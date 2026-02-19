"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import CustomDropdown from "../entries/CustomDropdown";
import {
  createVehicle,
  createVehiclePricing,
  deleteVehiclePricing,
  fetchVehiclePricing,
  fetchVehicles,
  isFirebaseConfigured,
  updateVehiclePricing,
  updateVehicle,
} from "@/lib/api";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { deleteUser, upsertDriverUser } from "@/lib/usersApi";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./vehicles.module.css";

const initialState = {
  vehicle_number: "",
  cab_type: "",
  capacity: "",
  active: true,
  ownership_type: "own",
  driver_name: "",
  driver_phone: "",
  driver_dashboard_access: false,
  notes: "",
};

const cabTypeOptions = [
  { label: "Sedan", value: "Sedan" },
  { label: "Premium Sedan", value: "Premium Sedan" },
  { label: "SUV", value: "SUV" },
  { label: "Premium SUV", value: "Premium SUV" },
];

const vehicleStatusOptions = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
];

const ownershipTypeOptions = [
  { label: "Own Vehicle", value: "own" },
  { label: "Leased Vehicle", value: "leased" },
];

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "8hr", value: "8hr" },
];

const initialPricing = {
  cab_type: "",
  slot: "",
  rate: "",
  extra_per_hour: "",
  extra_per_km: "",
};

