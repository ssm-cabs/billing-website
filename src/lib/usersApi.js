import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { getDefaultPermissions } from "@/config/modules";

const USER_ROLES = new Set(["admin", "user", "driver"]);

const normalizePermissions = (permissions) => {
  const defaults = getDefaultPermissions();
  if (!permissions || typeof permissions !== "object") return defaults;

  return Object.keys(defaults).reduce((acc, key) => {
    const value = permissions[key];
    acc[key] = value === "read" || value === "edit" || value === "none"
      ? value
      : defaults[key];
    return acc;
  }, {});
};

const normalizeRole = (role) => {
  if (typeof role !== "string") return "user";
  const normalized = role.toLowerCase().trim();
  return USER_ROLES.has(normalized) ? normalized : "user";
};

/**
 * Fetch all users from the users collection
 * @returns {Promise<Array>} - Array of user objects with IDs
 */
export async function fetchAllUsers() {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((userDoc) => {
      const baseData = userDoc.data();
      return {
        id: userDoc.id,
        ...baseData,
        user_id: baseData.user_id || userDoc.id,
        role: normalizeRole(baseData.role),
        permissions: normalizePermissions(baseData.permissions),
      };
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

/**
 * Add a new user to the users collection
 * @param {Object} userData - User data object
 * @returns {Promise<string>} - Document ID of the new user
 */
export async function addUser(userData) {
  try {
    const usersRef = collection(db, "users");
    const userRef = doc(usersRef);
    const { permissions, ...profileData } = userData;

    await setDoc(userRef, {
      ...profileData,
      user_id: userRef.id,
      role: normalizeRole(userData.role),
      permissions: normalizePermissions(permissions),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return userRef.id;
  } catch (error) {
    console.error("Error adding user:", error);
    throw error;
  }
}

/**
 * Update an existing user
 * @param {string} userId - Document ID of the user
 * @param {Object} userData - Updated user data
 * @returns {Promise<void>}
 */
export async function updateUser(userId, userData) {
  try {
    const userRef = doc(db, "users", userId);
    const { permissions, ...profileData } = userData;

    await updateDoc(userRef, {
      ...profileData,
      user_id: userId,
      role: normalizeRole(userData.role),
      permissions: normalizePermissions(permissions),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

/**
 * Delete a user from the users collection
 * @param {string} userId - Document ID of the user
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  try {
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
