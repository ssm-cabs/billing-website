"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "@/app/entries/MonthPicker";
import {
  fetchEntryUpdateRequests,
  getEntryUpdateRequestStatusCatalog,
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

export default function EntryUpdateRequestsPage() {
  const { canView, loading: permissionsLoading } = usePermissions("entries");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
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
  const statusDetailByKey = useMemo(() => {
    const catalog = getEntryUpdateRequestStatusCatalog();
    return catalog.reduce((acc, item) => {
      const key = String(item.status || "").trim().toLowerCase();
      if (!key) return acc;
      acc[key] = String(item.detail || "").trim();
      return acc;
    }, {});
  }, []);

  const getStatusClassName = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "submitted") return `${styles.status} ${styles.submitted}`;
    if (normalized === "approved") return `${styles.status} ${styles.approved}`;
    if (normalized === "rejected") return `${styles.status} ${styles.rejected}`;
    return styles.status;
  };

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchEntryUpdateRequests({
          month,
          orderByField: "updated_at",
          orderByDirection: "desc",
          limitCount: 500,
        });
        const sorted = data
          .slice()
          .sort(
            (left, right) =>
              toTimestamp(right.updated_at || right.created_at) -
              toTimestamp(left.updated_at || left.created_at)
          );
        setRequests(sorted);
        setStatus("success");
      } catch (loadError) {
        setStatus("error");
        setError(loadError.message || "Unable to load update requests.");
      }
    };

    load();
  }, [month]);

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

  if (!isDashboardUser) {
    return (
      <div className={styles.page}>
        <Link className={styles.backLink} href="/entries">
          ← Back to Entries
        </Link>
        <p className={styles.error}>Only dashboard users can view update request lists.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries">
            ← Back to Entries
          </Link>
          <p className={styles.eyebrow}>Entry Updates</p>
          <h1>Entry Update Requests</h1>
          <p className={styles.lead}>
            Review all submitted update requests and open the differences view.
          </p>
        </div>
      </header>

      <section className={styles.filters}>
        <label className={styles.field}>
          Month
          <MonthPicker value={month} onChange={setMonth} />
        </label>
      </section>

      <section className={styles.tableWrap}>
        {status === "loading" && <p>Loading requests...</p>}
        {status === "error" && <p className={styles.error}>{error}</p>}
        {status === "success" && requests.length === 0 && (
          <p>No update requests found for selected month.</p>
        )}

        {requests.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Updated At</th>
                <th>Entry Date</th>
                <th>Entry ID</th>
                <th>Vehicle</th>
                <th>Requested By</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.entry_update_id}>
                  <td data-label="Updated At">
                    {formatTimestamp(request.updated_at || request.created_at)}
                  </td>
                  <td data-label="Entry Date">{request.entry_date || "-"}</td>
                  <td data-label="Entry ID">{request.entry_id || "-"}</td>
                  <td data-label="Vehicle">{request.vehicle_number || "-"}</td>
                  <td data-label="Requested By">{request.user_name || request.requested_by || "-"}</td>
                  <td data-label="Status">
                    <span
                      className={`${getStatusClassName(request.status)} ${styles.statusWithTooltip}`}
                    >
                      {request.status || "-"}
                      {statusDetailByKey[String(request.status || "").trim().toLowerCase()] ? (
                        <span className={styles.statusTooltip}>
                          {statusDetailByKey[String(request.status || "").trim().toLowerCase()]}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td data-label="Action">
                    <Link
                      className={styles.viewBtn}
                      href={`/entries/update-requests/differences?id=${encodeURIComponent(
                        request.entry_update_id
                      )}`}
                    >
                      View Differences
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}
