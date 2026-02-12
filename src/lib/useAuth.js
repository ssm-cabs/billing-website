import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "./phoneAuth";

/**
 * Hook to protect pages - redirects to login if not authenticated
 * @param {Object} options - Configuration options
 * @param {boolean} options.requireAdmin - Require admin role (requires role in userData)
 * @param {string} options.redirectTo - Where to redirect if not authenticated (default: /login)
 * @returns {Object} - { user, loading, isAuthenticated, userData }
 */
export function useAuth(options = {}) {
  const { requireAdmin = false, redirectTo = "/login" } = options;
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const currentUser = getCurrentUser();

      if (!currentUser) {
        setIsAuthenticated(false);
        setUser(null);
        setUserData(null);
        setLoading(false);
        router.push(redirectTo);
        return;
      }

      setUser(currentUser);
      setIsAuthenticated(true);

      // Optional: Fetch user data from Firestore
      if (currentUser.phoneNumber) {
        try {
          const response = await fetch(`/api/auth/user-data?phone=${encodeURIComponent(currentUser.phoneNumber)}`);
          if (response.ok) {
            const data = await response.json();
            setUserData(data);

            // Check admin requirement
            if (requireAdmin && data?.role !== "admin") {
              setIsAuthenticated(false);
              router.push(redirectTo);
              return;
            }
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error);
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [router, redirectTo, requireAdmin]);

  useEffect(() => {
    const timer = setTimeout(checkAuth, 100); // Small delay to ensure auth is initialized
    return () => clearTimeout(timer);
  }, [checkAuth]);

  return { user, userData, loading, isAuthenticated };
}

/**
 * HOC to wrap pages and require authentication
 * @param {React.ComponentType} Component - Component to wrap
 * @param {Object} options - Configuration options
 * @returns {React.ComponentType} - Wrapped component
 */
export function withAuth(Component, options = {}) {
  return function ProtectedComponent(props) {
    const { user, userData, loading, isAuthenticated } = useAuth(options);

    if (loading) {
      return (
        <div style={{
          display: "flex",
          align-items: "center",
          justify-content: "center",
          min-height: "100vh",
        }}>
          <p>Loading...</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      return null; // Router handles redirect
    }

    return <Component {...props} user={user} userData={userData} />;
  };
}
