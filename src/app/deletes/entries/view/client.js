"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { fetchDeletedEntrySnapshotByDocId } from "@/lib/deletesApi";
import { usePermissions } from "@/lib/usePermissions";
import styles from "@/app/entries/edit.module.css";

const initialState = {
  entry_date: "",
  company_name: "",
  slot: "",
  start_time: "",
  end_time: "",
  pickup_location: "",
  drop_location: "",
  guest_name: "",
  guest_number: "",
  agent_name: "",
  vehicle_number: "",
  cab_type: "",
  user_name: "",
  rate: 0,
  odometer_start: "",
  odometer_end: "",
  tolls: "",
  bata: "",
  notes: "",
  total: 0,
};

export default function ClientDeletedEntryPage() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("id") || "";
  const { canView, loading: permissionsLoading } = usePermissions("deletes");
  const [entry, setEntry] = useState(initialState);
  const [loadingEntry, setLoadingEntry] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletedAt, setDeletedAt] = useState("");
  const [deletedBy, setDeletedBy] = useState("");

  useEffect(() => {
    if (!docId) {
      setLoadError("Invalid deleted entry ID");
      setLoadingEntry(false);
      return;
    }

    const loadEntrySnapshot = async () => {
      try {
        setLoadingEntry(true);
        const archived = await fetchDeletedEntrySnapshotByDocId(docId);
        const data = archived?.payload || {};
        setEntry({
          entry_date: data.entry_date || "",
          company_name: data.company_name || "",
          slot: data.slot || "",
          start_time: data.start_time || "",
          end_time: data.end_time || "",
          pickup_location: data.pickup_location || "",
          drop_location: data.drop_location || "",
          guest_name: data.guest_name || "",
          guest_number: data.guest_number || "",
          agent_name: data.agent_name || "",
          vehicle_number: data.vehicle_number || "",
          cab_type: data.cab_type || "",
          user_name: data.user_name || "",
          rate: Number(data.rate) || 0,
          odometer_start: data.odometer_start ?? "",
          odometer_end: data.odometer_end ?? "",
          tolls: data.tolls ?? "",
          bata: data.bata ?? "",
          notes: data.notes || "",
          total: Number(data.total) || Number(data.rate) || 0,
        });
        const actorName = String(archived?.deleted_by?.name || "").trim();
        const actorPhone = String(archived?.deleted_by?.phone || "").trim();
        const actorRole = String(archived?.deleted_by?.role || "").trim();
        setDeletedBy(
          [actorName || "-", actorPhone || "-", actorRole || "-"].join(" | ")
        );
        if (typeof archived?.deleted_at?.toDate === "function") {
          setDeletedAt(archived.deleted_at.toDate().toLocaleString());
        } else if (typeof archived?.deleted_at?.seconds === "number") {
          setDeletedAt(new Date(archived.deleted_at.seconds * 1000).toLocaleString());
        } else {
          setDeletedAt(String(archived?.deleted_at || "-"));
        }
        setLoadError("");
      } catch (err) {
        setLoadError(err.message || "Failed to load deleted entry snapshot");
      } finally {
        setLoadingEntry(false);
      }
    };

    loadEntrySnapshot();
  }, [docId]);

  const totalDisplay = useMemo(() => Number(entry.total) || 0, [entry.total]);

  if (permissionsLoading || loadingEntry) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/deletes">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Deleted entry</p>
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
            <Link className={styles.backLink} href="/deletes">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Deleted entry</p>
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
          <Link className={styles.backLink} href="/deletes">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Deleted entry</p>
          <h1>Archived Entry Snapshot</h1>
          <p className={styles.lead}>Read-only payload captured before deletion.</p>
        </div>
      </header>

      <div className={styles.form}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Trip Basics</h2>
          <div className={styles.sectionGrid}>
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
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Billing & Meter</h2>
          <div className={styles.sectionGrid}>
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
              Bata
              <input type="number" value={entry.bata} disabled readOnly />
            </label>
            <label className={styles.field}>
              Total
              <input type="number" value={totalDisplay} disabled readOnly />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ride Details</h2>
          <div className={styles.sectionGrid}>
            <label className={styles.field}>
              Pickup location
              <input type="text" value={entry.pickup_location} disabled readOnly />
            </label>
            <label className={styles.field}>
              Drop location
              <input type="text" value={entry.drop_location} disabled readOnly />
            </label>
            <label className={styles.field}>
              Guest name
              <input type="text" value={entry.guest_name} disabled readOnly />
            </label>
            <label className={styles.field}>
              Guest number
              <input type="text" value={entry.guest_number} disabled readOnly />
            </label>
            <label className={styles.field}>
              Agent name
              <input type="text" value={entry.agent_name} disabled readOnly />
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Archive Audit</h2>
          <div className={styles.sectionGrid}>
            <label className={styles.field}>
              Created by
              <input type="text" value={entry.user_name} disabled readOnly />
            </label>
            <label className={styles.field}>
              Deleted at
              <input type="text" value={deletedAt} disabled readOnly />
            </label>
            <label className={styles.field}>
              Deleted by
              <input type="text" value={deletedBy} disabled readOnly />
            </label>
            <label className={styles.field}>
              Notes
              <textarea value={entry.notes} rows={6} disabled readOnly />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
