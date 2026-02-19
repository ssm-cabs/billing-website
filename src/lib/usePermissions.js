import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PERMISSION_LEVELS, getDefaultPermissions } from "@/config/modules";
import { getHomeRouteForRole } from "./roleRouting";

/**
 * Hook to check permissions for a collection
 * @param {string} collection - Collection name
 * @returns {Object} - { canView, canEdit, loading, redirectToDashboard }
 */
export function usePermissions(collection) {
  const router = useRouter();
  const [canView, setCanView] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = () => {
      try {
        const userDataStr = localStorage.getItem("user_data");
        
        if (!userDataStr) {
          // No user data, redirect to login
          router.push("/login");
          return;
        }

        const userData = JSON.parse(userDataStr);
        const homeRoute = getHomeRouteForRole(userData?.role);
        const permissions = userData.permissions || {};
        const permission = permissions[collection] || PERMISSION_LEVELS.NONE;
        const isRoleHomeModule = homeRoute === `/${collection}`;

        if (permission === PERMISSION_LEVELS.NONE) {
          if (isRoleHomeModule) {
            setCanView(true);
            setCanEdit(true);
            return;
          }
          // No permission, redirect based on role.
          router.push(homeRoute);
          setCanView(false);
          setCanEdit(false);
        } else if (permission === PERMISSION_LEVELS.READ) {
          // Read-only permission
          setCanView(true);
          setCanEdit(false);
        } else if (permission === PERMISSION_LEVELS.EDIT) {
          // Full access
          setCanView(true);
          setCanEdit(true);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();

    const handleUserDataUpdate = () => {
      checkPermissions();
    };

    window.addEventListener("user_data_updated", handleUserDataUpdate);
    window.addEventListener("storage", handleUserDataUpdate);

    return () => {
      window.removeEventListener("user_data_updated", handleUserDataUpdate);
      window.removeEventListener("storage", handleUserDataUpdate);
    };
  }, [collection, router]);

  return { canView, canEdit, loading };
}

/**
 * Get user permissions from localStorage
 * @returns {Object} - Permissions object or default none permissions
 */
export function getUserPermissions() {
  if (typeof window === "undefined") return null;
  
  try {
    const userDataStr = localStorage.getItem("user_data");
    if (!userDataStr) return null;
    
    const userData = JSON.parse(userDataStr);
    return userData.permissions || getDefaultPermissions();
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return null;
  }
}

/**
 * Check if user can view a collection
 * @param {string} collection - Collection name
 * @returns {boolean}
 */
export function canViewCollection(collection) {
  const permissions = getUserPermissions();
  if (!permissions) return false;
  
  const permission = permissions[collection];
  return permission === PERMISSION_LEVELS.READ || permission === PERMISSION_LEVELS.EDIT;
}

/**
 * Check if user can edit a collection
 * @param {string} collection - Collection name
 * @returns {boolean}
 */
export function canEditCollection(collection) {
  const permissions = getUserPermissions();
  if (!permissions) return false;
  
  const permission = permissions[collection];
  return permission === PERMISSION_LEVELS.EDIT;
}
