"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  countActiveCompanies,
  countActiveVehicles,
  countEntriesByMonth,
  fetchEntries,
  isFirebaseConfigured,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { canViewCollection } from "@/lib/usePermissions";
import { MODULES } from "@/config/modules";
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
  const router = useRouter();
  const [entries, setEntries] = useState([]);
  const [companiesCount, setCompaniesCount] = useState(0);
  const [vehiclesCount, setVehiclesCount] = useState(0);
  const [entriesCount, setEntriesCount] = useState(0);
  const [status, setStatus] = useState("idle");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Check session timeout - auto logout after 24 hours
  useSessionTimeout();

  useEffect(() => {
    // Check authentication on mount - wait for Firebase auth to initialize
    const checkAuth = async () => {
      const { waitForAuthInit } = await import("@/lib/phoneAuth");
      const user = await waitForAuthInit();
      
      if (!user) {
        setIsAuthenticated(false);
        setIsLoading(false);
        router.push("/login");
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const loadData = async () => {
      setStatus("loading");
      try {
        const monthValue = getMonthValue();
        const [companiesData, vehiclesData, entriesCountData, recentEntriesData] = await Promise.all([
          countActiveCompanies(),
          countActiveVehicles(),
          countEntriesByMonth(monthValue),
          fetchEntries({ orderByField: "created_at", orderByDirection: "desc", limitCount: 6 }),
        ]);
        setCompaniesCount(companiesData);
        setVehiclesCount(vehiclesData);
        setEntriesCount(entriesCountData);
        setEntries(recentEntriesData);
        setStatus("success");
      } catch (err) {
        console.error("Dashboard data loading error:", err);
        setStatus("error");
      }
    };

    loadData();
  }, [isAuthenticated, isLoading]);

  const recentEntries = entries;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Router will redirect to /login
  }

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <UserSession />
      </div>
      
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
            {MODULES.filter((module) => canViewCollection(module.id)).map((module) => (
              <Link key={module.id} href={module.path}>
                {module.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
