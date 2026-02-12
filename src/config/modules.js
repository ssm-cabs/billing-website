/**
 * Application modules configuration
 * Add new modules here to automatically include them in permissions and navigation
 */

export const MODULES = [
  {
    id: "invoices",
    name: "Invoices",
    description: "View and generate invoices",
    path: "/invoices",
    icon: "📄",
  },
  {
    id: "companies",
    name: "Companies",
    description: "Manage corporate clients",
    path: "/companies",
    icon: "🏢",
  },
  {
    id: "entries",
    name: "Entries",
    description: "Manage ride entries",
    path: "/entries",
    icon: "📝",
  },
  {
    id: "vehicles",
    name: "Vehicles",
    description: "Manage fleet vehicles",
    path: "/vehicles",
    icon: "🚗",
  },
  {
    id: "users",
    name: "Users",
    description: "Manage system users",
    path: "/users",
    icon: "👥",
  },
];

/**
 * Permission levels configuration
 */
export const PERMISSION_LEVELS = {
  NONE: "none",
  READ: "read",
  EDIT: "edit",
};

/**
 * Get all module IDs
 * @returns {Array<string>}
 */
export function getModuleIds() {
  return MODULES.map((module) => module.id);
}

/**
 * Get module by ID
 * @param {string} id - Module ID
 * @returns {Object|null}
 */
export function getModuleById(id) {
  return MODULES.find((module) => module.id === id) || null;
}

/**
 * Get default permissions object (all modules set to none)
 * @returns {Object}
 */
export function getDefaultPermissions() {
  const permissions = {};
  MODULES.forEach((module) => {
    permissions[module.id] = PERMISSION_LEVELS.NONE;
  });
  return permissions;
}

/**
 * Validate permissions object
 * @param {Object} permissions - Permissions object to validate
 * @returns {boolean}
 */
export function validatePermissions(permissions) {
  if (!permissions || typeof permissions !== "object") return false;

  const moduleIds = getModuleIds();
  const validLevels = Object.values(PERMISSION_LEVELS);

  for (const moduleId of moduleIds) {
    if (!permissions.hasOwnProperty(moduleId)) return false;
    if (!validLevels.includes(permissions[moduleId])) return false;
  }

  return true;
}

/**
 * Get modules user has access to
 * @param {Object} permissions - User permissions
 * @returns {Array<Object>} - Array of accessible modules
 */
export function getAccessibleModules(permissions) {
  if (!permissions) return [];

  return MODULES.filter((module) => {
    const permission = permissions[module.id];
    return permission === PERMISSION_LEVELS.READ || permission === PERMISSION_LEVELS.EDIT;
  });
}
