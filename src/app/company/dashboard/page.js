"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MonthPicker from "@/app/entries/MonthPicker";
import { fetchBookingRequests, fetchCompanies, updateBookingRequest } from "@/lib/api";
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
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
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
              month,
              orderByField: "created_at",
              orderByDirection: "desc",
            })
          )
        );
        const flattened = allRequests
          .flat()
          .sort((a, b) =>
            String(b.entry_date || "").localeCompare(String(a.entry_date || ""))
          );
        setMyRequests(flattened);
        setMyRequestsStatus("success");
      } catch (requestError) {
        console.error("Failed to load booking requests:", requestError);
        setMyRequestsStatus("error");
      }
    };

    loadMyRequests();
  }, [companies, month]);

  const getStatusClassName = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "submitted") return `${styles.status} ${styles.submitted}`;
    if (normalized === "accepted") return `${styles.status} ${styles.accepted}`;
    if (normalized === "allotted") return `${styles.status} ${styles.allotted}`;
    if (normalized === "cancelled") return `${styles.status} ${styles.cancelled}`;
    if (normalized === "rejected") return `${styles.status} ${styles.rejected}`;
    return styles.status;
  };

  const handleCancelRequest = (request) => {
    const requestId = String(request?.booking_id || "").trim();
    if (!requestId) return;
    setPendingCancelRequest(request);
  };

  const confirmCancelRequest = async () => {
    const request = pendingCancelRequest;
    const requestId = String(request?.booking_id || "").trim();
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
      await updateBookingRequest(requestId, {
        status: "cancelled",
      });
      setMyRequests((prev) =>
        prev.map((row) =>
          row.booking_id === requestId
            ? {
                ...row,
                status: "cancelled",
                status_detail: "Request was cancelled by the requester.",
              }
            : row
        )
      );
      setActionMessage("Booking request cancelled.");
      setPendingCancelRequest(null);
    } catch (cancelError) {
      setError(cancelError.message || "Failed to cancel booking request.");
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
        <section className={styles.filters}>
          <label className={styles.field}>
            Month
            <MonthPicker value={month} onChange={setMonth} />
          </label>
        </section>
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
              <span>Route</span>
              <span>Cab / Slot</span>
              <span>Vehicle Number</span>
              <span>Driver</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {myRequests.slice(0, 12).map((request) => (
              <div key={request.booking_id} className={styles.requestRow}>
                <span data-label="Trip">
                  {request.entry_date || "-"} {request.start_time || ""}
                </span>
                <span data-label="Route" className={styles.routeCell}>
                  {request.pickup_location || "-"} → {request.drop_location || "-"}
                </span>
                <span data-label="Cab / Slot">
                  {request.cab_type || "-"} / {request.slot || "-"}
                </span>
                <span data-label="Vehicle Number">
                  {request.allotted_vehicle_number || "-"}
                </span>
                <span data-label="Driver">
                  {request.allotted_driver_name || "-"} /{" "}
                  {request.allotted_driver_number || request.allotted_driver_phone || "-"}
                </span>
                <span data-label="Status">
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
                <span data-label="Actions">
                  {request.status === "submitted" ? (
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editBtn}
                        href={`/company/bookings/edit?id=${encodeURIComponent(request.booking_id)}`}
                        title="Edit"
                        aria-label="Edit"
                      >
                        <span className={styles.editIcon}>✎</span>
                      </Link>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => handleCancelRequest(request)}
                        disabled={actionRequestId === request.booking_id}
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
              Do you want to cancel this submitted request for{" "}
              <strong>{pendingCancelRequest.entry_date || "-"}</strong>{" "}
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
                disabled={actionRequestId === pendingCancelRequest.booking_id}
              >
                {actionRequestId === pendingCancelRequest.booking_id ? "Cancelling..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
