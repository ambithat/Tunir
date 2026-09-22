// src/api/notificationSse.js
import tokenStore from "./tokenStore";
import axiosInstance from "./axiosInstance";
import { refreshOnce, isAccessTokenExpiredSoon } from "./authRefresh";

const GENERAL_EVENT = "*";
const CACHE_KEY = "last_sales_dashboard_kpis";
const subscribers = new Map();

let eventSource = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let connectedToken = "";
const MAX_RECONNECT_ATTEMPTS = 3;
const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 20000;

const eventCache = new Map();

// Initialize cache from localStorage if available
try {
  const saved = localStorage.getItem(CACHE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed) {
      eventCache.set("sales_dashboard_kpis", parsed);
      eventCache.set("dashboard_metrics", parsed);
    }
  }
} catch (_) { }

export function getLatestSalesKpis() {
  const mem = eventCache.get("sales_dashboard_kpis");
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { }
  return null;
}

// export function getBaseBackendUrl() {
//   return "";
// }
export function getBaseBackendUrl() {
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  return backendUrl.replace(/\/$/, "");
}
export function getNotificationSSEUrl() {
  const token = tokenStore.getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  const baseUrl = getBaseBackendUrl();

  if (baseUrl) {
    return `${baseUrl}/api/v1/notifications/stream${query}`;
  }

  return `/api/v1/notifications/stream${query}`;
}

export function getSalesDashboardSSEUrl() {
  return getNotificationSSEUrl();
}

function emit(eventType, payload) {
  if (eventType !== GENERAL_EVENT && payload !== undefined && payload !== null) {
    eventCache.set(eventType, payload);
    if (eventType === "sales_dashboard_kpis" || eventType === "dashboard_metrics") {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch (_) { }
    }
  }

  const target = subscribers.get(eventType);
  if (target) {
    target.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`[SSE] subscriber error for ${eventType}:`, err);
      }
    });
  }

  const all = subscribers.get(GENERAL_EVENT);
  if (all) {
    all.forEach((cb) => {
      try {
        cb({ type: eventType, payload });
      } catch (err) {
        console.error(`[SSE] generic subscriber error for ${eventType}:`, err);
      }
    });
  }
}

function parseEventData(event) {
  try {
    return typeof event.data === "string" ? JSON.parse(event.data) : event.data;
  } catch (_) {
    return event.data;
  }
}

