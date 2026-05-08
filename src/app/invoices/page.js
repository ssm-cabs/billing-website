"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import MonthPicker from "@/app/entries/MonthPicker";
import CustomDropdown from "@/app/entries/CustomDropdown";
import { usePermissions } from "@/lib/usePermissions";
import {
  fetchCompanies,
  fetchVehicles,
  generateInvoice,
  generateVehicleInvoice,
  fetchInvoicesByPeriod,
  updateInvoiceStatus,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./invoice.module.css";

const basePath = "/billing-website";
const logoWithBasePath = `${basePath}/logo.png`;

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const OUR_COMPANY = {
  name: "SSM Cabs",
  address1: "1st Floor, MSIL Building, Old Madras Rd, M V Extenstion",
  address2: "Hoskote, Bengaluru, Karnataka 562114",
  phone: "+91 9686000477",
  email: "accounts@ssmcabs.com",
};

const getCompanyOptions = (companies) =>
  companies.map((company) => ({
    label: company.name,
    value: company.company_id,
  }));

const getVehicleOptions = (vehicles) =>
  vehicles.map((vehicle) => ({
    label: `${vehicle.vehicle_number} (${vehicle.cab_type || "Cab"})`,
    value: vehicle.vehicle_id,
  }));

export default function InvoicePage() {
  const { canEdit, loading: permissionsLoading } = usePermissions("invoices");
  const [logoSrc, setLogoSrc] = useState(logoWithBasePath);

  const [companies, setCompanies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [month, setMonth] = useState(getMonthValue());

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [paymentNoteModal, setPaymentNoteModal] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [showGenerateConfirmType, setShowGenerateConfirmType] = useState(null);
  const [generatingType, setGeneratingType] = useState("");
  const [activeInvoiceTile, setActiveInvoiceTile] = useState("all");
  const [allInvoices, setAllInvoices] = useState([]);
  const [allInvoicesStatus, setAllInvoicesStatus] = useState("idle");

  const visibleInvoices = useMemo(() => {
    if (activeInvoiceTile === "all") {
      return allInvoices;
    }

    return allInvoices.filter((invoice) =>
      activeInvoiceTile === "vehicle"
        ? invoice.invoice_type === "vehicle"
        : invoice.invoice_type !== "vehicle"
    );
  }, [activeInvoiceTile, allInvoices]);

  const generateModalTargetLabel =
    showGenerateConfirmType === "vehicle" ? "Leased Vehicle" : "Company";
  const generateModalTargetName =
    showGenerateConfirmType === "vehicle"
      ? vehicles.find((vehicle) => vehicle.vehicle_id === selectedVehicle)?.vehicle_number || ""
      : companies.find((company) => company.company_id === selectedCompany)?.name || "";
  const generateModalHasExistingInvoice = useMemo(() => {
    if (!showGenerateConfirmType) return false;
    if (showGenerateConfirmType === "vehicle") {
      if (!selectedVehicle) return false;
      return allInvoices.some(
        (invoice) =>
          invoice.invoice_type === "vehicle" &&
          invoice.vehicle_id === selectedVehicle &&
          String(invoice.status || "draft").toLowerCase() === "draft"
      );
    }
    if (!selectedCompany) return false;
    return allInvoices.some(
      (invoice) =>
        invoice.invoice_type !== "vehicle" &&
        invoice.company_id === selectedCompany &&
        String(invoice.status || "draft").toLowerCase() === "draft"
    );
  }, [allInvoices, selectedCompany, selectedVehicle, showGenerateConfirmType]);
  const generateModalBlockedStatus = useMemo(() => {
    if (!showGenerateConfirmType) return "";
    const match =
      showGenerateConfirmType === "vehicle"
        ? allInvoices.find(
            (invoice) =>
              invoice.invoice_type === "vehicle" && invoice.vehicle_id === selectedVehicle
          )
        : allInvoices.find(
            (invoice) =>
              invoice.invoice_type !== "vehicle" && invoice.company_id === selectedCompany
          );
    if (!match) return "";
    const status = String(match.status || "draft").toLowerCase();
    return status === "draft" ? "" : status;
  }, [allInvoices, selectedCompany, selectedVehicle, showGenerateConfirmType]);

  const loadAllInvoices = async () => {
    setAllInvoicesStatus("loading");
    try {
      const data = await fetchInvoicesByPeriod(month);
      setAllInvoices(data);
      setAllInvoicesStatus("success");
    } catch (_) {
      setAllInvoicesStatus("error");
    }
  };

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await fetchCompanies();
        const activeCompanies = data.filter((c) => c.active !== false);
        setCompanies(activeCompanies);
        if (activeCompanies.length > 0) {
          setSelectedCompany(activeCompanies[0].company_id);
        }
      } catch (_) {
        setError("Failed to load companies");
      }
    };

    loadCompanies();
  }, []);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await fetchVehicles();
        const leasedVehicles = data.filter(
          (vehicle) => vehicle.active !== false && vehicle.ownership_type === "leased"
        );
        setVehicles(leasedVehicles);
        if (leasedVehicles.length > 0) {
          setSelectedVehicle((prev) => prev || leasedVehicles[0].vehicle_id);
        }
      } catch (_) {
        setError("Failed to load vehicles");
        setVehicles([]);
      }
    };

    loadVehicles();
  }, []);

  useEffect(() => {
    loadAllInvoices();
  }, [month]);

  const handleGenerateInvoice = async (type) => {
    if (!canEdit) return;

    const isCompany = type === "company";
    const selectedTarget = isCompany ? selectedCompany : selectedVehicle;
    const selectedMonth = month;

    if (!selectedTarget || !selectedMonth) {
      setError(
        isCompany
          ? "Please select a company and month"
          : "Please select a leased vehicle and month"
      );
      return;
    }

    setError("");
    setMessage("");
    setGeneratingType(type);

    try {
      if (isCompany) {
        await generateInvoice(selectedCompany, month);
      } else {
        await generateVehicleInvoice(selectedVehicle, month);
      }

      await loadAllInvoices();

      setMessage(
        isCompany
          ? "Company invoice generated successfully"
          : "Vehicle invoice generated successfully"
      );
      setShowGenerateConfirmType(null);
    } catch (err) {
      setError(err.message || "Failed to generate invoice");
    } finally {
      setGeneratingType("");
    }
  };

  const handleUpdateStatus = async (invoiceId, newStatus, note = "", invoiceType = "company") => {
    setError("");
    setMessage("");

    try {
      await updateInvoiceStatus(invoiceId, newStatus, note);
      setMessage(`Invoice marked as ${newStatus}`);
      setPaymentNoteModal(null);
      setPaymentNote("");

      await loadAllInvoices();
    } catch (_) {
      setError("Failed to update invoice");
    }
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
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      setError("Failed to generate PDF");
    } finally {
      element.style.width = previousStyles.width;
      element.style.maxWidth = previousStyles.maxWidth;
      element.style.margin = previousStyles.margin;
      element.style.minHeight = previousStyles.minHeight;
    }
  };

  const handleDownloadInvoice = async (invoice) => {
    const contentId = `invoice-content-${invoice.invoice_id}`;
    const existing = document.getElementById(contentId);
    if (existing) {
      await handleExportPDF(invoice);
      return;
    }

    setExpandedInvoice(invoice.invoice_id);

    setTimeout(async () => {
      await handleExportPDF(invoice);
    }, 60);
  };

  const handleOpenRegenerate = (invoice) => {
    const type = invoice.invoice_type === "vehicle" ? "vehicle" : "company";
    if (type === "vehicle") {
      if (invoice.vehicle_id) {
        setSelectedVehicle(invoice.vehicle_id);
      }
    } else if (invoice.company_id) {
      setSelectedCompany(invoice.company_id);
    }
    setShowGenerateConfirmType(type);
  };

  const renderInvoiceTable = (invoiceList) => {
    if (invoiceList.length === 0) {
      return <p className={styles.empty}>No invoices yet</p>;
    }

    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Type</th>
              <th>Target</th>
              <th>Period</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoiceList.map((invoice) => {
          const isVehicleInvoice = invoice.invoice_type === "vehicle";
          const companyDetails =
            companies.find((company) => company.company_id === invoice.company_id) || {};
          const vehicleDetails =
            vehicles.find((vehicle) => vehicle.vehicle_id === invoice.vehicle_id) || {};
          const invoiceToName = isVehicleInvoice
            ? invoice.vehicle_number || vehicleDetails.vehicle_number || "Vehicle"
            : invoice.company_name || companyDetails.name || "Company";
          const invoiceToAddress = isVehicleInvoice
            ? ""
            : invoice.company_address || companyDetails.address || "";
          const invoiceToContact = isVehicleInvoice
            ? invoice.driver_name || vehicleDetails.driver_name || ""
            : companyDetails.contact_name || "";
          const invoiceToPhone = isVehicleInvoice
            ? invoice.driver_phone || vehicleDetails.driver_phone || ""
            : companyDetails.contact_phone || "";
          const invoiceToEmail = isVehicleInvoice
            ? ""
            : invoice.company_email || companyDetails.email || "";
          const invoiceDate =
            invoice.invoice_date ||
            (invoice.created_at?.toDate
              ? invoice.created_at.toDate().toISOString().slice(0, 10)
              : "");
          const targetName = isVehicleInvoice
            ? invoice.vehicle_number || vehicleDetails.vehicle_number || "Vehicle"
            : invoice.company_name || companyDetails.name || "Company";

          return [
            <tr key={`${invoice.invoice_id}-row`} data-invoice-id={invoice.invoice_id}>
                <td data-label="Invoice ID">{invoice.invoice_id}</td>
                <td data-label="Type">{isVehicleInvoice ? "Vehicle" : "Company"}</td>
                <td data-label="Target">{targetName}</td>
                <td data-label="Period">{invoice.period || "-"}</td>
                <td data-label="Date">{invoiceDate || "-"}</td>
                <td data-label="Amount">₹{invoice.total?.toLocaleString() || 0}</td>
                <td data-label="Status">
                  <span
                    className={`${styles.badge} ${styles[`badge-${invoice.status || "draft"}`]}`}
                  >
                    {invoice.status || "draft"}
                  </span>
                </td>
                <td data-label="Actions" className={styles.actionsCell}>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.viewBtn}
                      onClick={() =>
                        setExpandedInvoice(
                          expandedInvoice === invoice.invoice_id ? null : invoice.invoice_id
                        )
                      }
                      title={expandedInvoice === invoice.invoice_id ? "Hide" : "View"}
                      aria-label={expandedInvoice === invoice.invoice_id ? "Hide" : "View"}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => handleDownloadInvoice(invoice)}
                      title="Download"
                      aria-label="Download"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 3v12" />
                        <path d="m7 11 5 5 5-5" />
                        <path d="M5 20h14" />
                      </svg>
                    </button>
                    {canEdit && invoice.status === "draft" ? (
                      <button
                        type="button"
                        className={styles.regenerateBtn}
                        onClick={() => handleOpenRegenerate(invoice)}
                        title="Regenerate"
                        aria-label="Regenerate"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                          <path d="M21 3v6h-6" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>,

              expandedInvoice === invoice.invoice_id ? (
                <tr key={`${invoice.invoice_id}-details`} className={styles.detailsRow}>
                  <td colSpan={8} className={styles.detailsCell}>
                    <div id={`invoice-content-${invoice.invoice_id}`} className={styles.invoiceDetails}>
                      <div className={styles.invoiceHeader}>
                        <div className={styles.invoiceAside}>
                          <img
                            src={logoSrc}
                            alt="Company Logo"
                            className={styles.logo}
                            onError={() => {
                              if (logoSrc !== "/logo.png") setLogoSrc("/logo.png");
                            }}
                          />
                          <div className={styles.ourDetails}>
                            <p>{OUR_COMPANY.name}</p>
                            <p>{OUR_COMPANY.address1}</p>
                            <p>{OUR_COMPANY.address2}</p>
                            <p>{OUR_COMPANY.phone}</p>
                            <p>{OUR_COMPANY.email}</p>
                          </div>
                        </div>
                        <div>
                          <p className={styles.period}>
                            {isVehicleInvoice ? "Vehicle Invoice" : "Invoice"} for {invoice.period}
                          </p>
                        </div>
                      </div>

                      <div className={styles.billedTo}>
                        <p className={styles.billedLabel}>Billed To</p>
                        <h3>{invoiceToName}</h3>
                        {invoiceToAddress && <p className={styles.companyDetails}>{invoiceToAddress}</p>}
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
                            <p className={styles.invoiceDate}>Invoice Date: {invoiceDate}</p>
                          )}
                        </div>
                      </div>

                      <div className={styles.detailsSection}>
                        <h4>Breakdown</h4>
                        <div className={styles.lineItems}>
                          {invoice.line_items?.length === 0 ? (
                            <p className={styles.empty}>No entries for this period</p>
                          ) : (
                            <>
                              <div className={`${styles.lineItem} ${styles.lineItemHeader}`}>
                                <span className={styles.column}>Date</span>
                                {isVehicleInvoice && (
                                  <span className={styles.column}>Company</span>
                                )}
                                <span className={styles.column}>Slot</span>
                                {!isVehicleInvoice && (
                                  <span className={styles.column}>Cab</span>
                                )}
                                {!isVehicleInvoice && (
                                  <span className={styles.column}>Vehicle</span>
                                )}
                                <span className={styles.column}>Extras (K/H/T/B)</span>
                                <span className={styles.column}>Amount</span>
                              </div>
                              {invoice.line_items?.map((item, idx) => (
                                <div key={idx} className={styles.lineItem}>
                                  <span className={styles.column}>{item.date}</span>
                                  {isVehicleInvoice && (
                                    <span className={styles.column}>{item.company_name || "-"}</span>
                                  )}
                                  <span className={styles.column}>{item.slot}</span>
                                  {!isVehicleInvoice && (
                                    <span className={styles.column}>{item.cab_type}</span>
                                  )}
                                  {!isVehicleInvoice && (
                                    <span className={styles.column}>{item.vehicle_number}</span>
                                  )}
                                  <span className={styles.column}>
                                    {`${Number(item.extra_kms) || 0}/${Number(item.extra_hours) || 0}/${Number(item.tolls) || 0}/${Number(item.bata) || 0}`}
                                  </span>
                                  <span className={styles.column}>₹{item.amount ?? item.rate ?? 0}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>

                        <div className={styles.totals}>
                          <div className={styles.totalRow}>
                            <span>Subtotal</span>
                            <span>₹{invoice.subtotal?.toLocaleString() || 0}</span>
                          </div>
                          {isVehicleInvoice ? (
                            <>
                              <div className={styles.totalRow}>
                                <span>TDS (1%)</span>
                                <span>-₹{(invoice.tds ?? Math.round((invoice.subtotal || 0) * 0.01))?.toLocaleString() || 0}</span>
                              </div>
                              <div className={styles.totalRow}>
                                <span>Commission (1%)</span>
                                <span>-₹{(invoice.commission ?? Math.round((invoice.subtotal || 0) * 0.01))?.toLocaleString() || 0}</span>
                              </div>
                              <div className={styles.totalRow}>
                                <span>Documentation (1%)</span>
                                <span>-₹{(invoice.documentation ?? Math.round((invoice.subtotal || 0) * 0.01))?.toLocaleString() || 0}</span>
                              </div>
                            </>
                          ) : (
                            <div className={styles.totalRow}>
                              <span>Tax (5% GST)</span>
                              <span>₹{invoice.tax?.toLocaleString() || 0}</span>
                            </div>
                          )}
                          <div className={styles.totalRow + " " + styles.final}>
                            <span>Total</span>
                            <span>₹{invoice.total?.toLocaleString() || 0}</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.footer}>
                        <div className={styles.footerSection}>
                          <p className={styles.footerLabel}>Our Details</p>
                          <p>{OUR_COMPANY.name}</p>
                          <p>{OUR_COMPANY.address1}</p>
                          <p>{OUR_COMPANY.address2}</p>
                          <p>{OUR_COMPANY.phone}</p>
                          <p>{OUR_COMPANY.email}</p>
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
                                "issued",
                                "",
                                invoice.invoice_type || "company"
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
                              setPaymentNoteModal({
                                invoiceId: invoice.invoice_id,
                                invoiceType: invoice.invoice_type || "company",
                              })
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
                  </td>
                </tr>
              ) : null,
          ];
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/dashboard">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Billing</p>
            <h1>Loading permissions...</h1>
          </div>
        </header>
      </div>
    );
  }

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
        {canEdit && (
          <div className={styles.headerActions}>
            <button
              className={styles.primaryCta}
              onClick={() => setShowGenerateConfirmType("company")}
            >
              Generate Invoice
            </button>
          </div>
        )}
      </header>

      {!isFirebaseConfigured && (
        <div className={styles.notice}>
          Add Firebase config to
          <span className={styles.noticeHighlight}>NEXT_PUBLIC_FIREBASE_*</span>
          to load live data.
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {message && <div className={styles.success}>{message}</div>}

      <section className={styles.filters}>
        <label className={styles.field}>
          Month
          <MonthPicker value={month} onChange={setMonth} />
        </label>
        <label className={styles.field}>
          Invoice Type
          <CustomDropdown
            options={[
              { label: "All Invoices", value: "all" },
              { label: "Company Invoices", value: "company" },
              { label: "Vehicle Invoices", value: "vehicle" },
            ]}
            value={activeInvoiceTile}
            onChange={setActiveInvoiceTile}
            getLabel={(o) => o.label}
            getValue={(o) => o.value}
            placeholder="Select type"
          />
        </label>
      </section>

      <section className={styles.invoicesList}>
        <div className={styles.historySection}>
          <h2>
            {activeInvoiceTile === "all"
              ? `All Invoices — ${month}`
              : activeInvoiceTile === "company"
              ? `Company Invoices — ${month}`
              : `Vehicle Invoices — ${month}`}
          </h2>
          {allInvoicesStatus === "loading" ? (
            <p className={styles.empty}>Loading invoices...</p>
          ) : allInvoicesStatus === "error" ? (
            <p className={styles.empty}>Failed to load invoices.</p>
          ) : (
            renderInvoiceTable(visibleInvoices)
          )}
        </div>
      </section>

      {paymentNoteModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => {
            setPaymentNoteModal(null);
            setPaymentNote("");
          }}
        >
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
                  handleUpdateStatus(
                    paymentNoteModal.invoiceId,
                    "paid",
                    paymentNote,
                    paymentNoteModal.invoiceType
                  )
                }
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {canEdit && showGenerateConfirmType && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowGenerateConfirmType(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              {generateModalHasExistingInvoice ? "Regenerate Invoice" : "Generate Invoice"}
            </h3>
            <div className={styles.generateToggle} role="group" aria-label="Invoice type to generate">
              <button
                type="button"
                className={`${styles.generateToggleButton} ${
                  showGenerateConfirmType === "company" ? styles.generateToggleButtonActive : ""
                }`}
                onClick={() => setShowGenerateConfirmType("company")}
              >
                Company
              </button>
              <button
                type="button"
                className={`${styles.generateToggleButton} ${
                  showGenerateConfirmType === "vehicle" ? styles.generateToggleButtonActive : ""
                }`}
                onClick={() => setShowGenerateConfirmType("vehicle")}
              >
                Vehicle
              </button>
            </div>
            <p className={`${styles.modalSubtitle} ${styles.modalLead}`}>
              Select invoice target for {month}. Existing draft invoices for the same target and
              month can be regenerated from here.
            </p>
            <label className={styles.field}>
              Invoice Target
              <CustomDropdown
                options={
                  showGenerateConfirmType === "vehicle"
                    ? getVehicleOptions(vehicles)
                    : getCompanyOptions(companies)
                }
                value={showGenerateConfirmType === "vehicle" ? selectedVehicle : selectedCompany}
                onChange={
                  showGenerateConfirmType === "vehicle"
                    ? setSelectedVehicle
                    : setSelectedCompany
                }
                getLabel={(option) => option.label}
                getValue={(option) => option.value}
                placeholder={
                  showGenerateConfirmType === "vehicle"
                    ? "Select a leased vehicle"
                    : "Select a company"
                }
                searchable
                searchPlaceholder={
                  showGenerateConfirmType === "vehicle"
                    ? "Search vehicle"
                    : "Search company"
                }
              />
            </label>
            <p className={styles.modalTypeHint}>
              {showGenerateConfirmType === "vehicle" ? "Vehicle invoice target" : "Company invoice target"}
            </p>
            <div className={styles.modalStateBlock}>
              {showGenerateConfirmType === "vehicle" && vehicles.length === 0 && (
                <div className={styles.warning}>
                  No active leased vehicles found. Add or activate a leased vehicle to generate
                  vehicle invoices.
                </div>
              )}
              {generateModalBlockedStatus ? (
                <p className={`${styles.modalSubtitle} ${styles.modalStateText}`}>
                  Invoice already exists with status <strong>{generateModalBlockedStatus}</strong>.
                  Regeneration is not allowed for this status.
                </p>
              ) : null}
              {generateModalTargetName && !generateModalBlockedStatus ? (
                <p className={`${styles.modalSubtitle} ${styles.modalStateText}`}>
                  {generateModalHasExistingInvoice
                    ? `A draft invoice already exists for ${generateModalTargetName} in ${month}. Regenerating will update that invoice.`
                    : `A new invoice will be created for ${generateModalTargetName} in ${month}.`}
                </p>
              ) : (
                <p className={`${styles.modalSubtitle} ${styles.modalStateText}`} aria-hidden="true">
                  &nbsp;
                </p>
              )}
            </div>
            <p className={styles.modalWarning}>
              Once generated, matching entries for the selected target and month will be locked for
              billing and used to build the invoice totals.
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setShowGenerateConfirmType(null)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => handleGenerateInvoice(showGenerateConfirmType)}
                disabled={
                  Boolean(generateModalBlockedStatus) ||
                  generatingType === showGenerateConfirmType ||
                  (showGenerateConfirmType === "vehicle"
                    ? !selectedVehicle || vehicles.length === 0
                    : !selectedCompany)
                }
              >
                {generatingType === showGenerateConfirmType
                  ? "Generating..."
                  : generateModalHasExistingInvoice
                  ? "Regenerate Invoice"
                  : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
