"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "../entries/MonthPicker";
import DatePicker from "../entries/DatePicker";
import CustomDropdown from "../entries/CustomDropdown";
import {
  createPayment,
  fetchPayments,
  fetchVehicles,
  isFirebaseConfigured,
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

const transactionTypeFilterOptions = [
  { label: "Driver Payments", value: "driver_payment" },
  { label: "Fueling", value: "fueling" },
];

const initialState = {
  transaction_type: "driver_payment",
  payment_date: getToday(),
  vehicle_number: "",
  driver_name: "",
  driver_phone: "",
  fuel_liters: "",
  fuel_station: "",
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState(initialState);
  const [showForm, setShowForm] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
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
    setShowCreateConfirm(false);
    setPendingPayload(null);
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
      (form.transaction_type === "fueling"
        ? vehicles.filter((vehicle) => vehicle.ownership_type === "own")
        : vehicles
      ).map((vehicle) => ({
        label: `${vehicle.vehicle_number} · ${vehicle.driver_name || "Driver"}`,
        value: vehicle.vehicle_number,
      })),
    [vehicles, form.transaction_type]
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
    let filtered = payments;

    if (typeFilter !== "all") {
      filtered = filtered.filter(
        (payment) =>
          String(payment.transaction_type || "driver_payment") === typeFilter
      );
    }

    if (vehicleFilter !== "all") {
      filtered = filtered.filter(
        (payment) => payment.vehicle_number === vehicleFilter
      );
    }

    return filtered;
  }, [payments, vehicleFilter, typeFilter]);

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

  const handleAddByType = (transactionType) => {
    if (!canEdit) return;
    setForm({
      ...getInitialFormState(),
      transaction_type: transactionType,
    });
    setError("");
    setMessage("");
    setShowForm(true);
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

    if (!form.vehicle_number) {
      setError("Vehicle is required.");
      return;
    }

    const selectedVehicle = vehicles.find(
      (vehicle) => vehicle.vehicle_number === form.vehicle_number
    );
    if (!selectedVehicle) {
      setError("Selected vehicle is invalid.");
      return;
    }

    if (form.transaction_type === "driver_payment" && !String(form.driver_name || "").trim()) {
      setError("Driver name is required for driver payments.");
      return;
    }

    const fuelLitersRaw =
      form.transaction_type === "fueling" ? String(form.fuel_liters).trim() : "";
    const fuelLiters =
      form.transaction_type === "fueling" && fuelLitersRaw
        ? Number(fuelLitersRaw)
        : 0;

    if (form.transaction_type === "fueling" && fuelLitersRaw && !Number.isFinite(fuelLiters)) {
      setError("Fuel liters must be a valid number.");
      return;
    }

    if (form.transaction_type === "fueling" && selectedVehicle.ownership_type !== "own") {
      setError("Fueling is allowed only for own vehicles.");
      return;
    }

    const payload = {
      ...form,
      amount,
      fuel_liters: fuelLiters,
      payment_month: String(form.payment_date || "").slice(0, 7),
    };

    setPendingPayload(payload);
    setShowCreateConfirm(true);
  };

  const confirmCreatePayment = async () => {
    if (!pendingPayload) return;

    try {
      await createPayment(pendingPayload);

      setMessage(
        isFirebaseConfigured
          ? "Record added."
          : "Demo mode: record prepared."
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
              <h1>Payments & Fueling</h1>
              <p className={styles.lead}>
                Track monthly driver payouts and vehicle fueling expenses.
              </p>
            </div>
            <div className={styles.headerActions}>
              {canEdit && (
                <>
                  <button
                    className={styles.primaryCta}
                    onClick={() => handleAddByType("driver_payment")}
                  >
                    Driver Payment
                  </button>
                  <button
                    className={styles.secondaryCta}
                    onClick={() => handleAddByType("fueling")}
                  >
                    Fuel Payment
                  </button>
                </>
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
            <label className={styles.field}>
              Type
              <CustomDropdown
                options={transactionTypeFilterOptions}
                value={typeFilter}
                onChange={setTypeFilter}
                getLabel={(option) => option.label}
                getValue={(option) => option.value}
                placeholder="Select type"
                defaultOption={{ label: "All Types", value: "all" }}
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
                  <span>Type</span>
                  <span>Vehicle</span>
                  <span>Contact</span>
                  <span>Driver</span>
                  <span>Fuel (L)</span>
                  <span>Amount</span>
                  <span>Mode</span>
                  <span>Status</span>
                  <span>Notes</span>
                </div>
                {filteredPayments.map((payment) => {
                  const notesText =
                    payment.transaction_type === "fueling" && payment.fuel_station
                      ? `${payment.fuel_station}${payment.notes ? ` • ${payment.notes}` : ""}`
                      : payment.notes || "-";

                  return (
                    <div key={payment.payment_id} className={styles.tableRow}>
                      <span>{payment.payment_date || "-"}</span>
                      <span>{String(payment.transaction_type || "driver_payment").replace(/_/g, " ")}</span>
                      <span>{payment.vehicle_number || "-"}</span>
                      <span>{payment.driver_phone || "-"}</span>
                      <span>{payment.driver_name || "-"}</span>
                      <span>{payment.transaction_type === "fueling" ? payment.fuel_liters || "-" : "-"}</span>
                      <span>{formatCurrency(payment.amount)}</span>
                      <span>{payment.payment_mode ? payment.payment_mode.replace(/_/g, " ") : "-"}</span>
                      <span className={`${styles.status} ${styles[payment.status] || ""}`}>
                        {payment.status}
                      </span>
                      <span className={styles.notesCell} title={notesText}>
                        {notesText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {canEdit && showForm && (
            <div className={styles.modalOverlay} onClick={closePaymentForm}>
              <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2>
                    {form.transaction_type === "fueling"
                      ? "Add Fuel Payment"
                      : "Add Driver Payment"}
                  </h2>
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
                    {form.transaction_type === "fueling" && (
                      <span>Only own vehicles are available for fueling entries.</span>
                    )}
                  </label>
                  {form.transaction_type === "driver_payment" && (
                    <>
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
                    </>
                  )}
                  <label className={styles.field}>
                    {form.transaction_type === "fueling" ? "Fuel cost" : "Amount"}
                    <input
                      type="text"
                      name="amount"
                      value={form.amount}
                      onChange={updateField}
                      placeholder="15000"
                      required
                    />
                  </label>
                  {form.transaction_type === "fueling" && (
                    <>
                      <label className={styles.field}>
                        Fuel liters (optional)
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="fuel_liters"
                          value={form.fuel_liters}
                          onChange={updateField}
                          placeholder="40"
                        />
                      </label>
                      <label className={styles.field}>
                        Fuel station (optional)
                        <input
                          type="text"
                          name="fuel_station"
                          value={form.fuel_station}
                          onChange={updateField}
                          placeholder="Station name"
                        />
                      </label>
                    </>
                  )}
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
                      Save Record
                    </button>
                  </div>
                  {message && <p className={styles.message}>{message}</p>}
                  {error && <p className={styles.error}>{error}</p>}
                </form>
              </div>
            </div>
          )}

          {canEdit && showCreateConfirm && (
            <div
              className={styles.modalOverlay}
              onClick={() => {
                setShowCreateConfirm(false);
                setPendingPayload(null);
              }}
            >
              <div
                className={`${styles.modal} ${styles.confirmModal}`}
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className={styles.modalTitle}>
                  {form.transaction_type === "fueling"
                    ? "Confirm Fuel Payment"
                    : "Confirm Driver Payment"}
                </h3>
                <div className={styles.modalNotice}>
                  Records are add-only. Existing entries cannot be edited or deleted.
                </div>
                <p className={styles.modalSubtitle}>Create this record now?</p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.secondaryCta}
                    onClick={() => {
                      setShowCreateConfirm(false);
                      setPendingPayload(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.primaryCta}
                    onClick={confirmCreatePayment}
                  >
                    Confirm
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
