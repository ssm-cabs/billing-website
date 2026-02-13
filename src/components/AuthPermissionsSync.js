"use client";

import { useEffect } from "react";
import { startAuthPermissionsSync } from "@/lib/phoneAuth";

export function AuthPermissionsSync() {
  useEffect(() => {
    const cleanup = startAuthPermissionsSync();
    return () => {
      cleanup();
    };
  }, []);

  return null;
}

export default AuthPermissionsSync;
