"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  fetchCompanies,
  generateInvoice,
  fetchInvoices,
  updateInvoiceStatus,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./invoice.module.css";

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export default function InvoicePage() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getMonthValue());
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState(null);

  useEffect(() => {
    const loadCompanies = async () => {
      setStatus("loading");
      try {
        const data = await fetchCompanies();
        const activeCompanies = data.filter((c) => c.active !== false);
        setCompanies(activeCompanies);
        if (activeCompanies.length > 0) {
          setSelectedCompany(activeCompanies[0].company_id);
        }
        setStatus("success");
      } catch (err) {
        setError("Failed to load companies");
        setStatus("error");
      }
    };

    loadCompanies();
  }, []);

  useEffect(() => {
    const loadInvoices = async () => {
      if (!selectedCompany) return;

      setStatus("loading");
      setError("");
      try {
        const data = await fetchInvoices(selectedCompany);
        setInvoices(data);
        setStatus("success");
      } catch (err) {
        setError("Failed to load invoices");
        setStatus("error");
      }
    };

    loadInvoices();
  }, [selectedCompany]);

  const handleGenerateInvoice = async () => {
    if (!selectedCompany || !selectedMonth) {
      setError("Please select a company and month");
      return;
    }

    setError("");
    setMessage("");
    setStatus("loading");

    try {
      await generateInvoice(selectedCompany, selectedMonth);
      setMessage("Invoice generated successfully");
      const data = await fetchInvoices(selectedCompany);
      setInvoices(data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Failed to generate invoice");
      setStatus("error");
    }
  };

  const handleUpdateStatus = async (invoiceId, newStatus) => {
    setError("");
    setMessage("");

    try {
      await updateInvoiceStatus(invoiceId, newStatus);
      setMessage(`Invoice marked as ${newStatus}`);
      const data = await fetchInvoices(selectedCompany);
      setInvoices(data);
    } catch (err) {
      setError("Failed to update invoice");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Billing</p>
          <h1>Invoice Management</h1>
          <p className={styles.lead}>
            Generate invoices, track billing, and manage payment status.
          </p>
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

      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.success}>{message}</div>}

      <section className={styles.grid}>
        <div className={styles.controls}>
          <h2>Generate Invoice</h2>

          <label className={styles.field}>
            Company
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="">Select a company</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.name}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Month
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </label>

          <button
            className={styles.primaryButton}
            onClick={handleGenerateInvoice}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Generating..." : "Generate Invoice"}
          </button>
        </div>

        <div className={styles.invoicesList}>
          <h2>Invoice History</h2>

          {invoices.length === 0 ? (
            <p className={styles.empty}>No invoices yet</p>
          ) : (
            <div className={styles.invoices}>
              {invoices.map((invoice) => (
                <div
                  key={invoice.invoice_id}
                  className={styles.invoiceCard}
                >
                  <div className={styles.invoiceHeader}>
                    <div>
                      <p className={styles.invoiceId}>{invoice.invoice_id}</p>
                      <p className={styles.invoicePeriod}>{invoice.period}</p>
                    </div>
                    <div className={styles.invoiceAmount}>
                      <p className={styles.totalAmount}>
                        ₹{invoice.total?.toLocaleString() || 0}
                      </p>
                      <span
                        className={`${styles.badge} ${styles[
                          `badge-${invoice.status || "draft"}`
                        ]}`}
                      >
                        {invoice.status || "draft"}
                      </span>
                    </div>
                  </div>

                  {expandedInvoice === invoice.invoice_id && (
                    <div className={styles.invoiceDetails}>
                      <div className={styles.detailsSection}>
                        <h4>Breakdown</h4>
                        <div className={styles.lineItems}>
                          {invoice.line_items?.length === 0 ? (
                            <p className={styles.empty}>
                              No entries for this period
                            </p>
                          ) : (
                            <>
                              {invoice.line_items?.map((item, idx) => (
                                <div key={idx} className={styles.lineItem}>
                                  <span>
                                    {item.cab_type} - {item.slot}
                                  </span>
                                  <span>₹{item.amount?.toLocaleString()}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>

                        <div className={styles.totals}>
                          <div className={styles.totalRow}>
                            <span>Subtotal</span>
                            <span>
                              ₹{invoice.subtotal?.toLocaleString() || 0}
                            </span>
                          </div>
                          <div className={styles.totalRow}>
                            <span>Tax (18% GST)</span>
                            <span>₹{invoice.tax?.toLocaleString() || 0}</span>
                          </div>
                          <div className={styles.totalRow + " " + styles.final}>
                            <span>Total</span>
                            <span>
                              ₹{invoice.total?.toLocaleString() || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {invoice.status !== "paid" && (
                        <div className={styles.actions}>
                          <button
                            className={styles.secondaryButton}
                            onClick={() =>
                              handleUpdateStatus(
                                invoice.invoice_id,
                                "issued"
                              )
                            }
                          >
                            Mark as Issued
                          </button>
                          <button
                            className={styles.primaryButton}
                            onClick={() =>
                              handleUpdateStatus(invoice.invoice_id, "paid")
                            }
                          >
                            Mark as Paid
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    className={styles.expandButton}
                    onClick={() =>
                      setExpandedInvoice(
                        expandedInvoice === invoice.invoice_id
                          ? null
                          : invoice.invoice_id
                      )
                    }
                  >
                    {expandedInvoice === invoice.invoice_id
                      ? "Hide Details"
                      : "View Details"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
