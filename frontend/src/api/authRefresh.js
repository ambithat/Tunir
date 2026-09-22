// src/api/authRefresh.js
import axios from "axios";
import tokenStore from "./tokenStore";




const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

const authRefreshAxios = axios.create({
    baseURL: backendUrl.replace(/\/$/, ""),
    timeout: 10000,
    withCredentials: true,
});




function decodeJwtPayload(token) {
    try {
        const payload = token?.split(".")?.[1];
        if (!payload) return {};
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
        return JSON.parse(window.atob(padded));
    } catch {
        return {};
    }
}

export function getAccessTokenExpiresAt(token = tokenStore.getToken()) {
    // 1. Decode JWT payload `exp` directly from the token string if available
    if (token) {
        const jwtExp = decodeJwtPayload(token)?.exp;
        if (Number.isFinite(Number(jwtExp)) && Number(jwtExp) > 0) {
            return Number(jwtExp) * 1000;
        }
    }

    // 2. Fallback to stored timestamp in localStorage
    const raw = localStorage.getItem("access_token_expires_at");
    const storedExpiresAt = raw ? Number(raw) : NaN;
    if (Number.isFinite(storedExpiresAt) && storedExpiresAt > 0) {
        return storedExpiresAt;
    }

    return NaN;
}

export function isAccessTokenExpiredSoon(leewayMs = 10000) {
    const expiresAt = getAccessTokenExpiresAt();
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
    return Date.now() >= expiresAt - leewayMs;
}

export function clearAuthStorage() {
    tokenStore.clearToken();
    try {
        localStorage.removeItem("user_data");
        localStorage.removeItem("access_token");
        localStorage.removeItem("access_token_expires_at");
        localStorage.removeItem("last_sales_dashboard_kpis");
    } catch (_) { }
}

export async function ensureFreshAccessToken() {
    if (tokenStore.isLoggedOut() || !tokenStore.getToken()) return "";
    if (isAccessTokenExpiredSoon()) {
        return refreshOnce();
    }
    return tokenStore.getToken();
}

// Refresh token is stored by the backend as an HttpOnly cookie. The browser
// sends it here because all API calls go through /api and use withCredentials.
export async function refreshAccessToken() {
    if (tokenStore.isLoggedOut()) {
        throw new Error("User is logged out; aborting token refresh.");
    }

    const res = await authRefreshAxios.post(
        "/api/v1/auth/refresh",
        {},
        {
            withCredentials: true,
            timeout: 10000,
        }
    );

    if (tokenStore.isLoggedOut()) {
        throw new Error("User logged out during token refresh.");
    }

    const newToken =
        res.data?.access_token ||
        res.data?.token ||
        res.data?.data?.access_token ||
        res.data?.data?.token;

    if (!newToken) throw new Error("No access token returned from /api/v1/auth/refresh endpoint.");

    tokenStore.setToken(newToken);
    const expiresIn = res.data?.expires_in || res.data?.data?.expires_in;
    if (expiresIn) {
        localStorage.setItem(
            "access_token_expires_at",
            String(Date.now() + Number(expiresIn) * 1000)
        );
    } else {
        const expiresAt = getAccessTokenExpiresAt(newToken);
        if (Number.isFinite(expiresAt) && expiresAt > 0) {
            localStorage.setItem("access_token_expires_at", String(expiresAt));
        }
    }
    return newToken;
}

let _refreshPromise = null;
export function refreshOnce() {
    if (!_refreshPromise) {
        _refreshPromise = refreshAccessToken().finally(() => {
            _refreshPromise = null;
        });
    }
    return _refreshPromise;
}
