"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DatePicker from "@/app/entries/DatePicker";
import CustomDropdown from "@/app/entries/CustomDropdown";
import TimePicker from "@/app/entries/TimePicker";
import {
  createBookingRequest,
  fetchCompanies,
  isFirebaseConfigured,
} from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./new.module.css";

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
  entry_date: getToday(),
  start_time: "",
  pickup_location: "",
  drop_location: "",
  cab_type: "",
  slot: "",
  notes: "",
};

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "8hr", value: "8hr" },
];

const cabTypeOptions = [
  { label: "Sedan", value: "Sedan" },
  { label: "Premium Sedan", value: "Premium Sedan" },
  { label: "SUV", value: "SUV" },
  { label: "Premium SUV", value: "Premium SUV" },
];

export default function NewCompanyBookingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [userData, setUserData] = useState(null);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

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
      } catch (error) {
        console.error("Failed to load company profile:", error);
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
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Unable to load company options.");
      }
    };

    loadCompanies();
  }, [userData]);

  const handleRequestFieldChange = (event) => {
    const { name, value } = event.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const today = getToday();
      if (String(requestForm.entry_date || "") < today) {
        throw new Error("Entry date cannot be earlier than today.");
      }

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
      const userName =
        String(userData?.name || "").trim() ||
        String(userData?.phone || "").trim() ||
        createdBy;

      await createBookingRequest({
        company_id: selectedCompany.company_id,
        company_name: selectedCompany.name || selectedCompany.company_id,
        entry_date: requestForm.entry_date,
        start_time: requestForm.start_time,
        pickup_location: requestForm.pickup_location,
        drop_location: requestForm.drop_location,
        cab_type: requestForm.cab_type,
        slot: requestForm.slot,
        notes: requestForm.notes,
        status: "submitted",
        created_by: createdBy,
        user_name: userName,
        approved_by: "",
        converted_entry_id: null,
      });

      setStatus("success");
      setMessage(
        isFirebaseConfigured
          ? "Booking request submitted for review."
          : "Demo mode: booking request prepared."
      );

      setTimeout(() => {
        router.push("/company/dashboard");
      }, 1000);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Failed to submit booking request.");
    }
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading...</p>
        </div>
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
          <Link className={styles.backLink} href="/company/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>New booking</p>
          <h1>Create Booking Request</h1>
          <p className={styles.lead}>
            Submit a new booking request for operations review.
          </p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Company
          <CustomDropdown
            options={companies}
            value={requestForm.company_id}
            onChange={(value) =>
              setRequestForm((prev) => ({ ...prev, company_id: value }))
            }
            getLabel={(company) => company.name || company.company_id}
            getValue={(company) => company.company_id}
            placeholder="Select company"
            defaultOption={{ label: "Select company", value: "" }}
          />
        </label>

        <label className={styles.field}>
          Entry date
          <DatePicker
            value={requestForm.entry_date}
            minDate={getToday()}
            onChange={(value) =>
              setRequestForm((prev) => ({ ...prev, entry_date: value }))
            }
          />
        </label>

        <label className={styles.field}>
          Start time
          <TimePicker
            value={requestForm.start_time}
            onChange={(value) =>
              setRequestForm((prev) => ({ ...prev, start_time: value }))
            }
            placeholder="Select start time"
          />
        </label>

        <label className={styles.field}>
          Slot
          <CustomDropdown
            options={slotOptions}
            value={requestForm.slot}
            onChange={(value) => setRequestForm((prev) => ({ ...prev, slot: value }))}
            getLabel={(option) => option.label}
            getValue={(option) => option.value}
            placeholder="Select slot"
            defaultOption={{ label: "Select slot", value: "" }}
          />
        </label>

        <label className={styles.field}>
          Cab type
          <CustomDropdown
            options={cabTypeOptions}
            value={requestForm.cab_type}
            onChange={(value) =>
              setRequestForm((prev) => ({ ...prev, cab_type: value }))
            }
            getLabel={(option) => option.label}
            getValue={(option) => option.value}
            placeholder="Select cab type"
            defaultOption={{ label: "Select cab type", value: "" }}
          />
        </label>

        <label className={styles.field}>
          Pickup
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
          Drop
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
          Notes
          <textarea
            name="notes"
            value={requestForm.notes}
            onChange={handleRequestFieldChange}
            rows={4}
            placeholder="Trip instructions"
          />
        </label>

        <div className={styles.actions}>
          <button className={styles.primaryCta} type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Submitting..." : "Submit Request"}
          </button>
          {message && (
            <p className={status === "error" ? styles.error : styles.success}>
              {message}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
