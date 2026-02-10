"use client";

import { useEffect, useState } from "react";
import { createCompany, fetchCompanies, isFirebaseConfigured } from "@/lib/api";
import styles from "./companies.module.css";

const initialState = {
  name: "",
  billing_cycle: "monthly",
  contact_name: "",
  contact_phone: "",
  address: "",
  active: true,
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const handleSubmit = async (event) => {
    event.preventDefault();
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
      <header className={styles.header}>
        <div>
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
            <select
              name="billing_cycle"
              value={form.billing_cycle}
              onChange={updateField}
            >
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
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
                  <div>
                    <h3>{company.name}</h3>
                    <p>{company.billing_cycle || "monthly"} billing</p>
                  </div>
                  <div className={styles.meta}>
                    <span>{company.contact_name || "-"}</span>
                    <span>{company.contact_phone || "-"}</span>
                    <span>{company.address || "-"}</span>
                  </div>
                  <span
                    className={
                      company.active ? styles.activeTag : styles.inactiveTag
                    }
                  >
                    {company.active ? "Active" : "Inactive"}
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
