"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchCompanies, fetchEntries, isFirebaseConfigured } from "@/lib/api";
import styles from "./entries.module.css";

export default function EntriesPage() {
  const [entries, setEntries] = useState([]);
  const [company, setCompany] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");

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

  useEffect(() => {
    const loadCompanies = async () => {
      setCompanyStatus("loading");
      try {
        const data = await fetchCompanies();
        setCompanies(data.filter((entry) => entry.active !== false));
        setCompanyStatus("success");
      } catch (err) {
        setCompanyStatus("error");
      }
    };

    loadCompanies();
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Ride entries</p>
          <h1>Daily Entry Desk</h1>
          <p className={styles.lead}>
            Review, filter, and export rides across corporate companies.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.primaryCta} href="/entries/new">
            New Entry
          </Link>
        </div>
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
            <option value="all">All Companies</option>
            {companies.map((companyItem) => (
              <option key={companyItem.company_id} value={companyItem.name}>
                {companyItem.name}
              </option>
            ))}
          </select>
          {companyStatus === "loading" && (
            <span className={styles.helper}>Loading companies...</span>
          )}
          {companyStatus === "error" && (
            <span className={styles.helperError}>
              Unable to load companies.
            </span>
          )}
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
