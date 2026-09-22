// src/api/activityApi.js
import axiosInstance from "./axiosInstance";
import { withAuthRetry } from "./authApi";

// In-memory cache for static activity dropdown masters
const activityDropdownCache = {
  types: null,
  outcomes: null,
  statuses: null
};

/**
 * Fetch paginated activities from GET /api/v1/activities
 * @param {Object} params - { limit: 50, cursor: null, is_active: true/null, search: string/null }
 */
export function getActivities(params = {}) {
  return withAuthRetry(async () => {
    const cleanParams = {};
    if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
    if (params.cursor !== undefined && params.cursor !== null) cleanParams.cursor = params.cursor;
    if (params.is_active !== undefined && params.is_active !== null) cleanParams.is_active = params.is_active;

    if (params.search !== undefined && params.search !== null && String(params.search).trim()) {
      cleanParams.search = String(params.search).trim();
    }

    if (params.from_date !== undefined && params.from_date !== null) {
      cleanParams.from_date = params.from_date;
    }
    if (params.to_date !== undefined && params.to_date !== null) {
      cleanParams.to_date = params.to_date;
    }

    // Force live fetch from backend if date parameters exist or skipCache is requested
    const shouldSkipCache = Boolean(params.skipCache || params.from_date || params.to_date);

    const res = await axiosInstance.get("/activities", {
      params: cleanParams,
      skipCache: shouldSkipCache,
      headers: shouldSkipCache ? { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" } : {}
    });
    return res.data;
  });
}

/**
 * Fetch activities for a specific lead: GET /api/v1/leads/{lead_id}/activities
 * @param {string} leadId
 */
export function getLeadActivities(leadId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get(`/leads/${encodeURIComponent(leadId)}/activities`);
    return res.data;
  });
}

/**
 * Create a new activity for a lead: POST /api/v1/leads/{lead_id}/activities
 * Schema:
 * {
 *   lead_owner_id?: number | string,
 *   activity_date: string (YYYY-MM-DD),
 *   activity_type_id?: number,
 *   summary?: string,
 *   next_action?: string,
 *   next_action_date?: string,
 *   outcome_id?: number,
 *   action_status_id?: number
 * }
 * @param {string} leadId
 * @param {Object} data
 */
export function createLeadActivity(leadId, data) {
  return withAuthRetry(async () => {
    const payload = {
      activity_date: data.activity_date || new Date().toISOString().slice(0, 10),
      meeting_action_remarks: data.meeting_action_remarks ? String(data.meeting_action_remarks).trim() : null
    };
    if (data.lead_owner_id !== undefined && data.lead_owner_id !== null && data.lead_owner_id !== '') {
      payload.lead_owner_id = !isNaN(Number(data.lead_owner_id)) ? Number(data.lead_owner_id) : data.lead_owner_id;
    }
    if (data.activity_type_id !== undefined && data.activity_type_id !== null && data.activity_type_id !== '') {
      payload.activity_type_id = Number(data.activity_type_id);
    }
    if (data.meeting_plan !== undefined) payload.meeting_plan = data.meeting_plan ? String(data.meeting_plan).trim() : null;
    if (data.next_action_type_id !== undefined && data.next_action_type_id !== null && data.next_action_type_id !== '') {
      payload.next_action_type_id = Number(data.next_action_type_id);
    } else if (data.next_action !== undefined && data.next_action !== null && data.next_action !== '') {
      payload.next_action_type_id = !isNaN(Number(data.next_action)) ? Number(data.next_action) : null;
    }
    if (data.next_action_date !== undefined) payload.next_action_date = data.next_action_date || null;
    if (data.next_meeting_plan !== undefined) payload.next_meeting_plan = data.next_meeting_plan ? String(data.next_meeting_plan).trim() : null;
    if (data.outcome_id !== undefined && data.outcome_id !== null && data.outcome_id !== '') {
      payload.outcome_id = Number(data.outcome_id);
    }
    if (data.action_status_id !== undefined && data.action_status_id !== null && data.action_status_id !== '') {
      payload.action_status_id = Number(data.action_status_id);
    }
    if (data.overdue_reason !== undefined) payload.overdue_reason = data.overdue_reason ? String(data.overdue_reason).trim() : null;

    const res = await axiosInstance.post(`/leads/${encodeURIComponent(leadId)}/activities`, payload);
    return res.data;
  });
}

