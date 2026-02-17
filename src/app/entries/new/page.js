"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DatePicker from "../DatePicker";
import CustomDropdown from "../CustomDropdown";
import {
  createEntry,
  fetchCompanies,
  fetchPricing,
  fetchVehicles,
  isFirebaseConfigured,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./new.module.css";

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLoggedInUserName = () => {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem("user_data");
    if (!stored) return "";
    const userData = JSON.parse(stored);
    return userData?.name || userData?.phone || "";
  } catch (error) {
    return "";
  }
};

const initialState = {
  entry_date: getToday(),
  company_name: "",
  slot: "",
  pickup_location: "",
  drop_location: "",
  odometer_start: "",
  odometer_end: "",
  vehicle_number: "",
  cab_type: "",
  user_name: "",
  rate: "",
  notes: "",
};

export default function NewEntryPage() {
  const router = useRouter();
  const { canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState("idle");
  const [pricing, setPricing] = useState([]);
  const [pricingStatus, setPricingStatus] = useState("idle");

  useEffect(() => {
    const loadCompanies = async () => {
      setCompanyStatus("loading");
      try {
        const data = await fetchCompanies();
        setCompanies(data.filter((company) => company.active !== false));
        setCompanyStatus("success");
      } catch (err) {
        setCompanyStatus("error");
      }
    };

    loadCompanies();
  }, []);

  useEffect(() => {
    const loadVehicles = async () => {
      setVehicleStatus("loading");
      try {
        const data = await fetchVehicles();
        setVehicles(data.filter((vehicle) => vehicle.active !== false));
        setVehicleStatus("success");
      } catch (err) {
        setVehicleStatus("error");
      }
    };

    loadVehicles();
  }, []);

  useEffect(() => {
    const loadPricing = async () => {
      if (!form.company_name) {
        setPricing([]);
        return;
      }

      setPricingStatus("loading");
      try {
        const selectedCompany = companies.find(
          (c) => c.name === form.company_name
        );
        if (selectedCompany) {
          const data = await fetchPricing(selectedCompany.company_id);
          setPricing(data);
          setPricingStatus("success");
        }
      } catch (err) {
        setPricingStatus("error");
      }
    };

    loadPricing();
  }, [form.company_name, companies]);

  const selectedVehicle = vehicles.find(
    (v) => v.vehicle_number === form.vehicle_number
  );
  const selectedCompany = companies.find((c) => c.name === form.company_name);
  const resolvedCabType = selectedVehicle?.cab_type || "";
  const matchingPrice = pricing.find(
    (p) => p.cab_type === resolvedCabType && p.slot === form.slot
  );
  const resolvedRate = matchingPrice?.rate || 0;
  const effectiveRate =
    form.rate === "" || form.rate === null ? resolvedRate : Number(form.rate) || 0;

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setForm((prev) => ({ ...prev, entry_date: date }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const odometerStartRaw = String(form.odometer_start).trim();
      const odometerEndRaw = String(form.odometer_end).trim();
      if (!odometerStartRaw || !odometerEndRaw) {
        throw new Error("Odometer start and end are required.");
      }

      const odometerStart = Number(odometerStartRaw);
      const odometerEnd = Number(odometerEndRaw);

      if (odometerStart !== null && (!Number.isFinite(odometerStart) || odometerStart < 0)) {
        throw new Error("Odometer start must be a valid number.");
      }

      if (odometerEnd !== null && (!Number.isFinite(odometerEnd) || odometerEnd < 0)) {
        throw new Error("Odometer end must be a valid number.");
      }

      if (odometerStart !== null && odometerEnd !== null && odometerEnd < odometerStart) {
        throw new Error("Odometer end cannot be less than odometer start.");
      }

      const loggedInName = getLoggedInUserName();
      await createEntry({
        ...form,
        company_id: selectedCompany?.company_id || "",
        vehicle_id: selectedVehicle?.vehicle_id || "",
        cab_type: resolvedCabType,
        rate: effectiveRate,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        user_name: loggedInName || form.user_name,
      });
      setStatus("success");
      setMessage(
        isFirebaseConfigured ? "Entry saved." : "Demo mode: entry prepared."
      );
      setForm({
        ...initialState,
        entry_date: getToday(),
      });
      // Redirect to /entries after 1 second
      setTimeout(() => {
        router.push("/entries");
      }, 1000);
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Failed to save entry.");
    }
  };

  if (permissionsLoading) {
    return (
      <div className={styles.page}>
        <div style={{ padding: "40px", textAlign: "center" }}>
          <p>Loading permissions...</p>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/entries">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Access Denied</p>
            <h1>Permission Required</h1>
            <p className={styles.lead}>
              You don&apos;t have permission to create new entries.
            </p>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/entries">
            ← Back
          </Link>
          <p className={styles.eyebrow}>New entry</p>
          <h1>Create Ride Entry</h1>
          <p className={styles.lead}>
            Capture daily rides for corporate clients with slot-based pricing.
          </p>
        </div>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Entry date
          <DatePicker
            value={form.entry_date}
            onChange={handleDateChange}
          />
        </label>
        <label className={styles.field}>
          Company
          <CustomDropdown
            options={companies}
            value={form.company_name}
            onChange={(value) => setForm((prev) => ({ ...prev, company_name: value }))}
            status={companyStatus}
            getLabel={(c) => c.name}
            getValue={(c) => c.name}
            placeholder="Select company"
          />
        </label>
        <label className={styles.field}>
          Vehicle
          <CustomDropdown
            options={vehicles}
            value={form.vehicle_number}
            onChange={(value) => setForm((prev) => ({ ...prev, vehicle_number: value }))}
            status={vehicleStatus}
            getLabel={(v) => `${v.vehicle_number} · ${v.driver_name || "Driver"} · ${v.cab_type}`}
            getValue={(v) => v.vehicle_number}
            placeholder="Select vehicle"
            searchable
            searchPlaceholder="Search vehicle"
          />
        </label>
        {form.vehicle_number && (
          <label className={styles.field}>
            Cab type
            <input
              type="text"
              value={resolvedCabType}
              disabled
              readOnly
            />
          </label>
        )}
        <label className={styles.field}>
          Slot
          <CustomDropdown
            options={["4hr", "8hr"]}
            value={form.slot}
            onChange={(value) => setForm((prev) => ({ ...prev, slot: value }))}
            getLabel={(slot) => slot}
            getValue={(slot) => slot}
            placeholder="Select slot"
          />
        </label>
        {form.vehicle_number && form.slot && (
          <label className={styles.field}>
            Rate
            <input
              type="number"
              name="rate"
              value={form.rate === "" || form.rate === null ? resolvedRate : form.rate}
              onChange={updateField}
              min="0"
              placeholder="Auto from company pricing"
            />
          </label>
        )}
        <label className={styles.field}>
          Odometer start
          <input
            type="number"
            name="odometer_start"
            value={form.odometer_start}
            onChange={updateField}
            min="0"
            step="1"
            required
            placeholder="e.g. 125430"
          />
        </label>
        <label className={styles.field}>
          Odometer end
          <input
            type="number"
            name="odometer_end"
            value={form.odometer_end}
            onChange={updateField}
            min="0"
            step="1"
            required
            placeholder="e.g. 125512"
          />
        </label>
        <label className={styles.field}>
          Pickup location
          <input
            type="text"
            name="pickup_location"
            value={form.pickup_location}
            onChange={updateField}
          />
        </label>
        <label className={styles.field}>
          Drop location
          <input
            type="text"
            name="drop_location"
            value={form.drop_location}
            onChange={updateField}
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
          <button className={styles.primaryCta} type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Saving..." : "Save Entry"}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </div>
      </form>
    </div>
  );
}
