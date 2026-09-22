// src/api/leadApi.js
import axiosInstance from "./axiosInstance";
import { withAuthRetry } from "./authApi";

/**
 * Fetch paginated leads from GET /api/v1/leads
 * @param {Object} params - { limit, cursor, is_active, search, status_id, stage_id }
 */
export function getLeads(params = {}) {
  return withAuthRetry(async () => {
    const cleanParams = {};
    if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
    if (params.cursor !== undefined && params.cursor !== null) cleanParams.cursor = params.cursor;
    if (params.is_active !== undefined && params.is_active !== null) cleanParams.is_active = params.is_active;
    if (params.search && String(params.search).trim()) cleanParams.search = String(params.search).trim();
    if (params.status_id !== undefined && params.status_id !== null && params.status_id !== 'all') {
      cleanParams.status_id = parseInt(params.status_id, 10);
    }
    if (params.stage_id !== undefined && params.stage_id !== null && params.stage_id !== 'all') {
      cleanParams.stage_id = parseInt(params.stage_id, 10);
    }
    if (params.lead_owner_id !== undefined && params.lead_owner_id !== null && params.lead_owner_id !== 'all') {
      cleanParams.lead_owner_id = String(params.lead_owner_id).trim();
    }
    if (params.contact_id !== undefined && params.contact_id !== null && params.contact_id !== 'all') {
      cleanParams.contact_id = String(params.contact_id).trim();
    }
    if (params.contact_name !== undefined && params.contact_name !== null && params.contact_name !== 'all') {
      cleanParams.contact_name = String(params.contact_name).trim();
    }
    if (params.created_from !== undefined && params.created_from !== null) {
      cleanParams.created_from = params.created_from;
    }
    if (params.created_to !== undefined && params.created_to !== null) {
      cleanParams.created_to = params.created_to;
    }
    if (params.from_date !== undefined && params.from_date !== null) {
      cleanParams.from_date = params.from_date;
    }
    if (params.to_date !== undefined && params.to_date !== null) {
      cleanParams.to_date = params.to_date;
    }
    if (params.start_date !== undefined && params.start_date !== null) {
      cleanParams.start_date = params.start_date;
    }
    if (params.end_date !== undefined && params.end_date !== null) {
      cleanParams.end_date = params.end_date;
    }

    // Force live fetch from backend if date parameters exist or skipCache is requested
    const shouldSkipCache = Boolean(params.skipCache || params.from_date || params.to_date || params.start_date || params.end_date || params.created_from || params.created_to);

    const res = await axiosInstance.get("/leads", {
      params: cleanParams,
      skipCache: shouldSkipCache,
      headers: shouldSkipCache ? { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" } : {}
    });
    return res.data;
  });
}

/**
 * Fetch lead dropdown list: GET /api/v1/leads/dropdown
 * Response array schema:
 * [
 *   {
 *     "lead_id": "LD-0138",
 *     "company": "Tardid Technology",
 *     "contact_name": "aarohi",
 *     "email": "nidhiaarohi123@gmail.com",
 *     "lead_owner_id": "LDR-0022",
 *     "is_active": true
 *   }
 * ]
 */
export function getLeadsDropdown() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get("/leads/dropdown", {
      skipCache: true,
      headers: { "Cache-Control": "no-cache, no-store", "Pragma": "no-cache" }
    });
    return res.data;
  });
}

/**
 * Create a new lead: POST /api/v1/leads
 * Schema:
 * {
 *   lead_owner_id?: string,
 *   lead_source?: string,
 *   company: string,
 *   contact_name?: string,
 *   designation?: string,
 *   phone_no?: string,
 *   email?: string,
 *   country?: string,
 *   project_value?: number,
 *   expected_closure?: string, // YYYY-MM-DD
 *   is_active?: boolean,
 *   products?: ProductRegisterCreate[]
 * }
 * @param {Object} data
 */