/**
 * Update an existing activity: PATCH /api/v1/activities/{activity_id}
 * Sends ONLY modified/provided fields.
 * @param {string} activityId
 * @param {Object} data
 */
export function updateActivity(activityId, data = {}) {
  return withAuthRetry(async () => {
    const payload = {};
    if (data.lead_owner_id !== undefined) payload.lead_owner_id = data.lead_owner_id ? String(data.lead_owner_id) : null;
    if (data.activity_date !== undefined) payload.activity_date = data.activity_date;
    if (data.activity_type_id !== undefined) payload.activity_type_id = data.activity_type_id ? Number(data.activity_type_id) : null;
    if (data.meeting_plan !== undefined) payload.meeting_plan = data.meeting_plan ? String(data.meeting_plan).trim() : null;
    if (data.meeting_action_remarks !== undefined) payload.meeting_action_remarks = data.meeting_action_remarks ? String(data.meeting_action_remarks).trim() : null;
    if (data.next_action_type_id !== undefined) {
      payload.next_action_type_id = data.next_action_type_id ? Number(data.next_action_type_id) : null;
    } else if (data.next_action !== undefined) {
      payload.next_action_type_id = data.next_action ? Number(data.next_action) : null;
    }
    if (data.next_action_date !== undefined) payload.next_action_date = data.next_action_date || null;
    if (data.next_meeting_plan !== undefined) payload.next_meeting_plan = data.next_meeting_plan ? String(data.next_meeting_plan).trim() : null;
    if (data.outcome_id !== undefined) payload.outcome_id = data.outcome_id ? Number(data.outcome_id) : null;
    if (data.action_status_id !== undefined) payload.action_status_id = data.action_status_id ? Number(data.action_status_id) : null;
    if (data.overdue_reason !== undefined) payload.overdue_reason = data.overdue_reason ? String(data.overdue_reason).trim() : null;
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    const res = await axiosInstance.patch(`/activities/${encodeURIComponent(activityId)}`, payload);
    return res.data;
  });
}

/**
 * Delete an activity: DELETE /api/v1/activities/{activity_id}
 * @param {string} activityId
 */
export function deleteActivity(activityId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete(`/activities/${encodeURIComponent(activityId)}`);
    return res.data;
  });
}

/**
 * Bulk delete selected activities: DELETE /api/v1/activities/bulk
 * Body payload: { "ids": ["string" | number] }
 * @param {Array<number|string>|{ids: Array<number|string>}} payload
 */
export function bulkDeleteActivities(payload) {
  return withAuthRetry(async () => {
    let idsArray = [];
    if (Array.isArray(payload)) {
      idsArray = payload;
    } else if (payload && Array.isArray(payload.ids)) {
      idsArray = payload.ids;
    } else if (payload && (payload.id || payload.activity_id)) {
      idsArray = [payload.id || payload.activity_id];
    }
    const body = { ids: idsArray };
    const res = await axiosInstance.delete("/activities/bulk", { data: body });
    return res.data;
  });
}

/**
 * Delete all activities: DELETE /api/v1/activities/delete-all
 */
export function deleteAllActivities() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete("/activities/delete-all");
    return res.data;
  });
}

// ── Dropdowns (Re-exported from statusTypeApi to ensure correct /statustype base path) ──
export {
  getActivityTypeDropdown,
  getActivityOutcomeDropdown,
  getActivityStatusDropdown
} from "./statusTypeApi";
