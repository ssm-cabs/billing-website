"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "../entries/MonthPicker";
import DatePicker from "../entries/DatePicker";
import CustomDropdown from "../entries/CustomDropdown";
import {
  createPayment,
  deletePayment,
  fetchPayments,
  fetchVehicles,
  isFirebaseConfigured,
  updatePayment,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./payments.module.css";

const getMonthValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const paymentModeOptions = [
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Cash", value: "cash" },
  { label: "UPI", value: "upi" },
];

const paymentStatusOptions = [
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
];

const initialState = {
  payment_date: getToday(),
  vehicle_number: "",
  driver_name: "",
  driver_phone: "",
  amount: "",
  payment_mode: "upi",
  status: "paid",
  notes: "",
};

const formatCurrency = (value) => `₹${Number(value || 0)}`;

export default function PaymentsPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("payments");
  const [payments, setPayments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [month, setMonth] = useState(getMonthValue);
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [form, setForm] = useState(initialState);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const getInitialFormState = useCallback(
    () => ({
      ...initialState,
      payment_date: getToday(),
      amount: "",
    }),
    []
  );

  const closePaymentForm = useCallback(() => {
    setShowForm(false);
    setEditingId("");
    setForm(getInitialFormState());
  }, [getInitialFormState]);

  const loadPayments = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchPayments({ month });
      setPayments(data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Unable to load payments.");
      setStatus("error");
    }
  }, [month]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPayments();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPayments]);

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const data = await fetchVehicles();
        setVehicles(data);
      } catch (_) {
        setVehicles([]);
      }
    };
    loadVehicles();
  }, []);

  const vehicleOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        label: `${vehicle.vehicle_number} · ${vehicle.driver_name || "Driver"}`,
        value: vehicle.vehicle_number,
      })),
    [vehicles]
  );

  const vehicleFilterOptions = useMemo(
    () =>
      vehicles.map((vehicle) => ({
        label: vehicle.vehicle_number,
        value: vehicle.vehicle_number,
      })),
    [vehicles]
  );

  const filteredPayments = useMemo(() => {
    if (vehicleFilter === "all") {
      return payments;
    }
    return payments.filter((payment) => payment.vehicle_number === vehicleFilter);
  }, [payments, vehicleFilter]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onVehicleChange = (vehicleNumber) => {
    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.vehicle_number === vehicleNumber
    );
    setForm((prev) => ({
      ...prev,
      vehicle_number: vehicleNumber,
      driver_name: selectedVehicle?.driver_name || prev.driver_name,
      driver_phone: selectedVehicle?.driver_phone || prev.driver_phone,
    }));
  };

  const handlePaymentDateChange = (date) => {
    setForm((prev) => ({ ...prev, payment_date: date }));
  };

  const handleAddClick = () => {
    if (!canEdit) return;
    setEditingId("");
    setForm(getInitialFormState());
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const handleEditClick = (payment) => {
    if (!canEdit) return;
    setEditingId(payment.payment_id);
    setForm({
      payment_date: payment.payment_date || getToday(),
      vehicle_number: payment.vehicle_number || "",
      driver_name: payment.driver_name || "",
      driver_phone: payment.driver_phone || "",
      amount:
        payment.amount === null || payment.amount === undefined
          ? ""
          : String(payment.amount),
      payment_mode: payment.payment_mode || "upi",
      status: payment.status || "paid",
      notes: payment.notes || "",
    });
    setError("");
    setMessage("");
    setShowForm(true);
  };

  const handleDeleteClick = (paymentId) => {
    if (!canEdit) return;
    setDeletePaymentId(paymentId);
    setShowDeleteConfirm(true);
  };

  const confirmDeletePayment = async () => {
    if (!canEdit || !deletePaymentId) return;
    try {
      await deletePayment(deletePaymentId);
      await loadPayments();
      setShowDeleteConfirm(false);
      setDeletePaymentId("");
    } catch (err) {
      setError(err.message || "Failed to delete payment.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canEdit) return;

    setError("");
    setMessage("");

    const amount = Number(String(form.amount).trim() || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    const payload = {
      ...form,
      amount,
      payment_month: String(form.payment_date || "").slice(0, 7),
    };

    try {
      if (editingId) {
        await updatePayment(editingId, payload);
      } else {
        await createPayment(payload);
      }

      setMessage(
        isFirebaseConfigured
          ? editingId
            ? "Payment updated."
            : "Payment added."
          : "Demo mode: payment prepared."
      );
      closePaymentForm();
      await loadPayments();
    } catch (err) {
      setError(err.message || "Failed to save payment.");
    }
  };

  return (
    <div className={styles.page}>
      {permissionsLoading && (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading permissions...</p>
        </div>
      )}

      {!permissionsLoading && canView && (
        <>
          <header className={styles.header}>
            <div>
              <Link className={styles.backLink} href="/dashboard">
                ← Back
              </Link>
              <p className={styles.eyebrow}>Payments</p>
              <h1>Driver Payments</h1>
              <p className={styles.lead}>
                Track and manage monthly payouts for drivers.
              </p>
            </div>
            <div className={styles.headerActions}>
              {canEdit && (
                <button className={styles.primaryCta} onClick={handleAddClick}>
                  Add Payment
                </button>
              )}
            </div>
          </header>

          {!isFirebaseConfigured && (
            <div className={styles.notice}>
              Add Firebase config to
              <span className={styles.noticeHighlight}>NEXT_PUBLIC_FIREBASE_*</span>
              to load live data.
            </div>
          )}

          <section className={styles.filters}>
            <label className={styles.field}>
              Month
              <MonthPicker value={month} onChange={setMonth} />
            </label>
            <label className={styles.field}>
              Vehicle
              <CustomDropdown
                options={vehicleFilterOptions}
                value={vehicleFilter}
                onChange={setVehicleFilter}
                getLabel={(option) => option.label}
                getValue={(option) => option.value}
                placeholder="Select vehicle"
                defaultOption={{ label: "All Vehicles", value: "all" }}
              />
            </label>
          </section>

          <section className={styles.listWrap}>
            <div className={styles.listHeader}>
              <h2>Payments List</h2>
              {status === "loading" && <span>Loading...</span>}
            </div>
            {status === "error" && <p className={styles.error}>{error}</p>}
            {status === "success" && filteredPayments.length === 0 && (
              <p>
                {payments.length === 0
                  ? "No payments found for this month."
                  : "No payments found for selected filters."}
              </p>
            )}
            {filteredPayments.length > 0 && (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span>Date</span>
                  <span>Driver</span>
                  <span>Vehicle</span>
                  <span>Amount</span>
                  <span>Mode</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {filteredPayments.map((payment) => (
                  <div key={payment.payment_id} className={styles.tableRow}>
                    <span>{payment.payment_date || "-"}</span>
                    <span>
                      {payment.driver_name || "-"}
                      <small>{payment.driver_phone || "-"}</small>
                    </span>
                    <span>{payment.vehicle_number || "-"}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                    <span>{payment.payment_mode.replace(/_/g, " ")}</span>
                    <span className={`${styles.status} ${styles[payment.status] || ""}`}>
                      {payment.status}
                    </span>
                    <span className={styles.actions}>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => handleEditClick(payment)}
                            title="Edit"
                            aria-label="Edit"
                          >
                            <span className={styles.editIcon}>✎</span>
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteClick(payment.payment_id)}
                            title="Delete"
                            aria-label="Delete"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {canEdit && showForm && (
            <div className={styles.modalOverlay} onClick={closePaymentForm}>
              <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2>{editingId ? "Edit Payment" : "Add Payment"}</h2>
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={closePaymentForm}
                  >
                    ✕
                  </button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                  <label className={styles.field}>
                    Payment date
                    <DatePicker
                      value={form.payment_date}
                      onChange={handlePaymentDateChange}
                    />
                  </label>
                  <label className={styles.field}>
                    Vehicle
                    <CustomDropdown
                      options={vehicleOptions}
                      value={form.vehicle_number}
                      onChange={onVehicleChange}
                      getLabel={(option) => option.label}
                      getValue={(option) => option.value}
                      placeholder="Select vehicle"
                    />
                  </label>
                  <label className={styles.field}>
                    Driver name
                    <input
                      type="text"
                      name="driver_name"
                      value={form.driver_name}
                      onChange={updateField}
                      placeholder="Driver name"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    Driver phone
                    <input
                      type="tel"
                      name="driver_phone"
                      value={form.driver_phone}
                      onChange={updateField}
                      placeholder="+919000000000"
                    />
                  </label>
                  <label className={styles.field}>
                    Amount
                    <input
                      type="text"
                      name="amount"
                      value={form.amount}
                      onChange={updateField}
                      placeholder="15000"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    Payment mode
                    <CustomDropdown
                      options={paymentModeOptions}
                      value={form.payment_mode}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, payment_mode: value }))
                      }
                      getLabel={(option) => option.label}
                      getValue={(option) => option.value}
                      placeholder="Select payment mode"
                    />
                  </label>
                  <label className={styles.field}>
                    Status
                    <CustomDropdown
                      options={paymentStatusOptions}
                      value={form.status}
                      onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                      getLabel={(option) => option.label}
                      getValue={(option) => option.value}
                      placeholder="Select status"
                    />
                  </label>
                  <label className={styles.field}>
                    Notes
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={updateField}
                      rows={3}
                    />
                  </label>

                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.secondaryCta}
                      onClick={closePaymentForm}
                    >
                      Cancel
                    </button>
                    <button className={styles.primaryCta} type="submit">
                      {editingId ? "Update Payment" : "Save Payment"}
                    </button>
                  </div>
                  {message && <p className={styles.message}>{message}</p>}
                  {error && <p className={styles.error}>{error}</p>}
                </form>
              </div>
            </div>
          )}

          {canEdit && showDeleteConfirm && (
            <div
              className={styles.modalOverlay}
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletePaymentId("");
              }}
            >
              <div
                className={`${styles.modal} ${styles.confirmModal}`}
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className={styles.modalTitle}>Delete Payment</h3>
                <p className={styles.modalSubtitle}>
                  Are you sure you want to delete this payment record? This action
                  cannot be undone.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryCta}
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeletePaymentId("");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.primaryCta}
                    onClick={confirmDeletePayment}
                  >
                    Delete Payment
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
