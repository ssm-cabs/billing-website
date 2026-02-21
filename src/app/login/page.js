"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import styles from "./login.module.css";
import {
  getAuthorizedUser,
  setupRecaptcha,
  sendOTP,
  verifyOTP,
  signOutUser,
  waitForAuthInit,
  getUserData,
} from "@/lib/phoneAuth";
import { setTokenExpiry } from "@/lib/useSessionTimeout";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";
import { getHomeRouteForRole } from "@/lib/roleRouting";
import { functions } from "@/lib/firebase";

async function syncCustomClaims(firebaseUser) {
  if (!firebaseUser) {
    throw new Error("User is not authenticated.");
  }
  if (!functions) {
    throw new Error("Firebase Functions is not initialized.");
  }
  const syncRoleClaim = httpsCallable(functions, "syncRoleClaim");
  const callableResult = await syncRoleClaim();
  console.log("syncRoleClaim callable response:", callableResult?.data || {});

  // Force refresh so Firestore rules immediately receive the new claim.
  await firebaseUser.getIdToken(true);
  const tokenResult = await firebaseUser.getIdTokenResult();
  console.log("Refreshed auth token role claim:", tokenResult?.claims?.role || "(missing)");
}

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState("phone"); // phone, otp, loading
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [authorizedUserData, setAuthorizedUserData] = useState(null);
  const recaptchaVerifierRef = useRef(null);

  // Check if user is already logged in
  useEffect(() => {
    const checkExistingAuth = async () => {
      const user = await waitForAuthInit();
      if (!user?.phoneNumber) return;

      try {
        const userData = await getUserData(user.phoneNumber);
        if (userData?.active === false) {
          await signOutUser();
          return;
        }
        await syncCustomClaims(user);
        router.push(getHomeRouteForRole(userData?.role));
      } catch (error) {
        console.error("Existing auth check failed:", error);
        await signOutUser();
      }
    };
    checkExistingAuth();
  }, [router]);

  // Initialize reCAPTCHA - run once on mount
  useEffect(() => {
    const initRecaptcha = () => {
      // Check if container exists
      const container = document.getElementById("recaptcha-container");
      if (!container) {
        setTimeout(initRecaptcha, 100);
        return;
      }

      try {
        // Clear any existing verifier
        if (recaptchaVerifierRef.current) {
          try {
            recaptchaVerifierRef.current.clear();
          } catch (e) {
            console.warn("Error clearing existing verifier:", e);
          }
        }

        const verifier = setupRecaptcha("recaptcha-container");
        recaptchaVerifierRef.current = verifier;
      } catch (err) {
        console.error("Failed to setup reCAPTCHA:", err);
        setError(
          "Security verification failed to load. Please refresh the page. Error: " +
            err.message
        );
      }
    };

    initRecaptcha();

    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.warn("Error clearing verifier on unmount:", e);
        }
      }
    };
  }, []);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Check if verifier is ready
      if (!recaptchaVerifierRef.current) {
        setError("Security verification not ready. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const formattedPhone = normalizePhoneNumber(phoneNumber);

      // Validate phone number format
      if (!isValidPhoneNumber(formattedPhone)) {
        setError("Please enter a valid phone number");
        setLoading(false);
        return;
      }
      setPhoneNumber(formattedPhone);

      // Check if user is authorized and keep profile for post-OTP session state.
      const authorizedUser = await getAuthorizedUser(formattedPhone);
      if (!authorizedUser) {
        setError(
          "This phone number is not authorized. Please contact your administrator."
        );
        setLoading(false);
        return;
      }
      if (authorizedUser.active === false) {
        setError("Your account is disabled. Please contact your administrator.");
        setLoading(false);
        return;
      }
      setAuthorizedUserData(authorizedUser);

      // Send OTP
      const confirmation = await sendOTP(
        formattedPhone,
        recaptchaVerifierRef.current
      );
      setConfirmationResult(confirmation);
      setStep("otp");
    } catch (err) {
      console.error("Phone submit error:", err);
      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (err.code === "auth/invalid-api-key") {
        setError("Firebase configuration error. Please contact support.");
      } else if (err.code === "auth/invalid-app-credential") {
        setError(
          "Security verification failed. Please refresh the page and try again."
        );
      } else {
        setError(err.message || "Failed to send OTP. Please try again.");
      }
      // Reset reCAPTCHA on error
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (e) {
          console.warn("Error resetting verifier:", e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!otp || otp.length !== 6) {
        setError("Please enter a valid 6-digit OTP");
        setLoading(false);
        return;
      }

      const result = await verifyOTP(confirmationResult, otp);
      await syncCustomClaims(result.user);
      
      // Set token expiry for 24-hour timeout
      setTokenExpiry();
      
      // Fetch and save user data with permissions to localStorage
      const phoneNumber = result.user.phoneNumber;
      const userData = await getUserData(phoneNumber);
      if (!userData) {
        setError("This phone number is not authorized.");
        await signOutUser();
        setLoading(false);
        return;
      }
      if (userData.active === false) {
        setError("Your account is disabled. Please contact your administrator.");
        await signOutUser();
        setLoading(false);
        return;
      }
      
      if (userData) {
        localStorage.setItem("user_data", JSON.stringify(userData));
        window.dispatchEvent(new Event("user_data_updated"));
        console.log("User data saved to localStorage");
      }
      
      // Redirect based on role on successful verification
      router.push(getHomeRouteForRole(userData?.role));
    } catch (err) {
      console.error("OTP verify error:", err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid OTP. Please try again.");
      } else if (err.code === "auth/code-expired") {
        setError("OTP has expired. Please request a new one.");
        setStep("phone");
        setPhoneNumber("");
        setOtp("");
      } else {
        setError(err.message || "Failed to verify OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    setStep("phone");
    setOtp("");
    setError("");
    setPhoneNumber("");
    setConfirmationResult(null);
    setAuthorizedUserData(null);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>SSM Cabs Billing</h1>
        </div>

        <div id="recaptcha-container" className={styles.recaptchaContainer} />

        {step === "phone" && (
          <form onSubmit={handlePhoneSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="Enter your phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onBlur={(e) => setPhoneNumber(normalizePhoneNumber(e.target.value))}
                disabled={loading}
                required
              />
              <span className={styles.hint}>
                Enter 10 digit Indian number (with or without +91)
              </span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading || !phoneNumber}
              className={styles.button}
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleOTPSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="otp">Enter OTP</label>
              <input
                id="otp"
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={loading}
                maxLength="6"
                required
              />
              <span className={styles.hint}>
                We sent a 6-digit code to +{phoneNumber.replace(/\D/g, "")}
              </span>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className={styles.button}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={handleBackClick}
              disabled={loading}
              className={styles.backButton}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
