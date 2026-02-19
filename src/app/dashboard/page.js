"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  countActiveCompanies,
  countActiveVehicles,
  countEntriesByMonth,
  countInvoices,
  countUsers,
  fetchEntries,
  isFirebaseConfigured,
} from "@/lib/api";
import { getUserData } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { canViewCollection } from "@/lib/usePermissions";
import { MODULES } from "@/config/modules";
import { normalizeRole } from "@/lib/roleRouting";
import styles from "./dashboard.module.css";

const QUICK_ACTION_ICON_META = {
  entries: { accent: "#8f5a3c", bg: "#f8eee6" },
  revenue: { accent: "#2b7a53", bg: "#e8f6ef" },
  companies: { accent: "#4d5c9a", bg: "#eef1fb" },
  vehicles: { accent: "#8f5a3c", bg: "#f8eee6" },
  payments: { accent: "#00707a", bg: "#e8f7f8" },
  invoices: { accent: "#6a4d9b", bg: "#f1ecfb" },
  users: { accent: "#9a4a6f", bg: "#fbeef5" },
};

function QuickActionIcon({ moduleId }) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (moduleId) {
    case "entries":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1" {...sharedProps} />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" {...sharedProps} />
          <path d="M9 12v-1h6v1" {...sharedProps} />
          <path d="M11 17h2" {...sharedProps} />
          <path d="M12 11v6" {...sharedProps} />
        </svg>
      );
    case "revenue":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" {...sharedProps} />
          <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" {...sharedProps} />
          <path d="m2 16 6 6" {...sharedProps} />
          <circle cx="16" cy="9" r="2.9" {...sharedProps} />
          <circle cx="6" cy="5" r="3" {...sharedProps} />
        </svg>
      );
    case "companies":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 12h4" {...sharedProps} />
          <path d="M10 8h4" {...sharedProps} />
          <path d="M14 21v-3a2 2 0 0 0-4 0v3" {...sharedProps} />
          <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" {...sharedProps} />
          <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" {...sharedProps} />
        </svg>
      );
    case "vehicles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" {...sharedProps} />
          <path d="M7 14h.01" {...sharedProps} />
          <path d="M17 14h.01" {...sharedProps} />
          <rect x="3" y="10" width="18" height="8" rx="2" {...sharedProps} />
          <path d="M5 18v2" {...sharedProps} />
          <path d="M19 18v2" {...sharedProps} />
        </svg>
      );
    case "payments":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" {...sharedProps} />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" {...sharedProps} />
        </svg>
      );
    case "invoices":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" {...sharedProps} />
          <path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" {...sharedProps} />
          <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" {...sharedProps} />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" {...sharedProps} />
          <path d="M16 3.128a4 4 0 0 1 0 7.744" {...sharedProps} />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" {...sharedProps} />
          <circle cx="9" cy="7" r="4" {...sharedProps} />
        </svg>
      );
    default:
      return null;
  }
}

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const RECENT_ENTRY_ROW_LIMIT = 6;

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
  const [usersCount, setUsersCount] = useState(0);
  const [invoicesCount, setInvoicesCount] = useState(0);
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

      try {
        const userData = user.phoneNumber ? await getUserData(user.phoneNumber) : null;
        if (normalizeRole(userData?.role) === "driver") {
          setIsLoading(false);
          router.push("/driver/dashboard");
          return;
        }
      } catch (error) {
        console.error("Failed to load user role:", error);
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
        const [
          companiesData,
          vehiclesData,
          entriesCountData,
          usersCountData,
          invoicesCountData,
          recentEntriesData,
        ] = await Promise.all([
          countActiveCompanies(),
          countActiveVehicles(),
          countEntriesByMonth(monthValue),
          countUsers(),
          countInvoices(),
          fetchEntries({ orderByField: "created_at", orderByDirection: "desc", limitCount: 6 }),
        ]);
        setCompaniesCount(companiesData);
        setVehiclesCount(vehiclesData);
        setEntriesCount(entriesCountData);
        setUsersCount(usersCountData);
        setInvoicesCount(invoicesCountData);
        setEntries(recentEntriesData);
        setStatus("success");
      } catch (err) {
        console.error("Dashboard data loading error:", err);
        setStatus("error");
      }
    };

    loadData();
  }, [isAuthenticated, isLoading]);

  const recentEntries = entries.slice(0, RECENT_ENTRY_ROW_LIMIT);
  const paddedRecentEntries = [
    ...recentEntries,
    ...Array(Math.max(0, RECENT_ENTRY_ROW_LIMIT - recentEntries.length)).fill(null),
  ];

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
          <p>Total invoices</p>
          <h2>{invoicesCount}</h2>
          <span>All time</span>
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
        <div className={styles.card}>
          <p>Active users</p>
          <h2>{usersCount}</h2>
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
              {paddedRecentEntries.map((entry, index) =>
                entry ? (
                  <div key={entry.entry_id} className={styles.tableRow}>
                    <span>{formatDate(entry.entry_date)}</span>
                    <span>{entry.company_name}</span>
                    <span>
                      {entry.pickup_location} → {entry.drop_location}
                    </span>
                  </div>
                ) : (
                  <div
                    key={`recent-entry-placeholder-${index}`}
                    className={`${styles.tableRow} ${styles.tableRowPlaceholder}`}
                    aria-hidden="true"
                  >
                    <span>—</span>
                    <span>—</span>
                    <span>—</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div className={`${styles.panel} ${styles.quickActionsPanel}`}>
          <div className={styles.panelHeader}>
            <h3>Quick actions</h3>
          </div>
          <div className={styles.actions}>
            {MODULES.filter((module) => canViewCollection(module.id))
              .sort((a, b) => {
                const order = ["entries", "revenue", "companies", "vehicles", "payments", "invoices", "users"];
                return order.indexOf(a.id) - order.indexOf(b.id);
              })
              .map((module) => {
                const iconTheme =
                  QUICK_ACTION_ICON_META[module.id] || QUICK_ACTION_ICON_META.entries;
                return (
                <Link
                  key={module.id}
                  href={module.path}
                  className={styles.actionCard}
                  style={{
                    "--action-accent": iconTheme.accent,
                    "--action-bg": iconTheme.bg,
                  }}
                >
                  <span className={styles.actionIcon} aria-hidden="true">
                    <QuickActionIcon moduleId={module.id} />
                  </span>
                  <span className={styles.actionBody}>
                    <span className={styles.actionTitle}>{module.name}</span>
                    <span className={styles.actionDescription}>{module.description}</span>
                  </span>
                </Link>
              )})}
          </div>
        </div>
      </section>
    </div>
  );
}
