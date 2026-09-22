// src/api/leaderApi.js
import axiosInstance from "./axiosInstance";
import { withAuthRetry } from "./authApi";

let leadersCache = null;
let leadersDropdownCache = null;

export function clearLeaderCache() {
  leadersCache = null;
  leadersDropdownCache = null;
}

/**
 * Fetch lightweight leaders dropdown from GET /api/v1/leaders/dropdown
 * Returns [ { leader_id: "LDR-0002", full_name: "Astha verma" }, ... ]
 */
export function getLeadersDropdown(force = false) {
  if (!force && leadersDropdownCache) {
    return Promise.resolve(leadersDropdownCache);
  }
  return withAuthRetry(async () => {
    const res = await axiosInstance.get("/leaders/dropdown");
    leadersDropdownCache = res.data;
    return res.data;
  });
}

/**
 * Fetch paginated leaders from GET /api/v1/leaders
 * @param {Object} params - { limit: 50, cursor: null, search: string }
 * @param {boolean} force - bypass cache
 */
export function getLeaders(params = {}, force = false) {
  const hasSearch = params.search && params.search.trim();
  // Only use cache for plain, un-filtered first-page loads
  if (!force && !params.cursor && !hasSearch && (!params.limit || params.limit >= 50) && leadersCache) {
    return Promise.resolve(leadersCache);
  }
  return withAuthRetry(async () => {
    const cleanParams = {};
    if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
    if (params.cursor !== undefined && params.cursor !== null) cleanParams.cursor = params.cursor;
    if (hasSearch) cleanParams.search = params.search.trim();

    const res = await axiosInstance.get("/leaders", { params: cleanParams });
    // Only cache the plain (no search, no cursor) full fetch
    if (!params.cursor && !hasSearch && (!params.limit || params.limit >= 50)) {
      leadersCache = res.data;
    }
    return res.data;
  });
}

/**
 * Search leaders by term via GET /api/v1/leaders?search=...
 * Always bypasses cache since it's a filtered subset.
 * @param {string} search - search term
 * @param {Object} params - extra params e.g. { limit: 50 }
 */
export function searchLeaders(search, params = {}) {
  return withAuthRetry(async () => {
    const cleanParams = { ...params };
    if (search && search.trim()) cleanParams.search = search.trim();
    const res = await axiosInstance.get("/leaders", { params: cleanParams });
    return res.data;
  });
}

/**
 * Create a new leader / employee: POST /api/v1/leaders
 * Schema:
 * {
 *   emp_id: string,
 *   first_name: string,
 *   last_name: string,
 *   email: string,
 *   password: string,
 *   designation: string,
 *   is_active: boolean
 * }
 * @param {Object} data
 */
export function createLeader(data) {
  leadersCache = null;
  leadersDropdownCache = null;
  return withAuthRetry(async () => {
    const payload = {
      emp_id: String(data.emp_id || "").trim(),
      first_name: String(data.first_name || "").trim(),
      last_name: String(data.last_name || "").trim(),
      email: String(data.email || "").trim(),
      password: data.password ? String(data.password) : "",
      designation: String(data.designation || "").trim(),
      role: data.role ? String(data.role).trim() : "user",
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
    };

    const res = await axiosInstance.post("/leaders", payload);
    leadersCache = null;
    leadersDropdownCache = null;
    return res.data;
  });
}

/**
 * Update leader details: PATCH /api/v1/leaders/{leader_id}
 * Sends ONLY the changed/provided fields in the payload body.
 * Schema (all optional in PATCH):
 * {
 *   first_name?: string,
 *   last_name?: string,
 *   email?: string,
 *   password?: string,
 *   designation?: string,
 *   role?: string,
 *   is_active?: boolean
 * }
 * @param {number|string} leaderId
 * @param {Object} data
 */
export function updateLeader(leaderId, data = {}) {
  leadersCache = null;
  leadersDropdownCache = null;
  return withAuthRetry(async () => {
    const payload = {};
    if (data.emp_id !== undefined) payload.emp_id = String(data.emp_id).trim();
    if (data.first_name !== undefined) payload.first_name = String(data.first_name).trim();
    if (data.last_name !== undefined) payload.last_name = data.last_name !== null ? String(data.last_name).trim() : "";
    if (data.email !== undefined) payload.email = String(data.email).trim();
    if (data.designation !== undefined) payload.designation = data.designation !== null ? String(data.designation).trim() : "";
    if (data.role !== undefined) payload.role = data.role !== null ? String(data.role).trim() : "user";
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);
    if (data.password !== undefined && data.password && String(data.password).trim()) {
      payload.password = String(data.password).trim();
    }

    const res = await axiosInstance.patch(`/leaders/${encodeURIComponent(leaderId)}`, payload);
    leadersCache = null;
    leadersDropdownCache = null;
    return res.data;
  });
}

