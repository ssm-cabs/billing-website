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
  fetchInvoices,
  fetchVehicleInvoices,
  invoiceExists,
  vehicleInvoiceExists,
  updateInvoiceStatus,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./invoice.module.css";

const basePath = "/billing-website";

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const OUR_COMPANY = {
  name: "SSM Cabs",
  address: "1st Floor, MSIL Building, Old Madras Rd, M V Extenstion, Hoskote, Bengaluru, Karnataka 562114",
  phone: "+91 9686000477",
  email: "accounts@ssmcabs.com",
  bank_details: "Account: 000111222333 | SBI | IFSC: SBIN0001234",
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

  const [companies, setCompanies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedCompanyMonth, setSelectedCompanyMonth] = useState(getMonthValue());
  const [selectedVehicleMonth, setSelectedVehicleMonth] = useState(getMonthValue());

  const [companyInvoices, setCompanyInvoices] = useState([]);
  const [vehicleInvoices, setVehicleInvoices] = useState([]);
  const [companyInvoicesStatus, setCompanyInvoicesStatus] = useState("idle");
  const [vehicleInvoicesStatus, setVehicleInvoicesStatus] = useState("idle");

  const [companyInvoiceAlreadyExists, setCompanyInvoiceAlreadyExists] = useState(false);
  const [vehicleInvoiceAlreadyExists, setVehicleInvoiceAlreadyExists] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState(null);
  const [paymentNoteModal, setPaymentNoteModal] = useState(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [showGenerateConfirmType, setShowGenerateConfirmType] = useState(null);
  const [generatingType, setGeneratingType] = useState("");
  const [activeInvoiceTile, setActiveInvoiceTile] = useState("company");

  const selectedCompanyInvoice = useMemo(
    () =>
      companyInvoices.find((invoice) => invoice.period === selectedCompanyMonth) || null,
    [companyInvoices, selectedCompanyMonth]
  );
  const selectedVehicleInvoice = useMemo(
    () =>
      vehicleInvoices.find((invoice) => invoice.period === selectedVehicleMonth) || null,
    [vehicleInvoices, selectedVehicleMonth]
  );
  const isSelectedCompanyInvoiceDraft =
    String(selectedCompanyInvoice?.status || "").toLowerCase() === "draft";
  const isSelectedVehicleInvoiceDraft =
    String(selectedVehicleInvoice?.status || "").toLowerCase() === "draft";

  const loadCompanyInvoices = async (companyId) => {
    if (!companyId) {
      setCompanyInvoices([]);
      return;
    }

    setCompanyInvoicesStatus("loading");
    try {
      const data = await fetchInvoices(companyId);
      setCompanyInvoices(data);
      setCompanyInvoicesStatus("success");
    } catch (_) {
      setError("Failed to load company invoices");
      setCompanyInvoicesStatus("error");
    }
  };

  const loadVehicleInvoices = async (vehicleId) => {
    if (!vehicleId) {
      setVehicleInvoices([]);
      return;
    }

    setVehicleInvoicesStatus("loading");
    try {
      const data = await fetchVehicleInvoices(vehicleId);
      setVehicleInvoices(data);
      setVehicleInvoicesStatus("success");
    } catch (_) {
      setError("Failed to load vehicle invoices");
      setVehicleInvoicesStatus("error");
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
    loadCompanyInvoices(selectedCompany);
  }, [selectedCompany]);

  useEffect(() => {
    loadVehicleInvoices(selectedVehicle);
  }, [selectedVehicle]);

  useEffect(() => {
    const checkCompanyInvoiceExists = async () => {
      if (!selectedCompany || !selectedCompanyMonth) {
        setCompanyInvoiceAlreadyExists(false);
        return;
      }

      try {
        const exists = await invoiceExists(selectedCompany, selectedCompanyMonth);
        setCompanyInvoiceAlreadyExists(exists);
      } catch (_) {
        setCompanyInvoiceAlreadyExists(false);
      }
    };

    checkCompanyInvoiceExists();
  }, [selectedCompany, selectedCompanyMonth]);

  useEffect(() => {
    const checkVehicleInvoiceExists = async () => {
      if (!selectedVehicle || !selectedVehicleMonth) {
        setVehicleInvoiceAlreadyExists(false);
        return;
      }

      try {
        const exists = await vehicleInvoiceExists(selectedVehicle, selectedVehicleMonth);
        setVehicleInvoiceAlreadyExists(exists);
      } catch (_) {
        setVehicleInvoiceAlreadyExists(false);
      }
    };

    checkVehicleInvoiceExists();
  }, [selectedVehicle, selectedVehicleMonth]);

  const handleGenerateInvoice = async (type) => {
    if (!canEdit) return;

    const isCompany = type === "company";
    const selectedTarget = isCompany ? selectedCompany : selectedVehicle;
    const selectedMonth = isCompany ? selectedCompanyMonth : selectedVehicleMonth;

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
        await generateInvoice(selectedCompany, selectedCompanyMonth);
        await loadCompanyInvoices(selectedCompany);
        const exists = await invoiceExists(selectedCompany, selectedCompanyMonth);
        setCompanyInvoiceAlreadyExists(exists);
      } else {
        await generateVehicleInvoice(selectedVehicle, selectedVehicleMonth);
        await loadVehicleInvoices(selectedVehicle);
        const exists = await vehicleInvoiceExists(selectedVehicle, selectedVehicleMonth);
        setVehicleInvoiceAlreadyExists(exists);
      }

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

      if (invoiceType === "vehicle") {
        await loadVehicleInvoices(selectedVehicle);
      } else {
        await loadCompanyInvoices(selectedCompany);
      }
    } catch (_) {
      setError("Failed to update invoice");
    }
  };

  const handleViewInvoice = (type) => {
    const isCompany = type === "company";
    const invoiceId = isCompany
      ? `${selectedCompany}-${selectedCompanyMonth}`
      : `${selectedVehicle}-${selectedVehicleMonth}`;

    setExpandedInvoice(invoiceId);

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

  const renderInvoiceCards = (invoiceList) => {
    if (invoiceList.length === 0) {
      return <p className={styles.empty}>No invoices yet</p>;
    }

    return (
      <div className={styles.invoices}>
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
                  <p className={styles.totalAmount}>₹{invoice.total?.toLocaleString() || 0}</p>
                  <span
                    className={`${styles.badge} ${styles[`badge-${invoice.status || "draft"}`]}`}
                  >
                    {invoice.status || "draft"}
                  </span>
                </div>
              </div>

              {expandedInvoice === invoice.invoice_id && (
                <div id={`invoice-content-${invoice.invoice_id}`} className={styles.invoiceDetails}>
                  <div className={styles.invoiceHeader}>
                    <div className={styles.invoiceAside}>
                      <img
                        src={`${basePath}/logo.png`}
                        alt="Company Logo"
                        className={styles.logo}
                      />
                      <div className={styles.ourDetails}>
                        <p>{OUR_COMPANY.name}</p>
                        <p>{OUR_COMPANY.address}</p>
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
                            <span className={styles.column}>Extras (K/H/T)</span>
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
                                {`${Number(item.extra_kms) || 0}/${Number(item.extra_hours) || 0}/${Number(item.tolls) || 0}`}
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
                      <div className={styles.totalRow}>
                        <span>Tax (18% GST)</span>
                        <span>₹{invoice.tax?.toLocaleString() || 0}</span>
                      </div>
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
              )}

              <button
                className={styles.expandButton}
                onClick={() =>
                  setExpandedInvoice(expandedInvoice === invoice.invoice_id ? null : invoice.invoice_id)
                }
              >
                {expandedInvoice === invoice.invoice_id ? "Hide Details" : "View Details"}
              </button>
            </div>
          );
        })}
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

      <section className={styles.grid}>
        <div className={styles.invoiceTypeTiles}>
          <button
            type="button"
            className={`${styles.invoiceTypeTile} ${
              activeInvoiceTile === "company" ? styles.invoiceTypeTileActive : ""
            }`}
            onClick={() => setActiveInvoiceTile("company")}
          >
            Company Invoices
          </button>
          <button
            type="button"
            className={`${styles.invoiceTypeTile} ${
              activeInvoiceTile === "vehicle" ? styles.invoiceTypeTileActive : ""
            }`}
            onClick={() => setActiveInvoiceTile("vehicle")}
          >
            Vehicle Invoices
          </button>
        </div>

        <div className={styles.controlsStack}>
          {activeInvoiceTile === "company" ? (
            <div className={styles.controls}>
              <h2>Generate Company Invoice</h2>
              <label className={styles.field}>
                Company
                <CustomDropdown
                  options={getCompanyOptions(companies)}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select a company"
                />
              </label>

              <label className={styles.field}>
                Month
                <MonthPicker value={selectedCompanyMonth} onChange={setSelectedCompanyMonth} />
              </label>

              {canEdit ? (
                <button
                  className={styles.primaryButton}
                  onClick={
                    companyInvoiceAlreadyExists
                      ? () => handleViewInvoice("company")
                      : () => setShowGenerateConfirmType("company")
                  }
                  disabled={generatingType === "company"}
                >
                  {generatingType === "company"
                    ? "Generating..."
                    : isSelectedCompanyInvoiceDraft
                    ? "Regenerate Invoice"
                    : companyInvoiceAlreadyExists
                    ? "View Invoice"
                    : "Generate Invoice"}
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  onClick={() => handleViewInvoice("company")}
                  disabled={!companyInvoiceAlreadyExists}
                >
                  View Invoice
                </button>
              )}
            </div>
          ) : (
            <div className={styles.controls}>
              <h2>Generate Vehicle Invoice</h2>
              <label className={styles.field}>
                Leased Vehicle
                <CustomDropdown
                  options={getVehicleOptions(vehicles)}
                  value={selectedVehicle}
                  onChange={setSelectedVehicle}
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select a leased vehicle"
                />
              </label>

              <label className={styles.field}>
                Month
                <MonthPicker value={selectedVehicleMonth} onChange={setSelectedVehicleMonth} />
              </label>

              {vehicles.length === 0 && (
                <div className={styles.warning}>
                  No active leased vehicles found. Add or activate a leased vehicle to generate
                  vehicle invoices.
                </div>
              )}

              {canEdit ? (
                <button
                  className={styles.primaryButton}
                  onClick={
                    vehicleInvoiceAlreadyExists
                      ? () => handleViewInvoice("vehicle")
                      : () => setShowGenerateConfirmType("vehicle")
                  }
                  disabled={generatingType === "vehicle" || vehicles.length === 0}
                >
                  {generatingType === "vehicle"
                    ? "Generating..."
                    : isSelectedVehicleInvoiceDraft
                    ? "Regenerate Invoice"
                    : vehicleInvoiceAlreadyExists
                    ? "View Invoice"
                    : "Generate Invoice"}
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  onClick={() => handleViewInvoice("vehicle")}
                  disabled={!vehicleInvoiceAlreadyExists || vehicles.length === 0}
                >
                  View Invoice
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.invoicesList}>
          {activeInvoiceTile === "company" ? (
            <div className={styles.historySection}>
              <h2>Company Invoice History</h2>
              {companyInvoicesStatus === "loading" ? (
                <p className={styles.empty}>Loading invoices...</p>
              ) : (
                renderInvoiceCards(companyInvoices)
              )}
            </div>
          ) : (
            <div className={styles.historySection}>
              <h2>Vehicle Invoice History</h2>
              {vehicleInvoicesStatus === "loading" ? (
                <p className={styles.empty}>Loading invoices...</p>
              ) : (
                renderInvoiceCards(vehicleInvoices)
              )}
            </div>
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
            <h3 className={styles.modalTitle}>Generate Invoice</h3>
            <p className={styles.modalSubtitle}>
              {showGenerateConfirmType === "company" ? (
                <>
                  Are you sure you want to generate an invoice for{" "}
                  <strong>
                    {companies.find((c) => c.company_id === selectedCompany)?.name ||
                      "this company"}
                  </strong>{" "}
                  for {selectedCompanyMonth}?
                </>
              ) : (
                <>
                  Are you sure you want to generate an invoice for{" "}
                  <strong>
                    {vehicles.find((v) => v.vehicle_id === selectedVehicle)?.vehicle_number ||
                      "this vehicle"}
                  </strong>{" "}
                  for {selectedVehicleMonth}?
                </>
              )}
            </p>
            <p className={styles.modalWarning}>
              {showGenerateConfirmType === "company"
                ? "⚠️ Once generated, all entries used in this invoice will be marked as billed and cannot be edited."
                : "⚠️ Once generated, this vehicle invoice will use leased vehicle pricing for matching ride entries in the selected month."}
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
                disabled={generatingType === showGenerateConfirmType}
              >
                {generatingType === showGenerateConfirmType
                  ? "Generating..."
                  : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
