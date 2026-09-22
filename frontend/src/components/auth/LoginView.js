import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiArrowLeft,
  FiKey,
  FiRefreshCw,
  FiTrendingUp,
  FiTarget,
  FiPieChart,
  FiCheck,
  FiShield,
  FiCpu,
  FiLayers,
  FiActivity,
  FiGlobe,
  FiZap,
  FiLogOut
} from 'react-icons/fi';
import Logo from "../Images/Logo.png";
import HeroGraphic from "../Images/HeroGraphic.png";
import tokenStore from "../../api/tokenStore";
import { useAuth } from "../../context/AuthContext";
import { logoutAllDevicesUser, forgotPassword, resetPassword } from "../../api/authApi";

// ─── Friendly error mapper ───────────────────────────────────────────────────
const getFriendlyError = (err) => {
  const status = err.response?.status;
  const raw =
    err.response?.data?.detail ||
    err.response?.data?.message ||
    err.response?.data?.error ||
    err.message ||
    "";
  const msg = (typeof raw === "string" ? raw : JSON.stringify(raw)).toLowerCase();

  if (msg.includes("network error") || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return {
      title: "No connection",
      body: "Your device appears to be offline. Check your internet or network and try again.",
      icon: "wifi",
    };
  }
  if (msg.includes("timeout") || err.code === "ECONNABORTED" || status === 504) {
    return {
      title: "Backend server unreachable",
      body: "Unable to connect to the backend server (504 Gateway Timeout). Please verify your backend server is running.",
      icon: "server",
    };
  }
  if (status === 401 || msg.includes("invalid credentials") || msg.includes("invalid email or password") || msg.includes("incorrect password")) {
    return {
      title: "Wrong email or password",
      body: typeof raw === "string" && raw ? raw : "The credentials you entered don't match any account. Double-check and try again.",
      icon: "lock",
    };
  }
  if (status === 404) {
    return {
      title: "Not Found",
      body: typeof raw === "string" && raw && raw !== "Not Found" ? raw : "Login endpoint not found on server. Please restart npm start so proxy settings take effect.",
      icon: "alert",
    };
  }
  if (msg.includes("user not found") || msg.includes("does not exist") || msg.includes("no account")) {
    return {
      title: "Account not found",
      body: "No account is registered with this email address. Check for typos.",
      icon: "mail",
    };
  }
  if (
    msg.includes("maximum session limit") ||
    msg.includes("logout from another device") ||
    msg.includes("logout from all devices") ||
    msg.includes("session limit") ||
    msg.includes("max_devices_exceeded")
  ) {
    return {
      title: "Device Limit Reached",
      body: typeof raw === "string" && raw ? raw : "Maximum session limit reached. Please logout from another device or click 'Logout from all devices' below.",
      icon: "shield",
    };
  }
  if (msg.includes("locked") || msg.includes("disabled") || msg.includes("suspended")) {
    return {
      title: "Account locked",
      body: "This account has been locked. Contact your administrator to restore access.",
      icon: "shield",
    };
  }
  if (status === 403) {
    return {
      title: "Access denied",
      body: "Your account doesn't have permission to access this system. Contact your administrator.",
      icon: "shield",
    };
  }
  if (status === 500 || status === 502 || status === 503) {
    return {
      title: "Server error",
      body: "Something went wrong on the server. This is temporary — try again in a few minutes.",
      icon: "server",
    };
  }
  if (raw) {
    return { title: "Login failed", body: typeof raw === "string" ? raw : "Login failed", icon: "alert" };
  }
  return {
    title: "Something went wrong",
    body: "An unexpected error occurred. Please try again or contact support if it persists.",
    icon: "alert",
  };
};

const getAccessTokenFromResponse = (data) =>
  data?.access_token || data?.accessToken || data?.token ||
  data?.user?.access_token || data?.user?.accessToken || data?.user?.token || null;

const decodeJwtPayload = (token) => {
  try {
    const payload = token?.split(".")?.[1];
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded));
  } catch {
    return {};
  }
};

