import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import { getDefaultPermissions } from "@/config/modules";

const PERMISSIONS_DOC_ID = "permissions";

const getPermissionsDocRef = (userId) =>
  doc(db, "users", userId, "permissions", PERMISSIONS_DOC_ID);

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

/**
 * Fetch all users from the users collection
 * @returns {Promise<Array>} - Array of user objects with IDs
 */
export async function fetchAllUsers() {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);

    const users = await Promise.all(
      querySnapshot.docs.map(async (userDoc) => {
        const baseData = userDoc.data();
        const permissionsSnap = await getDoc(getPermissionsDocRef(userDoc.id));
        const permissionsData = permissionsSnap.exists()
          ? permissionsSnap.data()
          : null;
        const rawPermissions =
          permissionsData?.permissions ||
          permissionsData ||
          baseData.permissions ||
          getDefaultPermissions();
        const permissions = normalizePermissions(rawPermissions);

        return {
          id: userDoc.id,
          ...baseData,
          user_id: baseData.user_id || userDoc.id,
          permissions,
        };
      })
    );

    return users;
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await setDoc(getPermissionsDocRef(userRef.id), {
      ...normalizePermissions(permissions),
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
      updated_at: new Date().toISOString(),
    });

    if (permissions) {
      await setDoc(getPermissionsDocRef(userId), {
        ...normalizePermissions(permissions),
        updated_at: new Date().toISOString(),
      });
    }
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
    const permissionsRef = getPermissionsDocRef(userId);
    await Promise.all([deleteDoc(userRef), deleteDoc(permissionsRef)]);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
