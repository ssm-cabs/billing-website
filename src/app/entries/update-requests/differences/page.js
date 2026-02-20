"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  fetchEntryById,
  fetchEntryUpdateRequestById,
  updateEntryUpdateRequest,
} from "@/lib/api";
import { canAccessBackofficeDashboard } from "@/lib/roleRouting";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./page.module.css";

function toTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  return 0;
}

function formatTimestamp(value) {
  const timestamp = toTimestamp(value);
  if (!timestamp) return "-";
  try {
    return new Date(timestamp).toLocaleString();
  } catch (_) {
    return "-";
  }
}

function formatFieldLabel(fieldName) {
  return String(fieldName || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatValue(value) {
  if (value === "" || value === null || value === undefined) return "-";
  return String(value);
}

export default function EntryUpdateDifferencesPage() {
  const searchParams = useSearchParams();
  const requestId = String(searchParams.get("id") || "").trim();
  const { canView, loading: permissionsLoading } = usePermissions("entries");

  const [request, setRequest] = useState(null);
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [reviewStatus, setReviewStatus] = useState("idle");
  const [reviewMessage, setReviewMessage] = useState("");

  const isDashboardUser = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("user_data");
      if (!raw) return false;
      const userData = JSON.parse(raw);
      return canAccessBackofficeDashboard(userData?.role);
    } catch (_) {
      return false;
    }
  }, []);
  const reviewerName = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = localStorage.getItem("user_data");
      if (!raw) return "";
      const userData = JSON.parse(raw);
      return String(userData?.name || userData?.phone || "").trim();
    } catch (_) {
      return "";
    }
  }, []);

  useEffect(() => {
    if (!requestId) return;

    const load = async () => {
      setStatus("loading");
      setError("");

      try {
        const requestData = await fetchEntryUpdateRequestById(requestId);
        setRequest(requestData);

        try {
          const entryData = await fetchEntryById(requestData.entry_id);
          setEntry(entryData);
        } catch (_) {
          setEntry(null);
        }

        setStatus("success");
      } catch (loadError) {
        setStatus("error");
        setError(loadError.message || "Unable to load differences.");
      }
    };

    load();
  }, [requestId]);

  const diffRows = useMemo(() => {
    if (!request?.requested_updates || typeof request.requested_updates !== "object") {
      return [];
    }

    return Object.entries(request.requested_updates).map(([field, requestedValue]) => {
      const currentValue = entry ? entry[field] : undefined;
      const hasChanged = String(currentValue ?? "") !== String(requestedValue ?? "");
      return {
        field,
        currentValue,
        requestedValue,
        hasChanged,
      };
    });
  }, [entry, request]);

  const handleReview = async (nextStatus) => {
    if (!request?.entry_update_id) return;
    try {
      setReviewStatus(nextStatus);
      setReviewMessage("");
      await updateEntryUpdateRequest(request.entry_update_id, {
        status: nextStatus,
        reviewed_by: reviewerName,
      });
      setRequest((prev) => (
        prev
          ? {
              ...prev,
              status: nextStatus,
              reviewed_by: reviewerName,
              updated_at: Date.now(),
            }
          : prev
      ));
      setReviewMessage(
        nextStatus === "approved" ? "Request approved successfully." : "Request rejected successfully."
      );
    } catch (reviewError) {
      setReviewMessage(reviewError.message || "Failed to update request status.");
    } finally {
      setReviewStatus("idle");
    }
  };

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!canView) {
    return null;
  }

  if (!requestId) {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href="/entries/update-requests">
          ← Back to Update Requests
        </Link>
        <p className={styles.error}>Missing update request id.</p>
      </div>
    );
  }

  if (!isDashboardUser) {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href="/entries/update-requests">
          ← Back to Update Requests
        </Link>
        <p className={styles.error}>Only dashboard users can view differences.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries/update-requests">
            ← Back to Update Requests
          </Link>
          <p className={styles.eyebrow}>Entry Updates</p>
          <h1>Request Differences</h1>
          <p className={styles.lead}>
            Compare requested changes with current entry values.
          </p>
        </div>
      </header>

      {status === "loading" && <p>Loading differences...</p>}
      {status === "error" && <p className={styles.error}>{error}</p>}
      {reviewMessage ? (
        <p className={styles.success}>
          {reviewMessage}
        </p>
      ) : null}
      {request?.status === "approved" ? (
        <p className={styles.success}>
          This request is already approved.
        </p>
      ) : null}
      {request?.status === "rejected" ? (
        <p className={styles.error}>
          This request is already rejected.
        </p>
      ) : null}

      {request && request.status !== "approved" && request.status !== "rejected" ? (
        <section className={styles.actionBar}>
          <button
            type="button"
            className={styles.acceptBtn}
            onClick={() => handleReview("approved")}
            disabled={reviewStatus !== "idle"}
          >
            {reviewStatus === "approved" ? "Approving..." : "Accept"}
          </button>
          <button
            type="button"
            className={styles.rejectBtn}
            onClick={() => handleReview("rejected")}
            disabled={reviewStatus !== "idle"}
          >
            {reviewStatus === "rejected" ? "Rejecting..." : "Reject"}
          </button>
        </section>
      ) : null}

      {status === "success" && request ? (
        <>
          <section className={styles.card}>
            <h2>Request Summary</h2>
            <div className={styles.grid}>
              <p><strong>Request ID:</strong> {request.entry_update_id || "-"}</p>
              <p><strong>Status:</strong> {request.status || "-"}</p>
              <p><strong>Entry ID:</strong> {request.entry_id || "-"}</p>
              <p><strong>Entry Date:</strong> {request.entry_date || "-"}</p>
              <p><strong>Requested By:</strong> {request.user_name || request.requested_by || "-"}</p>
              <p><strong>Reviewed By:</strong> {request.reviewed_by || "-"}</p>
              <p><strong>Updated At:</strong> {formatTimestamp(request.updated_at || request.created_at)}</p>
            </div>
            {request.reason ? (
              <p className={styles.note}><strong>Reason:</strong> {request.reason}</p>
            ) : null}
            {request.review_note ? (
              <p className={styles.note}><strong>Review Note:</strong> {request.review_note}</p>
            ) : null}
          </section>

          <section className={styles.card}>
            <h2>Field Differences</h2>
            {diffRows.length === 0 ? (
              <p>No field-level changes found in this request.</p>
            ) : (
              <div className={styles.diffTableWrap}>
                <table className={styles.diffTable}>
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Current Value</th>
                      <th>Requested Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffRows.map((row) => (
                      <tr key={row.field} className={row.hasChanged ? styles.changedRow : ""}>
                        <td data-label="Field">{formatFieldLabel(row.field)}</td>
                        <td data-label="Current Value">{formatValue(row.currentValue)}</td>
                        <td data-label="Requested Value">{formatValue(row.requestedValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
