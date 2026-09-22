// src/api/authApi.js
import axios from "axios";
import tokenStore from "./tokenStore";
import { stopNotificationSse } from "./notificationSse";

import {
  clearAuthStorage,
  ensureFreshAccessToken,
  getAccessTokenExpiresAt,
  isAccessTokenExpiredSoon,
  refreshAccessToken,
  refreshOnce,
} from "./authRefresh";

import { invalidateCache } from "./axiosInstance";
import { clearAllDropdownCaches } from "./statusTypeApi";
import { clearLeaderCache } from "./leaderApi";
const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

const authAxios = axios.create({
  baseURL: backendUrl.replace(/\/$/, ""),
  timeout: 15000,
  withCredentials: true,
});
export {
  ensureFreshAccessToken,
  isAccessTokenExpiredSoon,
  refreshAccessToken,
  refreshOnce,
};

// 3. Clear storage and redirect on session failure / user logout
export function forceLogout() {
  tokenStore.markLoggedOut();
  stopNotificationSse();
  clearAuthStorage();
  invalidateCache();
  clearAllDropdownCaches();
  clearLeaderCache();
  try {
    const bannerMsg = sessionStorage.getItem("logout_banner_message");
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("is_logged_out", "true");
    if (bannerMsg) {
      sessionStorage.setItem("logout_banner_message", bannerMsg);
    }
  } catch (_) {}
}

// 3b. Logout API Endpoint Call: /api/v1/auth/logout & /api/v1/notifications/logout
export async function logoutUser() {
  let logoutMessage = "You have been logged out successfully.";
  tokenStore.markLoggedOut();
  try {
    const token = tokenStore.getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Execute notification logout and auth logout in parallel
    const [notifRes, authRes] = await Promise.allSettled([
    authAxios.post(
  "/api/v1/notifications/logout",
        {},
        {
          headers,
          withCredentials: true,
          timeout: 10000,
        }
      ),
authAxios.post(
  "/api/v1/auth/logout",
        {},
        {
          headers,
          withCredentials: true,
          timeout: 10000,
        }
      )
    ]);

    if (authRes.status === "fulfilled" && (authRes.value?.data?.message || authRes.value?.data?.detail)) {
      logoutMessage = authRes.value.data.message || authRes.value.data.detail;
    } else if (notifRes.status === "fulfilled" && (notifRes.value?.data?.message || notifRes.value?.data?.detail)) {
      logoutMessage = notifRes.value.data.message || notifRes.value.data.detail;
    }
  } catch (err) {
    console.warn("[authApi] Logout API call:", err);
    if (err?.response?.data?.message || err?.response?.data?.detail) {
      logoutMessage = err.response.data.message || err.response.data.detail;
    }
  } finally {
    forceLogout();
  }
  return logoutMessage;
}

// 4. withAuthRetry: Universal Wrapper for ALL API calls
export async function withAuthRetry(apiCallFn) {
  // Proactively refresh if token is expired or expiring soon
  if (isAccessTokenExpiredSoon()) {
    try {
      await refreshOnce();
    } catch (refreshErr) {
      if (refreshErr?.status === 401 || refreshErr?.status === 403 || refreshErr?.response?.status === 401 || refreshErr?.response?.status === 403) {
        console.warn("[authApi] Access token expired and session refresh failed. Directing to login...");
        try {
          sessionStorage.setItem("logout_banner_message", "Your session has expired. Please log in again.");
        } catch (_) { }
        forceLogout();
        return new Promise(() => { }); // Halt execution
      }
    }
  }

  try {
    return await apiCallFn();
  } catch (err) {
    const status = err?.response?.status;

    // If 401 Unauthorized, refresh token and retry once
    if (status === 401) {
      try {
        await refreshOnce();
        return await apiCallFn(); // Retry original request with new token
      } catch (refreshErr) {
        console.warn("[authApi] 401 retry failed. Directing to login...");
        try {
          sessionStorage.setItem("logout_banner_message", "Your session has expired. Please log in again.");
        } catch (_) { }
        forceLogout();
        return new Promise(() => { }); // Halt execution
      }
    }
    throw err;
  }
}

// 5. Login Function
export async function loginUser(email, password) {
  const res = await authAxios.post("/api/v1/leader/login", { email, password }, { withCredentials: true, timeout: 15000 });
  const { access_token, token, user, expires_in } = res.data || {};
  const finalToken = access_token || token;

  if (finalToken) {
    tokenStore.setToken(finalToken);
  }
  if (expires_in) {
    localStorage.setItem(
      "access_token_expires_at",
      String(Date.now() + Number(expires_in) * 1000)
    );
  } else if (finalToken) {
    const expiresAt = getAccessTokenExpiresAt(finalToken);
    if (Number.isFinite(expiresAt) && expiresAt > 0) {
      localStorage.setItem("access_token_expires_at", String(expiresAt));
    }
  }

  const userData = user || res.data;
  if (userData) {
    localStorage.setItem("user_data", JSON.stringify(userData));
  }

  return { token: finalToken, user: userData };
}

// 6. Logout From All Devices Function
export async function logoutAllDevicesUser(email, password) {
  const res = await authAxios.post(
    "/api/v1/auth/logout-all-devices",
    { email, password },
    { withCredentials: true, timeout: 15000 }
  );
  return res.data;
}

// 7. Forgot Password Function: POST /api/v1/auth/forgot-password
export async function forgotPassword(email) {
  const res = await authAxios.post(
    "/api/v1/auth/forgot-password",
    { email: String(email || "").trim() },
    { timeout: 15000 }
  );
  return res.data;
}

// 8. Reset Password Function: POST /api/v1/auth/reset-password
export async function resetPassword(email, otp, newPassword) {
  const res = await authAxios.post(
    "/api/v1/auth/reset-password",
    {
      email: String(email || "").trim(),
      otp: String(otp || "").trim(),
      new_password: String(newPassword || "").trim()
    },
    { timeout: 15000 }
  );
  return res.data;
}
