"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CustomDropdown from "../entries/CustomDropdown";
import { waitForAuthInit } from "@/lib/phoneAuth";
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
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import styles from "./users.module.css";

const getPermissionOptions = (moduleId) => {
  if (moduleId === "revenue") {
    return [
      { value: "none", label: "None" },
      { value: "read", label: "Read" },
    ];
  }

  return [
    { value: "none", label: "None" },
    { value: "read", label: "Read" },
    { value: "edit", label: "Edit" },
  ];
};

const normalizeModulePermission = (moduleId, permission) => {
  if (moduleId === "revenue" && permission === "edit") {
    return "read";
  }
  return permission;
};

const normalizePermissions = (permissions = {}) =>
  Object.fromEntries(
    Object.entries(permissions).map(([moduleId, permission]) => [
      moduleId,
      normalizeModulePermission(moduleId, permission),
    ])
  );

const HIDDEN_PERMISSION_MODULES = new Set();
const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "user", label: "User" },
  { value: "driver", label: "Driver" },
];

const normalizeRole = (role) => {
  if (typeof role !== "string") return "user";
  const normalized = role.toLowerCase().trim();
  return ROLE_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "user";
};

export default function UsersPage() {
  const router = useRouter();
  const { canEdit } = usePermissions("users");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState({ id: null, name: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRole, setEditingRole] = useState("user");
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
    if (!canEdit) return;
    setEditingId(null);
    setFormData({
      phone: "",
      name: "",
      active: true,
      notes: "",
      permissions: getDefaultPermissions(),
    });
    setEditingRole("user");
    setFormError("");
    setShowForm(true);
  };

  const handleEditClick = (user) => {
    if (!canEdit) return;
    if (normalizeRole(user.role) === "admin") return;
    setEditingId(user.id);
    setFormData({
      phone: user.phone || "",
      name: user.name || "",
      active: user.active !== false,
      notes: user.notes || "",
      permissions: user.permissions || getDefaultPermissions(),
    });
    setEditingRole(normalizeRole(user.role));
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
        [collection]: normalizeModulePermission(collection, permission),
      },
    }));
  };

  const getPermissionsSummary = (permissions) => {
    if (!permissions) return "None";
    const activePerm = Object.entries(permissions)
      .filter(([moduleId, perm]) => !HIDDEN_PERMISSION_MODULES.has(moduleId) && perm !== "none")
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
    if (!isValidPhoneNumber(formData.phone.trim())) {
      setFormError("Invalid phone format (+91XXXXXXXXXX)");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setFormError("");

    if (!validateForm()) {
      return;
    }

    setFormLoading(true);
    try {
      const editingUser = editingId ? users.find((u) => u.id === editingId) : null;
      const dataToSave = {
        ...formData,
        ...(editingId
          ? { role: normalizeRole(editingUser?.role) }
          : { role: "user" }),
        phone: normalizePhoneNumber(formData.phone),
        permissions: normalizePermissions(formData.permissions),
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

  const handleDelete = (userId, userName) => {
    if (!canEdit) return;
    const user = users.find((u) => u.id === userId);
    if (normalizeRole(user?.role) === "admin") return;
    setDeleteTarget({ id: userId, name: userName });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!canEdit) return;
    if (!deleteTarget.id) return;
    try {
      await deleteUser(deleteTarget.id);
      setUsers(users.filter((u) => u.id !== deleteTarget.id));
      setShowDeleteConfirm(false);
      setDeleteTarget({ id: null, name: "" });
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
        {canEdit && (
          <button className={styles.primaryCta} onClick={handleAddClick}>
            Add User
          </button>
        )}
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
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const role = normalizeRole(user.role);
                return (
                  <tr key={user.id}>
                  <td className={styles.phone} data-label="Phone">
                    {user.phone}
                  </td>
                  <td className={styles.name} data-label="Name">
                    {user.name}
                  </td>
                  <td className={styles.role} data-label="Role">
                    {role}
                  </td>
                  <td className={styles.permissions} data-label="Permissions">
                    {getPermissionsSummary(user.permissions)}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`${styles.status} ${
                        role === "admin"
                          ? styles.admin
                          : user.active
                          ? styles.active
                          : styles.inactive
                      }`}
                    >
                      {role === "admin" ? "Admin" : user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className={styles.actions} data-label="Actions">
                      {role !== "admin" && (
                        <>
                          <button
                            className={styles.editBtn}
                            onClick={() => handleEditClick(user)}
                            title="Edit"
                          >
                            <span className={styles.editIcon}>✎</span>
                          </button>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(user.id, user.name)}
                            title="Delete"
                          >
                          ✕
                          </button>
                        </>
                      )}
                    </td>
                  )}
                  </tr>
                );
              })}
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
                  onBlur={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: normalizePhoneNumber(e.target.value),
                    }))
                  }
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
                {editingId && editingRole === "driver" ? (
                  <p className={styles.helperText}>
                    Permissions for driver accounts are managed from Vehicles.
                  </p>
                ) : (
                  <div className={styles.permissionsGrid}>
                    {MODULES.filter((module) => !HIDDEN_PERMISSION_MODULES.has(module.id)).map((module) => (
                      <div key={module.id} className={styles.permissionItem}>
                        <span className={styles.permissionLabel}>
                          {module.icon} {module.name}
                        </span>
                        <CustomDropdown
                          options={getPermissionOptions(module.id)}
                          value={normalizeModulePermission(
                            module.id,
                            formData.permissions[module.id]
                          )}
                          onChange={(value) =>
                            handlePermissionChange(module.id, value)
                          }
                          getLabel={(option) => option.label}
                          getValue={(option) => option.value}
                          buttonClassName={styles.permissionSelect}
                          placeholder="Select permission"
                        />
                      </div>
                      )
                    )}
                  </div>
                )}
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

      {showDeleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div
            className={`${styles.modal} ${styles.confirmModal}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Delete User</h3>
            <p className={styles.modalSubtitle}>
              Are you sure you want to delete {deleteTarget.name || "this user"}? This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                onClick={confirmDelete}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