/**
 * Delete leader: DELETE /api/v1/leaders/{leader_id}
 * @param {number|string} leaderId
 */
export function deleteLeader(leaderId) {
  leadersCache = null;
  leadersDropdownCache = null;
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete(`/leaders/${encodeURIComponent(leaderId)}`);
    leadersCache = null;
    leadersDropdownCache = null;
    return res.data;
  });
}

/**
 * Bulk delete leaders: DELETE /api/v1/leaders/bulk
 * Body payload: { "ids": [1, 2, 3] } or Array of IDs
 * @param {Array<number|string>|{ids: Array<number|string>}} payload
 */
export function bulkDeleteLeaders(payload) {
  leadersCache = null;
  leadersDropdownCache = null;
  return withAuthRetry(async () => {
    let idsArray = [];
    if (Array.isArray(payload)) {
      idsArray = payload;
    } else if (payload && Array.isArray(payload.ids)) {
      idsArray = payload.ids;
    } else if (payload && (payload.id || payload.leader_id)) {
      idsArray = [payload.id || payload.leader_id];
    }

    const body = { ids: idsArray };
    const res = await axiosInstance.delete("/leaders/bulk", { data: body });
    leadersCache = null;
    leadersDropdownCache = null;
    return res.data;
  });
}

/**
 * Fetch leader reassignment / permission delegation history: GET /api/v1/leader-reassignment-history
 * @param {number} limit
 * @param {number} offset
 * @param {string} search
 */
export function getLeaderReassignHistory(limit = 50, offset = 0, search = '') {
  return withAuthRetry(async () => {
    try {
      const params = { limit, offset };
      if (search && String(search).trim()) params.search = String(search).trim();
      const res = await axiosInstance.get("/leader-reassignment-history", { params });
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        const res = await axiosInstance.get("/leaders/reassign/history");
        return res.data;
      }
      throw err;
    }
  });
}

/**
 * Get history item by ID: GET /api/v1/leader-reassignment-history/{history_id}
 * @param {number|string} historyId
 */
export function getLeaderReassignHistoryById(historyId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get(`/leader-reassignment-history/${encodeURIComponent(historyId)}`);
    return res.data;
  });
}

/**
 * Create manual reassignment history record: POST /api/v1/leader-reassignment-history
 * @param {Object} historyData
 */
export function createReassignmentHistoryRecord(historyData) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.post("/leader-reassignment-history", historyData);
    return res.data;
  });
}


// inactive leader dropdown /api/v1/leaders/inactive/dropdown
export function getInactiveLeadersDropdown() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get("/leaders/inactive/dropdown");
    return res.data;
  });
}

/**
 * Fetch products registered under a leader: GET /api/v1/leaders/{leader_id}/products
 * @param {string|number} leaderId
 */
export function getLeaderProducts(leaderId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get(`/leaders/${encodeURIComponent(leaderId)}/products`);
    return res.data;
  });
}




/**
 * Product-based leader reassignment: POST /api/v1/leader-reassignment-history/reassign-products
 * Payload schema:
 * {
 *   source_leader_id: string,
 *   deactivate_source: boolean,
 *   product_assignments: [
 *     {
 *       product_register_id: string,
 *       target_leader_id: string
 *     }
 *   ],
 *   default_target_leader_id: string
 * }
 * @param {Object} payload
 */
export function reassignProducts(payload) {
  leadersCache = null;
  leadersDropdownCache = null;
  return withAuthRetry(async () => {
    const cleanPayload = {
      source_leader_id: String(payload.source_leader_id || "").trim(),
      deactivate_source: Boolean(payload.deactivate_source),
      product_assignments: Array.isArray(payload.product_assignments)
        ? payload.product_assignments.map(p => ({
            product_register_id: String(p.product_register_id || "").trim(),
            target_leader_id: String(p.target_leader_id || "").trim()
          }))
        : [],
      default_target_leader_id: String(payload.default_target_leader_id || payload.target_leader_id || "").trim()
    };
    try {
      const res = await axiosInstance.post("/leader-reassignment-history/reassign-products", cleanPayload);
      leadersCache = null;
      leadersDropdownCache = null;
      return res.data;
    } catch (err) {
      if (err.response?.status === 404) {
        // Fallback endpoint if API route is legacy
        const res = await axiosInstance.post("/leaders/reassign", {
          source_leader_id: cleanPayload.source_leader_id,
          target_leader_id: cleanPayload.default_target_leader_id
        });
        leadersCache = null;
        leadersDropdownCache = null;
        return res.data;
      }
      throw err;
    }
  });
}

/**
 * Reassign leads/activities from source leader to target leader: POST /api/v1/leader-reassignment-history/reassign-products
 * @param {Object} payload - { source_leader_id: string, target_leader_id: string, deactivate_source?: boolean, product_assignments?: Array }
 */
export function reassignLeader(payload) {
  return reassignProducts(payload);
}

