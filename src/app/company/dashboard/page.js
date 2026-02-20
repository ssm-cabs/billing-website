"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBookingRequest, fetchCompanies, isFirebaseConfigured } from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./page.module.css";

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCompanyIds(userData) {
  if (!Array.isArray(userData?.company_ids)) return [];
  return userData.company_ids.filter((id) => typeof id === "string" && id.trim());
}

const initialRequestForm = {
  company_id: "",
  trip_date: getToday(),
  trip_time: "",
  pickup_location: "",
  drop_location: "",
  cab_type: "",
  slot: "",
  notes: "",
};

export default function CompanyDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [requestStatus, setRequestStatus] = useState("idle");
  const [requestMessage, setRequestMessage] = useState("");

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
        if (!isRole(role, "company")) {
          setIsLoading(false);
          router.push(getHomeRouteForRole(role));
          return;
        }
        setUserData(profile);
      } catch (err) {
        console.error("Failed to load company profile:", err);
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

    const loadCompanies = async () => {
      try {
        const allCompanies = await fetchCompanies();
        const allowedCompanyIds = new Set(getCompanyIds(userData));
        const linkedCompanies = allCompanies.filter((company) =>
          allowedCompanyIds.has(company.company_id)
        );
        setCompanies(linkedCompanies);
        setRequestForm((prev) => ({
          ...prev,
          company_id: prev.company_id || linkedCompanies[0]?.company_id || "",
        }));
      } catch (err) {
        console.error("Failed to load company data:", err);
        setError("Unable to load your company details.");
      }
    };

    loadCompanies();
  }, [userData]);

  const companyCount = useMemo(() => companies.length, [companies]);

  const handleRequestFieldChange = (event) => {
    const { name, value } = event.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    setRequestStatus("loading");
    setRequestMessage("");

    try {
      const selectedCompany = companies.find(
        (company) => company.company_id === requestForm.company_id
      );

      if (!selectedCompany) {
        throw new Error("Please select a valid company.");
      }

      const createdBy =
        String(userData?.user_id || "").trim() ||
        String(userData?.phone || "").trim() ||
        String(userData?.name || "").trim();

      await createBookingRequest({
        company_id: selectedCompany.company_id,
        company_name: selectedCompany.name || selectedCompany.company_id,
        trip_date: requestForm.trip_date,
        trip_time: requestForm.trip_time,
        pickup_location: requestForm.pickup_location,
        drop_location: requestForm.drop_location,
        cab_type: requestForm.cab_type,
        slot: requestForm.slot,
        notes: requestForm.notes,
        status: "submitted",
        created_by: createdBy,
        approved_by: "",
        converted_entry_id: null,
      });

      setRequestStatus("success");
      setRequestMessage(
        isFirebaseConfigured
          ? "Booking request submitted for review."
          : "Demo mode: booking request prepared."
      );
      setRequestForm((prev) => ({
        ...initialRequestForm,
        company_id: prev.company_id,
        trip_date: getToday(),
      }));
    } catch (submitError) {
      setRequestStatus("error");
      setRequestMessage(
        submitError.message || "Failed to submit booking request."
      );
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
          <p className={styles.eyebrow}>Company</p>
          <h1>Company Dashboard</h1>
          <p className={styles.lead}>
            Review your assigned company profile and raise new booking requests.
          </p>
        </div>
      </header>

      <section className={styles.stats}>
        <div className={styles.card}>
          <p>Linked companies</p>
          <h2>{companyCount}</h2>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>New Booking Request</h3>
        </div>
        <p className={styles.requestHint}>
          Company submissions are saved to <code>booking_requests</code> and reviewed before conversion.
        </p>
        <form className={styles.formGrid} onSubmit={handleRequestSubmit}>
          <label className={styles.field}>
            <span>Company</span>
            <select
              name="company_id"
              value={requestForm.company_id}
              onChange={handleRequestFieldChange}
              required
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.name || company.company_id}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Trip date</span>
            <input
              type="date"
              name="trip_date"
              value={requestForm.trip_date}
              onChange={handleRequestFieldChange}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Trip time</span>
            <input
              type="time"
              name="trip_time"
              value={requestForm.trip_time}
              onChange={handleRequestFieldChange}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Pickup</span>
            <input
              type="text"
              name="pickup_location"
              value={requestForm.pickup_location}
              onChange={handleRequestFieldChange}
              placeholder="Pickup location"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Drop</span>
            <input
              type="text"
              name="drop_location"
              value={requestForm.drop_location}
              onChange={handleRequestFieldChange}
              placeholder="Drop location"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Cab type</span>
            <input
              type="text"
              name="cab_type"
              value={requestForm.cab_type}
              onChange={handleRequestFieldChange}
              placeholder="Sedan / SUV"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Slot</span>
            <select
              name="slot"
              value={requestForm.slot}
              onChange={handleRequestFieldChange}
              required
            >
              <option value="">Select slot</option>
              <option value="4hr">4hr</option>
              <option value="8hr">8hr</option>
            </select>
          </label>

          <label className={`${styles.field} ${styles.notesField}`}>
            <span>Notes</span>
            <textarea
              name="notes"
              value={requestForm.notes}
              onChange={handleRequestFieldChange}
              rows={4}
              placeholder="Trip instructions"
            />
          </label>

          <div className={styles.formActions}>
            <button type="submit" disabled={requestStatus === "loading"}>
              {requestStatus === "loading" ? "Submitting..." : "Submit Request"}
            </button>
            {requestMessage && (
              <p
                className={
                  requestStatus === "error" ? styles.error : styles.success
                }
              >
                {requestMessage}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Companies</h3>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {!error && companies.length === 0 && (
          <p className={styles.empty}>
            No companies are linked yet. Contact your administrator.
          </p>
        )}
        {companies.length > 0 && (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Company</span>
              <span>Billing Cycle</span>
              <span>Contact</span>
            </div>
            {companies.map((company) => (
              <div key={company.company_id} className={styles.tableRow}>
                <span>{company.name || "-"}</span>
                <span>{company.billing_cycle || "-"}</span>
                <span>{company.contact_name || "-"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
