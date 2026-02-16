"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MonthPicker from "../entries/MonthPicker";
import {
  fetchCompanies,
  fetchEntries,
  fetchInvoicesByPeriod,
  fetchPayments,
  isFirebaseConfigured,
} from "@/lib/api";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { usePermissions } from "@/lib/usePermissions";
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

const getMonthMeta = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();
  return { year, month, totalDays };
};

export default function RevenuePage() {
  const router = useRouter();
  const { canView, loading: permissionsLoading } = usePermissions("revenue");
  const [month, setMonth] = useState(getMonthValue);
  const [entries, setEntries] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
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
    if (!isAuthenticated || isLoading || permissionsLoading || !canView) return;

    const loadEntries = async () => {
      setStatus("loading");
      setError("");
      try {
        const [entriesData, companiesData, paymentsData, invoicesData] = await Promise.all([
          fetchEntries({ month }),
          fetchCompanies(),
          fetchPayments({ month }),
          fetchInvoicesByPeriod(month),
        ]);
        setEntries(entriesData);
        setCompanies(companiesData);
        setPayments(paymentsData);
        setInvoices(invoicesData);
        setStatus("success");
      } catch (err) {
        setError(err.message || "Unable to load revenue data.");
        setStatus("error");
      }
    };

    loadEntries();
  }, [month, isAuthenticated, isLoading, permissionsLoading, canView]);

  const revenueStats = useMemo(() => {
    const { year, month: monthNumber, totalDays } = getMonthMeta(month);
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
    const daysElapsed = isCurrentMonth ? today.getDate() : totalDays;

    if (!entries.length) {
      const paidCompanyInvoices = invoices.filter(
        (invoice) =>
          String(invoice.invoice_type || "company") === "company" &&
          String(invoice.status || "").toLowerCase() === "paid"
      );
      const paidInvoiceAmount = paidCompanyInvoices.reduce(
        (sum, invoice) => sum + (Number(invoice.total) || 0),
        0
      );
      const paidPaymentsAmount = payments
        .filter((payment) => String(payment.status || "").toLowerCase() === "paid")
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

      return {
        totalRevenue: 0,
        totalEntries: 0,
        averageRevenuePerDay: 0,
        projectedRevenue: 0,
        paidInvoiceAmount,
        paidPaymentsAmount,
        netCashflow: paidInvoiceAmount - paidPaymentsAmount,
        daysElapsed,
        totalDays,
        topCompany: "-",
      };
    }

    const totalRevenue = entries.reduce(
      (sum, entry) => sum + (Number(entry.rate) || 0),
      0
    );
    const totalEntries = entries.length;
    const averageRevenuePerDay =
      totalRevenue > 0 ? totalRevenue / Math.max(1, daysElapsed) : 0;

    const revenueByCompany = entries.reduce((acc, entry) => {
      const name = entry.company_name || "Unknown";
      acc[name] = (acc[name] || 0) + (Number(entry.rate) || 0);
      return acc;
    }, {});

    const topCompany = Object.entries(revenueByCompany).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    const projectedRevenue =
      totalRevenue > 0
        ? (totalRevenue / Math.max(1, daysElapsed)) * totalDays
        : 0;
    const paidCompanyInvoices = invoices.filter(
      (invoice) =>
        String(invoice.invoice_type || "company") === "company" &&
        String(invoice.status || "").toLowerCase() === "paid"
    );
    const paidInvoiceAmount = paidCompanyInvoices.reduce(
      (sum, invoice) => sum + (Number(invoice.total) || 0),
      0
    );
    const paidPaymentsAmount = payments
      .filter((payment) => String(payment.status || "").toLowerCase() === "paid")
      .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return {
      totalRevenue,
      totalEntries,
      averageRevenuePerDay,
      projectedRevenue,
      paidInvoiceAmount,
      paidPaymentsAmount,
      netCashflow: paidInvoiceAmount - paidPaymentsAmount,
      daysElapsed,
      totalDays,
      topCompany,
    };
  }, [entries, invoices, month, payments]);

  const companyBreakdown = useMemo(() => {
    const revenueByCompany = entries.reduce((acc, entry) => {
      const name = entry.company_name || "Unknown";
      if (!acc[name]) {
        acc[name] = { name, rides: 0, revenue: 0, invoiceRaised: 0, invoicePaid: 0 };
      }
      acc[name].rides += 1;
      acc[name].revenue += Number(entry.rate) || 0;
      return acc;
    }, {});

    const companyInvoices = invoices.filter(
      (invoice) => String(invoice.invoice_type || "company") === "company"
    );

    companyInvoices.forEach((invoice) => {
      const invoiceCompanyName =
        invoice.company_name ||
        companies.find((company) => company.company_id === invoice.company_id)?.name ||
        invoice.company_id ||
        "Unknown";

      if (!revenueByCompany[invoiceCompanyName]) {
        revenueByCompany[invoiceCompanyName] = {
          name: invoiceCompanyName,
          rides: 0,
          revenue: 0,
          invoiceRaised: 0,
          invoicePaid: 0,
        };
      }

      const invoiceTotal = Number(invoice.total) || 0;
      revenueByCompany[invoiceCompanyName].invoiceRaised += invoiceTotal;
      if (String(invoice.status || "").toLowerCase() === "paid") {
        revenueByCompany[invoiceCompanyName].invoicePaid += invoiceTotal;
      }
    });

    const normalizedCompanies = companies.map((company) => {
      const name = company.name || company.company_id || "Unknown";
      return (
        revenueByCompany[name] || {
          name,
          rides: 0,
          revenue: 0,
          invoiceRaised: 0,
          invoicePaid: 0,
        }
      );
    });

    const knownNames = new Set(normalizedCompanies.map((item) => item.name));
    const additionalRows = Object.values(revenueByCompany).filter(
      (row) => !knownNames.has(row.name)
    );

    return [...normalizedCompanies, ...additionalRows].sort((a, b) => {
      if (b.invoicePaid !== a.invoicePaid) {
        return b.invoicePaid - a.invoicePaid;
      }
      return b.revenue - a.revenue;
    });
  }, [entries, companies, invoices]);

  const vehicleBreakdown = useMemo(() => {
    const revenueByVehicle = entries.reduce((acc, entry) => {
      const vehicleNumber = entry.vehicle_number || "Unknown";
      if (!acc[vehicleNumber]) {
        acc[vehicleNumber] = { vehicleNumber, rides: 0, revenue: 0 };
      }
      acc[vehicleNumber].rides += 1;
      acc[vehicleNumber].revenue += Number(entry.rate) || 0;
      return acc;
    }, {});

    return Object.values(revenueByVehicle).sort((a, b) => b.revenue - a.revenue);
  }, [entries]);

  const dailyRevenue = useMemo(() => {
    const { year, month: monthNumber, totalDays } = getMonthMeta(month);
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
    const daysElapsed = isCurrentMonth ? today.getDate() : totalDays;
    const totals = Array.from({ length: totalDays }, () => 0);

    entries.forEach((entry) => {
      if (!entry.entry_date) return;
      const parts = entry.entry_date.split("-");
      if (parts.length !== 3) return;
      const dayIndex = Number(parts[2]) - 1;
      if (Number.isNaN(dayIndex) || dayIndex < 0 || dayIndex >= totalDays) return;
      totals[dayIndex] += Number(entry.rate) || 0;
    });

    const totalRevenue = totals.reduce((sum, value) => sum + value, 0);
    const projectedPerDay =
      totalRevenue > 0 ? totalRevenue / Math.max(1, daysElapsed) : 0;
    const maxValue = Math.max(...totals, projectedPerDay, 1);
    const peakValue = Math.max(...totals, 0);
    const peakDay = totals.findIndex((value) => value === peakValue) + 1;
    const yTicks = [1, 0.75, 0.5, 0.25, 0].map((factor) => Math.round(maxValue * factor));
    const bars = totals.map((value, index) => {
      const day = index + 1;
      const date = new Date(year, monthNumber - 1, day);
      const weekday = date.toLocaleDateString("en-IN", { weekday: "short" });
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const heightPercent = (value / maxValue) * 100;
      return {
        day,
        weekday,
        value,
        isWeekend,
        heightPercent,
      };
    });

    return {
      totals,
      maxValue,
      bars,
      yTicks,
      peakDay,
      peakValue,
      projectedPerDay,
      daysElapsed,
      totalDays,
    };
  }, [entries, month]);

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

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!canView) {
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
            Track revenue, company collections, and operating spend in one place.
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
          <p>Ride entries</p>
          <h2>{revenueStats.totalEntries}</h2>
          <span>{getMonthLabel(month)}</span>
        </div>
        <div className={styles.card}>
          <p>Booked revenue</p>
          <h2>{formatCurrency(revenueStats.totalRevenue)}</h2>
          <span>{getMonthLabel(month)}</span>
        </div>
        <div className={styles.card}>
          <p>Avg booked / day</p>
          <h2>{formatCurrency(revenueStats.averageRevenuePerDay)}</h2>
          <span>{getMonthLabel(month)}</span>
        </div>
        <div className={styles.card}>
          <p>Projected booked</p>
          <h2>{formatCurrency(revenueStats.projectedRevenue)}</h2>
          <span>
            {revenueStats.daysElapsed} of {revenueStats.totalDays} days
          </span>
        </div>
        <div className={styles.card}>
          <p>Top company (booked)</p>
          <h2>{revenueStats.topCompany}</h2>
          <span>Highest booked revenue</span>
        </div>
        <div className={styles.card}>
          <p>Invoice paid</p>
          <h2>{formatCurrency(revenueStats.paidInvoiceAmount)}</h2>
          <span>Company invoices</span>
        </div>
        <div className={styles.card}>
          <p>Payments spent</p>
          <h2>{formatCurrency(revenueStats.paidPaymentsAmount)}</h2>
          <span>Paid records in payments</span>
        </div>
        <div className={styles.card}>
          <p>Net cashflow</p>
          <h2>{formatCurrency(revenueStats.netCashflow)}</h2>
          <span>Invoice paid - payments spent</span>
        </div>
      </section>

      <section className={styles.chartSection}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Daily revenue trend</h3>
            <span>{getMonthLabel(month)}</span>
          </div>
          {status === "error" && <p className={styles.error}>{error}</p>}
          {status === "success" && entries.length === 0 && (
            <p>No entries found for this month.</p>
          )}
          {dailyRevenue.totals.length > 0 && (
            <div className={styles.chartWrap}>
              <div className={styles.chartFrame}>
                <div className={styles.yAxis}>
                  {dailyRevenue.yTicks.map((tick, index) => (
                    <span key={`${tick}-${index}`}>{formatCurrency(tick)}</span>
                  ))}
                </div>
                <div className={styles.barsWrap}>
                  <div className={styles.barGrid} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.chartBars}>
                    {dailyRevenue.bars.map((bar) => (
                      <div key={bar.day} className={styles.barCol}>
                        <div
                          className={`${styles.bar} ${
                            bar.isWeekend ? styles.barWeekend : ""
                          }`}
                          style={{ height: `${bar.heightPercent}%` }}
                          title={`${bar.weekday}, Day ${bar.day}: ${formatCurrency(bar.value)}`}
                        />
                        <span className={styles.barDay}>{bar.day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.chartMeta}>
                <span>
                  Peak day: Day {dailyRevenue.peakDay} ({formatCurrency(dailyRevenue.peakValue)})
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={styles.chartSection}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Vehicle revenue</h3>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && (
            <p className={styles.error}>{error}</p>
          )}
          {status === "success" && vehicleBreakdown.length === 0 && (
            <p>No entries found for this month.</p>
          )}
          {vehicleBreakdown.length > 0 && (
            <div className={`${styles.table} ${styles.table3}`}>
              <div className={styles.tableHeader}>
                <span>Vehicle</span>
                <span>Rides</span>
                <span>Revenue</span>
              </div>
              {vehicleBreakdown.map((vehicle) => (
                <div key={vehicle.vehicleNumber} className={styles.tableRow}>
                  <span>{vehicle.vehicleNumber}</span>
                  <span>{vehicle.rides}</span>
                  <span>{formatCurrency(vehicle.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.chartSection}>
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
            <div className={`${styles.table} ${styles.table4}`}>
              <div className={styles.tableHeader}>
                <span>Company</span>
                <span>Rides</span>
                <span>Revenue</span>
                <span>Invoice paid</span>
              </div>
              {companyBreakdown.map((company) => (
                <div key={company.name} className={styles.tableRow}>
                  <span>{company.name}</span>
                  <span>{company.rides}</span>
                  <span>{formatCurrency(company.revenue)}</span>
                  <span>{formatCurrency(company.invoicePaid)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
