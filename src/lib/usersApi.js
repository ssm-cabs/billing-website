import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Fetch all users from the users collection
 * @returns {Promise<Array>} - Array of user objects with IDs
 */
export async function fetchAllUsers() {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });
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
    const docRef = await addDoc(usersRef, {
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return docRef.id;
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
    await updateDoc(userRef, {
      ...userData,
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
