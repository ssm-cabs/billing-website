import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * Verify if a phone number exists in the authorized users database
 * @param {string} phoneNumber - Phone number with country code (e.g., +1234567890)
 * @returns {Promise<boolean>} - True if user is authorized
 */
export async function isUserAuthorized(phoneNumber) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", phoneNumber));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking user authorization:", error);
    throw error;
  }
}

/**
 * Get user data from database
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export async function getUserData(phoneNumber) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", phoneNumber));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    return querySnapshot.docs[0].data();
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

/**
 * Setup reCAPTCHA verifier for phone sign-in
 * @param {string} containerId - Element ID for reCAPTCHA container
 * @returns {RecaptchaVerifier} - Verifier instance
 */
export function setupRecaptcha(containerId) {
  if (!auth) {
    throw new Error("Firebase Auth not initialized");
  }

  try {
    const verifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: (token) => {
        console.debug("reCAPTCHA verification succeeded");
      },
      "expired-callback": () => {
        console.warn("reCAPTCHA expired");
      },
      "error-callback": (error) => {
        console.error("reCAPTCHA error:", error);
      },
    });
    return verifier;
  } catch (error) {
    console.error("Failed to create reCAPTCHA verifier:", error);
    throw new Error(
      `reCAPTCHA setup failed: ${error.message}. Ensure reCAPTCHA is configured in Firebase Console.`
    );
  }
}

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number with country code
 * @param {RecaptchaVerifier} verifier - reCAPTCHA verifier instance
 * @returns {Promise<Object>} - Confirmation result
 */
export async function sendOTP(phoneNumber, verifier) {
  try {
    if (!auth) {
      throw new Error("Firebase Auth not initialized");
    }

    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier
    );
    return confirmationResult;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
}

/**
 * Verify OTP code
 * @param {Object} confirmationResult - Result from sendOTP
 * @param {string} code - OTP code entered by user
 * @returns {Promise<Object>} - Authentication result
 */
export async function verifyOTP(confirmationResult, code) {
  try {
    const result = await confirmationResult.confirm(code);
    return result;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
}

/**
 * Get current authenticated user
 * @returns {Object|null} - Current user or null
 */
export function getCurrentUser() {
  return auth?.currentUser || null;
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOutUser() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}
