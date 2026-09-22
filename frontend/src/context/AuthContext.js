// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import tokenStore from "../api/tokenStore";
import { forceLogout, logoutUser } from "../api/authApi";

const decodeJwt = (t) => {
  try {
    const payload = t?.split(".")?.[1];
    if (!payload) return {};
    const norm = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = norm.padEnd(norm.length + ((4 - (norm.length % 4)) % 4), "=");
    return JSON.parse(window.atob(pad));
  } catch {
    return {};
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(() => tokenStore.getToken());
  const [user, setUserState] = useState(() => {
    try {
      const stored = localStorage.getItem("user_data") || localStorage.getItem("user");
      if (stored) return JSON.parse(stored);
      const tok = tokenStore.getToken();
      if (tok) {
        const payload = decodeJwt(tok);
        if (payload && (payload.sub || payload.email || payload.name)) {
          return {
            email: payload.email || payload.sub || "",
            role: payload.role || payload.roles || "Sales Lead Manager",
            fullName: payload.full_name || payload.name || payload.sub || "User",
            name: payload.full_name || payload.name || payload.sub || "User",
            emp_id: payload.emp_id || payload.leader_id || ""
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  const setToken = (newToken) => {
    setTokenState(newToken || "");
    tokenStore.setToken(newToken || "");
  };

  const setUser = (userData) => {
    setUserState(userData);
    if (userData) {
      localStorage.setItem("user_data", JSON.stringify(userData));
    } else {
      localStorage.removeItem("user_data");
    }
  };

  const logout = async () => {
    tokenStore.markLoggedOut();
    setTokenState("");
    setUserState(null);
    try {
      const msg = await logoutUser();
      if (msg) {
        sessionStorage.setItem("logout_banner_message", msg);
      }
    } catch (err) {
      console.warn("[AuthContext] Logout error:", err);
    } finally {
      setTokenState("");
      setUserState(null);
      tokenStore.clearToken();
      forceLogout();
      try {
        localStorage.removeItem("access_token");
        localStorage.removeItem("access_token_expires_at");
        localStorage.removeItem("user_data");
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("last_sales_dashboard_kpis");
      } catch (_) {}
    }
  };

  useEffect(() => {
    const unsub = tokenStore.subscribe((newToken) => {
      if (tokenStore.isLoggedOut() || !newToken) {
        setTokenState("");
        setUserState(null);
        return;
      }
      setTokenState(newToken);
      try {
        const stored = localStorage.getItem("user_data") || localStorage.getItem("user");
        if (stored) {
          setUserState(JSON.parse(stored));
        } else {
          const payload = decodeJwt(newToken);
          if (payload && (payload.sub || payload.email || payload.name)) {
            setUserState({
              email: payload.email || payload.sub || "",
              role: payload.role || payload.roles || "Sales Lead Manager",
              fullName: payload.full_name || payload.name || payload.sub || "User",
              name: payload.full_name || payload.name || payload.sub || "User",
              emp_id: payload.emp_id || payload.leader_id || ""
            });
          }
        }
      } catch (_) {}
    });

    const handleStorage = () => {
      if (tokenStore.isLoggedOut()) {
        setTokenState("");
        setUserState(null);
        return;
      }
      const currentToken = tokenStore.getToken();
      setTokenState(currentToken || "");
      if (!currentToken) {
        setUserState(null);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      if (unsub) unsub();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        setToken,
        user,
        setUser,
        logout,
        isAuthenticated: Boolean(token),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
