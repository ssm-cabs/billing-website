"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "./MonthPicker";
import CustomDropdown from "./CustomDropdown";
import NotesPreview from "@/components/NotesPreview";
import { usePermissions } from "@/lib/usePermissions";
import {
  fetchCompanies,
  fetchEntries,
  isFirebaseConfigured,
  deleteEntry,
} from "@/lib/api";
import styles from "./entries.module.css";

export default function EntriesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [entries, setEntries] = useState([]);
  const [company, setCompany] = useState("all");
  const [vehicle, setVehicle] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState(null);

  const vehicleOptions = useMemo(() => {
    const uniqueVehicleNumbers = Array.from(
      new Set(entries.map((entry) => entry.vehicle_number).filter(Boolean))
    );
    return uniqueVehicleNumbers.map((vehicleNumber) => ({
      label: vehicleNumber,
      value: vehicleNumber,
    }));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (vehicle === "all") {
      return entries;
    }
    return entries.filter((entry) => entry.vehicle_number === vehicle);
  }, [entries, vehicle]);

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchEntries({
          company: company === "all" ? "" : company,
          month,
        });
        setEntries(data);
        setStatus("success");
      } catch (err) {
        setError(err.message || "Unable to load entries.");
        setStatus("error");
      }
    };

    load();
  }, [company, month]);

  useEffect(() => {
    const loadCompanies = async () => {
      setCompanyStatus("loading");
      try {
        const data = await fetchCompanies();
        setCompanies(data.filter((entry) => entry.active !== false));
        setCompanyStatus("success");
      } catch (err) {
        setCompanyStatus("error");
      }
    };

    loadCompanies();
  }, []);

  const handleDeleteEntry = (entryId) => {
    setDeleteEntryId(entryId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteEntry = async () => {
    if (!deleteEntryId) return;
    try {
      await deleteEntry(deleteEntryId);
      const data = await fetchEntries({
        company: company === "all" ? "" : company,
        month,
      });
      setEntries(data);
      setShowDeleteConfirm(false);
      setDeleteEntryId(null);
    } catch (err) {
      setError(err.message || "Failed to delete entry");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Ride entries</p>
          <h1>Daily Entry Desk</h1>
          <p className={styles.lead}>
            Review, filter, and export rides across corporate companies.
          </p>
        </div>
        {canEdit && (
          <div className={styles.headerActions}>
            <Link className={styles.primaryCta} href="/entries/new">
              New Entry
            </Link>
          </div>
        )}
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

      <section className={styles.filters}>
        <label className={styles.field}>
          Month
          <MonthPicker
            value={month}
            onChange={setMonth}
          />
        </label>
        <label className={styles.field}>
          Company
          <CustomDropdown
            options={companies}
            value={company}
            onChange={setCompany}
            status={companyStatus}
            getLabel={(c) => c.name}
            getValue={(c) => c.name}
            placeholder="Select company"
            defaultOption={{ label: "All Companies", value: "all" }}
          />
        </label>
        <label className={styles.field}>
          Vehicle
          <CustomDropdown
            options={vehicleOptions}
            value={vehicle}
            onChange={setVehicle}
            getLabel={(v) => v.label}
            getValue={(v) => v.value}
            placeholder="Select vehicle"
            defaultOption={{ label: "All Vehicles", value: "all" }}
          />
        </label>
      </section>

      <section className={styles.tableWrap}>
        {status === "loading" && <p>Loading entries...</p>}
        {status === "error" && <p className={styles.error}>{error}</p>}
        {status === "success" && filteredEntries.length === 0 && (
          <p>
            {entries.length === 0
              ? "No entries yet. Add the first ride entry."
              : "No entries found for selected filters."}
          </p>
        )}
        {filteredEntries.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Cab Type</th>
                <th>Slot</th>
                <th>Rate</th>
                <th>Route</th>
                <th>User</th>
                <th>Vehicle</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td data-label="Date">{entry.entry_date}</td>
                  <td data-label="Company">{entry.company_name}</td>
                  <td data-label="Cab Type">{entry.cab_type}</td>
                  <td data-label="Slot">{entry.slot}</td>
                  <td data-label="Rate">
                    {entry.rate > 0 ? `₹${entry.rate}` : "-"}
                  </td>
                  <td data-label="Route">
                    {`${entry.pickup_location} → ${entry.drop_location}`}
                  </td>
                  <td data-label="User">{entry.user_name || "-"}</td>
                  <td data-label="Vehicle">{entry.vehicle_number}</td>
                  <td data-label="Notes">
                    <NotesPreview text={entry.notes} />
                  </td>
                  <td data-label="Actions" className={styles.actionsCell}>
                    {canEdit && !entry.billed && (
                      <div className={styles.actions}>
                        <Link
                          href={`/entries/edit?id=${encodeURIComponent(entry.entry_id)}`}
                          className={styles.editBtn}
                          title="Edit"
                          aria-label="Edit"
                        >
                          <span className={styles.editIcon}>✎</span>
                        </Link>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteEntry(entry.entry_id)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Entry</h3>
            <p className={styles.modalSubtitle}>
              Are you sure you want to delete this entry? This action cannot be undone.
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={confirmDeleteEntry}
              >
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
