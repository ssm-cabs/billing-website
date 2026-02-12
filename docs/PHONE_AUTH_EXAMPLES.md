/**
 * Example implementation of protected pages with phone authentication
 * This file demonstrates how to integrate the phone auth system into your pages
 */

// Example 1: Using the useAuth hook in a page
// File: src/app/dashboard/page.js

/*
"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { user, userData, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null; // Auth hook handles redirect
  }

  const handleSignOut = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <div className={styles.userInfo}>
          <span>{userData?.name}</span>
          <button onClick={handleSignOut}>Logout</button>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.card}>
          <h2>Welcome, {userData?.name}!</h2>
          <p>Phone: {user?.phoneNumber}</p>
          <p>Role: {userData?.role}</p>
          <p>Company: {userData?.company_id}</p>
        </div>
      </main>
    </div>
  );
}
*/

// Example 2: Using the withAuth HOC
// File: src/app/admin/page.js

/*
"use client";

import { withAuth } from "@/lib/useAuth";
import styles from "./admin.module.css";

function AdminPage({ user, userData }) {
  return (
    <div className={styles.admin}>
      <h1>Admin Panel</h1>
      <p>Logged in as: {userData?.name}</p>
      {userData?.role === "admin" && (
        <div className={styles.adminTools}>
          <h2>Admin Tools</h2>
          {/* Admin-only content */}
        </div>
      )}
    </div>
  );
}

// Protect with authentication (admin role required)
export default withAuth(AdminPage, { requireAdmin: true });
*/

// Example 3: Adding logout button component
// File: src/components/LogoutButton.js

/*
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ className = "" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/signout", { method: "POST" });
      if (response.ok) {
        router.push("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} disabled={loading} className={className}>
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
*/

// Example 4: Checking current auth state
// File: A component that conditionally renders based on auth

/*
"use client";

import { getCurrentUser } from "@/lib/phoneAuth";
import { useEffect, useState } from "react";

export function ProtectedContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setIsLoggedIn(true);
      setUser(currentUser);
    }
  }, []);

  if (!isLoggedIn) {
    return <p>Please log in to view this content</p>;
  }

  return (
    <div>
      <p>Welcome, {user?.phoneNumber}</p>
      {/* Protected content here */}
    </div>
  );
}
*/

// Example 5: Creating a profile page
// File: src/app/profile/page.js

/*
"use client";

import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    // Implement profile update logic
    console.log("Update profile");
  };

  return (
    <div className={styles.profile}>
      <h1>My Profile</h1>
      <form onSubmit={handleUpdateProfile}>
        <div className={styles.field}>
          <label>Name</label>
          <input type="text" defaultValue={userData?.name} />
        </div>
        <div className={styles.field}>
          <label>Email</label>
          <input type="email" defaultValue={userData?.email} />
        </div>
        <div className={styles.field}>
          <label>Phone</label>
          <input type="tel" defaultValue={user?.phoneNumber} disabled />
        </div>
        <div className={styles.field}>
          <label>Role</label>
          <input type="text" defaultValue={userData?.role} disabled />
        </div>
        <button type="submit">Update Profile</button>
      </form>
    </div>
  );
}
*/

export {};
