"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DatePicker from "../DatePicker";
import CustomDropdown from "../CustomDropdown";
import {
  fetchEntryById,
  updateEntry,
  fetchCompanies,
  fetchPricing,
  fetchVehicles,
  isFirebaseConfigured,
} from "@/lib/api";
import { usePermissions } from "@/lib/usePermissions";
import styles from "../edit.module.css";

const initialState = {
  entry_date: "",
  company_name: "",
  slot: "",
  pickup_location: "",
  drop_location: "",
  vehicle_number: "",
  cab_type: "",
  user_name: "",
  rate: 0,
  notes: "",
};

const slotOptions = [
  { label: "4hr", value: "4hr" },
  { label: "6hr", value: "6hr" },
  { label: "12hr", value: "12hr" },
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

export default function ClientEditEntryPage({ id }) {
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
          company_name: entry.company_name || "",
          slot: entry.slot || "",
          pickup_location: entry.pickup_location || "",
          drop_location: entry.drop_location || "",
          vehicle_number: entry.vehicle_number || "",
          cab_type: entry.cab_type || "",
          user_name: entry.user_name || "",
          rate: entry.rate || 0,
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

  useEffect(() => {
    if (loadingEntry) return;
    const loggedInName = getLoggedInUserName();
    if (loggedInName) {
      setForm((prev) => ({ ...prev, user_name: loggedInName }));
    }
  }, [loadingEntry]);

  useEffect(() => {
    const selectedVehicle = vehicles.find(
      (v) => v.vehicle_number === form.vehicle_number
    );
    const matchingPrice = pricing.find(
      (p) => p.cab_type === selectedVehicle?.cab_type && p.slot === form.slot
    );

    setForm((prev) => ({
      ...prev,
      cab_type: selectedVehicle?.cab_type || "",
      rate: matchingPrice?.rate || 0,
    }));
  }, [form.vehicle_number, form.slot, pricing, vehicles]);

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
      const loggedInName = getLoggedInUserName();
      await updateEntry(id, {
        ...form,
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
              You don't have permission to edit entries.
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
              setForm((prev) => ({ ...prev, company_name: value }))
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
              setForm((prev) => ({ ...prev, vehicle_number: value }))
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
              value={vehicles.find(v => v.vehicle_number === form.vehicle_number)?.cab_type || ""}
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
