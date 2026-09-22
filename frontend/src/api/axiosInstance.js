// src/api/axiosInstance.js
import axios from "axios";
import tokenStore from "./tokenStore";
import { clearAuthStorage, refreshOnce, isAccessTokenExpiredSoon } from "./authRefresh";

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const axiosInstance = axios.create({
  baseURL: `${backendUrl.replace(/\/$/, "")}/api/v1`,
  timeout: 30000,
  withCredentials: true,
});
// ── In-Memory Response Cache Store (30s TTL) ───────────────────────────────
const responseCache = new Map();
const pendingGetRequests = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 Seconds Cache TTL

function stableParams(params = {}) {
  if (!params || typeof params !== "object") return "";
  const ordered = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return JSON.stringify(ordered);
}

function getRequestKey(url, config = {}) {
  return `${config.baseURL || axiosInstance.defaults.baseURL || ""}${url}?${stableParams(config.params)}`;
}

/**
 * Invalidate cached GET responses across all components
 */
export function invalidateCache() {
  responseCache.clear();
  console.log("[Axios Cache] 🧹 Cleared entire response cache across all components");
}

// ── Override GET to support 30s TTL Cache + Request Deduplication ──────────
const axiosGet = axiosInstance.get.bind(axiosInstance);

axiosInstance.get = (url, config = {}) => {
  const key = getRequestKey(url, config);
  const now = Date.now();

  // 1. Return from 30s Cache if valid and skipCache is not set
  if (!config.skipCache && responseCache.has(key)) {
    const cached = responseCache.get(key);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return Promise.resolve(cached.response);
    }
    responseCache.delete(key);
  }

  // 2. Return in-flight request promise if already pending
  if (pendingGetRequests.has(key)) {
    return pendingGetRequests.get(key);
  }

  // 3. Perform network call and cache 200 OK response
  const request = axiosGet(url, config)
    .then((res) => {
      if (!config.skipCache && res?.status === 200) {
        responseCache.set(key, { response: res, timestamp: Date.now() });
      }
      return res;
    })
    .finally(() => {
      pendingGetRequests.delete(key);
    });

  pendingGetRequests.set(key, request);
  return request;
};

// Request Interceptor: Attach Bearer Token automatically.
axiosInstance.interceptors.request.use(
  async (config) => {
    if (tokenStore.isLoggedOut()) {
      config.skipAuthRefresh = true;
    } else if (!config.skipAuthRefresh && isAccessTokenExpiredSoon()) {
      try {
        await refreshOnce();
      } catch (_) {
        // Let the request continue; a 401 response will run the normal retry path.
      }
    }

    const token = tokenStore.getToken();
    if (token && !tokenStore.isLoggedOut()) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-invalidate cache on write operations (POST/PUT/PATCH/DELETE) & handle 401
axiosInstance.interceptors.response.use(
  (response) => {
    const method = (response.config?.method || "").toUpperCase();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      invalidateCache();
      try {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app_data_invalidated"));
        }
      } catch (_) { }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    if (status === 401 && !tokenStore.isLoggedOut() && originalRequest && !originalRequest._retry && !originalRequest.skipAuthRefresh) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshOnce();
        if (tokenStore.isLoggedOut()) {
          return Promise.reject(error);
        }
        originalRequest.headers = originalRequest.headers || {};
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return axiosInstance(originalRequest);
      } catch (refreshErr) {
        try {
          sessionStorage.setItem("logout_banner_message", "Your session has expired. Please log in again.");
        } catch (_) { }
        clearAuthStorage();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;

