import { PERMISSION_LEVELS, getDefaultPermissions, validatePermissions as validatePerms } from "@/config/modules";

/**
 * Permission utility functions for role-based access control
 * Uses centralized modules configuration
 */

/**
 * Check if user has read permission for a collection
 * @param {Object} userData - User data from Firestore (should include permissions object)
 * @param {string} collection - Collection name
 * @returns {boolean} - True if user can read
 */
export function canRead(userData, collection) {
  if (!userData || !userData.permissions) return false;
  const permission = userData.permissions[collection];
  return permission === PERMISSION_LEVELS.READ || permission === PERMISSION_LEVELS.EDIT;
}

/**
 * Check if user has edit permission for a collection
 * @param {Object} userData - User data from Firestore (should include permissions object)
 * @param {string} collection - Collection name
 * @returns {boolean} - True if user can edit
 */
export function canEdit(userData, collection) {
  if (!userData || !userData.permissions) return false;
  const permission = userData.permissions[collection];
  return permission === PERMISSION_LEVELS.EDIT;
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
  if (!userData || !userData.permissions) return PERMISSION_LEVELS.NONE;
  return userData.permissions[collection] || PERMISSION_LEVELS.NONE;
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
  
  return Object.entries(userData.permissions)
    .filter(([_, permission]) => permission === PERMISSION_LEVELS.READ || permission === PERMISSION_LEVELS.EDIT)
    .map(([collection, permission]) => ({
      collection,
      permission,
    }));
}

/**
 * Create default permissions object (all none)
 * @returns {Object} - Permissions object with all collections set to none
 */
export function createDefaultPermissions() {
  return getDefaultPermissions();
}

/**
 * Validate permissions object structure
 * @param {Object} permissions - Permissions object to validate
 * @returns {boolean} - True if valid
 */
export function isValidPermissions(permissions) {
  return validatePerms(permissions);
}
