"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import {
  fetchCompanies,
  generateInvoice,
  fetchInvoices,
  invoiceExists,
  updateInvoiceStatus,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./invoice.module.css";

const basePath = '/billing-website';

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const OUR_COMPANY = {
  name: "SSM Cabs",
  address: "No. 12, Anna Salai, Chennai, TN 600002",
  phone: "+91 44 4000 1234",
  email: "accounts@ssmcabs.com",
  bank_details: "Account: 000111222333 | SBI | IFSC: SBIN0001234",
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
  const [invoiceAlreadyExists, setInvoiceAlreadyExists] = useState(false);
  const [paymentNoteModal, setPaymentNoteModal] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

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

  useEffect(() => {
    const checkInvoiceExists = async () => {
      if (!selectedCompany || !selectedMonth) {
        setInvoiceAlreadyExists(false);
        return;
      }

      try {
        const exists = await invoiceExists(selectedCompany, selectedMonth);
        setInvoiceAlreadyExists(exists);
      } catch (err) {
        setInvoiceAlreadyExists(false);
      }
    };

    checkInvoiceExists();
  }, [selectedCompany, selectedMonth]);

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
      setShowGenerateConfirm(false);
    } catch (err) {
      setError(err.message || "Failed to generate invoice");
      setStatus("error");
    }
  };

  const handleUpdateStatus = async (invoiceId, newStatus, note = "") => {
    setError("");
    setMessage("");

    try {
      await updateInvoiceStatus(invoiceId, newStatus, note);
      setMessage(`Invoice marked as ${newStatus}`);
      setPaymentNoteModal(null);
      setPaymentNote("");
      const data = await fetchInvoices(selectedCompany);
      setInvoices(data);
    } catch (err) {
      setError("Failed to update invoice");
    }
  };

  const handleViewInvoice = () => {
    const invoiceId = `${selectedCompany}-${selectedMonth}`;
    setExpandedInvoice(invoiceId);
    // Scroll to the invoice section
    setTimeout(() => {
      const invoiceElement = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
      if (invoiceElement) {
        invoiceElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const handleExportPDF = async (invoice) => {
    const element = document.getElementById(`invoice-content-${invoice.invoice_id}`);
    if (!element) return;

    const previousStyles = {
      width: element.style.width,
      maxWidth: element.style.maxWidth,
      margin: element.style.margin,
      minHeight: element.style.minHeight,
    };

    element.style.width = "794px";
    element.style.maxWidth = "none";
    element.style.margin = "0";
    element.style.minHeight = "1122px";

    try {
      const renderScale = 1.5;
      const jpegQuality = 0.75;
      const canvas = await html2canvas(element, {
        scale: renderScale,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL("image/jpeg", jpegQuality);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const scale = maxWidth / canvas.width;
      const imgWidth = canvas.width * scale;
      const imgHeight = canvas.height * scale;
      const pageHeightPx = maxHeight / scale;

      if (imgHeight <= maxHeight) {
        pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight);
      } else {
        let y = 0;
        let pageIndex = 0;

        while (y < canvas.height) {
          const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;

          const pageContext = pageCanvas.getContext("2d");
          pageContext.drawImage(
            canvas,
            0,
            y,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight
          );

          const pageData = pageCanvas.toDataURL("image/jpeg", jpegQuality);
          if (pageIndex > 0) {
            pdf.addPage();
          }

          pdf.addImage(
            pageData,
            "JPEG",
            margin,
            margin,
            imgWidth,
            sliceHeight * scale
          );

          y += sliceHeight;
          pageIndex += 1;
        }
      }

      pdf.save(`${invoice.invoice_id}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF");
    } finally {
      element.style.width = previousStyles.width;
      element.style.maxWidth = previousStyles.maxWidth;
      element.style.margin = previousStyles.margin;
      element.style.minHeight = previousStyles.minHeight;
    }
  };

  const groupLineItemsByDate = (lineItems) => {
    const grouped = {};
    lineItems?.forEach((item) => {
      if (!grouped[item.date]) {
        grouped[item.date] = [];
      }
      grouped[item.date].push(item);
    });
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
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
            onClick={
              invoiceAlreadyExists ? handleViewInvoice : () => setShowGenerateConfirm(true)
            }
            disabled={status === "loading"}
          >
            {status === "loading"
              ? "Generating..."
              : invoiceAlreadyExists
              ? "View Invoice"
              : "Generate Invoice"}
          </button>
        </div>

        <div className={styles.invoicesList}>
          <h2>Invoice History</h2>

          {invoices.length === 0 ? (
            <p className={styles.empty}>No invoices yet</p>
          ) : (
            <div className={styles.invoices}>
              {invoices.map((invoice) => {
                const companyDetails =
                  companies.find(
                    (company) => company.company_id === invoice.company_id
                  ) || {};
                const invoiceToName =
                  invoice.company_name || companyDetails.name || "Company";
                const invoiceToAddress =
                  invoice.company_address || companyDetails.address || "";
                const invoiceToContact = companyDetails.contact_name || "";
                const invoiceToPhone = companyDetails.contact_phone || "";
                const invoiceToEmail =
                  invoice.company_email || companyDetails.email || "";
                const invoiceDate =
                  invoice.invoice_date ||
                  (invoice.created_at?.toDate
                    ? invoice.created_at.toDate().toISOString().slice(0, 10)
                    : "");

                return (
                <div
                  key={invoice.invoice_id}
                  data-invoice-id={invoice.invoice_id}
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
                    <div id={`invoice-content-${invoice.invoice_id}`} className={styles.invoiceDetails}>
                      <div className={styles.invoiceHeader}>
                        <div className={styles.invoiceAside}>
                          <img src={`${basePath}/logo.png`} alt="Company Logo" className={styles.logo} />
                          <div className={styles.ourDetails}>
                            <p>{OUR_COMPANY.name}</p>
                            <p>{OUR_COMPANY.address}</p>
                            <p>{OUR_COMPANY.phone}</p>
                            <p>{OUR_COMPANY.email}</p>
                          </div>
                        </div>
                        <div>
                          <p className={styles.period}>Invoice for {invoice.period}</p>
                        </div>
                      </div>

                      <div className={styles.billedTo}>
                        <p className={styles.billedLabel}>Billed To</p>
                        <h3>{invoiceToName}</h3>
                        {invoiceToAddress && (
                          <p className={styles.companyDetails}>{invoiceToAddress}</p>
                        )}
                        {(invoiceToContact || invoiceToPhone || invoiceToEmail) && (
                          <p className={styles.companyDetails}>
                            {[invoiceToContact, invoiceToPhone, invoiceToEmail]
                              .filter(Boolean)
                              .join(" | ")}
                          </p>
                        )}
                        <div className={styles.invoiceMetaInline}>
                          <p className={styles.invoiceNumber}>Invoice #: {invoice.invoice_id}</p>
                          {invoiceDate && (
                            <p className={styles.invoiceDate}>Date: {invoiceDate}</p>
                          )}
                        </div>
                      </div>

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
                                <div
                                  key={idx}
                                  className={styles.lineItem}
                                >
                                  <span className={styles.column}>{item.date}</span>
                                  <span className={styles.column}>{item.slot}</span>
                                  <span className={styles.column}>{item.cab_type}</span>
                                  <span className={styles.column}>{item.vehicle_number}</span>
                                  <span className={styles.column}>₹{item.rate}</span>
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

                      <div className={styles.footer}>
                        <div className={styles.footerSection}>
                          <p className={styles.footerLabel}>Our Details</p>
                          <p>{OUR_COMPANY.name}</p>
                          <p>{OUR_COMPANY.address}</p>
                          <p>{OUR_COMPANY.phone}</p>
                          <p>{OUR_COMPANY.email}</p>
                        </div>
                        <div className={styles.footerSection}>
                          <p className={styles.footerLabel}>Bank Details</p>
                          <p>{OUR_COMPANY.bank_details}</p>
                        </div>
                      </div>

                      {invoice.payment_note && (
                        <div className={styles.paymentNoteSection}>
                          <p className={styles.paymentNoteLabel}>Payment Note</p>
                          <p className={styles.paymentNoteText}>{invoice.payment_note}</p>
                        </div>
                      )}

                      {invoice.status === "draft" && (
                        <div className={styles.actions} data-html2canvas-ignore="true">
                          <button
                            className={styles.primaryButton}
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
                            className={styles.secondaryButton}
                            onClick={() => handleExportPDF(invoice)}
                          >
                            Download PDF
                          </button>
                        </div>
                      )}

                      {invoice.status === "issued" && (
                        <div className={styles.actions} data-html2canvas-ignore="true">
                          <button
                            className={styles.primaryButton}
                            onClick={() =>
                              setPaymentNoteModal(invoice.invoice_id)
                            }
                          >
                            Mark as Paid
                          </button>
                          <button
                            className={styles.secondaryButton}
                            onClick={() => handleExportPDF(invoice)}
                          >
                            Download PDF
                          </button>
                        </div>
                      )}

                      {invoice.status === "paid" && (
                        <div className={styles.actions} data-html2canvas-ignore="true">
                          <button
                            className={styles.secondaryButton}
                            onClick={() => handleExportPDF(invoice)}
                          >
                            Download PDF
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
                );
              })}
            </div>
          )}
        </div>
      </section>

      {paymentNoteModal && (
        <div className={styles.modalOverlay} onClick={() => {
          setPaymentNoteModal(null);
          setPaymentNote("");
        }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add Payment Note</h3>
            <p className={styles.modalSubtitle}>
              Add an optional note about this payment (e.g., reference number, payment method)
            </p>
            
            <textarea
              className={styles.noteTextarea}
              placeholder="Enter payment note..."
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={4}
            />

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  setPaymentNoteModal(null);
                  setPaymentNote("");
                }}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={() =>
                  handleUpdateStatus(paymentNoteModal, "paid", paymentNote)
                }
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowGenerateConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Generate Invoice</h3>
            <p className={styles.modalSubtitle}>
              Are you sure you want to generate an invoice for <strong>{companies.find(c => c.company_id === selectedCompany)?.name || "this company"}</strong> for {selectedMonth}?
            </p>
            <p className={styles.modalWarning}>
              ⚠️ Once generated, all entries used in this invoice will be locked and cannot be edited.
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setShowGenerateConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleGenerateInvoice}
                disabled={status === "loading"}
              >
                {status === "loading" ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
