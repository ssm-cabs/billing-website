"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MonthPicker from "../entries/MonthPicker";
import { fetchEntries, isFirebaseConfigured } from "@/lib/api";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import styles from "./revenue.module.css";

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatCurrency = (value) => {
  if (!Number.isFinite(value)) return "-";
  return `₹${Math.round(value)}`;
};

const getMonthLabel = (monthValue) => {
  if (!monthValue) return "";
  const [year, month] = monthValue.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export default function RevenuePage() {
  const router = useRouter();
  const [month, setMonth] = useState(getMonthValue);
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useSessionTimeout();

  useEffect(() => {
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

    const loadEntries = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchEntries({ month });
        setEntries(data);
        setStatus("success");
      } catch (err) {
        setError(err.message || "Unable to load revenue data.");
        setStatus("error");
      }
    };

    loadEntries();
  }, [month, isAuthenticated, isLoading]);

  const revenueStats = useMemo(() => {
    if (!entries.length) {
      return {
        totalRevenue: 0,
        totalEntries: 0,
        averageRate: 0,
        topCompany: "-",
      };
    }

    const totalRevenue = entries.reduce(
      (sum, entry) => sum + (Number(entry.rate) || 0),
      0
    );
    const totalEntries = entries.length;
    const averageRate = totalEntries ? totalRevenue / totalEntries : 0;

    const revenueByCompany = entries.reduce((acc, entry) => {
      const name = entry.company_name || "Unknown";
      acc[name] = (acc[name] || 0) + (Number(entry.rate) || 0);
      return acc;
    }, {});

    const topCompany = Object.entries(revenueByCompany).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      totalRevenue,
      totalEntries,
      averageRate,
      topCompany,
    };
  }, [entries]);

  const companyBreakdown = useMemo(() => {
    const map = entries.reduce((acc, entry) => {
      const name = entry.company_name || "Unknown";
      if (!acc[name]) {
        acc[name] = { name, rides: 0, revenue: 0 };
      }
      acc[name].rides += 1;
      acc[name].revenue += Number(entry.rate) || 0;
      return acc;
    }, {});

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [entries]);

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
          <p className={styles.eyebrow}>Revenue</p>
          <h1>Monthly Revenue Snapshot</h1>
          <p className={styles.lead}>
            Track entry-based revenue by company and monitor ride volume.
          </p>
        </div>
        <div className={styles.headerActions}>
          <MonthPicker value={month} onChange={setMonth} />
        </div>
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
          <p>Total revenue</p>
          <h2>{formatCurrency(revenueStats.totalRevenue)}</h2>
          <span>{getMonthLabel(month)}</span>
        </div>
        <div className={styles.card}>
          <p>Total entries</p>
          <h2>{revenueStats.totalEntries}</h2>
          <span>{getMonthLabel(month)}</span>
        </div>
        <div className={styles.card}>
          <p>Average rate</p>
          <h2>{formatCurrency(revenueStats.averageRate)}</h2>
          <span>Per ride</span>
        </div>
        <div className={styles.card}>
          <p>Top company</p>
          <h2>{revenueStats.topCompany}</h2>
          <span>Highest revenue</span>
        </div>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Company revenue</h3>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && (
            <p className={styles.error}>{error}</p>
          )}
          {status === "success" && companyBreakdown.length === 0 && (
            <p>No entries found for this month.</p>
          )}
          {companyBreakdown.length > 0 && (
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span>Company</span>
                <span>Rides</span>
                <span>Revenue</span>
              </div>
              {companyBreakdown.map((company) => (
                <div key={company.name} className={styles.tableRow}>
                  <span>{company.name}</span>
                  <span>{company.rides}</span>
                  <span>{formatCurrency(company.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Revenue checklist</h3>
          </div>
          <div className={styles.checklist}>
            <div>
              <p className={styles.checkTitle}>Validate entries</p>
              <p className={styles.checkCopy}>
                Make sure all rides for {getMonthLabel(month)} are captured.
              </p>
            </div>
            <div>
              <p className={styles.checkTitle}>Review top clients</p>
              <p className={styles.checkCopy}>
                Compare company totals against targets and contracts.
              </p>
            </div>
            <div>
              <p className={styles.checkTitle}>Prep invoices</p>
              <p className={styles.checkCopy}>
                Move the month forward once entries look complete.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
