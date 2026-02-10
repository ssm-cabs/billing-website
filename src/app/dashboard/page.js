"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  countActiveCompanies,
  countActiveVehicles,
  countEntriesByMonth,
  fetchEntries,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./dashboard.module.css";

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") {
    const date = value.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value);
};

export default function DashboardPage() {
  const [entries, setEntries] = useState([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [entriesCount, setEntriesCount] = useState(0);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    const loadData = async () => {
      setStatus("loading");
      try {
        const monthValue = getMonthValue();
        const [companiesData, vehiclesData, entriesCountData, recentEntriesData] = await Promise.all([
          countActiveCompanies(),
          countActiveVehicles(),
          countEntriesByMonth(monthValue),
          fetchEntries({ month: monthValue, orderByField: "entry_date", orderByDirection: "desc", limitCount: 6 }),
        ]);
        setCompaniesCount(companiesData);
        setVehiclesCount(vehiclesData);
        setEntriesCount(entriesCountData);
        setEntries(recentEntriesData);
        setStatus("success");
      } catch (err) {
        setStatus("error");
      }
    };

    loadData();
  }, []);

  const recentEntries = entries;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Dashboard</p>
          <h1>Operations Overview</h1>
          <p className={styles.lead}>
            Track daily volume, active companies, and fleet readiness.
          </p>
        </div>
        <Link className={styles.primaryCta} href="/entries/new">
          New Entry
        </Link>
      </header>

      {!isFirebaseConfigured && (
        <div className={styles.notice}>
          Add Firebase config to
          <span className={styles.noticeHighlight}>NEXT_PUBLIC_FIREBASE_*</span>
          to load live data.
        </div>
      )}

      <section className={styles.stats}>
        <div className={styles.card}>
          <p>Entries this month</p>
          <h2>{entriesCount}</h2>
          <span>{getMonthValue()}</span>
        </div>
        <div className={styles.card}>
          <p>Active companies</p>
          <h2>{companiesCount}</h2>
          <span>Total count</span>
        </div>
        <div className={styles.card}>
          <p>Active vehicles</p>
          <h2>{vehiclesCount}</h2>
          <span>Total count</span>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Recent entries</h3>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && (
            <p className={styles.error}>Unable to load dashboard data.</p>
          )}
          {status === "success" && recentEntries.length === 0 && (
            <p>No entries yet. Create the first ride entry.</p>
          )}
          {recentEntries.length > 0 && (
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span>Date</span>
                <span>Company</span>
                <span>Route</span>
              </div>
              {recentEntries.map((entry) => (
                <div key={entry.entry_id} className={styles.tableRow}>
                  <span>{formatDate(entry.entry_date)}</span>
                  <span>{entry.company_name}</span>
                  <span>
                    {entry.pickup_location} → {entry.drop_location}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Quick actions</h3>
          </div>
          <div className={styles.actions}>
            <Link href="/entries/new">Add ride entry</Link>
            <Link href="/entries">Review entries</Link>
            <Link href="/companies">Manage companies</Link>
            <Link href="/vehicles">Manage vehicles</Link>
            <Link href="/invoice">View invoices</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
