"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MonthPicker from "@/app/entries/MonthPicker";
import CustomDropdown from "@/app/entries/CustomDropdown";
import TimePicker from "@/app/entries/TimePicker";
import NotesPreview from "@/components/NotesPreview";
import {
  createEntryUpdateRequest,
  fetchEntries,
  fetchEntryUpdateRequests,
  getEntryUpdateRequestStatusCatalog,
  fetchVehicles,
  updateEntryUpdateRequest,
} from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./page.module.css";

function getVehicleIds(userData) {
  if (!Array.isArray(userData?.vehicle_ids)) return [];
  return userData.vehicle_ids.filter((id) => typeof id === "string" && id.trim());
}

function toComparableValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toTimestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  return 0;
}

function computeKmsFromOdometer(entry) {
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
}

function computeTimeTaken(entry) {
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
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesStatus, setEntriesStatus] = useState("idle");
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [vehicleId, setVehicleId] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${monthIndex}`;
  });
  const [requestByEntryId, setRequestByEntryId] = useState({});
  const [requestStatus, setRequestStatus] = useState("idle");
  const [requestSubmitStatus, setRequestSubmitStatus] = useState("idle");
  const [requestMessage, setRequestMessage] = useState("");
  const [pendingEntry, setPendingEntry] = useState(null);
  const [requestForm, setRequestForm] = useState({
    start_time: "",
    end_time: "",
    pickup_location: "",
    drop_location: "",
    odometer_start: "",
    odometer_end: "",
    tolls: "",
    reason: "",
  });

  useSessionTimeout();

  useEffect(() => {
    const checkAuth = async () => {
      const user = await waitForAuthInit();
      if (!user?.phoneNumber) {
        setIsLoading(false);
        router.push("/login");
        return;
      }

      try {
        const profile = await getUserData(user.phoneNumber);
        const role = normalizeRole(profile?.role);
        if (!isRole(role, "driver")) {
          setIsLoading(false);
          router.push(getHomeRouteForRole(role));
          return;
        }
        setUserData(profile);
      } catch (authError) {
        console.error("Failed to load driver profile:", authError);
        setIsLoading(false);
        router.push("/login");
        return;
      }

      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!userData) return;

    const loadVehicles = async () => {
      try {
        const allVehicles = await fetchVehicles();
        const allowedVehicleIds = new Set(getVehicleIds(userData));
        const linkedVehicles = allVehicles.filter((vehicle) =>
          allowedVehicleIds.has(vehicle.vehicle_id)
        );
        setVehicles(linkedVehicles);
      } catch (loadVehiclesError) {
        console.error("Failed to load driver vehicles:", loadVehiclesError);
        setError("Unable to load your vehicles.");
      }
    };

    loadVehicles();
  }, [userData]);

  useEffect(() => {
    if (!userData) return;

    const loadEntries = async () => {
      setEntriesStatus("loading");
      setError("");
      try {
        const allowedVehicleIds = getVehicleIds(userData);
        const resolvedVehicleIds =
          vehicleId === "all"
            ? allowedVehicleIds
            : allowedVehicleIds.includes(vehicleId)
              ? [vehicleId]
              : [];

        if (!resolvedVehicleIds.length) {
          setEntries([]);
          setEntriesStatus("success");
          return;
        }

        const allEntries = await Promise.all(
          resolvedVehicleIds.map((resolvedId) =>
            fetchEntries({
              vehicleId: resolvedId,
              month,
            })
          )
        );
        const flattened = allEntries
          .flat()
          .sort((a, b) => {
            const dateSort = String(b.entry_date || "").localeCompare(
              String(a.entry_date || "")
            );
            if (dateSort !== 0) return dateSort;
            return String(b.start_time || "").localeCompare(String(a.start_time || ""));
          });
        setEntries(flattened);
        setEntriesStatus("success");
      } catch (loadEntriesError) {
        console.error("Failed to load driver entries:", loadEntriesError);
        setEntriesStatus("error");
        setError(loadEntriesError.message || "Unable to load entries.");
      }
    };

    loadEntries();
  }, [month, userData, vehicleId]);

  useEffect(() => {
    const loadRequests = async () => {
      setRequestStatus("loading");
      try {
        const entryIds = entries
          .map((entry) => String(entry?.entry_id || "").trim())
          .filter(Boolean);
        if (!entryIds.length) {
          setRequestByEntryId({});
          setRequestStatus("success");
          return;
        }
        const requests = await fetchEntryUpdateRequests({
          entryIds,
          month,
          orderByField: "created_at",
          orderByDirection: "desc",
          limitCount: 200,
        });
        const latestByEntryId = requests.reduce((acc, request) => {
          const entryKey = String(request.entry_id || "").trim();
          if (!entryKey) return acc;
          const existing = acc[entryKey];
          if (!existing) {
            acc[entryKey] = request;
            return acc;
          }
          const existingTs = toTimestampValue(existing.updated_at || existing.created_at);
          const currentTs = toTimestampValue(request.updated_at || request.created_at);
          if (currentTs >= existingTs) {
            acc[entryKey] = request;
          }
          return acc;
        }, {});
        setRequestByEntryId(latestByEntryId);
        setRequestStatus("success");
      } catch (loadRequestsError) {
        console.error("Failed to load entry update requests:", loadRequestsError);
        setRequestStatus("error");
      }
    };

    loadRequests();
  }, [entries, month]);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.vehicle_id === vehicleId) || null,
    [vehicleId, vehicles]
  );

  const statusDetailByKey = useMemo(() => {
    const catalog = getEntryUpdateRequestStatusCatalog();
    return catalog.reduce((acc, item) => {
      const key = String(item.status || "").trim().toLowerCase();
      if (!key) return acc;
      acc[key] = String(item.detail || "").trim();
      return acc;
    }, {});
  }, []);

  const getRequestStatusClassName = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "submitted") return `${styles.status} ${styles.submitted}`;
    if (normalized === "approved") return `${styles.status} ${styles.accepted}`;
    if (normalized === "rejected") return `${styles.status} ${styles.rejected}`;
    return styles.status;
  };

  const openUpdateRequestModal = (entry) => {
    const existingRequest = requestByEntryId[String(entry?.entry_id || "").trim()] || null;
    const existingUpdates =
      existingRequest?.requested_updates &&
      typeof existingRequest.requested_updates === "object"
        ? existingRequest.requested_updates
        : {};
    setPendingEntry(entry);
    setRequestMessage("");
    setRequestSubmitStatus("idle");
    setRequestForm({
      start_time: String(
        existingUpdates.start_time ?? entry?.start_time ?? ""
      ).trim(),
      end_time: String(existingUpdates.end_time ?? entry?.end_time ?? "").trim(),
      pickup_location: String(
        existingUpdates.pickup_location ?? entry?.pickup_location ?? ""
      ).trim(),
      drop_location: String(
        existingUpdates.drop_location ?? entry?.drop_location ?? ""
      ).trim(),
      odometer_start: String(
        existingUpdates.odometer_start ?? entry?.odometer_start ?? ""
      ).trim(),
      odometer_end: String(
        existingUpdates.odometer_end ?? entry?.odometer_end ?? ""
      ).trim(),
      tolls: String(existingUpdates.tolls ?? entry?.tolls ?? "").trim(),
      reason: String(existingRequest?.reason || "").trim(),
    });
  };

  const handleUpdateRequest = async () => {
    if (!pendingEntry) return;

    const rawUpdates = {
      start_time: requestForm.start_time,
      end_time: requestForm.end_time,
      pickup_location: requestForm.pickup_location,
      drop_location: requestForm.drop_location,
      odometer_start: requestForm.odometer_start,
      odometer_end: requestForm.odometer_end,
      tolls: requestForm.tolls,
    };

    const requestedUpdates = Object.entries(rawUpdates).reduce((acc, [key, value]) => {
      const currentValue = toComparableValue(pendingEntry?.[key]);
      const nextValue = toComparableValue(value);
      if (nextValue !== currentValue) {
        if (key === "odometer_start" || key === "odometer_end" || key === "tolls") {
          acc[key] = nextValue === "" ? "" : Number(nextValue);
        } else {
          acc[key] = nextValue;
        }
      }
      return acc;
    }, {});

    if (!Object.keys(requestedUpdates).length) {
      setRequestSubmitStatus("error");
      setRequestMessage("Please change at least one field before submitting.");
      return;
    }
    try {
      setRequestSubmitStatus("loading");
      setRequestMessage("");
      const existingRequest = requestByEntryId[pendingEntry.entry_id];
      const existingId = String(existingRequest?.entry_update_id || "").trim();
      const payload = {
        entry_id: pendingEntry.entry_id,
        entry_date: pendingEntry.entry_date || "",
        vehicle_id: pendingEntry.vehicle_id || "",
        vehicle_number: pendingEntry.vehicle_number || "",
        user_name: userData?.name || userData?.phone || "",
        requested_updates: requestedUpdates,
        reason: String(requestForm.reason || "").trim(),
        status: "submitted",
      };
      const saved = existingId
        ? await updateEntryUpdateRequest(existingId, payload)
        : await createEntryUpdateRequest(payload);

      setRequestByEntryId((prev) => ({
        ...prev,
        [pendingEntry.entry_id]: {
          ...(prev[pendingEntry.entry_id] || {}),
          entry_update_id: saved.entry_update_id,
          entry_id: pendingEntry.entry_id,
          entry_date: pendingEntry.entry_date || "",
          vehicle_id: pendingEntry.vehicle_id || "",
          vehicle_number: pendingEntry.vehicle_number || "",
          user_name: userData?.name || userData?.phone || "",
          requested_updates: requestedUpdates,
          status: "submitted",
          reason: String(requestForm.reason || "").trim(),
          updated_at: Date.now(),
        },
      }));
      setRequestSubmitStatus("success");
      setRequestMessage("Update request submitted for approval.");
      setPendingEntry(null);
    } catch (submitError) {
      setRequestSubmitStatus("error");
      setRequestMessage(submitError.message || "Failed to submit update request.");
    }
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <UserSession />
      </div>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Driver</p>
          <h1>Driver Dashboard</h1>
          <p className={styles.lead}>
            Review your month-wise ride entries and raise update requests for approval.
          </p>
        </div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Vehicle Entries</h3>
        </div>
        <section className={styles.filters}>
          <label className={styles.field}>
            Month
            <MonthPicker value={month} onChange={setMonth} />
          </label>
          <label className={styles.field}>
            Vehicle
            <CustomDropdown
              options={vehicles}
              value={vehicleId}
              onChange={setVehicleId}
              getLabel={(vehicle) =>
                `${vehicle.vehicle_number || "-"} · ${vehicle.cab_type || "Cab"}`
              }
              getValue={(vehicle) => vehicle.vehicle_id}
              placeholder="Select vehicle"
              defaultOption={{ label: "All Vehicles", value: "all" }}
              buttonClassName={styles.dropdownButton}
            />
          </label>
        </section>
        {selectedVehicle ? (
          <p className={styles.requestHint}>
            Showing entries for <strong>{selectedVehicle.vehicle_number}</strong>.
          </p>
        ) : null}
        {error && <p className={styles.error}>{error}</p>}
        {requestMessage && (
          <p className={requestSubmitStatus === "success" ? styles.success : styles.error}>
            {requestMessage}
          </p>
        )}
        {entriesStatus === "loading" && <p className={styles.empty}>Loading entries...</p>}
        {entriesStatus === "error" && (
          <p className={styles.error}>Unable to load your entries.</p>
        )}
        {entriesStatus === "success" && entries.length === 0 && (
          <p className={styles.empty}>No entries found for selected filters.</p>
        )}
        {entries.length > 0 && (
          <div className={styles.table}>
            <div className={styles.requestHeader}>
              <span>Date</span>
              <span>Company</span>
              <span>Vehicle</span>
              <span>Slot</span>
              <span>Route</span>
              <span>Time Taken</span>
              <span>Kms</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {entries.map((entry) => {
              const latestRequest = requestByEntryId[entry.entry_id] || null;
              const statusLabel = latestRequest?.status || "-";
              const statusDetail =
                statusDetailByKey[String(statusLabel || "").trim().toLowerCase()] || "";
              return (
                <div key={entry.entry_id} className={styles.requestRow}>
                  <span>
                    {entry.entry_date || "-"} {entry.start_time || ""}
                  </span>
                  <span>
                    <NotesPreview text={entry.company_name} maxWidth={165} />
                  </span>
                  <span>{entry.vehicle_number || "-"}</span>
                  <span>{entry.slot || "-"}</span>
                  <span>
                    <NotesPreview
                      text={`${entry.pickup_location || "-"} → ${entry.drop_location || "-"}`}
                      maxWidth={180}
                    />
                  </span>
                  <span>{computeTimeTaken(entry) ?? "-"}</span>
                  <span>{computeKmsFromOdometer(entry) ?? "-"}</span>
                  <span>
                    {latestRequest ? (
                      <span
                        className={`${getRequestStatusClassName(statusLabel)} ${styles.statusWithTooltip}`}
                      >
                        {statusLabel}
                        {statusDetail ? (
                          <span className={styles.statusTooltip}>{statusDetail}</span>
                        ) : null}
                      </span>
                    ) : (
                      "-"
                    )}
                  </span>
                  <span>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => openUpdateRequestModal(entry)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <span className={styles.editIcon}>✎</span>
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {requestStatus === "error" && (
          <p className={styles.error}>Unable to load update request statuses.</p>
        )}
      </section>

      {pendingEntry ? (
        <div className={styles.modalOverlay} onClick={() => setPendingEntry(null)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <h3 className={styles.modalTitle}>Request Entry Update</h3>
            <p className={styles.modalSubtitle}>
              Entry <strong>{pendingEntry.entry_date || "-"}</strong>{" "}
              <strong>{pendingEntry.start_time || ""}</strong> for{" "}
              <strong>{pendingEntry.vehicle_number || "-"}</strong>
            </p>

            <div className={styles.modalForm}>
              <label className={styles.field}>
                Start time
                <TimePicker
                  value={requestForm.start_time}
                  onChange={(value) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      start_time: value,
                    }))
                  }
                  placeholder="Select start time"
                />
              </label>
              <label className={styles.field}>
                End time
                <TimePicker
                  value={requestForm.end_time}
                  onChange={(value) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      end_time: value,
                    }))
                  }
                  placeholder="Select end time"
                />
              </label>
              <label className={styles.field}>
                Pickup location
                <input
                  type="text"
                  value={requestForm.pickup_location}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      pickup_location: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                Drop location
                <input
                  type="text"
                  value={requestForm.drop_location}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      drop_location: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                Odometer start
                <input
                  type="number"
                  min="0"
                  value={requestForm.odometer_start}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      odometer_start: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                Odometer end
                <input
                  type="number"
                  min="0"
                  value={requestForm.odometer_end}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      odometer_end: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                Tolls
                <input
                  type="number"
                  min="0"
                  value={requestForm.tolls}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      tolls: event.target.value,
                    }))
                  }
                />
              </label>
              <label className={styles.field}>
                Reason for update
                <textarea
                  rows={3}
                  value={requestForm.reason}
                  onChange={(event) =>
                    setRequestForm((prev) => ({ ...prev, reason: event.target.value }))
                  }
                  placeholder="Explain why this entry needs correction."
                />
              </label>
            </div>
            {requestMessage && (
              <p className={requestSubmitStatus === "error" ? styles.error : styles.success}>
                {requestMessage}
              </p>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPendingEntry(null)}
                disabled={requestSubmitStatus === "loading"}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleUpdateRequest}
                disabled={requestSubmitStatus === "loading"}
              >
                {requestSubmitStatus === "loading" ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
