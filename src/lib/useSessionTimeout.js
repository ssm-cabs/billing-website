import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOutUser } from "./phoneAuth";

const SESSION_EXPIRY_KEY = "session_expiry_time";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook to automatically logout after 24 hours
 * Sets token expiry time when user logs in
 * Checks on mount if token has expired
 */
export function useSessionTimeout() {
  const router = useRouter();

  useEffect(() => {
    // Check if session token has expired
    const checkTokenExpiry = async () => {
      const expiryTime = localStorage.getItem(SESSION_EXPIRY_KEY);

      if (expiryTime) {
        const expiry = parseInt(expiryTime, 10);
        const currentTime = Date.now();

        if (currentTime > expiry) {
          // Token expired
          console.log("Session token expired after 24 hours");
          await signOutUser();
          localStorage.removeItem(SESSION_EXPIRY_KEY);
          router.push("/login");
          return;
        }

        // Calculate remaining time
        const remaining = expiry - currentTime;
        const hoursRemaining = Math.floor(remaining / (60 * 60 * 1000));

        if (hoursRemaining < 1) {
          const minutesRemaining = Math.floor(remaining / (60 * 1000));
          console.warn(`Session expiring in ${minutesRemaining} minutes`);
        }
      }
    };

    checkTokenExpiry();
  }, [router]);
}

/**
 * Set token expiry time (24 hours from now)
 * Call this after successful login
 */
export function setTokenExpiry() {
  const expiryTime = Date.now() + SESSION_DURATION_MS;
  localStorage.setItem(SESSION_EXPIRY_KEY, expiryTime.toString());
  console.log("Token expiry set to:", new Date(expiryTime));
}

/**
 * Clear token expiry (call on logout)
 */
export function clearTokenExpiry() {
  localStorage.removeItem(SESSION_EXPIRY_KEY);
}

/**
 * Get remaining time in milliseconds
 */
export function getSessionTimeRemaining() {
  const expiryTime = localStorage.getItem(SESSION_EXPIRY_KEY);
  if (!expiryTime) return null;

  const expiry = parseInt(expiryTime, 10);
  const currentTime = Date.now();
  const remaining = Math.max(expiry - currentTime, 0);

  return remaining;
}

/**
 * Get formatted remaining time (e.g., "23h 45m")
 */
export function getSessionTimeRemainingFormatted() {
  const remaining = getSessionTimeRemaining();
  if (remaining === null) return null;

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
