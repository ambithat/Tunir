// src/api/tokenStore.js

let accessToken = localStorage.getItem("access_token") || "";
let isLoggedOut = localStorage.getItem("is_logged_out") === "true";

const subscribers = new Set();

const notify = () => {
  subscribers.forEach((callback) => {
    try {
      callback(accessToken);
    } catch (err) {
      console.error("[tokenStore] subscriber error:", err);
    }
  });
};

const tokenStore = {
  isLoggedOut: () => isLoggedOut,
  getToken: () => {
    if (isLoggedOut) return "";
    return accessToken || localStorage.getItem("access_token") || "";
  },
  setToken: (token) => {
    const nextToken = token || "";
    if (nextToken) {
      isLoggedOut = false;
      try {
        localStorage.removeItem("is_logged_out");
      } catch (_) {}
    }
    if (nextToken === accessToken && !isLoggedOut) return;

    accessToken = nextToken;
    if (nextToken) {
      localStorage.setItem("access_token", nextToken);
    } else {
      localStorage.removeItem("access_token");
    }
    notify();
  },
  clearToken: () => {
    accessToken = "";
    isLoggedOut = true;
    try {
      localStorage.setItem("is_logged_out", "true");
      localStorage.removeItem("access_token");
      localStorage.removeItem("access_token_expires_at");
      localStorage.removeItem("user_data");
    } catch (_) {}
    notify();
  },
  markLoggedOut: () => {
    accessToken = "";
    isLoggedOut = true;
    try {
      localStorage.setItem("is_logged_out", "true");
      localStorage.removeItem("access_token");
      localStorage.removeItem("access_token_expires_at");
      localStorage.removeItem("user_data");
    } catch (_) {}
    notify();
  },
  subscribe: (callback) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
};

export default tokenStore;
