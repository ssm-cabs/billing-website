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
  fetchVehicles,
  isFirebaseConfigured,
  deleteEntry,
} from "@/lib/api";
import styles from "./entries.module.css";

const computeKmsFromOdometer = (entry) => {
  const startRaw = entry?.odometer_start;
  const endRaw = entry?.odometer_end;

  if (endRaw === "" || endRaw === null || endRaw === undefined) {
    return null;
  }

  if (startRaw === "" || startRaw === null || startRaw === undefined) {
    return null;
  }

  const start = Number(startRaw);
  const end = Number(endRaw);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return end - start;
};

export default function EntriesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [entries, setEntries] = useState([]);
  const [companyId, setCompanyId] = useState("all");
  const [vehicleId, setVehicleId] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [vehicleStatus, setVehicleStatus] = useState("idle");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState(null);

  const vehicleOptions = useMemo(
    () => vehicles.filter((vehicle) => vehicle.active !== false),
    [vehicles]
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.company_id === companyId) || null,
    [companies, companyId]
  );
  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.vehicle_id === vehicleId) || null,
    [vehicles, vehicleId]
  );

  useEffect(() => {
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        const data = await fetchEntries({
          company: selectedCompany?.name || "",
          companyId: companyId === "all" ? "" : companyId,
          vehicle: selectedVehicle?.vehicle_number || "",
          vehicleId: vehicleId === "all" ? "" : vehicleId,
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
  }, [companyId, month, selectedCompany, selectedVehicle, vehicleId]);

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

  useEffect(() => {
    const loadVehicles = async () => {
      setVehicleStatus("loading");
      try {
        const data = await fetchVehicles();
        setVehicles(data);
        setVehicleStatus("success");
      } catch (_) {
        setVehicleStatus("error");
      }
    };

    loadVehicles();
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
        company: selectedCompany?.name || "",
        companyId: companyId === "all" ? "" : companyId,
        vehicle: selectedVehicle?.vehicle_number || "",
        vehicleId: vehicleId === "all" ? "" : vehicleId,
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
            value={companyId}
            onChange={setCompanyId}
            status={companyStatus}
            getLabel={(c) => c.name}
            getValue={(c) => c.company_id}
            placeholder="Select company"
            defaultOption={{ label: "All Companies", value: "all" }}
          />
        </label>
        <label className={styles.field}>
          Vehicle
          <CustomDropdown
            options={vehicleOptions}
            value={vehicleId}
            onChange={setVehicleId}
            status={vehicleStatus}
            getLabel={(v) => v.vehicle_number}
            getValue={(v) => v.vehicle_id}
            placeholder="Select vehicle"
            defaultOption={{ label: "All Vehicles", value: "all" }}
          />
        </label>
      </section>

      <section className={styles.tableWrap}>
        {status === "loading" && <p>Loading entries...</p>}
        {status === "error" && <p className={styles.error}>{error}</p>}
        {status === "success" && entries.length === 0 && (
          <p>
            No entries found for selected filters.
          </p>
        )}
        {entries.length > 0 && (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Vehicle</th>
                <th>Slot</th>
                <th>Rate</th>
                <th>KMS</th>
                <th className={styles.routeColumn}>Route</th>
                <th>User</th>
                <th>Actions</th>
                <th className={styles.notesColumn}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td data-label="Date">{entry.entry_date}</td>
                  <td data-label="Company">{entry.company_name}</td>
                  <td data-label="Vehicle">{entry.vehicle_number}</td>
                  <td data-label="Slot">{entry.slot}</td>
                  <td data-label="Rate">
                    {entry.rate > 0 ? `₹${entry.rate}` : "-"}
                  </td>
                  <td data-label="KMS">
                    {computeKmsFromOdometer(entry) ?? "-"}
                  </td>
                  <td data-label="Route" className={styles.routeColumn}>
                    <NotesPreview
                      text={`${entry.pickup_location} → ${entry.drop_location}`}
                      maxWidth={180}
                    />
                  </td>
                  <td data-label="User">{entry.user_name || "-"}</td>
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
                  <td data-label="Notes" className={styles.notesColumn}>
                    <NotesPreview text={entry.notes} maxWidth={170} />
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
