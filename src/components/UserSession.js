"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signOutUser, getCurrentUser } from "@/lib/phoneAuth";
import styles from "./userSession.module.css";

/**
 * Component that displays logout button as icon only
 */
export function UserSession() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Update user state on mount
  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
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

  if (!user) {
    return null;
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={styles.logoutIcon}
      title="Logout"
      aria-label="Logout"
    >
      {loading ? "..." : "⎋"}
    </button>
  );
}

export default UserSession;
