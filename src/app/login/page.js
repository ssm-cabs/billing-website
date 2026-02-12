"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import {
  isUserAuthorized,
  setupRecaptcha,
  sendOTP,
  verifyOTP,
  getCurrentUser,
} from "@/lib/phoneAuth";

export default function LoginPage() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState("phone"); // phone, otp, loading
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push("/dashboard");
    }
  }, [router]);

  // Initialize reCAPTCHA
  useEffect(() => {
    try {
      const verifier = setupRecaptcha("recaptcha-container");
      setRecaptchaVerifier(verifier);
    } catch (err) {
      console.error("Failed to setup reCAPTCHA:", err);
      setError("Failed to initialize security verification. Please refresh.");
    }

    return () => {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }
    };
  }, []);

  const formatPhoneNumber = (value) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");
    // Add country code if not present
    if (cleaned.length === 10) {
      return "+91" + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith("91")) {
      return "+" + cleaned;
    }
    return "+" + cleaned;
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Validate phone number format
      if (!/^\+\d{10,15}$/.test(formattedPhone)) {
        setError("Please enter a valid phone number");
        setLoading(false);
        return;
      }

      // Check if user is authorized
      const isAuthorized = await isUserAuthorized(formattedPhone);
      if (!isAuthorized) {
        setError(
          "This phone number is not authorized. Please contact your administrator."
        );
        setLoading(false);
        return;
      }

      // Send OTP
      const confirmation = await sendOTP(
        formattedPhone,
        recaptchaVerifier
      );
      setConfirmationResult(confirmation);
      setStep("otp");
    } catch (err) {
      console.error("Phone submit error:", err);
      if (err.code === "auth/invalid-phone-number") {
        setError("Invalid phone number format");
      } else if (err.code === "auth/too-many-requests") {
        setError(
          "Too many attempts. Please try again later."
        );
      } else {
        setError(err.message || "Failed to send OTP. Please try again.");
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

      await verifyOTP(confirmationResult, otp);
      // Redirect to dashboard on successful verification
      router.push("/dashboard");
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
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>SSM Cabs Billing</h1>
          <p>Driver Management System</p>
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
