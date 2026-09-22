// src/api/statusTypeApi.js
import axios from "axios";
import tokenStore from "./tokenStore";
import { withAuthRetry } from "./authApi";

const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

const statusTypeApi = axios.create({
  baseURL: backendUrl.replace(/\/$/, ""),
  timeout: 30000,
  withCredentials: true,
});

const getHeaders = () => {
  const token = tokenStore.getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// In-memory cache for static dropdown lookups
const dropdownCache = {
  product: null,
  leaderStage: null,
  leadProductStatus: null,
  activityType: null,
  activityOutcome: null,
  activityStatus: null
};

export function clearAllDropdownCaches() {
  Object.keys(dropdownCache).forEach(k => {
    dropdownCache[k] = null;
  });
}

// ── 1. Product Dropdowns & Master ───────────────────────────────────────────
// GET /statustype/product/dropdown
export function getProductDropdown(force = false) {
  if (force) dropdownCache.product = null;
  if (!force && dropdownCache.product) {
    return Promise.resolve(dropdownCache.product);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/product/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    const rawData = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
    const sorted = [...rawData].sort((a, b) => {
      const nameA = String(typeof a === "object" && a !== null ? (a.product || a.product_name || a.name || "") : a || "").trim();
      const nameB = String(typeof b === "object" && b !== null ? (b.product || b.product_name || b.name || "") : b || "").trim();
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true });
    });
    dropdownCache.product = sorted;
    return sorted;
  });
}

