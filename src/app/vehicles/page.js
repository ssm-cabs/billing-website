"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CustomDropdown from "../entries/CustomDropdown";
import {
  createVehicle,
  fetchVehicles,
  isFirebaseConfigured,
  updateVehicle,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./vehicles.module.css";

const initialState = {
  vehicle_number: "",
  cab_type: "",
  capacity: "",
  status: "active",
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
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Maintenance", value: "maintenance" },
];

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
    status: "active",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

    const payload = {
      ...form,
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
      status: vehicle.status || "active",
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

    try {
      await updateVehicle(vehicleId, {
        driver_name: editForm.driver_name.trim(),
        driver_phone: editForm.driver_phone.trim(),
        status: editForm.status || "active",
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
                          placeholder="+91 90000 00000"
                        />
                      </label>
                      <label className={styles.field}>
                        Status
                        <CustomDropdown
                          options={vehicleStatusOptions}
                          value={editForm.status}
                          onChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              status: value,
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
                        <span>{vehicle.driver_name || "-"}</span>
                        <span>{vehicle.driver_phone || "-"}</span>
                      </div>
                      <span className={styles.statusTag}>{vehicle.status}</span>
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
                  value={form.status}
                  onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                  getLabel={(option) => option.label}
                  getValue={(option) => option.value}
                  placeholder="Select status"
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
                  placeholder="+91 90000 00000"
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