export function createLead(data) {
  return withAuthRetry(async () => {
    const payload = {
      company: String(data.company || "").trim(),
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
      products: Array.isArray(data.products)
        ? data.products.map(p => ({
            product_id: parseInt(p.product_id, 10) || 1,
            quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
            status_id: parseInt(p.status_id, 10) || 1,
            stage_id: parseInt(p.stage_id, 10) || 1,
            project_value: p.project_value !== undefined && p.project_value !== null && !isNaN(Number(p.project_value)) ? Number(p.project_value) : (Number(data.project_value) || 0),
            expected_closure: p.expected_closure || data.expected_closure || null,
            proposal_type: p.proposal_type ? String(p.proposal_type).trim() : null,
            proposal_document_url: p.proposal_document_url ? String(p.proposal_document_url).trim() : null,
            lost_reason: p.lost_reason ? String(p.lost_reason).trim() : null,
            is_active: p.is_active !== undefined ? Boolean(p.is_active) : true
          }))
        : []
    };

    if (data.lead_owner_id && String(data.lead_owner_id).trim()) payload.lead_owner_id = String(data.lead_owner_id).trim();
    if (data.lead_source && String(data.lead_source).trim()) payload.lead_source = String(data.lead_source).trim();
    if (data.contact_name && String(data.contact_name).trim()) payload.contact_name = String(data.contact_name).trim();
    if (data.designation && String(data.designation).trim()) payload.designation = String(data.designation).trim();
    if (data.phone_no && String(data.phone_no).trim()) payload.phone_no = String(data.phone_no).trim();
    if (data.phone_no_2 && String(data.phone_no_2).trim()) payload.phone_no_2 = String(data.phone_no_2).trim();
    if (data.email && String(data.email).trim()) payload.email = String(data.email).trim();
    payload.country = data.country && String(data.country).trim() ? String(data.country).trim() : 'India';
    if (data.region && String(data.region).trim()) payload.region = String(data.region).trim();

    const res = await axiosInstance.post("/leads", payload);
    return res.data;
  });
}

/**
 * Update an existing lead: PATCH /api/v1/leads/{lead_id}
 * Sends ONLY the changed/provided fields in the payload.
 * Schema (all optional in PATCH):
 * {
 *   lead_owner_id?: string,
 *   lead_source?: string,
 *   company?: string,
 *   contact_name?: string,
 *   designation?: string,
 *   phone_no?: string,
 *   phone_no_2?: string,
 *   email?: string,
 *   country?: string,
 *   region?: string,
 *   project_value?: number,
 *   expected_closure?: string, // YYYY-MM-DD
 *   is_active?: boolean,
 *   products?: [
 *     {
 *       product_register_id?: string, // If present, updates existing product; if omitted, creates new product
 *       product_id: number,           // MUST ALWAYS be passed by default
 *       quantity?: number,
 *       status_id?: number,
 *       stage_id?: number,
 *       project_value?: number,
 *       expected_closure?: string,
 *       proposal_type?: string,
 *       proposal_document_url?: string,
 *       lost_reason?: string,
 *       won?: boolean,
 *       is_active?: boolean
 *     }
 *   ]
 * }
 * @param {number|string} leadId
 * @param {Object} data
 */
