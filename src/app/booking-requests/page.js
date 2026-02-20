"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/lib/usePermissions";
import {
  acknowledgeBookingRequest,
  fetchBookingRequests,
  rejectBookingRequest,
} from "@/lib/api";
import styles from "./page.module.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "rejected", label: "Rejected" },
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
        orderByField: "created_at",
        orderByDirection: "desc",
      });
      setRequests(data);
    } catch (loadError) {
      setError(loadError.message || "Failed to load booking requests.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (permissionsLoading || !canView) return;
    loadRequests();
  }, [loadRequests, permissionsLoading, canView]);

  const handleAcknowledge = async (requestId) => {
    setActionRequestId(requestId);
    setMessage("");
    setError("");
    setLastCreatedEntryId("");

    try {
      const result = await acknowledgeBookingRequest(requestId, getReviewerName());
      setLastCreatedEntryId(result.entry_id || "");
      setMessage("Request acknowledged and entry created. Allot a vehicle on that entry to move status to allotted.");
      await loadRequests();
    } catch (actionError) {
      setError(actionError.message || "Failed to acknowledge request.");
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
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Booking requests</p>
          <h1>Review Company Requests</h1>
          <p className={styles.lead}>
            Acknowledge to create an entry. Reject to close the request.
          </p>
        </div>
      </header>

      <section className={styles.filters}>
        <label className={styles.field}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
                <th>Status</th>
                <th>Status detail</th>
                <th>Entry</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.request_id}>
                  <td data-label="Trip">
                    {request.trip_date || "-"} {request.start_time || ""}
                  </td>
                  <td data-label="Company">{request.company_name || "-"}</td>
                  <td data-label="Route">
                    {request.pickup_location || "-"} → {request.drop_location || "-"}
                  </td>
                  <td data-label="Cab / Slot">
                    {request.cab_type || "-"} / {request.slot || "-"}
                  </td>
                  <td data-label="Status">{request.status || "-"}</td>
                  <td data-label="Status detail">{request.status_detail || "-"}</td>
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
                          onClick={() => handleAcknowledge(request.request_id)}
                          disabled={actionRequestId === request.request_id}
                          className={styles.ackBtn}
                        >
                          Ack
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(request.request_id)}
                          disabled={actionRequestId === request.request_id}
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
