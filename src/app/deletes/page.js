"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { useAuth } from "@/lib/useAuth";
import { fetchDeletedDocuments } from "@/lib/deletesApi";
import styles from "./deletes.module.css";

function formatDateTime(value) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleString();
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString();
  }
  return String(value);
}

export default function DeletesPage() {
  const { loading: authLoading, isAuthenticated } = useAuth({
    requireAdmin: true,
    redirectTo: "/dashboard",
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useSessionTimeout();

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const loadDeletedRecords = async () => {
      setLoading(true);
      try {
        const data = await fetchDeletedDocuments(300);
        setRecords(data);
        setError("");
      } catch (err) {
        console.error("Error loading deleted records:", err);
        setError("Failed to load deleted records");
      } finally {
        setLoading(false);
      }
    };

    loadDeletedRecords();
  }, [authLoading, isAuthenticated]);

  const sourceTypes = useMemo(() => {
    const types = Array.from(
      new Set(records.map((record) => record.source_type).filter(Boolean))
    );
    return ["all", ...types];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return records.filter((record) => {
      if (sourceTypeFilter !== "all" && record.source_type !== sourceTypeFilter) {
        return false;
      }

      if (!query) return true;
      const haystack = [
        record.source_type,
        record.source_collection,
        record.source_path,
        record.source_doc_id,
        record.deleted_by?.name,
        record.deleted_by?.phone,
        record.deleted_by?.role,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [records, searchTerm, sourceTypeFilter]);

  if (authLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <UserSession />
      </div>

      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Admin</p>
          <h1>Deletes</h1>
          <p className={styles.lead}>
            Audit trail of deleted documents, including who deleted them and when.
          </p>
        </div>
      </header>

      <section className={styles.filters}>
        <label>
          Source Type
          <select
            value={sourceTypeFilter}
            onChange={(e) => setSourceTypeFilter(e.target.value)}
          >
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All" : type}
              </option>
            ))}
          </select>
        </label>

        <label>
          Search
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by source, id, or deleted by"
          />
        </label>
      </section>

      <section className={styles.content}>
        {loading && <p className={styles.loading}>Loading deleted records...</p>}
        {!loading && error && <p className={styles.error}>{error}</p>}
        {!loading && !error && filteredRecords.length === 0 && (
          <p className={styles.empty}>No deleted records found.</p>
        )}

        {!loading && !error && filteredRecords.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Deleted At</th>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Deleted By</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.delete_id}>
                    <td>{formatDateTime(record.deleted_at)}</td>
                    <td>{record.source_type || "-"}</td>
                    <td>
                      <div>{record.source_path || "-"}</div>
                      <small>ID: {record.source_doc_id || "-"}</small>
                    </td>
                    <td>
                      <div>{record.deleted_by?.name || "-"}</div>
                      <small>
                        {record.deleted_by?.phone || "-"} | {record.deleted_by?.role || "-"}
                      </small>
                    </td>
                    <td>
                      <details className={styles.payload}>
                        <summary>View</summary>
                        <pre>{JSON.stringify(record.payload || {}, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
