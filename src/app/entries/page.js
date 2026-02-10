"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchEntries, isFirebaseConfigured } from "@/lib/api";
import styles from "./entries.module.css";

export default function EntriesPage() {
  const [entries, setEntries] = useState([]);
  const [company, setCompany] = useState("all");
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchEntries({
          company: company === "all" ? "" : company,
          month,
        });
        setEntries(data);
        setStatus("success");
      } catch (err) {
        setError(err.message || "Unable to load entries.");
        setStatus("error");
      }
    };

    load();
  }, [company, month]);

  const companies = useMemo(() => {
    const names = new Set(entries.map((entry) => entry.company_name));
    return ["all", ...Array.from(names)];
  }, [entries]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Ride entries</p>
          <h1>Daily Entry Desk</h1>
          <p className={styles.lead}>
            Review, filter, and export rides across corporate companies.
          </p>
        </div>
        <Link className={styles.primaryCta} href="/entries/new">
          New Entry
        </Link>
      </header>

      {!isFirebaseConfigured && (
        <div className={styles.notice}>
          Add Firebase config to
          <span className={styles.noticeHighlight}>
            NEXT_PUBLIC_FIREBASE_*
          </span>
          to load live data.
        </div>
      )}

      <section className={styles.filters}>
        <label className={styles.field}>
          Company
          <select
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          >
            {companies.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "All Companies" : name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Month
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </section>

      <section className={styles.tableWrap}>
        {status === "loading" && <p>Loading entries...</p>}
        {status === "error" && <p className={styles.error}>{error}</p>}
        {status === "success" && entries.length === 0 && (
          <p>No entries yet. Add the first ride entry.</p>
        )}
        {entries.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Cab Type</th>
                <th>Slot</th>
                <th>Route</th>
                <th>Driver</th>
                <th>Vehicle</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td>{entry.entry_date}</td>
                  <td>{entry.company_name}</td>
                  <td>{entry.cab_type}</td>
                  <td>{entry.slot}</td>
                  <td>
                    {entry.pickup_location} → {entry.drop_location}
                  </td>
                  <td>{entry.driver_name}</td>
                  <td>{entry.vehicle_number}</td>
                  <td>{entry.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
