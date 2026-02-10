"use client";

import { useState } from "react";
import Link from "next/link";
import { createEntry, isFirebaseConfigured } from "@/lib/api";
import styles from "./new.module.css";

const initialState = {
  entry_date: "",
  company_name: "",
  cab_type: "",
  slot: "",
  pickup_location: "",
  drop_location: "",
  driver_name: "",
  vehicle_number: "",
  notes: "",
};

export default function NewEntryPage() {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

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
      setForm(initialState);
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Failed to save entry.");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>New entry</p>
          <h1>Create Ride Entry</h1>
          <p className={styles.lead}>
            Capture daily rides for corporate clients with slot-based pricing.
          </p>
        </div>
        <Link className={styles.secondaryCta} href="/entries">
          Back to Entries
        </Link>
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
          <input
            type="text"
            name="company_name"
            value={form.company_name}
            onChange={updateField}
            placeholder="Acme Corp"
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
          Slot
          <input
            type="text"
            name="slot"
            value={form.slot}
            onChange={updateField}
            placeholder="4hr, 6hr, 12hr"
            required
          />
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
          Driver name
          <input
            type="text"
            name="driver_name"
            value={form.driver_name}
            onChange={updateField}
          />
        </label>
        <label className={styles.field}>
          Vehicle number
          <input
            type="text"
            name="vehicle_number"
            value={form.vehicle_number}
            onChange={updateField}
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
