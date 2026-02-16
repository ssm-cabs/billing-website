"use client";

import { useEffect, useState } from "react";
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
};

export default function VehiclesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("vehicles");
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState("");
  const [editForm, setEditForm] = useState({
    driver_name: "",
    driver_phone: "",
    active: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedVehicleId, setExpandedVehicleId] = useState(null);
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

  const togglePricing = async (vehicleId) => {
    if (expandedVehicleId === vehicleId) {
      setExpandedVehicleId(null);
      return;
    }

    setExpandedVehicleId(vehicleId);
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

  const handlePricingSubmit = async (event, vehicle) => {
    event.preventDefault();
    const payload = pricingFormByVehicle[vehicle.vehicle_id] || initialPricing;
    const rateValue = payload.rate ? Number(payload.rate) : 0;

    try {
      await createVehiclePricing(vehicle.vehicle_id, {
        ...payload,
        cab_type: payload.cab_type || vehicle.cab_type || "",
        rate: rateValue,
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

    try {
      await updateVehiclePricing(vehicleId, pricingId, {
        ...payload,
        rate: rateValue,
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

    const payload = {
      ...form,
      driver_phone: normalizePhoneNumber(form.driver_phone),
      capacity: form.capacity ? Number(form.capacity) : null,
    };

    try {
      await createVehicle(payload);
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
      driver_name: vehicle.driver_name || "",
      driver_phone: vehicle.driver_phone || "",
      active: vehicle.active !== false,
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingVehicleId("");
    setEditSaving(false);
  };

  const handleEditSubmit = async (event, vehicleId) => {
    event.preventDefault();

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

    try {
      await updateVehicle(vehicleId, {
        driver_name: editForm.driver_name.trim(),
        driver_phone: normalizePhoneNumber(editForm.driver_phone),
        active: editForm.active,
      });
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
          {status === "success" && vehicles.length === 0 && (
            <p>No vehicles yet. Add your first fleet vehicle.</p>
          )}
          {vehicles.length > 0 && (
            <div className={styles.cards}>
              {vehicles.map((vehicle) => (
                <article key={vehicle.vehicle_id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3>{vehicle.vehicle_number}</h3>
                      <p>{vehicle.cab_type || "-"}</p>
                    </div>
                    {canEdit && editingVehicleId !== vehicle.vehicle_id && (
                      <button
                        type="button"
                        className={styles.secondaryCta}
                        onClick={() => startEdit(vehicle)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {editingVehicleId === vehicle.vehicle_id ? (
                    <form
                      className={styles.inlineEdit}
                      onSubmit={(event) => handleEditSubmit(event, vehicle.vehicle_id)}
                    >
                      <div className={styles.meta}>
                        <span>Capacity: {vehicle.capacity || "-"}</span>
                      </div>
                      <label className={styles.field}>
                        Driver name
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
                        />
                      </label>
                      <label className={styles.field}>
                        Driver phone
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
                        />
                      </label>
                      <label className={styles.field}>
                        Status
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
                      </label>
                      <div className={styles.inlineActions}>
                        <button
                          type="submit"
                          className={styles.primaryCta}
                          disabled={editSaving}
                        >
                          {editSaving ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className={styles.ghostCta}
                          onClick={cancelEdit}
                          disabled={editSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className={styles.meta}>
                        <span>Capacity: {vehicle.capacity || "-"}</span>
                        <span>
                          {vehicle.ownership_type === "leased"
                            ? "Leased Vehicle"
                            : "Own Vehicle"}
                        </span>
                        <span>{vehicle.driver_name || "-"}</span>
                        <span>{vehicle.driver_phone || "-"}</span>
                      </div>
                      <div className={styles.cardFooter}>
                        <span className={styles.statusTag}>{vehicle.status}</span>
                        {vehicle.ownership_type === "leased" && (
                          <button
                            type="button"
                            className={styles.linkButton}
                            onClick={() => togglePricing(vehicle.vehicle_id)}
                          >
                            {expandedVehicleId === vehicle.vehicle_id
                              ? "Hide pricing"
                              : "Manage pricing"}
                          </button>
                        )}
                      </div>
                      {vehicle.ownership_type === "leased" &&
                        expandedVehicleId === vehicle.vehicle_id && (
                          <div className={styles.pricingSection}>
                            {canEdit && (
                              <form
                                className={styles.pricingForm}
                                onSubmit={(event) => handlePricingSubmit(event, vehicle)}
                              >
                                <label className={styles.field}>
                                  Slot
                                  <CustomDropdown
                                    options={slotOptions}
                                    value={
                                      (pricingFormByVehicle[vehicle.vehicle_id] ||
                                        initialPricing).slot
                                    }
                                    onChange={(value) =>
                                      setPricingField(vehicle.vehicle_id, "slot", value)
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
                                      (pricingFormByVehicle[vehicle.vehicle_id] ||
                                        initialPricing).rate
                                    }
                                    onChange={(event) =>
                                      updatePricingField(vehicle.vehicle_id, event)
                                    }
                                    min="0"
                                    required
                                  />
                                </label>
                                <button className={styles.secondaryButton} type="submit">
                                  Add rate
                                </button>
                              </form>
                            )}
                            <div className={styles.pricingList}>
                              <div className={styles.pricingHeader}>
                                <span>Cab type</span>
                                <span>Slot</span>
                                <span>Rate</span>
                              </div>
                              {(pricingByVehicle[vehicle.vehicle_id] || []).map((pricing) => {
                                const edits =
                                  pricingEditByVehicle?.[vehicle.vehicle_id]?.[
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
                                              vehicle.vehicle_id,
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
                                              vehicle.vehicle_id,
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
                                      </>
                                    )}
                                    <div className={styles.pricingActions}>
                                      {canEdit && (
                                        <>
                                          {isEditing ? (
                                            <button
                                              type="button"
                                              className={styles.textButton}
                                              onClick={() =>
                                                savePricingEdit(
                                                  vehicle.vehicle_id,
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
                                                  startEditPricing(vehicle.vehicle_id, pricing)
                                                }
                                              >
                                                Update
                                              </button>
                                              <button
                                                type="button"
                                                className={styles.deleteButton}
                                                onClick={() =>
                                                  handleDeletePricing(
                                                    vehicle.vehicle_id,
                                                    pricing.pricing_id
                                                  )
                                                }
                                              >
                                                Delete
                                              </button>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {pricingStatus[vehicle.vehicle_id] === "loading" && (
                                <p className={styles.pricingNotice}>Loading pricing...</p>
                              )}
                              {pricingStatus[vehicle.vehicle_id] === "error" && (
                                <p className={styles.error}>Unable to load pricing.</p>
                              )}
                              {pricingStatus[vehicle.vehicle_id] === "success" &&
                                (pricingByVehicle[vehicle.vehicle_id] || []).length === 0 && (
                                  <p className={styles.pricingNotice}>No pricing rules yet.</p>
                                )}
                            </div>
                          </div>
                        )}
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

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
