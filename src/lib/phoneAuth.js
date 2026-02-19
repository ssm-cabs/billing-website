import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { getDefaultPermissions } from "@/config/modules";

// Track auth state initialization
let authStateInitialized = false;
let authStatePromise = null;
let userDocUnsubscribe = null;
let authUnsubscribe = null;
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
 * Wait for Firebase auth state to initialize
 * @returns {Promise<User|null>}
 */
export function waitForAuthInit() {
  if (authStateInitialized) {
    return Promise.resolve(auth?.currentUser || null);
  }

  if (!authStatePromise) {
    authStatePromise = new Promise((resolve) => {
      if (!auth) {
        authStateInitialized = true;
        resolve(null);
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        authStateInitialized = true;
        unsubscribe();
        resolve(user);
      });
    });
  }

  return authStatePromise;
}

/**
 * Verify if a phone number exists in the authorized users database
 * @param {string} phoneNumber - Phone number with country code (e.g., +1234567890)
 * @returns {Promise<boolean>} - True if user is authorized
 */
export async function isUserAuthorized(phoneNumber) {
  const userData = await getAuthorizedUser(phoneNumber);
  return Boolean(userData);
}

/**
 * Get authorized user data in a single query
 * @param {string} phoneNumber - Phone number with country code
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export async function getAuthorizedUser(phoneNumber) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("phone", "==", phoneNumber));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    return {
      ...userData,
      user_id: userData.user_id || userDoc.id,
    };
  } catch (error) {
    console.error("Error fetching authorized user:", error);
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
    const userData = await getAuthorizedUser(phoneNumber);
    if (!userData) return null;

    return {
      ...userData,
      permissions: normalizePermissions(userData.permissions),
      role: normalizeRole(userData.role),
    };
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

function updateLocalUserData(updater) {
  if (typeof window === "undefined") return;

  try {
    const existing = localStorage.getItem("user_data");
    if (!existing) return;

    const parsed = JSON.parse(existing);
    const updated = updater(parsed);
    if (!updated) return;

    const permissionsChanged =
      JSON.stringify(parsed.permissions || {}) !==
      JSON.stringify(updated.permissions || {});

    localStorage.setItem("user_data", JSON.stringify(updated));
    window.dispatchEvent(new Event("user_data_updated"));
    if (permissionsChanged) {
      window.dispatchEvent(new Event("permissions_changed"));
    }
  } catch (error) {
    console.error("Error updating local user_data:", error);
  }
}

function stopUserDocListener() {
  if (userDocUnsubscribe) {
    userDocUnsubscribe();
    userDocUnsubscribe = null;
  }
}

function startUserDocListener(userId) {
  if (!userId) return;

  stopUserDocListener();

  const userRef = doc(db, "users", userId);
  userDocUnsubscribe = onSnapshot(
    userRef,
    async (snapshot) => {
      if (!snapshot.exists()) return;

      const userData = {
        ...snapshot.data(),
        user_id: snapshot.data().user_id || userId,
        permissions: normalizePermissions(snapshot.data().permissions),
        role: normalizeRole(snapshot.data().role),
      };
      const isActive = userData.active !== false;

      updateLocalUserData((existing) => ({
        ...existing,
        ...userData,
        user_id: userData.user_id || existing.user_id || userId,
      }));

      if (!isActive) {
        await signOutUser();
      }
    },
    (error) => {
      console.error("User document listener error:", error);
    }
  );
}

/**
 * Starts a global listener that tracks auth state and watches
 * /users/<user_id> for the signed-in user.
 * @returns {Function} - Cleanup function
 */
export function startAuthPermissionsSync() {
  if (!auth || typeof window === "undefined") {
    return () => {};
  }

  if (authUnsubscribe) {
    return () => {
      stopUserDocListener();
      authUnsubscribe?.();
      authUnsubscribe = null;
    };
  }

  authUnsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) {
      stopUserDocListener();
      return;
    }

    try {
      const existing = localStorage.getItem("user_data");
      let userId = null;

      if (existing) {
        const parsed = JSON.parse(existing);
        const sameUser = parsed?.phone && user.phoneNumber
          ? parsed.phone === user.phoneNumber
          : false;
        userId = sameUser ? parsed?.user_id || null : null;
      }

      if (!userId && user.phoneNumber) {
        const latestUserData = await getUserData(user.phoneNumber);
        if (latestUserData) {
          localStorage.setItem("user_data", JSON.stringify(latestUserData));
          window.dispatchEvent(new Event("user_data_updated"));
          userId = latestUserData.user_id;
        }
      }

      if (userId) {
        startUserDocListener(userId);
      }
    } catch (error) {
      console.error("Error starting permission sync:", error);
    }
  });

  return () => {
    stopUserDocListener();
    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }
  };
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
    stopUserDocListener();
    // Clear token expiry and user data
    if (typeof window !== "undefined") {
      localStorage.removeItem("session_expiry_time");
      localStorage.removeItem("user_data");
    }
    await auth.signOut();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("session_signed_out"));
    }
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}
