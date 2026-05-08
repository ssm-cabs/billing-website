"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonthPicker from "./MonthPicker";
import CustomDropdown from "./CustomDropdown";
import DatePicker from "./DatePicker";
import NotesPreview from "@/components/NotesPreview";
import { usePermissions } from "@/lib/usePermissions";
import { canAccessBackofficeDashboard } from "@/lib/roleRouting";
import {
  countBookingRequests,
  countEntryUpdateRequests,
  fetchCompanies,
  fetchEntries,
  fetchVehicles,
  isFirebaseConfigured,
  deleteEntry,
} from "@/lib/api";
import styles from "./entries.module.css";

const ENTRY_ACTION_META = {
  bookingRequests: { accent: "#8f5a3c", bg: "#f8eee6" },
  updateRequests: { accent: "#4d5c9a", bg: "#eef1fb" },
  createEntry: { accent: "#2b7a53", bg: "#e8f6ef" },
};

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

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildTimestampForFilename = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
};

export default function EntriesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [entries, setEntries] = useState([]);
  const [companyId, setCompanyId] = useState("all");
  const [vehicleId, setVehicleId] = useState("all");
  const [entryDateFilter, setEntryDateFilter] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
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
  const [bookingRequestCount, setBookingRequestCount] = useState(0);
  const [updateRequestCount, setUpdateRequestCount] = useState(0);
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
  const slotOptions = useMemo(() => {
    const uniqueSlots = new Set(
      entries.map((entry) => String(entry?.slot || "").trim()).filter(Boolean)
    );
    return Array.from(uniqueSlots).sort((a, b) => a.localeCompare(b));
  }, [entries]);
  const userOptions = useMemo(() => {
    const uniqueUsers = new Set(
      entries.map((entry) => String(entry?.user_name || "").trim()).filter(Boolean)
    );
    return Array.from(uniqueUsers).sort((a, b) => a.localeCompare(b));
  }, [entries]);
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesDate = !entryDateFilter || String(entry?.entry_date || "").trim() === entryDateFilter;
      const matchesSlot = slotFilter === "all" || String(entry?.slot || "").trim() === slotFilter;
      const matchesUser = userFilter === "all" || String(entry?.user_name || "").trim() === userFilter;
      return matchesDate && matchesSlot && matchesUser;
    });
  }, [entries, entryDateFilter, slotFilter, userFilter]);

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

  useEffect(() => {
    const loadRequestCounts = async () => {
      if (permissionsLoading) return;

      if (!canEdit) {
        setBookingRequestCount(0);
      }
      if (!isDashboardUser) {
        setUpdateRequestCount(0);
      }

      const requests = [];
      if (canEdit) {
        requests.push(
          countBookingRequests({
            month,
            statuses: ["submitted", "accepted"],
          })
        );
      }
      if (isDashboardUser) {
        requests.push(
          countEntryUpdateRequests({
            month,
            status: "submitted",
          })
        );
      }

      if (!requests.length) return;

      const results = await Promise.allSettled(requests);
      let index = 0;

      if (canEdit) {
        const bookingResult = results[index];
        if (bookingResult?.status === "fulfilled") {
          setBookingRequestCount(bookingResult.value);
        } else {
          setBookingRequestCount(0);
        }
        index += 1;
      }

      if (isDashboardUser) {
        const updateResult = results[index];
        if (updateResult?.status === "fulfilled") {
          setUpdateRequestCount(updateResult.value);
        } else {
          setUpdateRequestCount(0);
        }
      }
    };

    loadRequestCounts();
  }, [canEdit, isDashboardUser, month, permissionsLoading]);

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

  const handleDownloadCsv = () => {
    if (!filteredEntries.length || typeof window === "undefined") return;

    const billingKeys = [
      "entry_date",
      "guest_name",
      "user_name",
      "vehicle_number",
      "cab_type",
      "slot",
      "start_time",
      "end_time",
      "kms",
      "hours",
      "extra_per_hour",
      "extra_per_km",
      "extra_time_cost",
      "extra_kms_cost",
      "rate",
      "tolls",
      "total",
    ];

    const headers = [...billingKeys, "time_taken"];
    const rows = filteredEntries.map((entry) => {
      const values = billingKeys.map((key) => entry?.[key]);
      values.push(
        computeTimeTaken(entry) ?? ""
      );
      return values.map(escapeCsvCell).join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `entries_${buildTimestampForFilename()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
        </div>
        {(canEdit || isDashboardUser) && (
          <div className={styles.headerActions}>
            {canEdit ? (
              <Link
                className={styles.primaryCta}
                href="/entries/booking-requests"
                aria-label="Booking Requests"
                style={{
                  "--cta-accent": ENTRY_ACTION_META.bookingRequests.accent,
                  "--cta-bg": ENTRY_ACTION_META.bookingRequests.bg,
                }}
              >
                <span className={styles.ctaIconWrap}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 2v3M17 2v3M4 7h16M6 11h5M6 15h8M6 19h6M16 14l2 2 4-4" />
                  </svg>
                  {bookingRequestCount > 0 ? (
                    <span className={styles.ctaCount}>{bookingRequestCount}</span>
                  ) : null}
                </span>
                <span className={styles.ctaTooltip}>
                  <span className={styles.ctaTooltipTitle}>Booking Requests</span>
                  <span className={styles.ctaTooltipDescription}>Review and convert ride requests.</span>
                </span>
              </Link>
            ) : null}
            {isDashboardUser ? (
              <Link
                className={styles.primaryCta}
                href="/entries/update-requests"
                aria-label="Update Requests"
                style={{
                  "--cta-accent": ENTRY_ACTION_META.updateRequests.accent,
                  "--cta-bg": ENTRY_ACTION_META.updateRequests.bg,
                }}
              >
                <span className={styles.ctaIconWrap}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 12a9 9 0 0 1 15.4-6.4M21 12a9 9 0 0 1-15.4 6.4M3 4v5h5M21 20v-5h-5" />
                  </svg>
                  {updateRequestCount > 0 ? (
                    <span className={styles.ctaCount}>{updateRequestCount}</span>
                  ) : null}
                </span>
                <span className={styles.ctaTooltip}>
                  <span className={styles.ctaTooltipTitle}>Update Requests</span>
                  <span className={styles.ctaTooltipDescription}>Review and approve ride updates.</span>
                </span>
              </Link>
            ) : null}
            {canEdit ? (
              <Link
                className={styles.primaryCta}
                href="/entries/new"
                aria-label="Create Entry"
                style={{
                  "--cta-accent": ENTRY_ACTION_META.createEntry.accent,
                  "--cta-bg": ENTRY_ACTION_META.createEntry.bg,
                }}
              >
                <span className={styles.ctaIconWrap}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <span className={styles.ctaTooltip}>
                  <span className={styles.ctaTooltipTitle}>Create Entry</span>
                  <span className={styles.ctaTooltipDescription}>Create and submit ride entries.</span>
                </span>
              </Link>
            ) : null}
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
          Date
          <DatePicker
            value={entryDateFilter}
            onChange={setEntryDateFilter}
            allowClear
            clearLabel="Clear date"
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
            searchable
            searchPlaceholder="Search company"
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
            searchable
            searchPlaceholder="Search vehicle"
          />
        </label>
        <label className={styles.field}>
          Slot
          <CustomDropdown
            options={slotOptions}
            value={slotFilter}
            onChange={setSlotFilter}
            getLabel={(slot) => slot}
            getValue={(slot) => slot}
            placeholder="Select slot"
            defaultOption={{ label: "All Slots", value: "all" }}
          />
        </label>
        <label className={styles.field}>
          User
          <div className={styles.userFilterRow}>
            <CustomDropdown
              options={userOptions}
              value={userFilter}
              onChange={setUserFilter}
              getLabel={(userName) => userName}
              getValue={(userName) => userName}
              placeholder="Select user"
              defaultOption={{ label: "All Users", value: "all" }}
            />
            <button
              type="button"
              className={styles.downloadBtn}
              onClick={handleDownloadCsv}
              title="Download filtered entries as CSV"
              aria-label="Download filtered entries as CSV"
              disabled={filteredEntries.length === 0}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11M8 10l4 4 4-4M4 17h16v4H4z" />
              </svg>
            </button>
          </div>
        </label>
      </section>

      <section className={styles.tableWrap}>
        {status === "loading" && <p>Loading entries...</p>}
        {status === "error" && <p className={styles.error}>{error}</p>}
        {status === "success" && filteredEntries.length === 0 && (
          <p>
            No entries found for selected filters.
          </p>
        )}
        {filteredEntries.length > 0 && (
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
              {filteredEntries.map((entry) => (
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
