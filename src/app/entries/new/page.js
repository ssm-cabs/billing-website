"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createEntry,
  fetchCompanies,
  fetchVehicles,
  isFirebaseConfigured,
} from "@/lib/api";
import styles from "./new.module.css";

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const initialState = {
  entry_date: getToday(),
  company_name: "",
  slot: "",
  pickup_location: "",
  drop_location: "",
  vehicle_number: "",
  notes: "",
};

export default function NewEntryPage() {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState("idle");

  useEffect(() => {
    const loadCompanies = async () => {
      setCompanyStatus("loading");
      try {
        const data = await fetchCompanies();
        setCompanies(data.filter((company) => company.active !== false));
        setCompanyStatus("success");
      } catch (err) {
        setCompanyStatus("error");
      }
    };

    loadCompanies();
  }, []);

  useEffect(() => {
    const loadVehicles = async () => {
      setVehicleStatus("loading");
      try {
        const data = await fetchVehicles();
        setVehicles(data.filter((vehicle) => vehicle.status !== "inactive"));
        setVehicleStatus("success");
      } catch (err) {
        setVehicleStatus("error");
      }
    };

    loadVehicles();
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await createEntry(form);
      setStatus("success");
      setMessage(
        isFirebaseConfigured ? "Entry saved." : "Demo mode: entry prepared."
      );
      setForm({ ...initialState, entry_date: getToday() });
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Failed to save entry.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries">
            ← Back
          </Link>
          <p className={styles.eyebrow}>New entry</p>
          <h1>Create Ride Entry</h1>
          <p className={styles.lead}>
            Capture daily rides for corporate clients with slot-based pricing.
          </p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Entry date
          <input
            type="date"
            name="entry_date"
            value={form.entry_date}
            onChange={updateField}
            required
          />
        </label>
        <label className={styles.field}>
          Company
          <select
            name="company_name"
            value={form.company_name}
            onChange={updateField}
            required
          >
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.company_id} value={company.name}>
                {company.name}
              </option>
            ))}
          </select>
          {companyStatus === "loading" && (
            <span className={styles.helper}>Loading companies...</span>
          )}
          {companyStatus === "error" && (
            <span className={styles.helperError}>
              Unable to load companies.
            </span>
          )}
        </label>
        <label className={styles.field}>
          Vehicle
          <select
            name="vehicle_number"
            value={form.vehicle_number}
            onChange={updateField}
          >
            <option value="">Select vehicle</option>
            {vehicles.map((vehicle) => (
              <option
                key={vehicle.vehicle_id}
                value={vehicle.vehicle_number}
              >
                {vehicle.vehicle_number} · {vehicle.driver_name || "Driver"} · {vehicle.cab_type}
              </option>
            ))}
          </select>
          {vehicleStatus === "loading" && (
            <span className={styles.helper}>Loading vehicles...</span>
          )}
          {vehicleStatus === "error" && (
            <span className={styles.helperError}>
              Unable to load vehicles.
            </span>
          )}
        </label>
        <label className={styles.field}>
          Slot
          <select
            name="slot"
            value={form.slot}
            onChange={updateField}
            required
          >
            <option value="">Select slot</option>
            <option value="4hr">4hr</option>
            <option value="6hr">6hr</option>
            <option value="8hr">8hr</option>
            <option value="12hr">12hr</option>
            <option value="Full day">Full day</option>
          </select>
        </label>
        <label className={styles.field}>
          Pickup location
          <input
            type="text"
            name="pickup_location"
            value={form.pickup_location}
            onChange={updateField}
            required
          />
        </label>
        <label className={styles.field}>
          Drop location
          <input
            type="text"
            name="drop_location"
            value={form.drop_location}
            onChange={updateField}
            required
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
          <button className={styles.primaryCta} type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Saving..." : "Save Entry"}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </div>
      </form>
    </div>
  );
}
