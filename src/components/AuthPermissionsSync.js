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

    window.addEventListener("permissions_changed", handlePermissionsChanged);

    return () => {
      window.removeEventListener("permissions_changed", handlePermissionsChanged);
      cleanup();
    };
  }, [router]);

  return null;
}

export default AuthPermissionsSync;
