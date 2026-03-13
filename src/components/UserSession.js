"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signOutUser, getCurrentUser } from "@/lib/phoneAuth";
import styles from "./userSession.module.css";

const INSTALL_ALLOWED_ROLES = new Set(["driver", "company", "user"]);

/**
 * Component that displays logout button as icon only
 */
export function UserSession() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Update user state on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);

    const loadRole = () => {
      try {
        const rawUserData = localStorage.getItem("user_data");
        const parsedUserData = rawUserData ? JSON.parse(rawUserData) : null;
        setRole(String(parsedUserData?.role || "").trim().toLowerCase());
      } catch {
        setRole("");
      }
    };

    loadRole();

    const inStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setIsStandalone(inStandaloneMode);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("user_data_updated", loadRole);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("user_data_updated", loadRole);
    };
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOutUser();
      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Failed to logout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice?.outcome === "accepted") {
      setCanInstall(false);
    }

    setDeferredPrompt(null);
  };

  if (!user) {
    return null;
  }

  const shouldShowInstall = INSTALL_ALLOWED_ROLES.has(role) && canInstall && !isStandalone;

  return (
    <div className={styles.actions}>
      {shouldShowInstall ? (
        <button
          onClick={handleInstallApp}
          className={styles.installButton}
          title="Install app"
          aria-label="Install app"
        >
          Install app
        </button>
      ) : null}
      <button
        onClick={handleLogout}
        disabled={loading}
        className={styles.logoutIcon}
        title="Logout"
        aria-label="Logout"
      >
        {loading ? "..." : "⎋"}
      </button>
    </div>
  );
}

export default UserSession;