// POST /statustype/product  Body: { "product": "string" }
export function createProduct(input) {
  dropdownCache.product = null;
  return withAuthRetry(async () => {
    const productName = typeof input === "object" && input !== null ? input.product : input;
    const res = await statusTypeApi.post(
      "/statustype/product",
      { product: String(productName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.product = null;
    return res.data;
  });
}

// PUT /statustype/product/{id}  Body: { "product": "string" }
export function updateProduct(id, input) {
  dropdownCache.product = null;
  return withAuthRetry(async () => {
    const productName = typeof input === "object" && input !== null ? input.product : input;
    const res = await statusTypeApi.put(
      `/statustype/product/${encodeURIComponent(id)}`,
      { product: String(productName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.product = null;
    return res.data;
  });
}

// DELETE /statustype/product/{id}
export function deleteProduct(id) {
  dropdownCache.product = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/product/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.product = null;
    return res.data;
  });
}

// ── 2. Leader Stage Dropdowns & Master ───────────────────────────────────────
// GET /statustype/leader-stage/dropdown
const LEADER_STAGE_ORDER = ["Low", "Medium", "High", "Negotiation", "Won", "Lost"];

export function getLeaderStageDropdown(force = false) {
  if (force) dropdownCache.leaderStage = null;
  if (!force && dropdownCache.leaderStage) {
    return Promise.resolve(dropdownCache.leaderStage);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/leader-stage/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    const sorted = [...res.data].sort((a, b) => {
      const ai = LEADER_STAGE_ORDER.indexOf(a.leader_stage);
      const bi = LEADER_STAGE_ORDER.indexOf(b.leader_stage);
      return (ai === -1 ? LEADER_STAGE_ORDER.length : ai) - (bi === -1 ? LEADER_STAGE_ORDER.length : bi);
    });
    dropdownCache.leaderStage = sorted;
    return sorted;
  });
}

// POST /statustype/leader-stage  Body: { "leader_stage": "string" }
export function createLeaderStage(input) {
  dropdownCache.leaderStage = null;
  return withAuthRetry(async () => {
    const stageName = typeof input === "object" && input !== null ? input.leader_stage : input;
    const res = await statusTypeApi.post(
      "/statustype/leader-stage",
      { leader_stage: String(stageName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.leaderStage = null;
    return res.data;
  });
}

// PUT /statustype/leader-stage/{id}  Body: { "leader_stage": "string" }
export function updateLeaderStage(id, input) {
  dropdownCache.leaderStage = null;
  return withAuthRetry(async () => {
    const stageName = typeof input === "object" && input !== null ? input.leader_stage : input;
    const res = await statusTypeApi.put(
      `/statustype/leader-stage/${encodeURIComponent(id)}`,
      { leader_stage: String(stageName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.leaderStage = null;
    return res.data;
  });
}

// DELETE /statustype/leader-stage/{id}
export function deleteLeaderStage(id) {
  dropdownCache.leaderStage = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/leader-stage/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.leaderStage = null;
    return res.data;
  });
}

// ── 3. Lead Product Status Dropdowns & Master ────────────────────────────────
// GET /statustype/lead-product/dropdown
const LEAD_PRODUCT_STATUS_ORDER = ["Unqualified", "Contacted", "Qualified", "Proposal Sent"];

export function getLeadProductStatusDropdown(force = false) {
  if (force) dropdownCache.leadProductStatus = null;
  if (!force && dropdownCache.leadProductStatus) {
    return Promise.resolve(dropdownCache.leadProductStatus);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/lead-product/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    const sorted = [...res.data].sort((a, b) => {
      const ai = LEAD_PRODUCT_STATUS_ORDER.indexOf(a.status);
      const bi = LEAD_PRODUCT_STATUS_ORDER.indexOf(b.status);
      return (ai === -1 ? LEAD_PRODUCT_STATUS_ORDER.length : ai) - (bi === -1 ? LEAD_PRODUCT_STATUS_ORDER.length : bi);
    });
    dropdownCache.leadProductStatus = sorted;
    return sorted;
  });
}

// POST /statustype/lead-product  Body: { "status": "string" }
export function createLeadProductStatus(input) {
  dropdownCache.leadProductStatus = null;
  return withAuthRetry(async () => {
    const statusName = typeof input === "object" && input !== null ? input.status : input;
    const res = await statusTypeApi.post(
      "/statustype/lead-product",
      { status: String(statusName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.leadProductStatus = null;
    return res.data;
  });
}

// PUT /statustype/lead-product/{id}  Body: { "status": "string" }
export function updateLeadProductStatus(id, input) {
  dropdownCache.leadProductStatus = null;
  return withAuthRetry(async () => {
    const statusName = typeof input === "object" && input !== null ? input.status : input;
    const res = await statusTypeApi.put(
      `/statustype/lead-product/${encodeURIComponent(id)}`,
      { status: String(statusName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.leadProductStatus = null;
    return res.data;
  });
}

// DELETE /statustype/lead-product/{id}
export function deleteLeadProductStatus(id) {
  dropdownCache.leadProductStatus = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/lead-product/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.leadProductStatus = null;
    return res.data;
  });
}

// ── 4. Activity Type Dropdowns & Master ──────────────────────────────────────
// GET /statustype/activity-type/dropdown
export function getActivityTypeDropdown(force = false) {
  if (force) dropdownCache.activityType = null;
  if (!force && dropdownCache.activityType) {
    return Promise.resolve(dropdownCache.activityType);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/activity-type/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    dropdownCache.activityType = res.data;
    return res.data;
  });
}

// POST /statustype/activity-type  Body: { "activity_type": "string" }
export function createActivityType(input) {
  dropdownCache.activityType = null;
  return withAuthRetry(async () => {
    const typeName = typeof input === "object" && input !== null ? input.activity_type : input;
    const res = await statusTypeApi.post(
      "/statustype/activity-type",
      { activity_type: String(typeName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityType = null;
    return res.data;
  });
}

// PUT /statustype/activity-type/{id}  Body: { "activity_type": "string" }
export function updateActivityType(id, input) {
  dropdownCache.activityType = null;
  return withAuthRetry(async () => {
    const typeName = typeof input === "object" && input !== null ? input.activity_type : input;
    const res = await statusTypeApi.put(
      `/statustype/activity-type/${encodeURIComponent(id)}`,
      { activity_type: String(typeName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityType = null;
    return res.data;
  });
}

// DELETE /statustype/activity-type/{id}
export function deleteActivityType(id) {
  dropdownCache.activityType = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/activity-type/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.activityType = null;
    return res.data;
  });
}

// ── 5. Daily Activity Outcome Dropdowns & Master ─────────────────────────────
// GET /statustype/daily-activity-outcome/dropdown
export function getActivityOutcomeDropdown(force = false) {
  if (force) dropdownCache.activityOutcome = null;
  if (!force && dropdownCache.activityOutcome) {
    return Promise.resolve(dropdownCache.activityOutcome);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/daily-activity-outcome/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    dropdownCache.activityOutcome = res.data;
    return res.data;
  });
}

// POST /statustype/daily-activity-outcome  Body: { "outcome": "string" }
export function createActivityOutcome(input) {
  dropdownCache.activityOutcome = null;
  return withAuthRetry(async () => {
    const outcomeName = typeof input === "object" && input !== null ? input.outcome : input;
    const res = await statusTypeApi.post(
      "/statustype/daily-activity-outcome",
      { outcome: String(outcomeName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityOutcome = null;
    return res.data;
  });
}

// PUT /statustype/daily-activity-outcome/{id}  Body: { "outcome": "string" }
export function updateActivityOutcome(id, input) {
  dropdownCache.activityOutcome = null;
  return withAuthRetry(async () => {
    const outcomeName = typeof input === "object" && input !== null ? input.outcome : input;
    const res = await statusTypeApi.put(
      `/statustype/daily-activity-outcome/${encodeURIComponent(id)}`,
      { outcome: String(outcomeName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityOutcome = null;
    return res.data;
  });
}

// DELETE /statustype/daily-activity-outcome/{id}
export function deleteActivityOutcome(id) {
  dropdownCache.activityOutcome = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/daily-activity-outcome/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.activityOutcome = null;
    return res.data;
  });
}

// ── 6. Daily Activity Status Dropdowns & Master ──────────────────────────────
// GET /statustype/daily-activity-status/dropdown
export function getActivityStatusDropdown(force = false) {
  if (force) dropdownCache.activityStatus = null;
  if (!force && dropdownCache.activityStatus) {
    return Promise.resolve(dropdownCache.activityStatus);
  }
  return withAuthRetry(async () => {
    const res = await statusTypeApi.get("/statustype/daily-activity-status/dropdown", {
      headers: { ...getHeaders(), "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" },
      params: force ? { _t: Date.now() } : {},
      withCredentials: true
    });
    dropdownCache.activityStatus = res.data;
    return res.data;
  });
}

// POST /statustype/daily-activity-status  Body: { "action_status": "string" }
export function createActivityStatus(input) {
  dropdownCache.activityStatus = null;
  return withAuthRetry(async () => {
    const statusName = typeof input === "object" && input !== null ? input.action_status : input;
    const res = await statusTypeApi.post(
      "/statustype/daily-activity-status",
      { action_status: String(statusName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityStatus = null;
    return res.data;
  });
}

// PUT /statustype/daily-activity-status/{id}  Body: { "action_status": "string" }
export function updateActivityStatus(id, input) {
  dropdownCache.activityStatus = null;
  return withAuthRetry(async () => {
    const statusName = typeof input === "object" && input !== null ? input.action_status : input;
    const res = await statusTypeApi.put(
      `/statustype/daily-activity-status/${encodeURIComponent(id)}`,
      { action_status: String(statusName || "").trim() },
      { headers: getHeaders(), withCredentials: true }
    );
    dropdownCache.activityStatus = null;
    return res.data;
  });
}

// DELETE /statustype/daily-activity-status/{id}
export function deleteActivityStatus(id) {
  dropdownCache.activityStatus = null;
  return withAuthRetry(async () => {
    const res = await statusTypeApi.delete(`/statustype/daily-activity-status/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
      withCredentials: true
    });
    dropdownCache.activityStatus = null;
    return res.data;
  });
}
