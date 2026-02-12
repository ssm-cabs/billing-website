"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, waitForAuthInit } from "@/lib/phoneAuth";
import { useSessionTimeout } from "@/lib/useSessionTimeout";
import { UserSession } from "@/components/UserSession";
import { usePermissions } from "@/lib/usePermissions";
import { MODULES, getDefaultPermissions } from "@/config/modules";
import {
  fetchAllUsers,
  addUser,
  updateUser,
  deleteUser,
} from "@/lib/usersApi";
import styles from "./users.module.css";

export default function UsersPage() {
  const router = useRouter();
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("users");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    phone: "",
    name: "",
    active: true,
    notes: "",
    permissions: getDefaultPermissions(),
  });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Check session timeout
  useSessionTimeout();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const user = await waitForAuthInit();
      if (!user) {
        setIsAuthenticated(false);
        setAuthLoading(false);
        router.push("/login");
        return;
      }
      setIsAuthenticated(true);
      setAuthLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch users
  useEffect(() => {
    if (!isAuthenticated || authLoading) return;

    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await fetchAllUsers();
        setUsers(data);
        setError("");
      } catch (err) {
        console.error("Error loading users:", err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isAuthenticated, authLoading]);

  const handleAddClick = () => {
    setEditingId(null);
    setFormData({
      phone: "",
      name: "",
      active: true,
      notes: "",
      permissions: getDefaultPermissions(),
    });
    setFormError("");
    setShowForm(true);
  };

  const handleEditClick = (user) => {
    setEditingId(user.id);
    setFormData({
      phone: user.phone || "",
      name: user.name || "",
      active: user.active !== false,
      notes: user.notes || "",
      permissions: user.permissions || getDefaultPermissions(),
    });
    setFormError("");
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePermissionChange = (collection, permission) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [collection]: permission,
      },
    }));
  };

  const getPermissionsSummary = (permissions) => {
    if (!permissions) return "None";
    const activePerm = Object.entries(permissions)
      .filter(([_, perm]) => perm !== "none")
      .map(([collection, perm]) => `${collection}: ${perm}`);
    return activePerm.length > 0 ? activePerm.join(", ") : "None";
  };

  const validateForm = () => {
    if (!formData.phone.trim()) {
      setFormError("Phone number is required");
      return false;
    }
    if (!formData.name.trim()) {
      setFormError("Name is required");
      return false;
    }
    if (!/^\+\d{10,15}$/.test(formData.phone.trim())) {
      setFormError("Invalid phone format (+91XXXXXXXXXX)");
      return false;
    }
    return true;
  };

  const formatPhoneForStorage = (phone) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return "+91" + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
      return "+" + cleaned;
    }
    return "+" + cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!validateForm()) {
      return;
    }

    setFormLoading(true);
    try {
      const dataToSave = {
        ...formData,
        phone: formatPhoneForStorage(formData.phone),
      };

      if (editingId) {
        await updateUser(editingId, dataToSave);
        setUsers(
          users.map((u) => (u.id === editingId ? { ...u, ...dataToSave } : u))
        );
      } else {
        const newId = await addUser(dataToSave);
        setUsers([{ id: newId, ...dataToSave }, ...users]);
      }

      setShowForm(false);
    } catch (err) {
      console.error("Error saving user:", err);
      setFormError(err.message || "Failed to save user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (userId, userName) => {
    if (!confirm(`Delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("Failed to delete user");
    }
  };

  const filteredUsers = users.filter((user) =>
    [user.phone, user.name]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className={styles.page}>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.topNav}>
        <UserSession />
      </div>

      <header className={styles.header}>
        <div>
          <Link className={styles.backLink} href="/dashboard">
            ← Back
          </Link>
          <p className={styles.eyebrow}>Users</p>
          <h1>Manage Users</h1>
          <p className={styles.lead}>
            Add, edit, and manage authorized users for the billing system.
          </p>
        </div>
        <button className={styles.primaryCta} onClick={handleAddClick}>
          Add User
        </button>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search by phone or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className={styles.empty}>
          {users.length === 0
            ? "No users yet. Create one to get started."
            : "No users match your search."}
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className={styles.phone}>{user.phone}</td>
                  <td className={styles.name}>{user.name}</td>
                  <td className={styles.permissions}>
                    {getPermissionsSummary(user.permissions)}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        user.active ? styles.active : styles.inactive
                      }`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className={styles.actions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => handleEditClick(user)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(user.id, user.name)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className={styles.modalOverlay} onClick={() => setShowForm(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2>{editingId ? "Edit User" : "Add New User"}</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setShowForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {formError && (
                <div className={styles.formError}>{formError}</div>
              )}

              <div className={styles.formGroup}>
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleFormChange}
                  placeholder="+919876543210"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>User Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="User Name"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>Permissions</label>
                <div className={styles.permissionsGrid}>
                  {MODULES.map((module) => (
                    <div key={module.id} className={styles.permissionItem}>
                      <span className={styles.permissionLabel}>
                        {module.icon} {module.name}
                      </span>
                      <select
                        value={formData.permissions[module.id]}
                        onChange={(e) =>
                          handlePermissionChange(module.id, e.target.value)
                        }
                        className={styles.permissionSelect}
                      >
                        <option value="none">None</option>
                        <option value="read">Read</option>
                        <option value="edit">Edit</option>
                        </select>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="active"
                    checked={formData.active}
                    onChange={handleFormChange}
                  />
                  Active
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  placeholder="Additional notes..."
                  rows="3"
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={formLoading}
                >
                  {formLoading
                    ? "Saving..."
                    : editingId
                    ? "Update User"
                    : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
