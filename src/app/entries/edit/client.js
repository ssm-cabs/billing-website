"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import DatePicker from "../DatePicker";
import CustomDropdown from "../CustomDropdown";
import {
  fetchEntryById,
  updateEntry,
  fetchCompanies,
  fetchVehicles,
  isFirebaseConfigured,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "../edit.module.css";

const initialState = {
  entry_date: "",
  company_id: "",
  company_name: "",
  slot: "",
  pickup_location: "",
  drop_location: "",
  vehicle_id: "",
  vehicle_number: "",
  cab_type: "",
  user_name: "",
  rate: 0,
  odometer_start: "",
  odometer_end: "",
  hours: "",
  kms: "",
  tolls: "",
  notes: "",
};

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "8hr", value: "8hr" },
];

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

export default function ClientEditEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { canEdit, loading: permissionsLoading } = usePermissions("entries");
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [companies, setCompanies] = useState([]);
  const [companyStatus, setCompanyStatus] = useState("idle");
  const [vehicles, setVehicles] = useState([]);
  const [vehicleStatus, setVehicleStatus] = useState("idle");
  const [loadingEntry, setLoadingEntry] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isBilled, setIsBilled] = useState(false);

  // Load entry data
  useEffect(() => {
    if (!id) {
      setLoadError("Invalid entry ID");
      setLoadingEntry(false);
      return;
    }

    const loadEntry = async () => {
      try {
        setLoadingEntry(true);
        const entry = await fetchEntryById(id);
        setIsBilled(entry.billed || false);
        setForm({
          entry_date: entry.entry_date || "",
          company_id: entry.company_id || "",
          company_name: entry.company_name || "",
          slot: entry.slot || "",
          pickup_location: entry.pickup_location || "",
          drop_location: entry.drop_location || "",
          vehicle_id: entry.vehicle_id || "",
          vehicle_number: entry.vehicle_number || "",
          cab_type: entry.cab_type || "",
          user_name: entry.user_name || "",
          rate: entry.rate || 0,
          odometer_start: entry.odometer_start ?? "",
          odometer_end: entry.odometer_end ?? "",
          hours: entry.hours ?? "",
          kms: entry.kms ?? "",
          tolls: entry.tolls ?? "",
          notes: entry.notes || "",
        });
        setLoadError("");
      } catch (err) {
        setLoadError(err.message || "Failed to load entry");
      } finally {
        setLoadingEntry(false);
      }
    };

    loadEntry();
  }, [id]);

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
    if (loadingEntry) return;
    const loggedInName = getLoggedInUserName();
    if (loggedInName) {
      setForm((prev) => ({ ...prev, user_name: loggedInName }));
    }
  }, [loadingEntry]);

  useEffect(() => {
    if (!companies.length) return;
    setForm((prev) => {
      if (prev.company_id || !prev.company_name) return prev;
      const selectedCompany = companies.find((company) => company.name === prev.company_name);
      if (!selectedCompany) return prev;
      return {
        ...prev,
        company_id: selectedCompany.company_id,
      };
    });
  }, [companies]);

  useEffect(() => {
    if (!vehicles.length) return;
    setForm((prev) => {
      if (prev.vehicle_id || !prev.vehicle_number) return prev;
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.vehicle_number === prev.vehicle_number
      );
      if (!selectedVehicle) return prev;
      return {
        ...prev,
        vehicle_id: selectedVehicle.vehicle_id,
        cab_type: selectedVehicle.cab_type || prev.cab_type || "",
      };
    });
  }, [vehicles]);

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
      const odometerStart = odometerStartRaw === "" ? null : Number(odometerStartRaw);
      const odometerEnd = odometerEndRaw === "" ? null : Number(odometerEndRaw);

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
      await updateEntry(id, {
        ...form,
        odometer_start: odometerStart,
        odometer_end: odometerEnd,
        hours: form.hours === "" ? null : Number(form.hours),
        kms: form.kms === "" ? null : Number(form.kms),
        tolls: form.tolls === "" ? null : Number(form.tolls),
        user_name: loggedInName || form.user_name,
      });
      setStatus("success");
      setMessage(
        isFirebaseConfigured ? "Entry updated." : "Demo mode: entry prepared."
      );
      // Redirect to /entries after 1 second
      setTimeout(() => {
        router.push("/entries");
      }, 1000);
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Failed to update entry.");
    }
  };

  if (permissionsLoading || loadingEntry) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/entries">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Edit entry</p>
            <h1>Loading...</h1>
          </div>
        </header>
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
              You don&apos;t have permission to edit entries.
            </p>
          </div>
        </header>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/entries">
              ← Back
            </Link>
            <p className={styles.eyebrow}>Edit entry</p>
            <h1>Error</h1>
            <p className={styles.lead}>{loadError}</p>
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
          <p className={styles.eyebrow}>Edit entry</p>
          <h1>Update Ride Entry</h1>
          <p className={styles.lead}>
            Modify ride details for corporate clients.
          </p>
        </div>
      </header>

      {isBilled ? (
        <div className={styles.form}>
          <p>This entry has been billed and cannot be edited.</p>
        </div>
      ) : (
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
            onChange={(value) =>
              setForm((prev) => {
                const selectedCompany = companies.find((company) => company.name === value);
                return {
                  ...prev,
                  company_name: value,
                  company_id: selectedCompany?.company_id || prev.company_id || "",
                };
              })
            }
            disabled
            getLabel={(company) => company.name}
            getValue={(company) => company.name}
            placeholder="Select company"
          />
          {companyStatus === "loading" && (
            <span className={styles.helper}>Loading companies...</span>
          )}
          {companyStatus === "error" && (
            <span className={styles.helperError}>
              Unable to load companies.
            </span>
          )}
        </label>
        <label className={styles.field}>
          Vehicle
          <CustomDropdown
            options={vehicles}
            value={form.vehicle_number}
            onChange={(value) =>
              setForm((prev) => {
                const selectedVehicle = vehicles.find(
                  (vehicle) => vehicle.vehicle_number === value
                );
                return {
                  ...prev,
                  vehicle_number: value,
                  vehicle_id: selectedVehicle?.vehicle_id || prev.vehicle_id || "",
                  cab_type: selectedVehicle?.cab_type || prev.cab_type || "",
                };
              })
            }
            getLabel={(vehicle) =>
              `${vehicle.vehicle_number} · ${vehicle.driver_name || "Driver"} · ${vehicle.cab_type}`
            }
            getValue={(vehicle) => vehicle.vehicle_number}
            placeholder="Select vehicle"
          />
          {vehicleStatus === "loading" && (
            <span className={styles.helper}>Loading vehicles...</span>
          )}
          {vehicleStatus === "error" && (
            <span className={styles.helperError}>
              Unable to load vehicles.
            </span>
          )}
        </label>
        {form.vehicle_number && (
          <label className={styles.field}>
            Cab type
            <input
              type="text"
              value={form.cab_type || ""}
              disabled
              readOnly
            />
          </label>
        )}
        <label className={styles.field}>
          Slot
          <CustomDropdown
            options={slotOptions}
            value={form.slot}
            onChange={(value) => setForm((prev) => ({ ...prev, slot: value }))}
            getLabel={(option) => option.label}
            getValue={(option) => option.value}
            placeholder="Select slot"
          />
        </label>
        {form.vehicle_number && form.slot && (
          <label className={styles.field}>
            Rate
            <input
              type="number"
              name="rate"
              value={form.rate}
              onChange={updateField}
              placeholder="Enter rate"
            />
          </label>
        )}
        <label className={styles.field}>
          Pickup location
          <input
            type="text"
            name="pickup_location"
            value={form.pickup_location}
            onChange={updateField}
            required
          />
        </label>
        <label className={styles.field}>
          Drop location
          <input
            type="text"
            name="drop_location"
            value={form.drop_location}
            onChange={updateField}
            required
          />
        </label>
        <label className={styles.field}>
          Odometer start
          <input
            type="number"
            name="odometer_start"
            value={form.odometer_start}
            onChange={updateField}
            min="0"
            step="1"
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
            placeholder="e.g. 125512"
          />
        </label>
        <label className={styles.field}>
          Extra hours
          <input
            type="number"
            name="hours"
            value={form.hours}
            onChange={updateField}
            min="0"
            step="1"
            placeholder="e.g. 2"
          />
        </label>
        <label className={styles.field}>
          Extra kms
          <input
            type="number"
            name="kms"
            value={form.kms}
            onChange={updateField}
            min="0"
            step="1"
            placeholder="e.g. 18"
          />
        </label>
        <label className={styles.field}>
          Toll Charges
          <input
            type="number"
            name="tolls"
            value={form.tolls}
            onChange={updateField}
            min="0"
            step="1"
            placeholder="e.g. 250"
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
            {status === "loading" ? "Saving..." : "Update Entry"}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </div>
        </form>
      )}
    </div>
  );
}
