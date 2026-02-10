"use client";

import { useEffect, useState } from "react";
import { createVehicle, fetchVehicles, isFirebaseConfigured } from "@/lib/api";
import styles from "./vehicles.module.css";

const initialState = {
  vehicle_number: "",
  cab_type: "",
  capacity: "",
  status: "active",
  driver_name: "",
  driver_phone: "",
  notes: "",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadVehicles = async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchVehicles();
      setVehicles(data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Unable to load vehicles.");
      setStatus("error");
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      ...form,
      capacity: form.capacity ? Number(form.capacity) : null,
    };

    try {
      await createVehicle(payload);
      setMessage(
        isFirebaseConfigured
          ? "Vehicle added."
          : "Demo mode: vehicle prepared."
      );
      setForm(initialState);
      await loadVehicles();
    } catch (err) {
      setError(err.message || "Failed to add vehicle.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Vehicles</p>
          <h1>Fleet Vehicles</h1>
          <p className={styles.lead}>
            Manage vehicle details, drivers, and fleet status.
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

      <section className={styles.grid}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <h2>Add Vehicle</h2>
          <label className={styles.field}>
            Vehicle number
            <input
              type="text"
              name="vehicle_number"
              value={form.vehicle_number}
              onChange={updateField}
              placeholder="TN 09 AB 1234"
              required
            />
          </label>
          <label className={styles.field}>
            Cab type
            <select
              name="cab_type"
              value={form.cab_type}
              onChange={updateField}
              required
            >
              <option value="">Select cab type</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Tempo Traveller">Tempo Traveller</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className={styles.field}>
            Capacity
            <input
              type="number"
              name="capacity"
              value={form.capacity}
              onChange={updateField}
              min="1"
              placeholder="4"
            />
          </label>
          <label className={styles.field}>
            Status
            <select name="status" value={form.status} onChange={updateField}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </label>
          <label className={styles.field}>
            Driver name
            <input
              type="text"
              name="driver_name"
              value={form.driver_name}
              onChange={updateField}
              placeholder="Driver name"
            />
          </label>
          <label className={styles.field}>
            Driver phone
            <input
              type="tel"
              name="driver_phone"
              value={form.driver_phone}
              onChange={updateField}
              placeholder="+91 90000 00000"
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

          <div className={styles.actions}>
            <button className={styles.primaryCta} type="submit">
              Save Vehicle
            </button>
            {message && <p className={styles.message}>{message}</p>}
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </form>

        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h2>Vehicle List</h2>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && <p className={styles.error}>{error}</p>}
          {status === "success" && vehicles.length === 0 && (
            <p>No vehicles yet. Add your first fleet vehicle.</p>
          )}
          {vehicles.length > 0 && (
            <div className={styles.cards}>
              {vehicles.map((vehicle) => (
                <article key={vehicle.vehicle_id} className={styles.card}>
                  <div>
                    <h3>{vehicle.vehicle_number}</h3>
                    <p>{vehicle.cab_type || "-"}</p>
                  </div>
                  <div className={styles.meta}>
                    <span>Capacity: {vehicle.capacity || "-"}</span>
                    <span>{vehicle.driver_name || "-"}</span>
                    <span>{vehicle.driver_phone || "-"}</span>
                  </div>
                  <span className={styles.statusTag}>{vehicle.status}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
