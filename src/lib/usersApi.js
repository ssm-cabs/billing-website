import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { getDefaultPermissions } from "@/config/modules";
import { normalizePhoneNumber } from "./phone";
import { isRole, normalizeRole } from "./roleRouting";

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
    const userSnapshot = await getDoc(userRef);
    const role = userSnapshot.exists()
      ? normalizeRole(userSnapshot.data()?.role)
      : "";

    await deleteDoc(userRef);

    if (isRole(role, "driver")) {
      const vehiclesRef = collection(db, "vehicles");
      const vehiclesQuery = query(vehiclesRef, where("driver_user_id", "==", userId));
      const vehiclesSnapshot = await getDocs(vehiclesQuery);

      await Promise.all(
        vehiclesSnapshot.docs.map((vehicleDoc) =>
          updateDoc(doc(db, "vehicles", vehicleDoc.id), {
            driver_dashboard_access: false,
            driver_user_id: "",
          })
        )
      );
    }
    if (isRole(role, "company")) {
      const companiesRef = collection(db, "companies");
      const companiesQuery = query(companiesRef, where("company_user_id", "==", userId));
      const companiesSnapshot = await getDocs(companiesQuery);

      await Promise.all(
        companiesSnapshot.docs.map((companyDoc) =>
          updateDoc(doc(db, "companies", companyDoc.id), {
            company_dashboard_access: false,
            company_user_id: "",
          })
        )
      );
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

/**
 * Create or update a driver user by phone number
 * @param {Object} payload
 * @param {string} payload.driver_name
 * @param {string} payload.driver_phone
 * @param {string} payload.vehicle_id
 * @returns {Promise<string>} - User document ID
 */
export async function upsertDriverUser(payload) {
  const name = String(payload?.driver_name || "").trim();
  const phone = normalizePhoneNumber(payload?.driver_phone || "");
  const vehicleId = String(payload?.vehicle_id || "").trim();

  if (!name) {
    throw new Error("Driver name is required to grant dashboard access");
  }
  if (!phone) {
    throw new Error("Driver phone is required to grant dashboard access");
  }
  if (!vehicleId) {
    throw new Error("Vehicle ID is required to grant dashboard access");
  }

  const usersRef = collection(db, "users");
  const existingQuery = query(usersRef, where("phone", "==", phone));
  const existingSnapshot = await getDocs(existingQuery);
  const now = new Date().toISOString();

  if (!existingSnapshot.empty) {
    const existingUser = existingSnapshot.docs[0];
    await updateDoc(doc(db, "users", existingUser.id), {
      name,
      phone,
      role: normalizeRole("driver"),
      active: true,
      vehicle_ids: arrayUnion(vehicleId),
      updated_at: now,
    });
    return existingUser.id;
  }

  const newUserRef = doc(usersRef);
  await setDoc(newUserRef, {
    user_id: newUserRef.id,
    name,
    phone,
    role: normalizeRole("driver"),
    active: true,
    vehicle_ids: [vehicleId],
    created_at: now,
    updated_at: now,
  });
  return newUserRef.id;
}

/**
 * Create or update a company user by phone number
 * @param {Object} payload
 * @param {string} payload.contact_name
 * @param {string} payload.contact_phone
 * @param {string} payload.company_id
 * @returns {Promise<string>} - User document ID
 */
export async function upsertCompanyUser(payload) {
  const name = String(payload?.contact_name || "").trim();
  const phone = normalizePhoneNumber(payload?.contact_phone || "");
  const companyId = String(payload?.company_id || "").trim();

  if (!name) {
    throw new Error("Contact name is required to grant dashboard access");
  }
  if (!phone) {
    throw new Error("Contact phone is required to grant dashboard access");
  }
  if (!companyId) {
    throw new Error("Company ID is required to grant dashboard access");
  }

  const usersRef = collection(db, "users");
  const existingQuery = query(usersRef, where("phone", "==", phone));
  const existingSnapshot = await getDocs(existingQuery);
  const now = new Date().toISOString();

  if (!existingSnapshot.empty) {
    const existingUser = existingSnapshot.docs[0];
    await updateDoc(doc(db, "users", existingUser.id), {
      name,
      phone,
      role: normalizeRole("company"),
      active: true,
      company_ids: arrayUnion(companyId),
      updated_at: now,
    });
    return existingUser.id;
  }

  const newUserRef = doc(usersRef);
  await setDoc(newUserRef, {
    user_id: newUserRef.id,
    name,
    phone,
    role: normalizeRole("company"),
    active: true,
    company_ids: [companyId],
    created_at: now,
    updated_at: now,
  });
  return newUserRef.id;
}
