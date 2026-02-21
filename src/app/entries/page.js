"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "./MonthPicker";
import CustomDropdown from "./CustomDropdown";
import NotesPreview from "@/components/NotesPreview";
import { usePermissions } from "@/lib/usePermissions";
import { canAccessBackofficeDashboard } from "@/lib/roleRouting";
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

const computeTimeTaken = (entry) => {
  const startTime = String(entry?.start_time || "").trim();
  const endTime = String(entry?.end_time || "").trim();

  if (!startTime || !endTime) {
    return null;
  }

  const [startHourRaw, startMinuteRaw] = startTime.split(":");
  const [endHourRaw, endMinuteRaw] = endTime.split(":");

  const startHour = Number(startHourRaw);
  const startMinute = Number(startMinuteRaw);
  const endHour = Number(endHourRaw);
  const endMinute = Number(endMinuteRaw);

  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endHour) ||
    !Number.isInteger(endMinute)
  ) {
    return null;
  }

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;

  if (endTotalMinutes < startTotalMinutes) {
    return null;
  }

  const diffMinutes = endTotalMinutes - startTotalMinutes;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
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
  const isDashboardUser = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("user_data");
      if (!raw) return false;
      const userData = JSON.parse(raw);
      return canAccessBackofficeDashboard(userData?.role);
    } catch (_) {
      return false;
    }
  }, []);

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

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <p>Loading permissions...</p>
      </div>
    );
  }

  if (!canView) {
    return null;
  }

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
          {(canEdit || isDashboardUser) && (
            <div className={styles.headerActions}>
              {canEdit ? (
                <Link className={styles.primaryCta} href="/entries/booking-requests">
                  <span className={styles.ctaTopRow}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 2v3M17 2v3M4 7h16M6 11h5M6 15h8M6 19h6M16 14l2 2 4-4" />
                    </svg>
                    <span className={styles.ctaTitle}>Booking Requests</span>
                  </span>
                  <span className={styles.ctaDescription}>Review and convert incoming ride requests.</span>
                </Link>
              ) : null}
              {isDashboardUser ? (
                <Link className={styles.primaryCta} href="/entries/update-requests">
                  <span className={styles.ctaTopRow}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 12a9 9 0 0 1 15.4-6.4M21 12a9 9 0 0 1-15.4 6.4M3 4v5h5M21 20v-5h-5" />
                    </svg>
                    <span className={styles.ctaTitle}>Update Requests</span>
                  </span>
                  <span className={styles.ctaDescription}>Review and approve incoming ride updates.</span>
                </Link>
              ) : null}
              {canEdit ? (
                <Link className={styles.primaryCta} href="/entries/new">
                  <span className={styles.ctaTopRow}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className={styles.ctaTitle}>Create Entry</span>
                  </span>
                  <span className={styles.ctaDescription}>Create and submit daily ride entries.</span>
                </Link>
              ) : null}
            </div>
          )}
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
                <th className={styles.companyColumn}>Company</th>
                <th>Vehicle</th>
                <th>Slot</th>
                <th>Total</th>
                <th>Time Taken</th>
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
                  <td data-label="Company" className={styles.companyColumn}>
                    <NotesPreview text={entry.company_name} maxWidth={165} />
                  </td>
                  <td data-label="Vehicle">{entry.vehicle_number}</td>
                  <td data-label="Slot">{entry.slot}</td>
                  <td data-label="Total">
                    {(Number(entry.total) || Number(entry.rate) || 0) > 0
                      ? `₹${Number(entry.total) || Number(entry.rate) || 0}`
                      : "-"}
                  </td>
                  <td data-label="Time Taken">
                    {computeTimeTaken(entry) ?? "-"}
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
                    {(canView || (canEdit && !entry.billed)) && (
                      <div className={styles.actions}>
                        {canView ? (
                          <Link
                            href={`/entries/view?id=${encodeURIComponent(entry.entry_id)}`}
                            className={styles.viewBtn}
                            title="View"
                            aria-label="View"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Link>
                        ) : null}
                        {canEdit && !entry.billed ? (
                          <>
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
                          </>
                        ) : null}
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
