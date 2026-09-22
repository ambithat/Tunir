// src/api/contactApi.js
import axiosInstance from "./axiosInstance";
import { withAuthRetry } from "./authApi";

/**
 * Fetch paginated contacts from GET /api/v1/contacts
 * @param {Object} params - { limit: 50, cursor: null, is_active: true/null, search: string/null }
 */
export function getContacts(params = {}) {
  return withAuthRetry(async () => {
    const cleanParams = {};
    if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
    if (params.cursor !== undefined && params.cursor !== null) cleanParams.cursor = params.cursor;
    if (params.is_active !== undefined && params.is_active !== null) cleanParams.is_active = params.is_active;
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
    if (params.from_date !== undefined && params.from_date !== null) {
      cleanParams.from_date = params.from_date;
    }
    if (params.to_date !== undefined && params.to_date !== null) {
      cleanParams.to_date = params.to_date;
    }

    // Force live fetch from backend if date parameters exist or skipCache is requested
    const shouldSkipCache = Boolean(params.skipCache || params.from_date || params.to_date);

    const res = await axiosInstance.get("/contacts", {
      params: cleanParams,
      skipCache: shouldSkipCache,
      headers: shouldSkipCache ? { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" } : {}
    });
    return res.data;
  });
}

/**
 * Fetch lightweight contacts dropdown: GET /api/v1/contacts/dropdown
 */
export function getContactsDropdown() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get("/contacts/dropdown");
    return res.data;
  });
}

/**
 * Fetch a single contact by contact_id: GET /api/v1/contacts/{contact_id}
 * @param {string} contactId
 */
export function getContactById(contactId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get(`/contacts/${encodeURIComponent(contactId)}`);
    return res.data;
  });
}

/**
 * Create a new contact: POST /api/v1/contacts
 * Schema:
 * {
 *   company: string,
 *   contact_name: string,
 *   designation?: string,
 *   phone_no_1: string,
 *   phone_no_2?: string,
 *   email: string,
 *   country?: string,
 *   region?: string,
 *   is_active?: boolean
 * }
 * @param {Object} data
 */
export function createContact(data) {
  return withAuthRetry(async () => {
    const payload = {
      company: String(data.company || "").trim(),
      contact_name: String(data.contact_name || "").trim(),
      phone_no_1: String(data.phone_no_1 || "").trim(),
      email: String(data.email || "").trim(),
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
    };
    if (data.designation !== undefined) payload.designation = data.designation ? String(data.designation).trim() : null;
    if (data.phone_no_2 !== undefined) payload.phone_no_2 = data.phone_no_2 ? String(data.phone_no_2).trim() : null;
    if (data.country !== undefined) payload.country = data.country ? String(data.country).trim() : null;
    if (data.region !== undefined) payload.region = data.region ? String(data.region).trim() : null;

    const res = await axiosInstance.post("/contacts", payload);
    return res.data;
  });
}

/**
 * Update an existing contact: PATCH /api/v1/contacts/{contact_id}
 * Sends ONLY the modified/provided fields in the payload.
 * Schema (all optional in PATCH):
 * {
 *   company?: string,
 *   contact_name?: string,
 *   designation?: string,
 *   phone_no_1?: string,
 *   phone_no_2?: string,
 *   email?: string,
 *   country?: string,
 *   region?: string,
 *   is_active?: boolean
 * }
 * @param {string} contactId
 * @param {Object} data
 */
export function updateContact(contactId, data = {}) {
  return withAuthRetry(async () => {
    const payload = {};
    if (data.company !== undefined) payload.company = String(data.company).trim();
    if (data.contact_name !== undefined) payload.contact_name = String(data.contact_name).trim();
    if (data.designation !== undefined) payload.designation = data.designation ? String(data.designation).trim() : null;
    if (data.phone_no_1 !== undefined) payload.phone_no_1 = String(data.phone_no_1).trim();
    if (data.phone_no_2 !== undefined) payload.phone_no_2 = data.phone_no_2 ? String(data.phone_no_2).trim() : null;
    if (data.email !== undefined) payload.email = String(data.email).trim();
    if (data.country !== undefined) payload.country = data.country ? String(data.country).trim() : null;
    if (data.region !== undefined) payload.region = data.region ? String(data.region).trim() : null;
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    const res = await axiosInstance.patch(`/contacts/${encodeURIComponent(contactId)}`, payload);
    return res.data;
  });
}

/**
 * Delete a contact: DELETE /api/v1/contacts/{contact_id}
 * @param {string} contactId
 */
export function deleteContact(contactId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete(`/contacts/${encodeURIComponent(contactId)}`);
    return res.data;
  });
}

/**
 * Bulk delete selected contacts: DELETE /api/v1/contacts/bulk
 * Body payload: { "ids": ["string" | number] }
 * @param {Array<number|string>|{ids: Array<number|string>}} payload
 */
export function bulkDeleteContacts(payload) {
  return withAuthRetry(async () => {
    let idsArray = [];
    if (Array.isArray(payload)) {
      idsArray = payload;
    } else if (payload && Array.isArray(payload.ids)) {
      idsArray = payload.ids;
    } else if (payload && (payload.id || payload.contact_id)) {
      idsArray = [payload.id || payload.contact_id];
    }
    const body = { ids: idsArray };
    const res = await axiosInstance.delete("/contacts/bulk", { data: body });
    return res.data;
  });
}

/**
 * Delete all contacts: DELETE /api/v1/contacts/delete-all
 */
export function deleteAllContacts() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete("/contacts/delete-all");
    return res.data;
  });
}
