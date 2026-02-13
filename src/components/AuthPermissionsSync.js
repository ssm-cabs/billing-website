"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startAuthPermissionsSync } from "@/lib/phoneAuth";

export function AuthPermissionsSync() {
  const router = useRouter();

  useEffect(() => {
    const cleanup = startAuthPermissionsSync();
    const handlePermissionsChanged = () => {
      router.refresh();
    };
    const handleSessionSignedOut = () => {
      router.push("/login");
    };

    window.addEventListener("permissions_changed", handlePermissionsChanged);
    window.addEventListener("session_signed_out", handleSessionSignedOut);

    return () => {
      window.removeEventListener("permissions_changed", handlePermissionsChanged);
      window.removeEventListener("session_signed_out", handleSessionSignedOut);
      cleanup();
    };
  }, [router]);

  return null;
}

export default AuthPermissionsSync;