export function updateLead(leadId, data = {}) {
  return withAuthRetry(async () => {
    const payload = {};
    if (data.lead_owner_id !== undefined && data.lead_owner_id !== null) payload.lead_owner_id = String(data.lead_owner_id).trim();
    if (data.lead_source !== undefined && data.lead_source !== null) payload.lead_source = String(data.lead_source).trim();
    if (data.company !== undefined && data.company !== null) payload.company = String(data.company).trim();
    if (data.contact_name !== undefined && data.contact_name !== null) payload.contact_name = String(data.contact_name).trim();
    if (data.designation !== undefined && data.designation !== null) payload.designation = String(data.designation).trim();
    if (data.phone_no !== undefined && data.phone_no !== null) payload.phone_no = String(data.phone_no).trim();
    if (data.phone_no_2 !== undefined && data.phone_no_2 !== null) payload.phone_no_2 = String(data.phone_no_2).trim();
    if (data.email !== undefined && data.email !== null) payload.email = String(data.email).trim();
    if (data.country !== undefined) payload.country = data.country ? String(data.country).trim() : 'India';
    if (data.region !== undefined && data.region !== null) payload.region = String(data.region).trim();
    if (data.is_active !== undefined) payload.is_active = Boolean(data.is_active);

    if (Array.isArray(data.products)) {
      payload.products = data.products.map(p => {
        const parsedStageId = p.stage_id !== undefined && p.stage_id !== null && p.stage_id !== '' ? parseInt(p.stage_id, 10) : 1;
        const parsedStatusId = p.status_id !== undefined && p.status_id !== null && p.status_id !== '' ? parseInt(p.status_id, 10) : 1;

        const item = {
          product_id: parseInt(p.product_id, 10) || 1,
          quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
          status_id: parsedStatusId,
          stage_id: parsedStageId,
          project_value: p.project_value !== undefined && p.project_value !== null && p.project_value !== '' && !isNaN(Number(p.project_value)) ? Number(p.project_value) : 0,
          expected_closure: p.expected_closure ? String(p.expected_closure).slice(0, 10) : null,
          proposal_type: p.proposal_type ? String(p.proposal_type).trim() : null,
          proposal_document_url: p.proposal_document_url ? String(p.proposal_document_url).trim() : null,
          lost_reason: p.lost_reason ? String(p.lost_reason).trim() : null,
          is_active: p.is_active !== undefined ? Boolean(p.is_active) : true
        };

        if (p.product_register_id !== undefined && p.product_register_id !== null && String(p.product_register_id).trim() !== '') {
          item.product_register_id = String(p.product_register_id).trim();
        }

        return item;
      });
    }

    const res = await axiosInstance.patch(`/leads/${encodeURIComponent(leadId)}`, payload);
    return res.data;
  });
}

/**
 * Delete a lead: DELETE /api/v1/leads/{lead_id}
 * @param {number|string} leadId
 */
export function deleteLead(leadId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete(`/leads/${encodeURIComponent(leadId)}`);
    return res.data;
  });
}

/**
 * Bulk delete selected leads: DELETE /api/v1/leads/bulk
 * Body payload: { "ids": ["string" | number] }
 * @param {Array<number|string>|{ids: Array<number|string>}} payload
 */
export function bulkDeleteLeads(payload) {
  return withAuthRetry(async () => {
    let idsArray = [];
    if (Array.isArray(payload)) {
      idsArray = payload;
    } else if (payload && Array.isArray(payload.ids)) {
      idsArray = payload.ids;
    } else if (payload && (payload.id || payload.lead_id)) {
      idsArray = [payload.id || payload.lead_id];
    }
    const body = { ids: idsArray };
    const res = await axiosInstance.delete("/leads/bulk", { data: body });
    return res.data;
  });
}

/**
 * Delete all leads: DELETE /api/v1/leads/delete-all
 */
export function deleteAllLeads() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete("/leads/delete-all");
    return res.data;
  });
}

/**
 * Get products assigned to a lead: GET /api/v1/leads/{lead_id}/products
 * @param {number|string} leadId
 */
export function getLeadProducts(leadId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get(`/leads/${encodeURIComponent(leadId)}/products`);
    return res.data;
  });
}

/**
 * Add a product to a lead via single unified PATCH /api/v1/leads/{lead_id} API
 * @param {number|string} leadId
 * @param {Object} data
 */
