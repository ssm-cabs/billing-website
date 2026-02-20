"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchEntryById } from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "../edit.module.css";

const initialState = {
  entry_date: "",
  company_name: "",
  slot: "",
  start_time: "",
  end_time: "",
  pickup_location: "",
  drop_location: "",
  vehicle_number: "",
  cab_type: "",
  user_name: "",
  rate: 0,
  odometer_start: "",
  odometer_end: "",
  tolls: "",
  notes: "",
  total: 0,
};

export default function ClientViewEntryPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { canView, loading: permissionsLoading } = usePermissions("entries");
  const [entry, setEntry] = useState(initialState);
  const [loadingEntry, setLoadingEntry] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!id) {
      setLoadError("Invalid entry ID");
      setLoadingEntry(false);
      return;
    }

    const loadEntry = async () => {
      try {
        setLoadingEntry(true);
        const data = await fetchEntryById(id);
        setEntry({
          entry_date: data.entry_date || "",
          company_name: data.company_name || "",
          slot: data.slot || "",
          start_time: data.start_time || "",
          end_time: data.end_time || "",
          pickup_location: data.pickup_location || "",
          drop_location: data.drop_location || "",
          vehicle_number: data.vehicle_number || "",
          cab_type: data.cab_type || "",
          user_name: data.user_name || "",
          rate: Number(data.rate) || 0,
          odometer_start: data.odometer_start ?? "",
          odometer_end: data.odometer_end ?? "",
          tolls: data.tolls ?? "",
          notes: data.notes || "",
          total: Number(data.total) || Number(data.rate) || 0,
        });
        setLoadError("");
      } catch (err) {
        setLoadError(err.message || "Failed to load entry");
      } finally {
        setLoadingEntry(false);
      }
    };

    loadEntry();
  }, [id]);

  const totalDisplay = useMemo(() => Number(entry.total) || 0, [entry.total]);

  if (permissionsLoading || loadingEntry) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/entries">
              ← Back
            </Link>
            <p className={styles.eyebrow}>View entry</p>
            <h1>Loading...</h1>
          </div>
        </header>
      </div>
    );
  }

  if (!canView) {
    return null;
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/entries">
              ← Back
            </Link>
            <p className={styles.eyebrow}>View entry</p>
            <h1>Error</h1>
            <p className={styles.lead}>{loadError}</p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries">
            ← Back
          </Link>
          <p className={styles.eyebrow}>View entry</p>
          <h1>Ride Entry Details</h1>
          <p className={styles.lead}>Review complete ride details in read-only mode.</p>
        </div>
      </header>

      <div className={styles.form}>
        <label className={styles.field}>
          Entry date
          <input type="text" value={entry.entry_date} disabled readOnly />
        </label>
        <label className={styles.field}>
          Company
          <input type="text" value={entry.company_name} disabled readOnly />
        </label>
        <label className={styles.field}>
          Vehicle
          <input type="text" value={entry.vehicle_number} disabled readOnly />
        </label>
        <label className={styles.field}>
          Cab type
          <input type="text" value={entry.cab_type} disabled readOnly />
        </label>
        <label className={styles.field}>
          Slot
          <input type="text" value={entry.slot} disabled readOnly />
        </label>
        <label className={styles.field}>
          Rate
          <input type="number" value={entry.rate} disabled readOnly />
        </label>
        <label className={styles.field}>
          Toll Charges
          <input type="number" value={entry.tolls} disabled readOnly />
        </label>
        <label className={styles.field}>
          Odometer start
          <input type="text" value={entry.odometer_start} disabled readOnly />
        </label>
        <label className={styles.field}>
          Odometer end
          <input type="text" value={entry.odometer_end} disabled readOnly />
        </label>
        <label className={styles.field}>
          Start time
          <input type="text" value={entry.start_time} disabled readOnly />
        </label>
        <label className={styles.field}>
          End time
          <input type="text" value={entry.end_time} disabled readOnly />
        </label>
        <label className={styles.field}>
          Pickup location
          <input type="text" value={entry.pickup_location} disabled readOnly />
        </label>
        <label className={styles.field}>
          Drop location
          <input type="text" value={entry.drop_location} disabled readOnly />
        </label>
        <label className={styles.field}>
          User
          <input type="text" value={entry.user_name} disabled readOnly />
        </label>
        <label className={styles.field}>
          Notes
          <textarea value={entry.notes} rows={7} disabled readOnly />
        </label>
        <label className={styles.field}>
          Total
          <input type="number" value={totalDisplay} disabled readOnly />
        </label>
      </div>
    </div>
  );
}
