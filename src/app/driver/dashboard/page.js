"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchVehicles } from "@/lib/api";
import { getUserData, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { getHomeRouteForRole, normalizeRole } from "@/lib/roleRouting";
import styles from "./page.module.css";

function getVehicleIds(userData) {
  if (!Array.isArray(userData?.vehicle_ids)) return [];
  return userData.vehicle_ids.filter((id) => typeof id === "string" && id.trim());
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);

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
        if (role !== "driver") {
          setIsLoading(false);
          router.push(getHomeRouteForRole(role));
          return;
        }
        setUserData(profile);
      } catch (err) {
        console.error("Failed to load driver profile:", err);
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

    const loadVehicles = async () => {
      try {
        const allVehicles = await fetchVehicles();
        const allowedVehicleIds = new Set(getVehicleIds(userData));
        setVehicles(
          allVehicles.filter((vehicle) => allowedVehicleIds.has(vehicle.vehicle_id))
        );
      } catch (err) {
        console.error("Failed to load driver vehicles:", err);
        setError("Unable to load your vehicles.");
      }
    };

    loadVehicles();
  }, [userData]);

  const vehicleCount = useMemo(() => vehicles.length, [vehicles]);

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
          <p className={styles.eyebrow}>Driver</p>
          <h1>Driver Dashboard</h1>
          <p className={styles.lead}>
            View your assigned vehicles and continue with driver operations.
          </p>
        </div>
      </header>

      <section className={styles.stats}>
        <div className={styles.card}>
          <p>Assigned vehicles</p>
          <h2>{vehicleCount}</h2>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3>My Vehicles</h3>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {!error && vehicles.length === 0 && (
          <p className={styles.empty}>
            No vehicles are assigned yet. Contact your administrator.
          </p>
        )}
        {vehicles.length > 0 && (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Vehicle</span>
              <span>Cab Type</span>
              <span>Status</span>
            </div>
            {vehicles.map((vehicle) => (
              <div key={vehicle.vehicle_id} className={styles.tableRow}>
                <span>{vehicle.vehicle_number || "-"}</span>
                <span>{vehicle.cab_type || "-"}</span>
                <span>{vehicle.active !== false ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
