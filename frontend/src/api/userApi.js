// src/api/userApi.js
import axiosInstance from "./axiosInstance";
import { withAuthRetry } from "./authApi";
import { getLeaders, createLeader, updateLeader, deleteLeader, bulkDeleteLeaders } from "./leaderApi";

export { getLeaders, createLeader, updateLeader, deleteLeader, bulkDeleteLeaders };

// Backward-compatibility alias
export function getEmployees(params = {}) {
  return getLeaders(params);
}

export function createEmployee(data) {
  return createLeader(data);
}

export function deleteEmployee(employeeId) {
  return deleteLeader(employeeId);
}

// GET Current User Profile / Users List
export function getUsers(params = {}) {
  return withAuthRetry(async () => {
    const res = await axiosInstance.get("/users", { params });
    return res.data;
  });
}
