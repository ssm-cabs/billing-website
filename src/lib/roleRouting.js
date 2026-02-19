const ALLOWED_ROLES = new Set(["admin", "user", "driver"]);

export function normalizeRole(role) {
  if (typeof role !== "string") return "user";
  const normalized = role.toLowerCase().trim();
  return ALLOWED_ROLES.has(normalized) ? normalized : "user";
}

export function getHomeRouteForRole(role) {
  return normalizeRole(role) === "driver" ? "/driver/dashboard" : "/dashboard";
}

