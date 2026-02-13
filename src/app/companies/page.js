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
  updatePricing,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./companies.module.css";

const initialState = {
  name: "",
  billing_cycle: "monthly",
  contact_name: "",
  contact_phone: "",
  address: "",
  active: true,
};

const initialPricing = {
  cab_type: "",
  slot: "",
  rate: "",
};

const billingCycleOptions = [
  { label: "Monthly", value: "monthly" },
  { label: "Daily", value: "daily" },
];

const cabTypeOptions = [
  { label: "Sedan", value: "Sedan" },
  { label: "Premium Sedan", value: "Premium Sedan" },
  { label: "SUV", value: "SUV" },
  { label: "Premium SUV", value: "Premium SUV" },
];

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "6hr", value: "6hr" },
  { label: "12hr", value: "12hr" },
];

export default function CompaniesPage() {
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("companies");
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
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
    loadCompanies();
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

  const togglePricing = async (companyId) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
      return;
    }

    setExpandedCompanyId(companyId);
    if (!pricingByCompany[companyId]) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "loading" }));
      try {
        const data = await fetchPricing(companyId);
        setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
        setPricingStatus((prev) => ({ ...prev, [companyId]: "success" }));
      } catch (err) {
        setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
      }
    }
  };

  const handlePricingSubmit = async (event, companyId) => {
    event.preventDefault();
    const payload = pricingFormByCompany[companyId] || initialPricing;
    const rateValue = payload.rate ? Number(payload.rate) : 0;

    try {
      await createPricing(companyId, { ...payload, rate: rateValue });
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
      setPricingFormByCompany((prev) => ({
        ...prev,
        [companyId]: initialPricing,
      }));
    } catch (err) {
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

    try {
      await updatePricing(companyId, pricingId, {
        ...payload,
        rate: rateValue,
      });
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
      setPricingEditByCompany((prev) => {
        const companyEdits = { ...(prev[companyId] || {}) };
        delete companyEdits[pricingId];
        return { ...prev, [companyId]: companyEdits };
      });
    } catch (err) {
      setPricingStatus((prev) => ({ ...prev, [companyId]: "error" }));
    }
  };

  const handleDeletePricing = async (companyId, pricingId) => {
    try {
      await deletePricing(companyId, pricingId);
      const data = await fetchPricing(companyId);
      setPricingByCompany((prev) => ({ ...prev, [companyId]: data }));
    } catch (err) {
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

    try {
      await createCompany(form);
      setMessage(
        isFirebaseConfigured
          ? "Company added."
          : "Demo mode: company prepared."
      );
      setForm(initialState);
      await loadCompanies();
    } catch (err) {
      setError(err.message || "Failed to add company.");
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
          <p className={styles.eyebrow}>Companies</p>
          <h1>Corporate Companies</h1>
          <p className={styles.lead}>
            Manage corporate clients, contacts, and billing cycles.
          </p>
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

      <section className={styles.grid}>
        {canEdit && (
        <form className={styles.form} onSubmit={handleSubmit}>
          <h2>Add Company</h2>
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
              placeholder="+91 90000 00000"
            />
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
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={updateField}
            />
            Active company
          </label>

          <div className={styles.actions}>
            <button className={styles.primaryCta} type="submit">
              Save Company
            </button>
            {message && <p className={styles.message}>{message}</p>}
            {error && <p className={styles.error}>{error}</p>}
          </div>
        </form>
        )}

        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h2>Company List</h2>
            {status === "loading" && <span>Loading...</span>}
          </div>
          {status === "error" && <p className={styles.error}>{error}</p>}
          {status === "success" && companies.length === 0 && (
            <p>No companies yet. Add your first corporate client.</p>
          )}
          {companies.length > 0 && (
            <div className={styles.cards}>
              {companies.map((company) => (
                <article key={company.company_id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3>{company.name}</h3>
                      <p>{company.billing_cycle || "monthly"} billing</p>
                    </div>
                    <p className={styles.companyId}>ID: {company.company_id}</p>
                  </div>
                  <div className={styles.meta}>
                    <span>{company.contact_name || "-"}</span>
                    <span>{company.contact_phone || "-"}</span>
                    <span>{company.address || "-"}</span>
                  </div>
                  <div className={styles.cardFooter}>
                    <span
                      className={
                        company.active ? styles.activeTag : styles.inactiveTag
                      }
                    >
                      {company.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => togglePricing(company.company_id)}
                    >
                      {expandedCompanyId === company.company_id
                        ? "Hide pricing"
                        : "Manage pricing"}
                    </button>
                  </div>
                  {expandedCompanyId === company.company_id && (
                    <div className={styles.pricingSection}>
                      {canEdit && (
                      <form
                        className={styles.pricingForm}
                        onSubmit={(event) =>
                          handlePricingSubmit(event, company.company_id)
                        }
                      >
                        <label className={styles.field}>
                          Cab type
                          <CustomDropdown
                            options={cabTypeOptions}
                            value={
                              (pricingFormByCompany[company.company_id] ||
                                initialPricing).cab_type
                            }
                            onChange={(value) =>
                              setPricingField(company.company_id, "cab_type", value)
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
                              (pricingFormByCompany[company.company_id] ||
                                initialPricing).slot
                            }
                            onChange={(value) =>
                              setPricingField(company.company_id, "slot", value)
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
                              (pricingFormByCompany[company.company_id] ||
                                initialPricing).rate
                            }
                            onChange={(event) =>
                              updatePricingField(company.company_id, event)
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
                        {(pricingByCompany[company.company_id] || []).map(
                          (pricing) => {
                            const edits =
                              pricingEditByCompany?.[company.company_id]?.[
                                pricing.pricing_id
                              ];
                            const isEditing = Boolean(edits);
                            return (
                              <div
                                key={pricing.pricing_id}
                                className={styles.pricingRow}
                              >
                                {isEditing ? (
                                  <>
                                    <CustomDropdown
                                      options={cabTypeOptions}
                                      value={edits.cab_type}
                                      onChange={(value) =>
                                        setEditPricingField(
                                          company.company_id,
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
                                          company.company_id,
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
                                          company.company_id,
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
                                          company.company_id,
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
                                          startEditPricing(
                                            company.company_id,
                                            pricing
                                          )
                                        }
                                      >
                                        Update
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.deleteButton}
                                        onClick={() =>
                                          handleDeletePricing(
                                            company.company_id,
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
                          }
                        )}
                        {pricingStatus[company.company_id] === "loading" && (
                          <p className={styles.pricingNotice}>Loading pricing...</p>
                        )}
                        {pricingStatus[company.company_id] === "error" && (
                          <p className={styles.error}>
                            Unable to load pricing.
                          </p>
                        )}
                        {pricingStatus[company.company_id] === "success" &&
                          (pricingByCompany[company.company_id] || []).length ===
                            0 && (
                            <p className={styles.pricingNotice}>
                              No pricing rules yet.
                            </p>
                          )}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
