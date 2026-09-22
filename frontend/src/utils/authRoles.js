// src/utils/authRoles.js

/**
 * Checks if the user is an Admin or Super Admin based on system role.
 * Valid system roles: "super admin", "super_admin", "admin", "user"
 * @param {Object} user
 * @returns {boolean}
 */
export function isAdmin(user) {
  if (!user) return false;
  const role = String(user.role || user.user_role || "").toString().trim().toLowerCase();
  return role === "admin" || role === "super admin" || role === "super_admin" || role.includes("admin");
}

export function isSuperAdmin(user) {
  if (!user) return false;
  const role = String(user.role || user.user_role || "").toString().trim().toLowerCase();
  return role === "super admin" || role === "super_admin";
}

export function isExecutive(user) {
  return isAdmin(user);
}

/** Admin Settings / User Management module access is strictly for Super Admin */
export function hasAdminAccess(user) {
  return isSuperAdmin(user);
}

export function getUserDesignation(user) {
  if (!user) return "User";
  return user.designation || user.role || "Sales Lead Manager";
}