function cleanupConnection() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (eventSource) {
    try {
      eventSource.close();
    } catch (err) {
      console.warn("[SSE] Error closing EventSource:", err);
    }
    eventSource = null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return;
  }
  reconnectAttempts += 1;
  const delay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * 2 ** (reconnectAttempts - 1),
    MAX_RECONNECT_DELAY_MS
  );
  console.log(`[SSE] 🔄 Stream will attempt reconnect in ${delay}ms (Attempt #${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    startNotificationSse().catch((err) => {
      console.warn("[SSE] Error during scheduled reconnect:", err);
    });
  }, delay);
}

function handleParseEvent(event, defaultType = "") {
  const payload = parseEventData(event);
  console.log(`[SSE] ⚡ Stream event received [${defaultType || "auto"}]:`, payload);

  const eventData =
    payload && typeof payload === "object" && payload.data !== undefined
      ? payload.data
      : payload;

  const rawEventType = payload && typeof payload === "object" ? (payload.event || payload.event_type || payload.type) : null;
  const eventType = rawEventType ? String(rawEventType).replace(/-/g, "_") : (defaultType || "message");

  // Emit under detected eventType
  emit(eventType, eventData);
  if (defaultType && defaultType !== eventType) {
    emit(defaultType, eventData);
  }

  // Automatic routing based on payload structure
  if (eventData && typeof eventData === "object") {
    // 1. Dashboard KPI Metrics
    if (eventData.total_leads !== undefined || eventData.summary !== undefined || eventData.by_leader !== undefined || eventData.by_status !== undefined) {
      emit("sales_dashboard_kpis", eventData);
      emit("dashboard_metrics", eventData);
    }
    // 2. Sales Notifications
    if (
      eventData.notification_id !== undefined ||
      eventData.table === "sales_notifications" ||
      eventData.notification_type !== undefined ||
      eventType.includes("notification") ||
      (typeof eventData.message === "string" && eventData.message.length > 0)
    ) {
      emit("sales_notification", eventData);
      emit("sales_notifications", eventData);
      emit("notification", eventData);
      emit("notifications", eventData);
    }
  }

  if (payload && typeof payload === "object") {
    if (typeof payload.event === "string" && payload.event !== defaultType && payload.event !== eventType) {
      emit(payload.event, eventData);
    }
    if (typeof payload.event_type === "string" && payload.event_type !== defaultType && payload.event_type !== eventType) {
      emit(payload.event_type, eventData);
    }
    if (typeof payload.type === "string" && payload.type !== defaultType && payload.type !== eventType) {
      emit(payload.type, eventData);
    }
  }
}

export function subscribeToSseEvent(eventType, callback) {
  const typeKey = eventType || GENERAL_EVENT;
  const existing = subscribers.get(typeKey) || new Set();
  existing.add(callback);
  subscribers.set(typeKey, existing);

  // Push cached data immediately on subscribe
  if (typeKey !== GENERAL_EVENT) {
    const cached = eventCache.get(typeKey) || (typeKey === "sales_dashboard_kpis" ? getLatestSalesKpis() : undefined);
    if (cached !== undefined && cached !== null) {
      try {
        callback(cached);
      } catch (err) {
        console.error(`[SSE] Error executing callback on cached event [${typeKey}]:`, err);
      }
    }
  }

  return () => {
    const set = subscribers.get(typeKey);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) {
      subscribers.delete(typeKey);
    }
  };
}

export async function startNotificationSse() {
  // If already open or connecting, do NOT reconnect or restart under any circumstances (persist for entire login session)
  if (
    eventSource &&
    (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CONNECTING)
  ) {
    return;
  }

  // On reconnect attempt or if token is expired/near-expired, refresh access token before building SSE URL
  let token = tokenStore.getToken();
  if (!token || isAccessTokenExpiredSoon() || reconnectAttempts > 0) {
    try {
      console.log("[SSE] 🔑 Refreshing access token before establishing stream...");
      const newToken = await refreshOnce();
      if (newToken) {
        token = newToken;
      }
    } catch (refreshErr) {
      console.warn("[SSE] ⚠️ Token refresh before SSE connection failed:", refreshErr);
      token = tokenStore.getToken();
    }
  }

  if (!token) {
    console.warn("[SSE] No valid access token available for SSE stream.");
    return;
  }

  cleanupConnection();
  connectedToken = token;

  const notifUrl = getNotificationSSEUrl();
  if (!notifUrl) {
    console.warn("[SSE] Notification stream URL is not configured.");
    return;
  }

  try {
    console.log("[SSE] 🔌 Connecting to live SSE Stream:", notifUrl);
    const es = new EventSource(notifUrl, { withCredentials: true });
    eventSource = es;

    es.onopen = () => {
      reconnectAttempts = 0;
      emit("open", { stream: "notifications" });
      console.log("[SSE] ✅ Live stream connected successfully (Single Connection for session)!");
    };

    es.onerror = async (err) => {
      console.warn("[SSE] ⚠️ Live stream disconnected/error, readyState:", es ? es.readyState : "closed");
      emit("error", { stream: "notifications", error: err });
      cleanupConnection();

      // Whenever an SSE disconnect or 401 error occurs, refresh token so the subsequent reconnect uses a fresh access token
      try {
        await refreshOnce();
      } catch (e) {
        console.warn("[SSE] ⚠️ Token refresh on disconnect failed:", e);
      }

      scheduleReconnect();
    };

    // Named event listeners
    [
      "sales_dashboard_kpis",
      "sales-dashboard-kpis",
      "dashboard_metrics",
      "dashboard-metrics",
      "sales_notification",
      "sales-notification",
      "sales_notifications",
      "notification",
      "notifications"
    ].forEach(evtName => {
      es.addEventListener(evtName, (event) => {
        handleParseEvent(event, evtName.replace(/-/g, "_"));
      });
    });

    // Catch-all onmessage
    es.onmessage = (event) => {
      handleParseEvent(event, "sales_dashboard_kpis");
      emit("message", parseEventData(event));
    };
  } catch (err) {
    console.error("[SSE] Failed to initialize EventSource:", err);
  }
}

export function stopNotificationSse() {
  cleanupConnection();
  reconnectAttempts = 0;
  connectedToken = "";
  eventCache.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem("last_sales_dashboard_kpis");
  } catch (_) {}
  console.log("[SSE] 🛑 Live stream disconnected & local cache cleared.");
}

export function resetNotificationSse() {
  stopNotificationSse();
}

/**
 * Fallback & Manual Sync API
 * Emits the latest cached KPIs without calling deprecated REST endpoint
 */
export async function refreshDashboardKpis() {
  const cached = getLatestSalesKpis();
  if (cached) {
    emit("sales_dashboard_kpis", cached);
  }
  return cached;
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    stopNotificationSse();
  });
}