export function addLeadProduct(leadId, data = {}) {
  const pId = parseInt(data.product_id, 10) || 1;
  const stageId = data.stage_id !== undefined && data.stage_id !== null && data.stage_id !== '' && parseInt(data.stage_id, 10) > 0 ? parseInt(data.stage_id, 10) : null;
  const statusId = data.status_id !== undefined && data.status_id !== null && data.status_id !== '' && parseInt(data.status_id, 10) > 0 ? parseInt(data.status_id, 10) : 1;
  const newProd = {
    product_id: pId,
    quantity: Math.max(1, parseInt(data.quantity, 10) || 1),
    status_id: statusId,
    stage_id: stageId,
    won: data.won !== undefined && data.won !== null ? (typeof data.won === 'number' ? data.won : (Number(data.won) || 0)) : 0,
    project_value: data.project_value !== undefined && data.project_value !== null && !isNaN(Number(data.project_value)) ? Number(data.project_value) : 0,
    expected_closure: data.expected_closure || null,
    proposal_type: data.proposal_type ? String(data.proposal_type).trim() : null,
    proposal_document_url: data.proposal_document_url ? String(data.proposal_document_url).trim() : null,
    lost_reason: data.lost_reason ? String(data.lost_reason).trim() : null,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
  };
  return updateLead(leadId, {
    products: [newProd]
  });
}

/**
 * Update a product in a lead via single unified PATCH /api/v1/leads/{lead_id} API
 * @param {number|string} leadId
 * @param {number|string} productRegisterId
 * @param {Object} data
 */
export function updateLeadProduct(leadId, productRegisterId, data = {}) {
  const pId = parseInt(data.product_id, 10) || 1;
  const stageId = data.stage_id !== undefined && data.stage_id !== null && data.stage_id !== '' && parseInt(data.stage_id, 10) > 0 ? parseInt(data.stage_id, 10) : null;
  const statusId = data.status_id !== undefined && data.status_id !== null && data.status_id !== '' && parseInt(data.status_id, 10) > 0 ? parseInt(data.status_id, 10) : 1;
  const productItem = {
    product_id: pId,
    quantity: Math.max(1, parseInt(data.quantity, 10) || 1),
    status_id: statusId,
    stage_id: stageId,
    won: data.won !== undefined && data.won !== null ? (typeof data.won === 'number' ? data.won : (Number(data.won) || 0)) : 0,
    project_value: data.project_value !== undefined && data.project_value !== null && !isNaN(Number(data.project_value)) ? Number(data.project_value) : 0,
    expected_closure: data.expected_closure || null,
    proposal_type: data.proposal_type ? String(data.proposal_type).trim() : null,
    proposal_document_url: data.proposal_document_url ? String(data.proposal_document_url).trim() : null,
    lost_reason: data.lost_reason ? String(data.lost_reason).trim() : null,
    is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
  };
  if (productRegisterId) {
    productItem.product_register_id = String(productRegisterId).trim();
  }
  return updateLead(leadId, {
    products: [productItem]
  });
}

/**
 * Delete a product from a lead: DELETE /api/v1/leads/{lead_id}/products/{product_register_id}
 * @param {number|string} leadId
 * @param {number|string} productRegisterId
 */
export function deleteLeadProduct(leadId, productRegisterId) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.delete(
      `/leads/${encodeURIComponent(leadId)}/products/${encodeURIComponent(productRegisterId)}`
    );
    return res.data;
  });
}

/**
 * Upload a proposal document: POST /api/v1/leads/proposal/upload
 * multipart/form-data:
 * - file: binary file (File object)
 * - proposal_type: string ('Technical Proposal Sent' or 'Techno Commercial Proposal Sent')
 * - lead_id: string (optional)
 * - product_register_id: string (optional)
 * @param {Object} data - { file, proposal_type, lead_id, product_register_id }
 */
export function uploadLeadProposal(data = {}) {
  return withAuthRetry(async () => {
    const formData = new FormData();
    if (data.file) {
      formData.append('file', data.file);
    }
    if (data.proposal_type) {
      formData.append('proposal_type', data.proposal_type);
    }
    if (data.lead_id !== undefined && data.lead_id !== null) {
      formData.append('lead_id', String(data.lead_id).trim());
    }
    if (data.product_register_id !== undefined && data.product_register_id !== null) {
      formData.append('product_register_id', String(data.product_register_id).trim());
    }

    const res = await axiosInstance.post('/leads/proposal/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  });
}