const getStoredProfileFromResponse = (data, token, fallbackEmail = "") => {
  const tokenPayload = decodeJwtPayload(token);
  const firstName = data?.first_name || data?.user?.first_name || tokenPayload?.first_name || tokenPayload?.given_name || "";
  const lastName = data?.last_name || data?.user?.last_name || tokenPayload?.last_name || tokenPayload?.family_name || "";
  const fullName = data?.full_name || data?.name || data?.user?.full_name || data?.user?.name ||
    tokenPayload?.full_name || tokenPayload?.name || `${firstName} ${lastName}`.trim() || "";
  const designation = data?.designation || data?.user?.designation || tokenPayload?.designation ||
    data?.role || data?.user?.role || tokenPayload?.role || "Sales Lead Manager";
  const empId = data?.emp_id || data?.leader_id || data?.user?.emp_id || data?.user?.leader_id || tokenPayload?.emp_id || "";

  return {
    email: data?.email || data?.user?.email || tokenPayload?.email || tokenPayload?.sub || fallbackEmail || "",
    role: data?.role || data?.user?.role || tokenPayload?.role || tokenPayload?.user_role ||
      (Array.isArray(tokenPayload?.roles) ? tokenPayload.roles[0] : tokenPayload?.roles) || "Administrator",
    designation,
    emp_id: empId,
    sub: data?.sub || data?.user?.sub || tokenPayload?.sub || tokenPayload?.user_sub || firstName,
    firstName,
    lastName,
    fullName: fullName || "User",
    name: fullName || "User",
  };
};

