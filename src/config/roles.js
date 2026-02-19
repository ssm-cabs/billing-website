export const ROLE_DEFINITIONS = {
  admin: {
    label: "Admin",
    homeRoute: "/dashboard",
    canAccessBackofficeDashboard: true,
  },
  user: {
    label: "User",
    homeRoute: "/dashboard",
    canAccessBackofficeDashboard: true,
  },
  driver: {
    label: "Driver",
    homeRoute: "/driver/dashboard",
    canAccessBackofficeDashboard: false,
  },
  company: {
    label: "Company",
    homeRoute: "/companies",
    canAccessBackofficeDashboard: false,
  },
};

export const DEFAULT_ROLE = "user";

export function getRoleKeys() {
  return Object.keys(ROLE_DEFINITIONS);
}

export function normalizeRole(role) {
  if (typeof role !== "string") return DEFAULT_ROLE;
  const normalized = role.toLowerCase().trim();
  return ROLE_DEFINITIONS[normalized] ? normalized : DEFAULT_ROLE;
}

export function getRoleDefinition(role) {
  const key = normalizeRole(role);
  return ROLE_DEFINITIONS[key];
}

export function getHomeRouteForRole(role) {
  return getRoleDefinition(role).homeRoute;
}

export function canAccessBackofficeDashboard(role) {
  return Boolean(getRoleDefinition(role).canAccessBackofficeDashboard);
}

export function isRole(role, expectedRole) {
  return normalizeRole(role) === normalizeRole(expectedRole);
}
