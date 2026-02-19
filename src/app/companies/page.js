"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CustomDropdown from "../entries/CustomDropdown";
import {
  createCompany,
  createPricing,
  deletePricing,
  fetchCompanies,
  fetchPricing,
  isFirebaseConfigured,
  updateCompany,
  updatePricing,
} from "@/lib/api";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { deleteUser, upsertCompanyUser } from "@/lib/usersApi";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./companies.module.css";

const initialState = {
  name: "",
  billing_cycle: "monthly",
  contact_name: "",
  contact_phone: "",
  address: "",
  company_dashboard_access: false,
  active: true,
};

const initialPricing = {
  cab_type: "",
  slot: "",
  rate: "",
  extra_per_hour: "",
  extra_per_km: "",
};

const billingCycleOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Daily", value: "daily" },
];

const companyStatusOptions = [
  { label: "Active", value: true },
  { label: "Inactive", value: false },
];

const cabTypeOptions = [
  { label: "Sedan", value: "Sedan" },
  { label: "Premium Sedan", value: "Premium Sedan" },
  { label: "SUV", value: "SUV" },
  { label: "Premium SUV", value: "Premium SUV" },
];

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "8hr", value: "8hr" },
];

export default function CompaniesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("companies");
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [showForm, setShowForm] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState("");
  const [editForm, setEditForm] = useState({
    contact_name: "",
    contact_phone: "",
    address: "",
    company_dashboard_access: false,
    active: true,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pricingModalCompanyId, setPricingModalCompanyId] = useState(null);
  const [pricingByCompany, setPricingByCompany] = useState({});
  const [pricingFormByCompany, setPricingFormByCompany] = useState({});
  const [pricingStatus, setPricingStatus] = useState({});
  const [pricingEditByCompany, setPricingEditByCompany] = useState({});

  const loadCompanies = async () => {
    setStatus("loading");
    setError("");
    try {
      const data = await fetchCompanies();
      setCompanies(data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Unable to load companies.");
      setStatus("error");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await loadCompanies();
    };

    initialize();
  }, []);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updatePricingField = (companyId, event) => {
    const { name, value } = event.target;
    setPricingFormByCompany((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || initialPricing),
        [name]: value,
      },
    }));
  };

  const setPricingField = (companyId, name, value) => {
    setPricingFormByCompany((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || initialPricing),
        [name]: value,
      },
    }));
  };

  const openPricingModal = async (companyId) => {
    setPricingModalCompanyId(companyId);
    if (!pricingByCompany[companyId]) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "loading" }));
      try {
        const data = await fetchPricing(companyId);
        setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
        setPricingStatus((prev) => ({ ...prev, [companyId]: "success" }));
      } catch (_) {
        setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
      }
    }
  };

  const closePricingModal = () => {
    setPricingModalCompanyId(null);
  };

  const handlePricingSubmit = async (event, companyId) => {
    event.preventDefault();
    const payload = pricingFormByCompany[companyId] || initialPricing;
    const rateValue = payload.rate ? Number(payload.rate) : 0;
    const extraPerHourValue = payload.extra_per_hour ? Number(payload.extra_per_hour) : 0;
    const extraPerKmValue = payload.extra_per_km ? Number(payload.extra_per_km) : 0;

    try {
      await createPricing(companyId, {
        ...payload,
        rate: rateValue,
        extra_per_hour: extraPerHourValue,
        extra_per_km: extraPerKmValue,
      });
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
      setPricingFormByCompany((prev) => ({
        ...prev,
        [companyId]: initialPricing,
      }));
      setPricingStatus((prev) => ({ ...prev, [companyId]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
    }
  };

  const startEditPricing = (companyId, pricing) => {
    setPricingEditByCompany((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || {}),
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

  const updateEditPricingField = (companyId, pricingId, event) => {
    const { name, value } = event.target;
    setPricingEditByCompany((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || {}),
        [pricingId]: {
          ...(prev[companyId]?.[pricingId] || {}),
          [name]: value,
        },
      },
    }));
  };

  const setEditPricingField = (companyId, pricingId, name, value) => {
    setPricingEditByCompany((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || {}),
        [pricingId]: {
          ...(prev[companyId]?.[pricingId] || {}),
          [name]: value,
        },
      },
    }));
  };

  const savePricingEdit = async (companyId, pricingId) => {
    const payload = pricingEditByCompany?.[companyId]?.[pricingId];
    if (!payload) return;
    const rateValue = payload.rate ? Number(payload.rate) : 0;
    const extraPerHourValue = payload.extra_per_hour ? Number(payload.extra_per_hour) : 0;
    const extraPerKmValue = payload.extra_per_km ? Number(payload.extra_per_km) : 0;

    try {
      await updatePricing(companyId, pricingId, {
        ...payload,
        rate: rateValue,
        extra_per_hour: extraPerHourValue,
        extra_per_km: extraPerKmValue,
      });
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
      setPricingEditByCompany((prev) => {
        const companyEdits = { ...(prev[companyId] || {}) };
        delete companyEdits[pricingId];
        return { ...prev, [companyId]: companyEdits };
      });
      setPricingStatus((prev) => ({ ...prev, [companyId]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
    }
  };

  const handleDeletePricing = async (companyId, pricingId) => {
    try {
      await deletePricing(companyId, pricingId);
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
      setPricingStatus((prev) => ({ ...prev, [companyId]: "success" }));
    } catch (_) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canEdit) {
      setError("You don't have permission to create companies");
      return;
    }

    setMessage("");
    setError("");

    if (form.contact_phone && !isValidPhoneNumber(normalizePhoneNumber(form.contact_phone))) {
      setError("Invalid contact phone format (+91XXXXXXXXXX)");
      return;
    }
    if (form.company_dashboard_access && !form.contact_name.trim()) {
      setError("Contact name is required when dashboard access is enabled");
      return;
    }
    if (form.company_dashboard_access && !form.contact_phone.trim()) {
      setError("Contact phone is required when dashboard access is enabled");
      return;
    }

    try {
      const normalizedContactPhone = normalizePhoneNumber(form.contact_phone);
      const payload = {
        ...form,
        contact_phone: normalizedContactPhone,
        company_user_id: "",
      };
      const created = await createCompany(payload);
      if (form.company_dashboard_access && created?.company_id) {
        const companyUserId = await upsertCompanyUser({
          contact_name: form.contact_name,
          contact_phone: normalizedContactPhone,
          company_id: created.company_id,
        });
        await updateCompany(created.company_id, {
          company_user_id: companyUserId,
        });
      }
      setMessage(
        isFirebaseConfigured ? "Company added." : "Demo mode: company prepared."
      );
      setForm(initialState);
      setShowForm(false);
      await loadCompanies();
    } catch (err) {
      setError(err.message || "Failed to add company.");
    }
  };

  const handleAddCompanyClick = () => {
    if (!canEdit) return;
    setForm(initialState);
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const startEdit = (company) => {
    setEditingCompanyId(company.company_id);
    setEditForm({
      contact_name: company.contact_name || "",
      contact_phone: company.contact_phone || "",
      address: company.address || "",
      company_dashboard_access: company.company_dashboard_access === true,
      active: company.active !== false,
    });
    setMessage("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingCompanyId("");
    setEditSaving(false);
  };

  const handleEditSubmit = async (companyId) => {
    if (!canEdit) {
      setError("You don't have permission to update companies");
      return;
    }

    setEditSaving(true);
    setMessage("");
    setError("");

    if (
      editForm.contact_phone &&
      !isValidPhoneNumber(normalizePhoneNumber(editForm.contact_phone))
    ) {
      setError("Invalid contact phone format (+91XXXXXXXXXX)");
      setEditSaving(false);
      return;
    }
    if (editForm.company_dashboard_access && !editForm.contact_name.trim()) {
      setError("Contact name is required when dashboard access is enabled");
      setEditSaving(false);
      return;
    }
    if (editForm.company_dashboard_access && !editForm.contact_phone.trim()) {
      setError("Contact phone is required when dashboard access is enabled");
      setEditSaving(false);
      return;
    }

    try {
      const company = companies.find((item) => item.company_id === companyId);
      let companyUserId = company?.company_user_id || "";
      const normalizedContactPhone = normalizePhoneNumber(editForm.contact_phone);

      if (editForm.company_dashboard_access) {
        companyUserId = await upsertCompanyUser({
          contact_name: editForm.contact_name,
          contact_phone: normalizedContactPhone,
          company_id: companyId,
        });
      } else if (companyUserId) {
        await deleteUser(companyUserId);
        companyUserId = "";
      }

      await updateCompany(companyId, {
        contact_name: editForm.contact_name.trim(),
        contact_phone: normalizedContactPhone,
        address: editForm.address.trim(),
        company_dashboard_access: editForm.company_dashboard_access,
        company_user_id: companyUserId,
        active: editForm.active,
      });
      setMessage(
        isFirebaseConfigured ? "Company updated." : "Demo mode: company update prepared."
      );
      cancelEdit();
      await loadCompanies();
    } catch (err) {
      setError(err.message || "Failed to update company.");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredCompanies = companies.filter((company) =>
    [
      company.name,
      company.company_id,
      company.billing_cycle,
      company.contact_name,
      company.contact_phone,
      company.address,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const pricingCompany =
    companies.find((company) => company.company_id === pricingModalCompanyId) || null;

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
              <p className={styles.eyebrow}>Companies</p>
              <h1>Corporate Companies</h1>
              <p className={styles.lead}>
                Manage corporate clients, contacts, and billing cycles.
              </p>
            </div>
            {canEdit && (
              <button className={styles.primaryCta} onClick={handleAddCompanyClick}>
                Add Company
              </button>
            )}
          </header>

          {!isFirebaseConfigured && (
            <div className={styles.notice}>
              Add Firebase config to
              <span className={styles.noticeHighlight}>NEXT_PUBLIC_FIREBASE_*</span>
              to load live data.
            </div>
          )}

          <section className={styles.gridSingle}>
            <div className={styles.list}>
              <div className={styles.listHeader}>
                <h2>Company List</h2>
                {status === "loading" && <span>Loading...</span>}
              </div>
              {status === "error" && <p className={styles.error}>{error}</p>}
              {message && <p className={styles.message}>{message}</p>}
              {canView && (
                <div className={styles.searchBar}>
                  <input
                    type="text"
                    placeholder="Search by name, contact, phone, or billing cycle..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              )}
              {status === "success" && companies.length === 0 && (
                <p>No companies yet. Add your first corporate client.</p>
              )}
              {status === "success" && companies.length > 0 && filteredCompanies.length === 0 && (
                <p>No companies match your search.</p>
              )}
              {filteredCompanies.length > 0 && (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>Billing Cycle</th>
                        <th>Contact Name</th>
                        <th>Contact Phone</th>
                        <th>Address</th>
                        <th>Dashboard Access</th>
                        <th>Status</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((company) => {
                        const isEditing = editingCompanyId === company.company_id;

                        return (
                        <tr key={company.company_id}>
                          <td className={styles.name} data-label="Company">
                            {company.name || "-"}
                          </td>
                          <td data-label="Billing Cycle">
                            {company.billing_cycle || "monthly"}
                          </td>
                          <td data-label="Contact Name">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.contact_name}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    contact_name: event.target.value,
                                  }))
                                }
                                placeholder="Contact person"
                                className={styles.inlineInput}
                              />
                            ) : (
                              company.contact_name || "-"
                            )}
                          </td>
                          <td className={styles.phone} data-label="Contact Phone">
                            {isEditing ? (
                              <input
                                type="tel"
                                value={editForm.contact_phone}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    contact_phone: event.target.value,
                                  }))
                                }
                                onBlur={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    contact_phone: normalizePhoneNumber(event.target.value),
                                  }))
                                }
                                placeholder="+919000000000"
                                className={styles.inlineInput}
                              />
                            ) : (
                              company.contact_phone || "-"
                            )}
                          </td>
                          <td data-label="Address">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editForm.address}
                                onChange={(event) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    address: event.target.value,
                                  }))
                                }
                                placeholder="Address"
                                className={styles.inlineInput}
                              />
                            ) : (
                              <span className={styles.address}>{company.address || "-"}</span>
                            )}
                          </td>
                          <td data-label="Dashboard Access">
                            {isEditing ? (
                              <label className={styles.inlineCheckbox}>
                                <input
                                  type="checkbox"
                                  checked={editForm.company_dashboard_access}
                                  onChange={(event) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      company_dashboard_access: event.target.checked,
                                    }))
                                  }
                                />
                                Allow
                              </label>
                            ) : (
                              <span
                                className={`${styles.status} ${
                                  company.company_dashboard_access ? styles.active : styles.inactive
                                }`}
                              >
                                {company.company_dashboard_access ? "Allowed" : "Not allowed"}
                              </span>
                            )}
                          </td>
                          <td data-label="Status">
                            {isEditing ? (
                              <div className={styles.inlineDropdown}>
                                <CustomDropdown
                                  options={companyStatusOptions}
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
                                  company.active !== false ? styles.active : styles.inactive
                                }`}
                              >
                                {company.active !== false ? "Active" : "Inactive"}
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
                                    onClick={() => handleEditSubmit(company.company_id)}
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
                                    onClick={() => startEdit(company)}
                                    title="Edit contact details"
                                    aria-label="Edit contact details"
                                  >
                                    <span className={styles.editIcon}>✎</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.editBtn}
                                    onClick={() => openPricingModal(company.company_id)}
                                    title="Manage pricing"
                                    aria-label="Manage pricing"
                                  >
                                    <span className={styles.pricingIcon}>₹</span>
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {canEdit && pricingCompany && (
            <div className={styles.modalOverlay} onClick={closePricingModal}>
              <div
                className={`${styles.modal} ${styles.pricingModal}`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h2>Manage Pricing: {pricingCompany.name}</h2>
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
                    onSubmit={(event) => handlePricingSubmit(event, pricingCompany.company_id)}
                  >
                    <label className={styles.field}>
                      Cab type
                      <CustomDropdown
                        options={cabTypeOptions}
                        value={
                          (pricingFormByCompany[pricingCompany.company_id] || initialPricing)
                            .cab_type
                        }
                        onChange={(value) =>
                          setPricingField(pricingCompany.company_id, "cab_type", value)
                        }
                        getLabel={(option) => option.label}
                        getValue={(option) => option.value}
                        placeholder="Select cab type"
                      />
                    </label>
                    <label className={styles.field}>
                      Slot
                      <CustomDropdown
                        options={slotOptions}
                        value={
                          (pricingFormByCompany[pricingCompany.company_id] || initialPricing)
                            .slot
                        }
                        onChange={(value) =>
                          setPricingField(pricingCompany.company_id, "slot", value)
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
                          (pricingFormByCompany[pricingCompany.company_id] || initialPricing).rate
                        }
                        onChange={(event) =>
                          updatePricingField(pricingCompany.company_id, event)
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
                          (pricingFormByCompany[pricingCompany.company_id] || initialPricing)
                            .extra_per_hour
                        }
                        onChange={(event) =>
                          updatePricingField(pricingCompany.company_id, event)
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
                          (pricingFormByCompany[pricingCompany.company_id] || initialPricing)
                            .extra_per_km
                        }
                        onChange={(event) =>
                          updatePricingField(pricingCompany.company_id, event)
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
                    {(pricingByCompany[pricingCompany.company_id] || []).map((pricing) => {
                      const edits =
                        pricingEditByCompany?.[pricingCompany.company_id]?.[pricing.pricing_id];
                      const isEditing = Boolean(edits);
                      return (
                        <div key={pricing.pricing_id} className={styles.pricingRow}>
                          {isEditing ? (
                            <>
                              <CustomDropdown
                                options={cabTypeOptions}
                                value={edits.cab_type}
                                onChange={(value) =>
                                  setEditPricingField(
                                    pricingCompany.company_id,
                                    pricing.pricing_id,
                                    "cab_type",
                                    value
                                  )
                                }
                                getLabel={(option) => option.label}
                                getValue={(option) => option.value}
                                placeholder="Select cab type"
                                disabled
                                buttonClassName={styles.pricingInlineDropdown}
                              />
                              <CustomDropdown
                                options={slotOptions}
                                value={edits.slot}
                                onChange={(value) =>
                                  setEditPricingField(
                                    pricingCompany.company_id,
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
                                    pricingCompany.company_id,
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
                                    pricingCompany.company_id,
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
                                    pricingCompany.company_id,
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
                                  savePricingEdit(pricingCompany.company_id, pricing.pricing_id)
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
                                    startEditPricing(pricingCompany.company_id, pricing)
                                  }
                                >
                                  Update
                                </button>
                                <button
                                  type="button"
                                  className={styles.deleteButton}
                                  onClick={() =>
                                    handleDeletePricing(
                                      pricingCompany.company_id,
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
                    {pricingStatus[pricingCompany.company_id] === "loading" && (
                      <p className={styles.pricingNotice}>Loading pricing...</p>
                    )}
                    {pricingStatus[pricingCompany.company_id] === "error" && (
                      <p className={styles.error}>Unable to load pricing.</p>
                    )}
                    {pricingStatus[pricingCompany.company_id] === "success" &&
                      (pricingByCompany[pricingCompany.company_id] || []).length === 0 && (
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
                  <h2>Add Company</h2>
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
                    Company name
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={updateField}
                      placeholder="Acme Corp"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    Billing cycle
                    <CustomDropdown
                      options={billingCycleOptions}
                      value={form.billing_cycle}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, billing_cycle: value }))
                      }
                      getLabel={(option) => option.label}
                      getValue={(option) => option.value}
                      placeholder="Select billing cycle"
                    />
                  </label>
                  <label className={styles.field}>
                    Contact name
                    <input
                      type="text"
                      name="contact_name"
                      value={form.contact_name}
                      onChange={updateField}
                      placeholder="Contact person"
                    />
                  </label>
                  <label className={styles.field}>
                    Contact phone
                    <input
                      type="tel"
                      name="contact_phone"
                      value={form.contact_phone}
                      onChange={updateField}
                      onBlur={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          contact_phone: normalizePhoneNumber(event.target.value),
                        }))
                      }
                      placeholder="+919000000000"
                    />
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      name="company_dashboard_access"
                      checked={form.company_dashboard_access}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          company_dashboard_access: event.target.checked,
                        }))
                      }
                    />
                    Allow dashboard access for this company
                  </label>
                  <label className={styles.field}>
                    Address
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={updateField}
                      rows={3}
                    />
                  </label>
                  <label className={styles.field}>
                    Status
                    <CustomDropdown
                      options={companyStatusOptions}
                      value={form.active}
                      onChange={(value) => setForm((prev) => ({ ...prev, active: value }))}
                      getLabel={(option) => option.label}
                      getValue={(option) => option.value}
                      placeholder="Select status"
                    />
                  </label>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.ghostCta}
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </button>
                    <button className={styles.primaryCta} type="submit">
                      Save Company
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