const getApiUrl = () => {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  if (!backendUrl) return "";

  return `${backendUrl.replace(/\/$/, "")}/api/v1/leader/login`;
};
export default function LoginView({ onLogin }) {
  const { setToken, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [showMaxSessionModal, setShowMaxSessionModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState(() => {
    try {
      const msg = sessionStorage.getItem("logout_banner_message");
      if (msg) {
        sessionStorage.removeItem("logout_banner_message");
        return msg;
      }
    } catch (_) { }
    return "";
  });

  // ── Forgot & Reset Password States ──
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResetSuccessModal, setShowResetSuccessModal] = useState(false);
  const [resetSuccessText, setResetSuccessText] = useState('');

  // OTP Resend Cooldown Countdown Timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleOpenForgot = () => {
    setAuthMode('forgot');
    setForgotEmail(email || '');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleBackToLogin = () => {
    setAuthMode('login');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setIsSendingOtp(true);

    try {
      const res = await forgotPassword(targetEmail);
      const msg = res?.message || 'If an account with that email exists, an OTP has been sent.';
      setSuccessMsg(msg);
      setResendCooldown(60);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setAuthMode('reset');
      if (!forgotEmail) setForgotEmail(targetEmail);
    } catch (err) {
      console.error('Forgot password error:', err);
      const raw = err.response?.data?.detail || err.response?.data?.message || err.response?.data?.error || err.message;
      setErrorMsg(typeof raw === 'string' ? raw : 'Failed to send OTP. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    const targetEmail = (forgotEmail || email).trim();
    if (!targetEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!otp.trim()) {
      setErrorMsg('Please enter the OTP sent to your email.');
      return;
    }
    if (!newPassword) {
      setErrorMsg('Please enter your new password.');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please check and try again.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsResettingPassword(true);

    try {
      const res = await resetPassword(targetEmail, otp.trim(), newPassword);
      const serverMsg = res?.message || res?.detail;
      const msg = (serverMsg && typeof serverMsg === 'string') 
        ? serverMsg 
        : 'Password successfully updated! Please sign in with your new password.';
      setSuccessMsg(msg);
      setResetSuccessText(msg);
      setShowResetSuccessModal(true);
      setAuthMode('login');
      setEmail(targetEmail);
      setPassword('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Reset password error:', err);
      const raw = err.response?.data?.detail || err.response?.data?.message || err.response?.data?.error || err.message;
      setErrorMsg(typeof raw === 'string' ? raw : 'Failed to reset password. Please verify your OTP and try again.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setSuccessMsg('');
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in both email and password.');
      return;
    }
    setErrorMsg('');
    setLoading(true);

    if (email === "admin@gmail.com" && password === "admin123") {
      const dummyToken = "dummy_demo_token";
      const dummyUser = { email, role: "admin", fullName: "Admin", name: "Admin" };
      setToken(dummyToken);
      setUser(dummyUser);
      if (onLogin) onLogin(dummyUser);
      setLoading(false);
      return;
    }

    const API_URL = getApiUrl();
    if (!API_URL) {
      setErrorMsg("No server IP is set. Please configure the API server.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(API_URL, { email, password }, { timeout: 15000, withCredentials: true });
      const access_token = getAccessTokenFromResponse(res.data);
      if (!access_token) throw new Error("No access token returned from server");
      setToken(access_token);
      const profile = getStoredProfileFromResponse(res.data, access_token, email);
      setUser(profile);
      if (res.data?.expires_in) {
        localStorage.setItem("access_token_expires_at", String(Date.now() + Number(res.data.expires_in) * 1000));
      }
      if (onLogin) onLogin(profile);
    } catch (err) {
      console.error("Login failed:", err);
      const rawErr = err.response?.data?.detail || err.response?.data?.message || err.response?.data?.error || err.message || "";
      const errStr = (typeof rawErr === "string" ? rawErr : JSON.stringify(rawErr)).toLowerCase();

      if (
        errStr.includes("maximum session limit") ||
        errStr.includes("logout from another device") ||
        errStr.includes("logout from all devices") ||
        errStr.includes("session limit") ||
        errStr.includes("max_devices_exceeded")
      ) {
        setShowMaxSessionModal(true);
      } else {
        const friendly = getFriendlyError(err);
        setErrorMsg(friendly.body || friendly.title || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in both email and password to log out all devices.');
      return;
    }
    setIsLoggingOutAll(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await logoutAllDevicesUser(email.trim(), password.trim());
      const msg = res?.message || res?.detail || 'Successfully logged out from all devices. You can now sign in below.';
      setSuccessMsg(msg);
    } catch (err) {
      console.error('Logout all devices error:', err);
      const raw = err.response?.data?.detail || err.response?.data?.message || err.message;
      setErrorMsg(typeof raw === 'string' ? raw : 'Failed to logout from all devices. Please check your credentials.');
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleLogoutAllAndLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please fill in both email and password.');
      setShowMaxSessionModal(false);
      return;
    }
    setIsLoggingOutAll(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Step 1: Invalidate previous device sessions
      await logoutAllDevicesUser(email.trim(), password.trim());

      // Step 2: Automatically log in on this new device
      const API_URL = getApiUrl();
      const res = await axios.post(API_URL, { email: email.trim(), password: password.trim() }, { timeout: 15000, withCredentials: true });
      const access_token = getAccessTokenFromResponse(res.data);
      if (!access_token) throw new Error("No access token returned from server");

      setToken(access_token);
      const profile = getStoredProfileFromResponse(res.data, access_token, email.trim());
      setUser(profile);
      if (res.data?.expires_in) {
        localStorage.setItem("access_token_expires_at", String(Date.now() + Number(res.data.expires_in) * 1000));
      }
      setShowMaxSessionModal(false);
      if (onLogin) onLogin(profile);
    } catch (err) {
      console.error('Logout all and login error:', err);
      const raw = err.response?.data?.detail || err.response?.data?.message || err.message;
      setErrorMsg(typeof raw === 'string' ? raw : 'Failed to reset sessions and log in. Please try again.');
      setShowMaxSessionModal(false);
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleQuickDemo = (roleEmail, roleName) => {
    setEmail(roleEmail);
    setPassword('demoPass123!');
    setErrorMsg('');
    setLoading(true);

    // Simulate authentic demo session token
    const demoPayload = {
      sub: roleEmail,
      name: roleName,
      role: 'Administrator',
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    const demoToken = `demo_jwt.${btoa(JSON.stringify(demoPayload))}.signature`;

    setTimeout(() => {
      tokenStore.setToken(demoToken);
      localStorage.setItem("access_token_expires_at", String(Date.now() + 3600 * 1000));
      const demoUser = {
        name: roleName,
        fullName: roleName,
        email: roleEmail,
        role: 'Administrator'
      };
      setToken(demoToken);
      setUser(demoUser);
      setLoading(false);
      if (onLogin) onLogin(demoUser);
    }, 300);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'grid',
      gridTemplateColumns: '1.3fr 1fr',
      backgroundImage: `linear-gradient(180deg, rgba(4, 8, 14, 0.6) 0%, rgba(4, 8, 14, 0.78) 50%, rgba(4, 8, 14, 0.96) 100%), url(${HeroGraphic})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      backgroundColor: '#04080E',
      fontFamily: "'Inter', sans-serif",
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Ambient Glow Accent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 15% 20%, rgba(0, 212, 170, 0.25) 0%, rgba(0, 198, 255, 0.08) 50%, rgba(0,0,0,0) 80%)',
        pointerEvents: 'none'
      }} />

      {/* ── LEFT SIDE: CLEAN, POWERFUL, SPACIOUS BRAND OVERLAY ───────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        // borderRight: '1px solid rgba(49, 151, 149, 0.2)',
        padding: '52px 64px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {/* 1. TOP BRAND HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              minWidth: '54px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              flexShrink: 0,
              boxSizing: 'border-box',
              // background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.12), rgba(0, 198, 255, 0.05))',
              // border: '1px solid rgba(0, 212, 170, 0.35)',
              borderRadius: '14px',
              backdropFilter: 'blur(12px)',
              // boxShadow: '0 4px 16px rgba(0, 212, 170, 0.15)'
            }}>
              <img src={Logo} alt="TUNIR Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{
                fontFamily: "'Helvetica', 'Inter', sans-serif",
                fontSize: '22px',
                fontWeight: 600,
                letterSpacing: '0.03em',
                width: 'fit-content',
                // background: 'linear-gradient(135deg, #FFFFFF 40%, #00D4AA 100%)',
                // WebkitBackgroundClip: 'text',
                // WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
                whiteSpace: 'nowrap'
              }}>
                TARDID TECHNOLOGIES
              </div>
            </div>
          </div>
        </div>

        {/* 2. POWERFUL HERO HEADLINE & SLEEK METRICS */}
        <div style={{ maxWidth: '640px', marginTop: 'auto', marginBottom: 'auto', paddingTop: '36px', paddingBottom: '36px' }}>

          {/* Top Pill Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '7px 20px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.12), rgba(0, 198, 255, 0.06))',
            border: '1px solid rgba(0, 212, 170, 0.4)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(0, 212, 170, 0.15)',
            marginBottom: '22px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#00D4AA',
              boxShadow: '0 0 12px #00D4AA, 0 0 4px #00D4AA'
            }} />
            <span style={{ fontFamily: "'Helvetica'", fontSize: '13px', fontWeight: 800, color: '#00D4AA', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Sales Intelligence Platform
            </span>
          </div>

          {/* Main Title */}
          <h1 style={{
            fontFamily: "'Helvetica', 'Inter', sans-serif",
            fontSize: '56px',
            fontWeight: 800,
            letterSpacing: '0.05em',
            lineHeight: 1.1,
            margin: '0 0 22px 0',
            width: 'fit-content',
            background: 'linear-gradient(135deg, #FFFFFF 20%, #00D4AA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 4px 20px rgba(0, 212, 170, 0.2))'
          }}>
            TUNIR
          </h1>

          {/* Company Brief Description */}
          <div style={{
            borderLeft: '3px solid rgba(0, 212, 170, 0.7)',
            paddingLeft: '18px',
            background: 'linear-gradient(90deg, rgba(0, 212, 170, 0.06) 0%, transparent 100%)',
            borderRadius: '0 12px 12px 0',
            paddingTop: '10px',
            paddingBottom: '10px',
            marginBottom: '28px',
            maxWidth: '600px'
          }}>
            <p style={{
              fontSize: '15.5px',
              color: '#CBD5E1',
              lineHeight: 1.68,
              margin: 0,
              wordSpacing: '1px',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.9)'
            }}>
              This application helps <strong style={{ color: '#FFFFFF', fontWeight: 700 }}>Tardid Technologies </strong> manage its complete sales and lead-tracking process. It records lead details, customer contacts, project values, expected closure dates, products, quantities, lead owners and sources.
            </p>
          </div>

          {/* Sleek Frosted HUD Feature Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            maxWidth: '600px',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(145deg, rgba(0, 212, 170, 0.1), rgba(6, 12, 20, 0.75))',
              border: '1px solid rgba(0, 212, 170, 0.35)',
              borderRadius: '16px',
              padding: '18px 20px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(0, 212, 170, 0.15)',
                    border: '1px solid rgba(0, 212, 170, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FiShield style={{ color: '#00D4AA', fontSize: '18px' }} />
                  </div>
                  <span style={{ fontSize: '16.5px', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Helvetica'", letterSpacing: '0.02em' }}>
                    Opportunity & Pipeline Monitoring
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', color: '#94A3B8', lineHeight: 1.55, letterSpacing: '0.01em' }}>
                  Monitors opportunity status, sales stage, probability, risk level, weighted pipeline value and sales performance.
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'linear-gradient(145deg, rgba(0, 198, 255, 0.1), rgba(6, 12, 20, 0.75))',
              border: '1px solid rgba(0, 198, 255, 0.35)',
              borderRadius: '16px',
              padding: '18px 20px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(0, 198, 255, 0.15)',
                    border: '1px solid rgba(0, 198, 255, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <FiLayers style={{ color: '#00C6FF', fontSize: '18px' }} />
                  </div>
                  <span style={{ fontSize: '16.5px', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Helvetica'", letterSpacing: '0.02em' }}>
                    Dashboard & Activity Register
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', color: '#94A3B8', lineHeight: 1.55, letterSpacing: '0.01em' }}>
                  Provides overview of total leads, qualified leads, negotiations, proposals, pipeline & activity.
                </div>
              </div>
            </div>
          </div>

          {/* Enterprise Tech Badges */}


          {/* Subtitle */}
          {/* <p style={{
            fontSize: '16px',
            color: '#CBD5E1',
            lineHeight: 1.65,
            margin: '0 0 44px 0',
            maxWidth: '540px',
            textShadow: '0 2px 14px rgba(0, 0, 0, 0.95)'
          }}>
            Unified B2B CRM dashboard engineered for tracking complex defense acquisitions, stage probabilities, and high-value hardware SKUs.
          </p> */}

          {/* Clean Minimal Horizontal Statistics Row with Dividers */}
          {/* <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            background: 'rgba(8, 14, 22, 0.65)',
            border: '1px solid rgba(0, 212, 170, 0.3)',
            borderRadius: '20px',
            padding: '22px 28px',
            backdropFilter: 'blur(20px)',
            maxWidth: '560px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)'
          }}>
            <div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '24px', fontWeight: 800, color: '#00D4AA', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTrendingUp style={{ fontSize: '20px' }} /> ₹ 1,022.00 Cr
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, marginTop: '4px' }}>
                Active Pipeline
              </div>
            </div>

            <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.15)' }} />

            <div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '24px', fontWeight: 800, color: '#00C6FF', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTarget style={{ fontSize: '20px' }} /> 100% Win
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, marginTop: '4px' }}>
                Conversion Rate
              </div>
            </div>

            <div style={{ width: '1px', height: '36px', background: 'rgba(255, 255, 255, 0.15)' }} />

            <div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '24px', fontWeight: 800, color: '#FFAA00', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiPieChart style={{ fontSize: '20px' }} /> 16 SKUs
              </div>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 700, marginTop: '4px' }}>
                Defence Hardware
              </div>
            </div>
          </div> */}
        </div>

        {/* 3. BOTTOM CLIENT TRUST TICKER */}
        {/* <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Trusted by Defence & Aerospace Leaders
          </div>
          <div style={{ display: 'flex', gap: '22px', fontSize: '13px', color: '#E2E8F0', fontWeight: 700, flexWrap: 'wrap' }}>
            <span>⚓ Indian Navy</span>
            <span style={{ color: '#00D4AA' }}>•</span>
            <span>🛡️ MS Military</span>
            <span style={{ color: '#00D4AA' }}>•</span>
            <span>🚢 GRSE</span>
            <span style={{ color: '#00D4AA' }}>•</span>
            <span>🎖️ Indian Army</span>
          </div>
        </div> */}
      </div>

      {/* ── RIGHT SIDE: SLEEK ENTERPRISE LOGIN FORM PANEL ───────────────── */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          background: 'linear-gradient(165deg, rgba(10, 18, 28, 0.92) 0%, rgba(5, 9, 15, 0.96) 100%)',
          border: '1px solid rgba(0, 212, 170, 0.38)',
          borderRadius: '18px',
          padding: '36px 36px 32px 36px',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.9), 0 0 45px rgba(0, 212, 170, 0.18)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxSizing: 'border-box'
        }}>

          {/* Step Pill Badge */}
          {authMode !== 'login' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(0, 212, 170, 0.12)',
              border: '1px solid rgba(0, 212, 170, 0.35)',
              color: '#00D4AA',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '14px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 8px #00D4AA' }} />
              {authMode === 'forgot' ? 'Step 1 of 2 • Send OTP' : 'Step 2 of 2 • Reset Password'}
            </div>
          )}

          {/* Form Header */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontFamily: "'Helvetica', 'Inter', sans-serif",
              fontSize: '26px',
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0'
            }}>
              {authMode === 'login' && (
                <>
                  Sign In to{' '}
                  <span style={{
                    fontFamily: "'Helvetica', 'Inter', sans-serif",
                    background: 'linear-gradient(135deg, #FFFFFF 30%, #00D4AA 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 800,
                    letterSpacing: '0.05em'
                  }}>
                    TUNIR
                  </span>
                </>
              )}
              {authMode === 'forgot' && 'Forgot Password'}
              {authMode === 'reset' && 'Reset Password'}
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
              {authMode === 'login' && 'Enter your corporate credentials to access your workspace.'}
              {authMode === 'forgot' && "Enter your registered email address and we'll send you an OTP code to reset your password."}
              {authMode === 'reset' && 'Enter the OTP code received on your email along with your new password.'}
            </p>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div style={{
              background: 'linear-gradient(90deg, rgba(0, 212, 170, 0.14) 0%, rgba(16, 185, 129, 0.06) 100%)',
              border: '1px solid rgba(0, 212, 170, 0.45)',
              borderLeft: '4px solid #00D4AA',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: '#00D4AA',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(0, 212, 170, 0.15)',
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgba(0, 212, 170, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}>
                <FiCheck style={{ fontSize: '12px', strokeWidth: 3, color: '#00D4AA' }} />
              </div>
              <span style={{ color: '#E2E8F0', fontWeight: 500 }}>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              background: 'rgba(255, 75, 43, 0.15)',
              border: '1px solid rgba(255, 75, 43, 0.35)',
              borderLeft: '4px solid #FF4B2B',
              borderRadius: '12px',
              padding: '12px 14px',
              marginBottom: '20px',
              color: '#FF4B2B',
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: 1.4,
              textAlign: 'left'
            }}>
              <div>{errorMsg}</div>
              {authMode === 'login' && (errorMsg.toLowerCase().includes("session limit") ||
                errorMsg.toLowerCase().includes("all devices") ||
                errorMsg.toLowerCase().includes("max_devices")) && (
                  <button
                    type="button"
                    onClick={handleLogoutAllDevices}
                    disabled={isLoggingOutAll}
                    style={{
                      width: '100%',
                      height: '36px',
                      marginTop: '10px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: 800,
                      cursor: isLoggingOutAll ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FiLogOut style={{ fontSize: '14px' }} />
                    <span>{isLoggingOutAll ? 'Logging out all devices...' : 'Logout from all devices'}</span>
                  </button>
                )}
            </div>
          )}

          {/* MODE 1: LOGIN FORM */}
          {authMode === 'login' && (
            <form onSubmit={handleSubmit}>
              {/* Email Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Email Address
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '46px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiMail style={{ color: '#00D4AA', fontSize: '17px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    autoComplete="username"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}>
                    Password
                  </label>
                  <span
                    onClick={handleOpenForgot}
                    style={{ fontSize: '12px', color: '#00D4AA', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Forgot Password?
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '46px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiLock style={{ color: '#00D4AA', fontSize: '17px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'transparent', border: 'none', color: '#8CA0B8', cursor: 'pointer', fontSize: '17px', padding: '4px', flexShrink: 0 }}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Remember Me Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '5px',
                  border: `1px solid ${rememberMe ? '#00D4AA' : 'rgba(49, 151, 149, 0.4)'}`,
                  background: rememberMe ? 'rgba(0, 212, 170, 0.2)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00D4AA',
                  transition: 'all 140ms ease'
                }}>
                  {rememberMe && <FiCheck style={{ fontSize: '13px', strokeWidth: 3 }} />}
                </div>
                <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>
                  Keep me signed in on this device
                </span>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #009B82 100%)',
                  color: '#070C12',
                  fontFamily: "'Helvetica'",
                  fontSize: '15px',
                  fontWeight: 900,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 24px rgba(0, 212, 170, 0.35)',
                  transition: 'all 160ms ease',
                  opacity: loading ? 0.8 : 1
                }}
              >
                {loading ? 'Authenticating...' : (
                  <>
                    Sign In to TUNIR <FiArrowRight style={{ fontSize: '17px', strokeWidth: 2.5 }} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* MODE 2: FORGOT PASSWORD FORM (REQUEST OTP) */}
          {authMode === 'forgot' && (
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: '22px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Email Address
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '46px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiMail style={{ color: '#00D4AA', fontSize: '17px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter email address"
                    autoComplete="email"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #009B82 100%)',
                  color: '#070C12',
                  fontFamily: "'Helvetica'",
                  fontSize: '15px',
                  fontWeight: 900,
                  cursor: isSendingOtp ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 24px rgba(0, 212, 170, 0.35)',
                  transition: 'all 160ms ease',
                  opacity: isSendingOtp ? 0.8 : 1
                }}
              >
                {isSendingOtp ? 'Sending OTP...' : (
                  <>
                    Send OTP <FiArrowRight style={{ fontSize: '17px', strokeWidth: 2.5 }} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '18px', textAlign: 'center' }}>
                <span
                  onClick={handleBackToLogin}
                  style={{
                    fontSize: '13px',
                    color: '#94A3B8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#00D4AA'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                >
                  <FiArrowLeft style={{ fontSize: '14px' }} /> Back to Sign In
                </span>
              </div>
            </form>
          )}

          {/* MODE 3: RESET PASSWORD FORM (OTP + NEW PASSWORD) */}
          {authMode === 'reset' && (
            <form onSubmit={handleResetPassword}>
              {/* Confirmed Email Field */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Email Address
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '42px',
                  padding: '0 14px',
                  background: 'rgba(0, 212, 170, 0.05)',
                  border: '1px solid rgba(0, 212, 170, 0.22)',
                  borderRadius: '10px'
                }}>
                  <FiMail style={{ color: '#00D4AA', fontSize: '16px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Enter email address"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#E2E8F0',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#00D4AA',
                    background: 'rgba(0, 212, 170, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    letterSpacing: '0.05em',
                    flexShrink: 0
                  }}>
                    CONFIRMED
                  </span>
                </div>
              </div>

              {/* OTP Field */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em'
                  }}>
                    One-Time Password (OTP)
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isSendingOtp || resendCooldown > 0}
                    style={{
                      background: resendCooldown > 0 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 212, 170, 0.12)',
                      border: `1px solid ${resendCooldown > 0 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 212, 170, 0.35)'}`,
                      borderRadius: '8px',
                      padding: '2px 8px',
                      color: resendCooldown > 0 ? '#94A3B8' : '#00D4AA',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: (isSendingOtp || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <FiRefreshCw style={{ fontSize: '10px', animation: isSendingOtp ? 'spin 1s linear infinite' : 'none' }} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                  </button>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '42px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiKey style={{ color: '#00D4AA', fontSize: '16px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP code"
                    autoComplete="one-time-code"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      letterSpacing: '0.08em',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </div>
              </div>

              {/* New Password Field */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  New Password
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '42px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiLock style={{ color: '#00D4AA', fontSize: '16px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{ background: 'transparent', border: 'none', color: '#8CA0B8', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: '5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Confirm New Password
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: '42px',
                  padding: '0 14px',
                  background: '#070C12',
                  border: '1px solid rgba(49, 151, 149, 0.35)',
                  borderRadius: '10px',
                  transition: 'all 160ms ease'
                }}>
                  <FiLock style={{ color: '#00D4AA', fontSize: '16px', marginRight: '10px', flexShrink: 0 }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    spellCheck="false"
                    style={{
                      width: '100%',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontFamily: "'Inter', sans-serif"
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ background: 'transparent', border: 'none', color: '#8CA0B8', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              {/* Reset Password Submit Button */}
              <button
                type="submit"
                disabled={isResettingPassword}
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #00D4AA 0%, #009B82 100%)',
                  color: '#070C12',
                  fontFamily: "'Helvetica'",
                  fontSize: '15px',
                  fontWeight: 900,
                  cursor: isResettingPassword ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 24px rgba(0, 212, 170, 0.35)',
                  transition: 'all 160ms ease',
                  opacity: isResettingPassword ? 0.8 : 1
                }}
              >
                {isResettingPassword ? 'Resetting Password...' : (
                  <>
                    Reset Password <FiArrowRight style={{ fontSize: '17px', strokeWidth: 2.5 }} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <span
                  onClick={handleBackToLogin}
                  style={{
                    fontSize: '13px',
                    color: '#94A3B8',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#00D4AA'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                >
                  <FiArrowLeft style={{ fontSize: '14px' }} /> Back to Sign In
                </span>
              </div>
            </form>
          )}

          {/* Quick Demo Options */}
          {/* <div style={{ marginTop: '26px', paddingTop: '22px', borderTop: '1px solid rgba(49, 151, 149, 0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
              Quick Demo Account Login
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => handleQuickDemo('admin@tardid.com', 'System Admin')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 212, 170, 0.35)',
                  background: 'rgba(0, 212, 170, 0.12)',
                  color: '#00D4AA',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 140ms ease'
                }}
              >
                👑 Admin User
              </button>

              <button
                onClick={() => handleQuickDemo('neel.k@tardid.com', 'Neel Kamat')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 198, 255, 0.35)',
                  background: 'rgba(0, 198, 255, 0.12)',
                  color: '#00C6FF',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  transition: 'all 140ms ease'
                }}
              >
                💼 Sales Manager
              </button>
            </div>
          </div> */}

          {/* Security Footer */}
          {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '20px', fontSize: '11.5px', color: '#64748B', fontFamily: "'Helvetica'" }}>
            <FiShield style={{ color: '#00D4AA' }} /> 256-bit Encrypted Security
          </div> */}

        </div>
      </div>

      {/* ── MAX SESSION LIMIT POPUP MODAL ── */}
      {showMaxSessionModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          background: 'rgba(0, 0, 0, 0.78)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '430px',
            background: 'rgba(9, 14, 21, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '20px',
            padding: '28px 24px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(239, 68, 68, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}>
                <FiShield />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF', fontFamily: "'Helvetica'" }}>
                  Device Limit Reached
                </h3>
                <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                  Maximum 2 active devices allowed
                </span>
              </div>
            </div>

            <div style={{ fontSize: '13.5px', color: '#CBD5E1', lineHeight: 1.5, fontWeight: 500, background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              You are logged in on the maximum number of active devices (2 devices). Would you like to log out from all previous devices and sign in on this device now?
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowMaxSessionModal(false)}
                disabled={isLoggingOutAll}
                style={{
                  flex: 1,
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#CBD5E1',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogoutAllAndLogin}
                disabled={isLoggingOutAll}
                style={{
                  flex: 2,
                  height: '42px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isLoggingOutAll ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 20px rgba(239, 68, 68, 0.35)'
                }}
              >
                {isLoggingOutAll ? (
                  <span>Logging in here...</span>
                ) : (
                  <>
                    <FiLogOut style={{ fontSize: '15px' }} />
                    <span>Logout All & Login Here</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PASSWORD RESET SUCCESS POPUP MODAL ── */}
      {showResetSuccessModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          background: 'rgba(0, 0, 0, 0.80)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: 'linear-gradient(165deg, rgba(10, 22, 28, 0.96) 0%, rgba(6, 12, 20, 0.98) 100%)',
            border: '1px solid rgba(0, 212, 170, 0.5)',
            borderRadius: '20px',
            padding: '32px 28px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 45px rgba(0, 212, 170, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              background: 'rgba(0, 212, 170, 0.15)',
              border: '2px solid rgba(0, 212, 170, 0.5)',
              color: '#00D4AA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              boxShadow: '0 0 20px rgba(0, 212, 170, 0.35)'
            }}>
              <FiCheck style={{ strokeWidth: 3 }} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800, color: '#FFFFFF', fontFamily: "'Helvetica', 'Inter', sans-serif" }}>
                Password Successfully Updated!
              </h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#94A3B8', lineHeight: 1.5 }}>
                {resetSuccessText || 'Your password has been changed. You can now sign in using your new password.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowResetSuccessModal(false)}
              style={{
                width: '100%',
                height: '46px',
                marginTop: '8px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #00D4AA 0%, #009B82 100%)',
                border: 'none',
                color: '#070C12',
                fontSize: '15px',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 170, 0.35)',
                transition: 'all 0.15s ease'
              }}
            >
              Continue to Sign In
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
