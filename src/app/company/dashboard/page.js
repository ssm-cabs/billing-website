"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchBookingRequests, fetchCompanies } from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./page.module.css";

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCompanyIds(userData) {
  if (!Array.isArray(userData?.company_ids)) return [];
  return userData.company_ids.filter((id) => typeof id === "string" && id.trim());
}

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [myRequestsStatus, setMyRequestsStatus] = useState("idle");

  useSessionTimeout();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await waitForAuthInit();
      if (!user?.phoneNumber) {
        setIsLoading(false);
        router.push("/login");
        return;
      }

      try {
        const profile = await getUserData(user.phoneNumber);
        const role = normalizeRole(profile?.role);
        if (!isRole(role, "company")) {
          setIsLoading(false);
          router.push(getHomeRouteForRole(role));
          return;
        }
        setUserData(profile);
      } catch (err) {
        console.error("Failed to load company profile:", err);
        setIsLoading(false);
        router.push("/login");
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!userData) return;

    const loadCompanies = async () => {
      try {
        const allCompanies = await fetchCompanies();
        const allowedCompanyIds = new Set(getCompanyIds(userData));
        const linkedCompanies = allCompanies.filter((company) =>
          allowedCompanyIds.has(company.company_id)
        );
        setCompanies(linkedCompanies);
      } catch (err) {
        console.error("Failed to load company data:", err);
        setError("Unable to load your company details.");
      }
    };

    loadCompanies();
  }, [userData]);

  useEffect(() => {
    if (!companies.length) return;

    const loadMyRequests = async () => {
      setMyRequestsStatus("loading");
      try {
        const allRequests = await Promise.all(
          companies.map((company) =>
            fetchBookingRequests({
              companyId: company.company_id,
              orderByField: "created_at",
              orderByDirection: "desc",
            })
          )
        );
        const flattened = allRequests
          .flat()
          .sort((a, b) =>
            String(b.trip_date || "").localeCompare(String(a.trip_date || ""))
          );
        setMyRequests(flattened);
        setMyRequestsStatus("success");
      } catch (requestError) {
        console.error("Failed to load booking requests:", requestError);
        setMyRequestsStatus("error");
      }
    };

    loadMyRequests();
  }, [companies]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <UserSession />
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Company</p>
          <h1>Company Dashboard</h1>
          <p className={styles.lead}>
            Review your assigned company profile and raise new booking requests.
          </p>
        </div>
        <Link className={styles.primaryCta} href="/company/booking/new">
          New Booking
        </Link>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Booking Requests</h3>
        </div>
        {myRequestsStatus === "loading" && <p className={styles.empty}>Loading requests...</p>}
        {myRequestsStatus === "error" && (
          <p className={styles.error}>Unable to load your booking requests.</p>
        )}
        {myRequestsStatus !== "loading" && myRequests.length === 0 && (
          <p className={styles.empty}>No booking requests raised yet.</p>
        )}
        {myRequests.length > 0 && (
          <div className={styles.table}>
            <div className={styles.requestHeader}>
              <span>Trip</span>
              <span>Company</span>
              <span>Status</span>
              <span>Status Detail</span>
            </div>
            {myRequests.slice(0, 12).map((request) => (
              <div key={request.request_id} className={styles.requestRow}>
                <span>
                  {request.trip_date || "-"} {request.start_time || ""}
                </span>
                <span>{request.company_name || "-"}</span>
                <span>{request.status || "-"}</span>
                <span>{request.status_detail || "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
