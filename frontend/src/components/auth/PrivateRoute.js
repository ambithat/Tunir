// src/components/auth/PrivateRoute.js
import React from "react";
import { useAuth } from "../../context/AuthContext";

// Decodes JWT without external dependencies
export function decodeJwtPayload(token) {
  try {
    const payload = token?.split(".")?.[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(window.atob(padded));
  } catch {
    return {};
  }
}

const PrivateRoute = ({ children, allowedRoles, fallback = null }) => {
  const { token, user } = useAuth();

  // 1. Not Authenticated
  if (!token) {
    return fallback;
  }

  // 2. Role Check (Optional)
  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const jwtPayload = decodeJwtPayload(token);
    const userRole = (user?.role || user?.permission || jwtPayload?.role || "user").toLowerCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

    if (!normalizedAllowed.includes(userRole)) {
      return fallback;
    }
  }

  return children;
};

export default PrivateRoute;
