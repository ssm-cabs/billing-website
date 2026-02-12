/**
 * Permission utility functions for role-based access control
 * Collections: invoices, companies, entries, vehicles, users
 * Permission levels: none, read, edit
 */

/**
 * Check if user has read permission for a collection
 * @param {Object} userData - User data from Firestore (should include permissions object)
 * @param {string} collection - Collection name (invoices, companies, entries, vehicles, users)
 * @returns {boolean} - True if user can read
 */
export function canRead(userData, collection) {
  if (!userData || !userData.permissions) return false;
  const permission = userData.permissions[collection];
  return permission === "read" || permission === "edit";
}

/**
 * Check if user has edit permission for a collection
 * @param {Object} userData - User data from Firestore (should include permissions object)
 * @param {string} collection - Collection name (invoices, companies, entries, vehicles, users)
 * @returns {boolean} - True if user can edit
 */
export function canEdit(userData, collection) {
  if (!userData || !userData.permissions) return false;
  const permission = userData.permissions[collection];
  return permission === "edit";
}

/**
 * Check if user has any permission for a collection
 * @param {Object} userData - User data from Firestore
 * @param {string} collection - Collection name
 * @returns {boolean} - True if user has any permission (read or edit)
 */
export function hasAccess(userData, collection) {
  return canRead(userData, collection);
}

/**
 * Get permission level for a collection
 * @param {Object} userData - User data from Firestore
 * @param {string} collection - Collection name
 * @returns {string} - Permission level (none, read, edit)
 */
export function getPermissionLevel(userData, collection) {
  if (!userData || !userData.permissions) return "none";
  return userData.permissions[collection] || "none";
}

/**
 * Check if user is an admin (has edit access to users collection)
 * @param {Object} userData - User data from Firestore
 * @returns {boolean} - True if user can manage users
 */
export function isAdmin(userData) {
  return canEdit(userData, "users");
}

/**
 * Get all collections user has access to
 * @param {Object} userData - User data from Firestore
 * @returns {Array<{collection: string, permission: string}>} - Array of accessible collections
 */
export function getAccessibleCollections(userData) {
  if (!userData || !userData.permissions) return [];
  
  const collections = ["invoices", "companies", "entries", "vehicles", "users"];
  return collections
    .filter((collection) => hasAccess(userData, collection))
    .map((collection) => ({
      collection,
      permission: userData.permissions[collection],
    }));
}

/**
 * Create default permissions object (all none)
 * @returns {Object} - Permissions object with all collections set to none
 */
export function createDefaultPermissions() {
  return {
    invoices: "none",
    companies: "none",
    entries: "none",
    vehicles: "none",
    users: "none",
  };
}

/**
 * Validate permissions object structure
 * @param {Object} permissions - Permissions object to validate
 * @returns {boolean} - True if valid
 */
export function isValidPermissions(permissions) {
  if (!permissions || typeof permissions !== "object") return false;
  
  const validCollections = ["invoices", "companies", "entries", "vehicles", "users"];
  const validLevels = ["none", "read", "edit"];
  
  for (const collection of validCollections) {
    if (!permissions.hasOwnProperty(collection)) return false;
    if (!validLevels.includes(permissions[collection])) return false;
  }
  
  return true;
}
