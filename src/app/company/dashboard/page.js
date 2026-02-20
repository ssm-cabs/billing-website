"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteBookingRequest, fetchBookingRequests, fetchCompanies } from "@/lib/api";
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
  const [myRequests, setMyRequests] = useState([]);
  const [myRequestsStatus, setMyRequestsStatus] = useState("idle");
  const [actionRequestId, setActionRequestId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [pendingCancelRequest, setPendingCancelRequest] = useState(null);

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

  const getStatusClassName = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "submitted") return `${styles.status} ${styles.submitted}`;
    if (normalized === "acknowledged") return `${styles.status} ${styles.acknowledged}`;
    if (normalized === "allotted") return `${styles.status} ${styles.allotted}`;
    if (normalized === "rejected") return `${styles.status} ${styles.rejected}`;
    return styles.status;
  };

  const handleCancelRequest = (request) => {
    const requestId = String(request?.request_id || "").trim();
    if (!requestId) return;
    setPendingCancelRequest(request);
  };

  const confirmCancelRequest = async () => {
    const request = pendingCancelRequest;
    const requestId = String(request?.request_id || "").trim();
    if (!requestId) return;
    if (String(request?.status || "").trim().toLowerCase() !== "submitted") {
      setError("Only submitted requests can be cancelled.");
      setPendingCancelRequest(null);
      return;
    }

    setActionRequestId(requestId);
    setActionMessage("");
    setError("");

    try {
      await deleteBookingRequest(requestId);
      setMyRequests((prev) => prev.filter((row) => row.request_id !== requestId));
      setActionMessage("Booking request deleted.");
      setPendingCancelRequest(null);
    } catch (cancelError) {
      setError(cancelError.message || "Failed to delete booking request.");
    } finally {
      setActionRequestId("");
    }
  };

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
        <Link className={styles.primaryCta} href="/company/bookings/new">
          New Booking
        </Link>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Booking Requests</h3>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {myRequestsStatus === "loading" && <p className={styles.empty}>Loading requests...</p>}
        {myRequestsStatus === "error" && (
          <p className={styles.error}>Unable to load your booking requests.</p>
        )}
        {actionMessage && <p className={styles.success}>{actionMessage}</p>}
        {myRequestsStatus !== "loading" && myRequests.length === 0 && (
          <p className={styles.empty}>No booking requests raised yet.</p>
        )}
        {myRequests.length > 0 && (
          <div className={styles.table}>
            <div className={styles.requestHeader}>
              <span>Trip</span>
              <span>Company</span>
              <span>Route</span>
              <span>Cab / Slot</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {myRequests.slice(0, 12).map((request) => (
              <div key={request.request_id} className={styles.requestRow}>
                <span>
                  {request.trip_date || "-"} {request.start_time || ""}
                </span>
                <span>{request.company_name || "-"}</span>
                <span>
                  {request.pickup_location || "-"} → {request.drop_location || "-"}
                </span>
                <span>
                  {request.cab_type || "-"} / {request.slot || "-"}
                </span>
                <span>
                  <span
                    className={`${getStatusClassName(request.status)} ${styles.statusWithTooltip}`}
                  >
                    {request.status || "-"}
                    {request.status_detail ? (
                      <span className={styles.statusTooltip}>
                        {request.status_detail}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span>
                  {request.status === "submitted" ? (
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editBtn}
                        href={`/company/bookings/edit?id=${encodeURIComponent(request.request_id)}`}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <span className={styles.editIcon}>✎</span>
                      </Link>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => handleCancelRequest(request)}
                        disabled={actionRequestId === request.request_id}
                        title="Cancel"
                        aria-label="Cancel"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    "-"
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingCancelRequest ? (
        <div className={styles.modalOverlay} onClick={() => setPendingCancelRequest(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.modalTitle}>Cancel Booking Request</h3>
            <p className={styles.modalSubtitle}>
              Do you want to delete this submitted request for{" "}
              <strong>{pendingCancelRequest.trip_date || "-"}</strong>{" "}
              <strong>{pendingCancelRequest.start_time || ""}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPendingCancelRequest(null)}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={confirmCancelRequest}
                disabled={actionRequestId === pendingCancelRequest.request_id}
              >
                {actionRequestId === pendingCancelRequest.request_id ? "Cancelling..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