export default function VehiclesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("vehicles");
  const [vehicles, setVehicles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [editForm, setEditForm] = useState({
    capacity: "",
    driver_name: "",
    driver_phone: "",
    driver_dashboard_access: false,
    active: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pricingModalVehicleId, setPricingModalVehicleId] = useState(null);
  const [pricingByVehicle, setPricingByVehicle] = useState({});
  const [pricingFormByVehicle, setPricingFormByVehicle] = useState({});
  const [pricingStatus, setPricingStatus] = useState({});
  const [pricingEditByVehicle, setPricingEditByVehicle] = useState({});

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

  const setPricingField = (vehicleId, name, value) => {
    setPricingFormByVehicle((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || initialPricing),
        [name]: value,
      },
    }));
  };

  const updatePricingField = (vehicleId, event) => {
    const { name, value } = event.target;
    setPricingFormByVehicle((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || initialPricing),
        [name]: value,
      },
    }));
  };

  const openPricingModal = async (vehicleId) => {
    setPricingModalVehicleId(vehicleId);
    if (!pricingByVehicle[vehicleId]) {
      setPricingStatus((prev) => ({ ...prev, [vehicleId]: "loading" }));
      try {
        const data = await fetchVehiclePricing(vehicleId);
        setPricingByVehicle((prev) => ({ ...prev, [vehicleId]: data }));
        setPricingStatus((prev) => ({ ...prev, [vehicleId]: "success" }));
      } catch (_) {
        setPricingStatus((prev) => ({ ...prev, [vehicleId]: "error" }));
      }
    }
  };

  const closePricingModal = () => {
    setPricingModalVehicleId(null);
  };

  const handlePricingSubmit = async (event, vehicle) => {
    event.preventDefault();
    const payload = pricingFormByVehicle[vehicle.vehicle_id] || initialPricing;
    const rateValue = payload.rate ? Number(payload.rate) : 0;
    const extraPerHourValue = payload.extra_per_hour ? Number(payload.extra_per_hour) : 0;
    const extraPerKmValue = payload.extra_per_km ? Number(payload.extra_per_km) : 0;

    try {
      await createVehiclePricing(vehicle.vehicle_id, {
        ...payload,
        cab_type: payload.cab_type || vehicle.cab_type || "",
        rate: rateValue,
        extra_per_hour: extraPerHourValue,
        extra_per_km: extraPerKmValue,
      });
      const data = await fetchVehiclePricing(vehicle.vehicle_id);
      setPricingByVehicle((prev) => ({ ...prev, [vehicle.vehicle_id]: data }));
      setPricingFormByVehicle((prev) => ({
        ...prev,
        [vehicle.vehicle_id]: initialPricing,
      }));
      setPricingStatus((prev) => ({ ...prev, [vehicle.vehicle_id]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [vehicle.vehicle_id]: "error" }));
    }
  };

  const startEditPricing = (vehicleId, pricing) => {
    setPricingEditByVehicle((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || {}),
        [pricing.pricing_id]: {
          cab_type: pricing.cab_type || "",
          slot: pricing.slot || "",
          rate: pricing.rate ?? "",
          extra_per_hour: pricing.extra_per_hour ?? "",
          extra_per_km: pricing.extra_per_km ?? "",
        },
      },
    }));
  };

  const updateEditPricingField = (vehicleId, pricingId, event) => {
    const { name, value } = event.target;
    setPricingEditByVehicle((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || {}),
        [pricingId]: {
          ...(prev[vehicleId]?.[pricingId] || {}),
          [name]: value,
        },
      },
    }));
  };

  const setEditPricingField = (vehicleId, pricingId, name, value) => {
    setPricingEditByVehicle((prev) => ({
      ...prev,
      [vehicleId]: {
        ...(prev[vehicleId] || {}),
        [pricingId]: {
          ...(prev[vehicleId]?.[pricingId] || {}),
          [name]: value,
        },
      },
    }));
  };

  const savePricingEdit = async (vehicleId, pricingId) => {
    const payload = pricingEditByVehicle?.[vehicleId]?.[pricingId];
    if (!payload) return;
    const rateValue = payload.rate ? Number(payload.rate) : 0;
    const extraPerHourValue = payload.extra_per_hour ? Number(payload.extra_per_hour) : 0;
    const extraPerKmValue = payload.extra_per_km ? Number(payload.extra_per_km) : 0;

    try {
      await updateVehiclePricing(vehicleId, pricingId, {
        ...payload,
        rate: rateValue,
        extra_per_hour: extraPerHourValue,
        extra_per_km: extraPerKmValue,
      });
      const data = await fetchVehiclePricing(vehicleId);
      setPricingByVehicle((prev) => ({ ...prev, [vehicleId]: data }));
      setPricingEditByVehicle((prev) => {
        const vehicleEdits = { ...(prev[vehicleId] || {}) };
        delete vehicleEdits[pricingId];
        return { ...prev, [vehicleId]: vehicleEdits };
      });
      setPricingStatus((prev) => ({ ...prev, [vehicleId]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [vehicleId]: "error" }));
    }
  };

  const handleDeletePricing = async (vehicleId, pricingId) => {
    try {
      await deleteVehiclePricing(vehicleId, pricingId);
      const data = await fetchVehiclePricing(vehicleId);
      setPricingByVehicle((prev) => ({ ...prev, [vehicleId]: data }));
      setPricingStatus((prev) => ({ ...prev, [vehicleId]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [vehicleId]: "error" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!canEdit) {
      setError("You don't have permission to create vehicles");
      return;
    }
    
    setMessage("");
    setError("");

    if (!form.cab_type) {
      setError("Cab type is required");
      return;
    }

    if (form.driver_phone && !isValidPhoneNumber(normalizePhoneNumber(form.driver_phone))) {
      setError("Invalid driver phone format (+91XXXXXXXXXX)");
      return;
    }
    if (form.driver_dashboard_access && !form.driver_name.trim()) {
      setError("Driver name is required when dashboard access is enabled");
      return;
    }
    if (form.driver_dashboard_access && !form.driver_phone.trim()) {
      setError("Driver phone is required when dashboard access is enabled");
      return;
    }

    try {
      const normalizedDriverPhone = normalizePhoneNumber(form.driver_phone);
      const payload = {
        ...form,
        driver_phone: normalizedDriverPhone,
        driver_user_id: "",
        capacity: form.capacity ? Number(form.capacity) : null,
      };
      const created = await createVehicle(payload);

      if (form.driver_dashboard_access && created?.vehicle_id) {
        const driverUserId = await upsertDriverUser({
          driver_name: form.driver_name,
          driver_phone: normalizedDriverPhone,
          vehicle_id: created.vehicle_id,
        });
        await updateVehicle(created.vehicle_id, {
          driver_user_id: driverUserId,
          active: payload.active,
        });
      }
      setMessage(
        isFirebaseConfigured
          ? "Vehicle added."
          : "Demo mode: vehicle prepared."
      );
      setForm(initialState);
      setShowForm(false);
      await loadVehicles();
    } catch (err) {
      setError(err.message || "Failed to add vehicle.");
    }
  };

  const handleAddVehicleClick = () => {
    if (!canEdit) return;
    setForm(initialState);
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const startEdit = (vehicle) => {
    setEditingVehicleId(vehicle.vehicle_id);
    setEditForm({
      capacity: vehicle.capacity ?? "",
      driver_name: vehicle.driver_name || "",
      driver_phone: vehicle.driver_phone || "",
      driver_dashboard_access: vehicle.driver_dashboard_access === true,
      active: vehicle.active !== false,
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingVehicleId("");
    setEditSaving(false);
  };

  const handleEditSubmit = async (vehicleId) => {
    if (!canEdit) {
      setError("You don't have permission to update vehicles");
      return;
    }

    setEditSaving(true);
    setMessage("");
    setError("");

    if (editForm.driver_phone && !isValidPhoneNumber(normalizePhoneNumber(editForm.driver_phone))) {
      setError("Invalid driver phone format (+91XXXXXXXXXX)");
      setEditSaving(false);
      return;
    }
    if (editForm.driver_dashboard_access && !editForm.driver_name.trim()) {
      setError("Driver name is required when dashboard access is enabled");
      setEditSaving(false);
      return;
    }
    if (editForm.driver_dashboard_access && !editForm.driver_phone.trim()) {
      setError("Driver phone is required when dashboard access is enabled");
      setEditSaving(false);
      return;
    }

    try {
      const vehicle = vehicles.find((item) => item.vehicle_id === vehicleId);
      let driverUserId = vehicle?.driver_user_id || "";
      const normalizedDriverPhone = normalizePhoneNumber(editForm.driver_phone);

      if (editForm.driver_dashboard_access) {
        driverUserId = await upsertDriverUser({
          driver_name: editForm.driver_name,
          driver_phone: normalizedDriverPhone,
          vehicle_id: vehicleId,
        });
      } else if (driverUserId) {
        await deleteUser(driverUserId);
        driverUserId = "";
      }

      const payload = {
        capacity: editForm.capacity ? Number(editForm.capacity) : null,
        driver_name: editForm.driver_name.trim(),
        driver_phone: normalizedDriverPhone,
        driver_dashboard_access: editForm.driver_dashboard_access,
        driver_user_id: driverUserId,
        active: editForm.active,
      };
      await updateVehicle(vehicleId, payload);
      setMessage(
        isFirebaseConfigured
          ? "Vehicle updated."
          : "Demo mode: vehicle update prepared."
      );
      cancelEdit();
      await loadVehicles();
    } catch (err) {
      setError(err.message || "Failed to update vehicle.");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredVehicles = vehicles.filter((vehicle) =>
    [
      vehicle.vehicle_number,
      vehicle.cab_type,
      vehicle.driver_name,
      vehicle.driver_phone,
      vehicle.ownership_type,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );
  const pricingVehicle =
    vehicles.find((vehicle) => vehicle.vehicle_id === pricingModalVehicleId) || null;

  return (
    <div className={styles.page}>
      {permissionsLoading && (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading permissions...</p>
        </div>
      )}
      
      {!permissionsLoading && (
      <>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Vehicles</p>
          <h1>Fleet Vehicles</h1>
          <p className={styles.lead}>
            Manage vehicle details, drivers, and fleet status.
          </p>
        </div>
        {canEdit && (
          <button className={styles.primaryCta} onClick={handleAddVehicleClick}>
            Add Vehicle
          </button>
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

      <section className={styles.gridSingle}>
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h2>Vehicle List</h2>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && <p className={styles.error}>{error}</p>}
          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="Search by vehicle number, cab type, or driver..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={styles.searchInput}
            />
          </div>
          {status === "success" && vehicles.length === 0 && (
            <p>No vehicles yet. Add your first fleet vehicle.</p>
          )}
          {status === "success" && vehicles.length > 0 && filteredVehicles.length === 0 && (
            <p>No vehicles match your search.</p>
          )}
          {filteredVehicles.length > 0 && (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Cab Type</th>
                    <th>Capacity</th>
                    <th>Driver</th>
                    <th>Driver Phone</th>
                    <th>Dashboard Access</th>
                    <th>Ownership</th>
                    <th>Status</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((vehicle) => {
                    const isEditing = editingVehicleId === vehicle.vehicle_id;

                    return (
                      <Fragment key={vehicle.vehicle_id}>
                        <tr>
                          <td className={styles.name} data-label="Vehicle">
                            {vehicle.vehicle_number || "-"}
                          </td>
                          <td data-label="Cab Type">{vehicle.cab_type || "-"}</td>
                          <td data-label="Capacity">
                            {isEditing ? (
                              <input
                                type="number"
                                value={editForm.capacity}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    capacity: event.target.value,
                                  }))
                                }
                                min="1"
                                placeholder="Capacity"
                                className={styles.inlineInput}
                              />
                            ) : (
                              vehicle.capacity || "-"
                            )}
                          </td>
                          <td data-label="Driver">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.driver_name}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    driver_name: event.target.value,
                                  }))
                                }
                                placeholder="Driver name"
                                className={styles.inlineInput}
                              />
                            ) : (
                              vehicle.driver_name || "-"
                            )}
                          </td>
                          <td className={styles.phone} data-label="Driver Phone">
                            {isEditing ? (
                              <input
                                type="tel"
                                value={editForm.driver_phone}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    driver_phone: event.target.value,
                                  }))
                                }
                                onBlur={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    driver_phone: normalizePhoneNumber(event.target.value),
                                  }))
                                }
                                placeholder="+919000000000"
                                className={styles.inlineInput}
                              />
                            ) : (
                              vehicle.driver_phone || "-"
                            )}
                          </td>
                          <td data-label="Dashboard Access">
                            {isEditing ? (
                              <label className={styles.inlineCheckbox}>
                                <input
                                  type="checkbox"
                                  checked={editForm.driver_dashboard_access}
                                  onChange={(event) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      driver_dashboard_access: event.target.checked,
                                    }))
                                  }
                                />
                                Allow
                              </label>
                            ) : (
                              <span
                                className={`${styles.status} ${
                                  vehicle.driver_dashboard_access ? styles.active : styles.inactive
                                }`}
                              >
                                {vehicle.driver_dashboard_access ? "Allowed" : "No Access"}
                              </span>
                            )}
                          </td>
                          <td data-label="Ownership">
                            {vehicle.ownership_type === "leased"
                              ? "Leased Vehicle"
                              : "Own Vehicle"}
                          </td>
                          <td data-label="Status">
                            {isEditing ? (
                              <div className={styles.inlineDropdown}>
                                <CustomDropdown
                                  options={vehicleStatusOptions}
                                  value={editForm.active}
                                  onChange={(value) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      active: value,
                                    }))
                                  }
                                  getLabel={(option) => option.label}
                                  getValue={(option) => option.value}
                                  placeholder="Select status"
                                />
                              </div>
                            ) : (
                              <span
                                className={`${styles.status} ${
                                  vehicle.active !== false ? styles.active : styles.inactive
                                }`}
                              >
                                {vehicle.active !== false ? "Active" : "Inactive"}
                              </span>
                            )}
                          </td>
                          {canEdit && (
                            <td className={styles.rowActions} data-label="Actions">
                              {isEditing ? (
                                <div className={styles.inlineActions}>
                                  <button
                                    type="button"
                                    className={styles.secondaryCta}
                                    onClick={() => handleEditSubmit(vehicle.vehicle_id)}
                                    disabled={editSaving}
                                  >
                                    {editSaving ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.linkButton}
                                    onClick={cancelEdit}
                                    disabled={editSaving}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className={styles.inlineActions}>
                                  <button
                                    type="button"
                                    className={styles.editBtn}
                                    onClick={() => startEdit(vehicle)}
                                    title="Edit"
                                    aria-label="Edit"
                                  >
                                    <span className={styles.editIcon}>✎</span>
                                  </button>
                                  {vehicle.ownership_type === "leased" && (
                                    <button
                                      type="button"
                                      className={styles.editBtn}
                                      onClick={() => openPricingModal(vehicle.vehicle_id)}
                                      title="Manage pricing"
                                      aria-label="Manage pricing"
                                    >
                                      <span className={styles.pricingIcon}>₹</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {canEdit && pricingVehicle && (
        <div className={styles.modalOverlay} onClick={closePricingModal}>
          <div
            className={`${styles.modal} ${styles.pricingModal}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>Manage Pricing: {pricingVehicle.vehicle_number}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={closePricingModal}
              >
                ✕
              </button>
            </div>
            <div className={`${styles.pricingSection} ${styles.pricingSectionModal}`}>
              <form
                className={styles.pricingForm}
                onSubmit={(event) => handlePricingSubmit(event, pricingVehicle)}
              >
                <label className={styles.field}>
                  Slot
                  <CustomDropdown
                    options={slotOptions}
                    value={
                      (pricingFormByVehicle[pricingVehicle.vehicle_id] || initialPricing).slot
                    }
                    onChange={(value) =>
                      setPricingField(pricingVehicle.vehicle_id, "slot", value)
                    }
                    getLabel={(option) => option.label}
                    getValue={(option) => option.value}
                    placeholder="Select slot"
                  />
                </label>
                <label className={styles.field}>
                  Rate
                  <input
                    type="number"
                    name="rate"
                    value={
                      (pricingFormByVehicle[pricingVehicle.vehicle_id] || initialPricing).rate
                    }
                    onChange={(event) =>
                      updatePricingField(pricingVehicle.vehicle_id, event)
                    }
                    min="0"
                    required
                  />
                </label>
                <label className={styles.field}>
                  Extra / hour
                  <input
                    type="number"
                    name="extra_per_hour"
                    value={
                      (pricingFormByVehicle[pricingVehicle.vehicle_id] || initialPricing)
                        .extra_per_hour
                    }
                    onChange={(event) =>
                      updatePricingField(pricingVehicle.vehicle_id, event)
                    }
                    min="0"
                  />
                </label>
                <label className={styles.field}>
                  Extra / km
                  <input
                    type="number"
                    name="extra_per_km"
                    value={
                      (pricingFormByVehicle[pricingVehicle.vehicle_id] || initialPricing)
                        .extra_per_km
                    }
                    onChange={(event) =>
                      updatePricingField(pricingVehicle.vehicle_id, event)
                    }
                    min="0"
                  />
                </label>
                <button className={styles.secondaryButton} type="submit">
                  Add rate
                </button>
              </form>
              <div className={styles.pricingList}>
                <div className={styles.pricingHeader}>
                  <span>Cab type</span>
                  <span>Slot</span>
                  <span>Rate</span>
                  <span>Extra / hour</span>
                  <span>Extra / km</span>
                </div>
                {(pricingByVehicle[pricingVehicle.vehicle_id] || []).map((pricing) => {
                  const edits =
                    pricingEditByVehicle?.[pricingVehicle.vehicle_id]?.[
                      pricing.pricing_id
                    ];
                  const isEditing = Boolean(edits);
                  return (
                    <div key={pricing.pricing_id} className={styles.pricingRow}>
                      {isEditing ? (
                        <>
                          <span>{edits.cab_type}</span>
                          <CustomDropdown
                            options={slotOptions}
                            value={edits.slot}
                            onChange={(value) =>
                              setEditPricingField(
                                pricingVehicle.vehicle_id,
                                pricing.pricing_id,
                                "slot",
                                value
                              )
                            }
                            getLabel={(option) => option.label}
                            getValue={(option) => option.value}
                            placeholder="Select slot"
                            disabled
                            buttonClassName={styles.pricingInlineDropdown}
                          />
                          <input
                            type="number"
                            name="rate"
                            value={edits.rate}
                            onChange={(event) =>
                              updateEditPricingField(
                                pricingVehicle.vehicle_id,
                                pricing.pricing_id,
                                event
                              )
                            }
                            min="0"
                          />
                          <input
                            type="number"
                            name="extra_per_hour"
                            value={edits.extra_per_hour}
                            onChange={(event) =>
                              updateEditPricingField(
                                pricingVehicle.vehicle_id,
                                pricing.pricing_id,
                                event
                              )
                            }
                            min="0"
                          />
                          <input
                            type="number"
                            name="extra_per_km"
                            value={edits.extra_per_km}
                            onChange={(event) =>
                              updateEditPricingField(
                                pricingVehicle.vehicle_id,
                                pricing.pricing_id,
                                event
                              )
                            }
                            min="0"
                          />
                        </>
                      ) : (
                        <>
                          <span>{pricing.cab_type}</span>
                          <span>{pricing.slot}</span>
                          <span>₹ {pricing.rate}</span>
                          <span>₹ {Number(pricing.extra_per_hour) || 0}</span>
                          <span>₹ {Number(pricing.extra_per_km) || 0}</span>
                        </>
                      )}
                      <div className={styles.pricingActions}>
                        {isEditing ? (
                          <button
                            type="button"
                            className={styles.textButton}
                            onClick={() =>
                              savePricingEdit(
                                pricingVehicle.vehicle_id,
                                pricing.pricing_id
                              )
                            }
                          >
                            Save
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.textButton}
                              onClick={() =>
                                startEditPricing(pricingVehicle.vehicle_id, pricing)
                              }
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              className={styles.deleteButton}
                              onClick={() =>
                                handleDeletePricing(
                                  pricingVehicle.vehicle_id,
                                  pricing.pricing_id
                                )
                              }
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pricingStatus[pricingVehicle.vehicle_id] === "loading" && (
                  <p className={styles.pricingNotice}>Loading pricing...</p>
                )}
                {pricingStatus[pricingVehicle.vehicle_id] === "error" && (
                  <p className={styles.error}>Unable to load pricing.</p>
                )}
                {pricingStatus[pricingVehicle.vehicle_id] === "success" &&
                  (pricingByVehicle[pricingVehicle.vehicle_id] || []).length === 0 && (
                    <p className={styles.pricingNotice}>No pricing rules yet.</p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {canEdit && showForm && (
        <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add Vehicle</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>
            <form className={styles.form} onSubmit={handleSubmit}>
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
                <CustomDropdown
                  options={cabTypeOptions}
                  value={form.cab_type}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, cab_type: value }))
                  }
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select cab type"
                />
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
                <CustomDropdown
                  options={vehicleStatusOptions}
                  value={form.active}
                  onChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select status"
                />
              </label>
              <label className={styles.field}>
                Vehicle type
                <CustomDropdown
                  options={ownershipTypeOptions}
                  value={form.ownership_type}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, ownership_type: value }))
                  }
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select vehicle type"
                />
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
                  onBlur={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      driver_phone: normalizePhoneNumber(event.target.value),
                    }))
                  }
                  placeholder="+919000000000"
                />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  name="driver_dashboard_access"
                  checked={form.driver_dashboard_access}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      driver_dashboard_access: event.target.checked,
                    }))
                  }
                />
                Allow dashboard access for this driver
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
                <button type="button" className={styles.ghostCta} onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button className={styles.primaryCta} type="submit">
                  Save Vehicle
                </button>
              </div>
              {message && <p className={styles.message}>{message}</p>}
              {error && <p className={styles.error}>{error}</p>}
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
