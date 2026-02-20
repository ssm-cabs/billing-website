"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DatePicker from "@/app/entries/DatePicker";
import CustomDropdown from "@/app/entries/CustomDropdown";
import TimePicker from "@/app/entries/TimePicker";
import {
  fetchBookingRequestById,
  fetchCompanies,
  isFirebaseConfigured,
  updateBookingRequest,
} from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, isRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./edit.module.css";

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

const initialForm = {
  company_id: "",
  entry_date: "",
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

function EditCompanyBookingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("id") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState([]);
  const [requestData, setRequestData] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [allowedCompanyIds, setAllowedCompanyIds] = useState(new Set());

  useSessionTimeout();

  useEffect(() => {
    const init = async () => {
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

        const companyIds = new Set(getCompanyIds(profile));
        setAllowedCompanyIds(companyIds);

        const [allCompanies, bookingRequest] = await Promise.all([
          fetchCompanies(),
          fetchBookingRequestById(requestId),
        ]);

        if (!bookingRequest?.company_id || !companyIds.has(bookingRequest.company_id)) {
          throw new Error("You don't have access to edit this booking request.");
        }

        if (bookingRequest.status !== "submitted") {
          throw new Error("Only submitted booking requests can be edited.");
        }

        const linkedCompanies = allCompanies.filter((company) =>
          companyIds.has(company.company_id)
        );
        setCompanies(linkedCompanies);
        setRequestData(bookingRequest);
        setForm({
          company_id: bookingRequest.company_id || "",
          entry_date: bookingRequest.entry_date || "",
          start_time: bookingRequest.start_time || "",
          pickup_location: bookingRequest.pickup_location || "",
          drop_location: bookingRequest.drop_location || "",
          cab_type: bookingRequest.cab_type || "",
          slot: bookingRequest.slot || "",
          notes: bookingRequest.notes || "",
        });
      } catch (error) {
        setStatus("error");
        setMessage(error.message || "Failed to load booking request.");
      } finally {
        setIsLoading(false);
      }
    };

    if (!requestId) {
      setStatus("error");
      setMessage("Missing booking request id.");
      setIsLoading(false);
      return;
    }

    init();
  }, [requestId, router]);

  const companyNameById = useMemo(() => {
    return new Map(companies.map((company) => [company.company_id, company.name || company.company_id]));
  }, [companies]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!requestId) return;

    setStatus("loading");
    setMessage("");

    try {
      const today = getToday();
      if (String(form.entry_date || "") < today) {
        throw new Error("Entry date cannot be earlier than today.");
      }

      if (!allowedCompanyIds.has(form.company_id)) {
        throw new Error("Please select a valid company.");
      }

      await updateBookingRequest(requestId, {
        company_id: form.company_id,
        company_name: companyNameById.get(form.company_id) || "",
        entry_date: form.entry_date,
        start_time: form.start_time,
        pickup_location: form.pickup_location,
        drop_location: form.drop_location,
        cab_type: form.cab_type,
        slot: form.slot,
        notes: form.notes,
      });

      setStatus("success");
      setMessage(
        isFirebaseConfigured
          ? "Booking request updated."
          : "Demo mode: booking update prepared."
      );

      setTimeout(() => {
        router.push("/company/dashboard");
      }, 1000);
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Failed to update booking request.");
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
          <p className={styles.eyebrow}>Edit booking</p>
          <h1>Edit Booking Request</h1>
          <p className={styles.lead}>
            Update request details before operations review.
          </p>
        </div>
      </header>

      {status === "error" && !requestData ? (
        <div className={styles.form}>
          <p className={styles.error}>{message}</p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Company
            <CustomDropdown
              options={companies}
              value={form.company_id}
              onChange={(value) => setForm((prev) => ({ ...prev, company_id: value }))}
              getLabel={(company) => company.name || company.company_id}
              getValue={(company) => company.company_id}
              placeholder="Select company"
              defaultOption={{ label: "Select company", value: "" }}
            />
          </label>

          <label className={styles.field}>
            Entry date
            <DatePicker
              value={form.entry_date}
              minDate={getToday()}
              onChange={(value) => setForm((prev) => ({ ...prev, entry_date: value }))}
            />
          </label>

          <label className={styles.field}>
            Start time
            <TimePicker
              value={form.start_time}
              onChange={(value) => setForm((prev) => ({ ...prev, start_time: value }))}
              placeholder="Select start time"
            />
          </label>

          <label className={styles.field}>
            Slot
            <CustomDropdown
              options={slotOptions}
              value={form.slot}
              onChange={(value) => setForm((prev) => ({ ...prev, slot: value }))}
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
              value={form.cab_type}
              onChange={(value) => setForm((prev) => ({ ...prev, cab_type: value }))}
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
              value={form.pickup_location}
              onChange={handleChange}
              placeholder="Pickup location"
              required
            />
          </label>

          <label className={styles.field}>
            Drop
            <input
              type="text"
              name="drop_location"
              value={form.drop_location}
              onChange={handleChange}
              placeholder="Drop location"
              required
            />
          </label>

          <label className={styles.field}>
            Notes
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={4}
              placeholder="Trip instructions"
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.primaryCta} type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Saving..." : "Update Request"}
            </button>
            {message && (
              <p className={status === "error" ? styles.error : styles.success}>{message}</p>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export default function EditCompanyBookingPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <p>Loading...</p>
          </div>
        </div>
      }
    >
      <EditCompanyBookingPageContent />
    </Suspense>
  );
}
