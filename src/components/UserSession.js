"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { signOutUser, getCurrentUser } from "@/lib/phoneAuth";
import styles from "./userSession.module.css";

/**
 * Component that displays current user and logout button
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
    <div className={styles.session}>
      <div className={styles.userInfo}>
        <span className={styles.phone}>{user.phoneNumber}</span>
      </div>
      <button
        onClick={handleLogout}
        disabled={loading}
        className={styles.logoutButton}
      >
        {loading ? "Logging out..." : "Logout"}
      </button>
    </div>
  );
}

export default UserSession;
