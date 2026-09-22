// src/api/notificationApi.js
import axiosInstance from './axiosInstance';
import { withAuthRetry } from './authApi';

/**
 * Fetch all sales notifications: GET /api/v1/sales/notifications/all
 * Schema:
 * {
 *   status: "success",
 *   count: number,
 *   data: [
 *     {
 *       notification_id: string,
 *       user_id: string,
 *       first_name: string,
 *       last_name: string,
 *       email: string,
 *       designation: string,
 *       target_id: string,
 *       notification_type: string,
 *       message: string,
 *       is_viewed: boolean,
 *       created_at: string,
 *       last_refreshed_at: string
 *     }
 *   ]
 * }
 */
export function getAllNotifications() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get('/sales/notifications/unread');
    return res.data;
  });
}

/**
 * Mark notification as viewed/read: PUT /api/v1/sales/notifications/view
 * Query Parameters:
 *   - notification_id: string (e.g. "NTF-0010")
 *   - status_flag: boolean (e.g. true)
 */
export function markNotificationViewed(notificationId, statusFlag = true) {
  return withAuthRetry(async () => {
    const params = {
      notification_id: notificationId,
      status_flag: statusFlag,
    };
    // Direct PUT request as required by the backend API
    const res = await axiosInstance.put('/sales/notifications/view', null, { params });
    return res.data;
  });
}

// /api/v1/sales/notifications/mark-all-read


export function markAllNotificationAsRead() {
  return withAuthRetry(async () => {
    // Direct PUT request as required by the backend API
    const res = await axiosInstance.put('/sales/notifications/mark-all-read');
    return res.data;
  });
}

/**
 * Call notification logout API: POST /api/v1/notifications/logout
 */
export function logoutNotificationApi() {
  return withAuthRetry(async () => {
    const res = await axiosInstance.post('/notifications/logout');
    return res.data;
  });
}