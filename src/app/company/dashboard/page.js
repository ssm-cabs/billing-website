"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCompanies } from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./page.module.css";

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
        setCompanies(
          allCompanies.filter((company) => allowedCompanyIds.has(company.company_id))
        );
      } catch (err) {
        console.error("Failed to load company data:", err);
        setError("Unable to load your company details.");
      }
    };

    loadCompanies();
  }, [userData]);

  const companyCount = useMemo(() => companies.length, [companies]);

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
            Review your assigned company profile and billing details.
          </p>
        </div>
      </header>

      <section className={styles.stats}>
        <div className={styles.card}>
          <p>Linked companies</p>
          <h2>{companyCount}</h2>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Companies</h3>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {!error && companies.length === 0 && (
          <p className={styles.empty}>
            No companies are linked yet. Contact your administrator.
          </p>
        )}
        {companies.length > 0 && (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Company</span>
              <span>Billing Cycle</span>
              <span>Contact</span>
            </div>
            {companies.map((company) => (
              <div key={company.company_id} className={styles.tableRow}>
                <span>{company.name || "-"}</span>
                <span>{company.billing_cycle || "-"}</span>
                <span>{company.contact_name || "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

