"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "../MonthPicker";
import CustomDropdown from "../CustomDropdown";
import { usePermissions } from "@/lib/usePermissions";
import {
  acceptBookingRequest,
  fetchBookingRequests,
  rejectBookingRequest,
} from "@/lib/api";
import styles from "./page.module.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "allotted", label: "Allotted" },
];

function getReviewerName() {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem("user_data");
    if (!stored) return "";
    const userData = JSON.parse(stored);
    return userData?.name || userData?.phone || userData?.user_id || "";
  } catch (_) {
    return "";
  }
}

export default function BookingRequestsPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [requests, setRequests] = useState([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [actionRequestId, setActionRequestId] = useState("");
  const [lastCreatedEntryId, setLastCreatedEntryId] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBookingRequests({
        status: statusFilter === "all" ? "" : statusFilter,
        month,
        orderByField: "created_at",
        orderByDirection: "desc",
      });
      setRequests(data);
    } catch (loadError) {
      setError(loadError.message || "Failed to load booking requests.");
    } finally {
      setLoading(false);
    }
  }, [month, statusFilter]);

  useEffect(() => {
    if (permissionsLoading || !canView) return;
    loadRequests();
  }, [loadRequests, permissionsLoading, canView]);

  const handleAccept = async (requestId) => {
    setActionRequestId(requestId);
    setMessage("");
    setError("");
    setLastCreatedEntryId("");

    try {
      const result = await acceptBookingRequest(requestId, getReviewerName());
      setLastCreatedEntryId(result.entry_id || "");
      setMessage("Request accepted and entry created. Allot a vehicle on that entry to move status to allotted.");
      await loadRequests();
    } catch (actionError) {
      setError(actionError.message || "Failed to accept request.");
    } finally {
      setActionRequestId("");
    }
  };

  const handleReject = async (requestId) => {
    if (!window.confirm("Reject this booking request? This will close the request flow.")) {
      return;
    }

    setActionRequestId(requestId);
    setMessage("");
    setError("");
    setLastCreatedEntryId("");

    try {
      await rejectBookingRequest(requestId, getReviewerName());
      setMessage("Request rejected.");
      await loadRequests();
    } catch (actionError) {
      setError(actionError.message || "Failed to reject request.");
    } finally {
      setActionRequestId("");
    }
  };

  const rows = useMemo(() => requests || [], [requests]);

  const getStatusClassName = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "submitted") return `${styles.status} ${styles.submitted}`;
    if (normalized === "accepted") return `${styles.status} ${styles.accepted}`;
    if (normalized === "allotted") return `${styles.status} ${styles.allotted}`;
    if (normalized === "cancelled") return `${styles.status} ${styles.cancelled}`;
    if (normalized === "rejected") return `${styles.status} ${styles.rejected}`;
    return styles.status;
  };

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <p>Loading permissions...</p>
      </div>
    );
  }

  if (!canView) {
    return null;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Booking requests</p>
          <h1>Review Booking Requests</h1>
          <p className={styles.lead}>
            Accept to create an entry. Reject to close the request.
          </p>
        </div>
      </header>

      <section className={styles.filters}>
        <label className={styles.field}>
          Month
          <MonthPicker value={month} onChange={setMonth} />
        </label>
        <label className={styles.field}>
          Status
          <CustomDropdown
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            getLabel={(option) => option.label}
            getValue={(option) => option.value}
            placeholder="Select status"
            defaultOption={null}
          />
        </label>
      </section>

      {message && <p className={styles.success}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {lastCreatedEntryId && (
        <p className={styles.info}>
          Entry created: {" "}
          <Link href={`/entries/edit?id=${encodeURIComponent(lastCreatedEntryId)}`}>
            {lastCreatedEntryId}
          </Link>
        </p>
      )}

      <section className={styles.tableWrap}>
        {loading && <p>Loading booking requests...</p>}
        {!loading && rows.length === 0 && <p>No booking requests found.</p>}
        {rows.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Trip</th>
                <th>Company</th>
                <th>Route</th>
                <th>Cab / Slot</th>
                <th>Requested By</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Entry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.booking_id}>
                  <td data-label="Trip">
                    {request.entry_date || "-"} {request.start_time || ""}
                  </td>
                  <td data-label="Company">{request.company_name || "-"}</td>
                  <td data-label="Route">
                    {request.pickup_location || "-"} → {request.drop_location || "-"}
                  </td>
                  <td data-label="Cab / Slot">
                    {request.cab_type || "-"} / {request.slot || "-"}
                  </td>
                  <td data-label="Requested By">{request.created_by || "-"}</td>
                  <td data-label="Notes">{request.notes || "-"}</td>
                  <td data-label="Status">
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
                  </td>
                  <td data-label="Entry">
                    {request.converted_entry_id ? (
                      <Link href={`/entries/edit?id=${encodeURIComponent(request.converted_entry_id)}`}>
                        {request.converted_entry_id}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td data-label="Actions">
                    {canEdit && request.status === "submitted" ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => handleAccept(request.booking_id)}
                          disabled={actionRequestId === request.booking_id}
                          className={styles.ackBtn}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(request.booking_id)}
                          disabled={actionRequestId === request.booking_id}
                          className={styles.rejectBtn}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
