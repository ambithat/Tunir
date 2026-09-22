// src/components/notifications/NotificationDrawer.js
import React, { useEffect, useState, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  FiBell,
  FiX,
  FiCheckCircle,
  FiArrowLeft,
  FiArrowRight,
  FiTrendingUp,
  FiActivity,
  FiUser,
  FiPhone,
  FiBellOff,
  FiExternalLink,
  FiBriefcase,
  FiPackage,
  FiAlertCircle,
  FiClock,
  FiTarget,
  FiUserPlus,
  FiTrash2,
  FiLock
} from "react-icons/fi";
import { getAllNotifications, markAllNotificationAsRead, markNotificationViewed } from "../../api/notificationApi";
import {
  startNotificationSse,
  resetNotificationSse,
  subscribeToSseEvent,
} from "../../api/notificationSse";

const NOTIFICATION_DRAWER_ANIMATION_MS = 300;

let _notifications = [];
let _subscribers = new Set();
let _toastSubscribers = new Set();
let _initialFetchDone = false;
let _notificationSseUnsubscribe = null;

export function _subscribeToast(cb) {
  _toastSubscribers.add(cb);
  return () => _toastSubscribers.delete(cb);
}

export function triggerInAppToast(notification) {
  _toastSubscribers.forEach((cb) => {
    try {
      cb(notification);
    } catch (_) { }
  });
}



let baseDocumentTitle = typeof document !== "undefined" ? document.title : "Star AI Sales CRM";

function updateChromeTabTitle(unreadCount) {
  if (typeof document === "undefined") return;
  if (!baseDocumentTitle || baseDocumentTitle.includes("New Notification")) {
    baseDocumentTitle = "Star AI Sales CRM";
  }
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) 🔔 New Notification${unreadCount > 1 ? 's' : ''} • ${baseDocumentTitle}`;
  } else {
    document.title = baseDocumentTitle;
  }
}

export function requestChromeNotificationPermission() {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (window.Notification.permission === "default") {
      try {
        window.Notification.requestPermission().catch(() => { });
      } catch (_) { }
    }
  }
}

function triggerChromeDesktopNotification(notification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const showNotif = () => {
    try {
      const parsed = parseStructuredNotification(notification?.message, notification);
      const title = parsed?.title || notification?.title || notification?.type_label || "New Sales Notification";
      const body = parsed?.fullText || notification?.message || "You have received a new notification in Star AI Sales CRM.";

      const notif = new window.Notification(`🔔 ${title}`, {
        body: body,
        icon: "/favicon.ico",
        tag: notification?.id || `notif_${Date.now()}`,
        renotify: true
      });

      notif.onclick = () => {
        try {
          window.focus();
          window.dispatchEvent(new CustomEvent("open_notification_drawer"));
        } catch (_) { }
      };
    } catch (err) {
      console.warn("[ChromeNotification] Error displaying desktop notification:", err);
    }
  };

  if (window.Notification.permission === "granted") {
    showNotif();
  } else if (window.Notification.permission !== "denied") {
    try {
      window.Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          showNotif();
        }
      }).catch(() => { });
    } catch (_) { }
  }
}

function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) { }
}

function _broadcast() {
  const snapshot = [..._notifications];
  const unreadCount = snapshot.filter((n) => n.unread || !n.is_viewed).length;
  updateChromeTabTitle(unreadCount);

  _subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (err) {
      console.error("[NotificationDrawer] broadcast error:", err);
    }
  });
}

function _mergeIn(incoming) {
  if (!incoming || !incoming.length) return;
  const existingIds = new Set(_notifications.map((n) => n.id));
  const fresh = incoming.filter((n) => !existingIds.has(n.id));
  if (!fresh.length) return;
  _notifications = [...fresh, ..._notifications].sort((a, b) => b.timestamp - a.timestamp);
  _broadcast();
}

export function _formatNotifTime(isoStringOrTimestamp, nowMs = Date.now()) {
  if (!isoStringOrTimestamp) return "Just now";
  try {
    const d = typeof isoStringOrTimestamp === 'number'
      ? new Date(isoStringOrTimestamp)
      : new Date(isoStringOrTimestamp);
    if (isNaN(d.getTime())) return String(isoStringOrTimestamp);
    const diffSecs = Math.max(0, Math.floor((nowMs - d.getTime()) / 1000));
    if (diffSecs < 60) return "Just now";
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
    if (diffSecs < 172800) return "Yesterday";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return String(isoStringOrTimestamp);
  }
}

// ── Helper to format notification_type into badge & icon ──────────────────
export function getNotificationTypeBadge(type = "STAGE_UPDATE") {
  const norm = String(type || "").trim().toUpperCase();

  if (norm.includes("OVERDUE") || norm.includes("LOCKED")) {
    return {
      label: "Overdue Locked",
      bg: "rgba(239, 68, 68, 0.16)",
      color: "#EF4444",
      border: "rgba(239, 68, 68, 0.4)",
      Icon: FiLock
    };
  }
  if (norm.includes("REMAINDER") || norm.includes("REMINDER")) {
    return {
      label: "Lead Reminder",
      bg: "rgba(245, 158, 11, 0.14)",
      color: "#F59E0B",
      border: "rgba(245, 158, 11, 0.35)",
      Icon: FiClock
    };
  }
  if (norm.includes("LEAD_DELETED") || norm.includes("LEAD DELETED") || norm.includes("DELETE")) {
    return {
      label: "Lead Deleted",
      bg: "rgba(239, 68, 68, 0.14)",
      color: "#EF4444",
      border: "rgba(239, 68, 68, 0.35)",
      Icon: FiTrash2
    };
  }
  if (norm.includes("LEAD_CREATED") || norm.includes("LEAD CREATED") || norm.includes("NEW_LEAD") || norm.includes("CREATE")) {
    return {
      label: "Lead Created",
      bg: "rgba(59, 130, 246, 0.14)",
      color: "#3B82F6",
      border: "rgba(59, 130, 246, 0.35)",
      Icon: FiUserPlus
    };
  }
  if (norm.includes("ACTIVITY")) {
    return {
      label: "Activity Update",
      bg: "rgba(168, 85, 247, 0.14)",
      color: "#A855F7",
      border: "rgba(168, 85, 247, 0.35)",
      Icon: FiActivity
    };
  }
  if (norm.includes("STAGE")) {
    return {
      label: "Stage Update",
      bg: "rgba(0, 212, 170, 0.14)",
      color: "#00D4AA",
      border: "rgba(0, 212, 170, 0.35)",
      Icon: FiTrendingUp
    };
  }

  // Dynamic fallback for any unknown notification_type
  const dynamicLabel = norm
    .split("_")
    .map((w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : ""))
    .join(" ")
    .trim();

  return {
    label: dynamicLabel || "Notification",
    bg: "rgba(0, 212, 170, 0.14)",
    color: "#00D4AA",
    border: "rgba(0, 212, 170, 0.35)",
    Icon: FiBell
  };
}

// ── Map raw API notification → internal shape ──────────────────────────────
export function _mapNotification(n) {
  if (!n || typeof n !== "object") return null;

  const notifId = n.notification_id || n.id || (n.raw && (n.raw.notification_id || n.raw.id));
  const message = (n.message || (n.raw && n.raw.message) || "").trim();

  // Filter out empty pings without an ID or message
  if (!notifId && !message) return null;

  const finalId = notifId || `NTF-${Math.random().toString(36).substr(2, 6)}`;
  const notifType = n.notification_type || (n.raw && n.raw.notification_type) || "STAGE_UPDATE";
  const action = n.action || (n.raw && n.raw.action) || "INSERT";

  // Parse structured information from message string:
  let parsedLeadOwner = "";
  let parsedProduct = "";
  let parsedStage = "";
  let parsedCompany = "";
  let parsedContact = "";

  if (message) {
    const ownerMatch = message.match(/Lead Owner:\s*([^,]+)/i);
    if (ownerMatch) parsedLeadOwner = ownerMatch[1].trim();

    const productMatch = message.match(/Product Name:\s*([^,]+)/i);
    if (productMatch) parsedProduct = productMatch[1].trim();

    const stageMatch = message.match(/Stage (?:Changed To|Status):\s*([^,]+)/i);
    if (stageMatch) parsedStage = stageMatch[1].trim();

    const companyMatch = message.match(/Company (?:Name)?:\s*([^,]+)/i) || message.match(/for Lead '[^']+'\s*\(([^)]+)\)/i);
    if (companyMatch) parsedCompany = companyMatch[1].trim();

    const contactMatch = message.match(/Contact (?:Name)?:\s*([^,]+)/i);
    if (contactMatch) parsedContact = contactMatch[1].trim();
  }

  const senderName =
    parsedLeadOwner ||
    [n.first_name, n.last_name].filter(Boolean).join(" ") ||
    n.user_name ||
    n.leader_name ||
    n.lead_owner ||
    "";

  const initials = senderName
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "SA";

  const stage =
    n.stage_name ||
    n.stage ||
    parsedStage ||
    "";

  const company = n.company_name || n.company || parsedCompany || "";
  const contact = n.contact_name || n.contact || parsedContact || "";
  const product = n.product_name || n.product || parsedProduct || "";

  const createdAt = n.created_at || n.created_date || n.last_refreshed_at || n.timestamp || Date.now();
  const timestamp = typeof createdAt === "number" ? createdAt : (new Date(createdAt).getTime() || Date.now());

  const isViewed = n.is_viewed === true || n.is_viewed === 1;

  // Extract or derive lead_id
  let leadId = n.lead_id || n.target_id || n.leadId || n.demand_id || n.demandId || (n.raw && (n.raw.lead_id || n.raw.target_id || n.raw.leadId)) || null;

  if (!leadId && message) {
    const leadIdMatch = message.match(/Lead\s*(?:ID|#)?:\s*([A-Za-z0-9_-]+)/i) || message.match(/\b(LD-\d+)\b/i);
    if (leadIdMatch) leadId = leadIdMatch[1].trim();
  }

  if (!leadId && typeof finalId === "string") {
    leadId = finalId.replace(/^NTF-/i, "LD-");
  }

  return {
    id: finalId,
    notification_id: finalId,
    lead_id: leadId,
    user_id: n.user_id || "",
    leader_id: n.leader_id || "",
    action,
    sender: company || contact || senderName,
    senderName,
    initials,
    message: message || "Lead update notification",
    company_name: company,
    contact_name: contact,
    product_name: product,
    target_id: leadId,
    notification_type: notifType,
    stage,
    designation: n.designation || "Leader",
    email: n.email || "",
    time: _formatNotifTime(createdAt),
    timestamp,
    unread: !isViewed,
    is_viewed: isViewed,
    raw: n,
  };
}

function getCurrentUser() {
  try {
    const stored = localStorage.getItem("user_data");
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function isNotificationForCurrentUser(n) {
  if (!n) return false;
  const currentUser = getCurrentUser();
  if (!currentUser) return true;

  const currentUserId = String(currentUser.user_id || currentUser.leader_id || currentUser.id || "").trim().toLowerCase();
  const currentUserEmail = String(currentUser.email || "").trim().toLowerCase();

  const notifUserId = String(n.user_id || n.leader_id || n.raw?.user_id || n.raw?.leader_id || "").trim().toLowerCase();
  const notifEmail = String(n.email || n.raw?.email || "").trim().toLowerCase();

  // If notification explicitly specifies user_id / leader_id, match strictly against current user
  if (notifUserId && currentUserId) {
    if (notifUserId !== currentUserId) {
      console.log(`[NotificationDrawer] 🚫 Filtered out notification for user ${notifUserId} (Current user: ${currentUserId})`);
      return false;
    }
  }

  // If notification explicitly specifies email, match strictly against current user
  if (notifEmail && currentUserEmail) {
    if (notifEmail !== currentUserEmail) {
      console.log(`[NotificationDrawer] 🚫 Filtered out notification for email ${notifEmail} (Current user: ${currentUserEmail})`);
      return false;
    }
  }

  return true;
}

export function handleSseNotification(raw) {
  if (!raw) return;

  // Extract nested data if payload is { event_type: "sales_notification", data: { ... } }
  const data = raw.data !== undefined && typeof raw.data === "object" && raw.data !== null ? raw.data : raw;

  // Filter out notifications that belong to a different user
  if (!isNotificationForCurrentUser(data)) return;

  const notifId = data.notification_id || data.id || raw.notification_id || raw.id;
  const message = (data.message || raw.message || "").trim();

  // Ignore empty pings without notification_id and message
  if (!notifId && !message) return;

  console.log("[NotificationDrawer] ⚡ Live SSE notification accepted for current user:", data);

  const mapped = _mapNotification(data);
  if (!mapped) return;

  if (notifId) {
    const existingIndex = _notifications.findIndex((n) => n.id === notifId || n.notification_id === notifId);
    if (existingIndex !== -1) {
      _notifications = _notifications.map((n, idx) => {
        if (idx === existingIndex) {
          const isViewed = data.is_viewed !== undefined ? !!data.is_viewed : mapped.is_viewed;
          return {
            ...n,
            ...mapped,
            unread: !isViewed,
            is_viewed: isViewed,
          };
        }
        return n;
      });
      _broadcast();
      return;
    }
  }

  // New notification (INSERT / default) -> prepend to top of list and broadcast!
  _notifications = [mapped, ..._notifications.filter((n) => n.id !== mapped.id)];
  _broadcast();

  // Trigger In-App Toast Banner + Chrome Desktop Banner Notification & Audio Chime
  triggerInAppToast(mapped);
  triggerChromeDesktopNotification(mapped);
  playNotificationChime();
}

export function addNotification(raw) {
  handleSseNotification(raw);
}

export function clearNotifications() {
  _notifications = [];
  _initialFetchDone = false;

  if (_notificationSseUnsubscribe) {
    _notificationSseUnsubscribe();
    _notificationSseUnsubscribe = null;
  }

  _broadcast();
}

/**
 * Fetch initial notifications from GET /api/v1/sales/notifications/all
 * STRICTLY ONCE per webpage session.
 */
export async function fetchInitialNotifications() {
  if (_initialFetchDone) return;
  _initialFetchDone = true;
  try {
    const res = await getAllNotifications();
    console.log("[NotificationDrawer] 🔔 History notifications fetched successfully:", res);
    let list = [];
    if (Array.isArray(res?.data)) list = res.data;
    else if (Array.isArray(res?.notifications)) list = res.notifications;
    else if (Array.isArray(res)) list = res;

    // Strict user filtering for notification history
    const filteredList = list.filter(isNotificationForCurrentUser);

    const mapped = filteredList.map(_mapNotification).filter(Boolean);
    if (mapped.length) {
      _mergeIn(mapped);
    }
  } catch (err) {
    console.error("[NotificationDrawer] initial history fetch failed:", err);
    _initialFetchDone = false;
  }
}

export function initNotificationSystem() {
  clearNotifications();
  fetchInitialNotifications();
  startNotificationSse();
  requestChromeNotificationPermission();

  const unsubs = [
    subscribeToSseEvent("sales_notification", handleSseNotification),
    subscribeToSseEvent("sales_notifications", handleSseNotification),
    subscribeToSseEvent("notification", handleSseNotification),
    subscribeToSseEvent("notifications", handleSseNotification),
    subscribeToSseEvent("*", ({ type, payload }) => {
      if (
        type === "sales_notification" ||
        type === "sales_notifications" ||
        type === "notification" ||
        type === "notifications" ||
        (payload && (payload.notification_id || payload.table === "sales_notifications"))
      ) {
        handleSseNotification(payload);
      }
    })
  ];

  _notificationSseUnsubscribe = () => {
    unsubs.forEach((u) => {
      if (typeof u === "function") u();
    });
  };
}

export function _subscribe(cb) {
  _subscribers.add(cb);
  cb([..._notifications]);
  return () => _subscribers.delete(cb);
}

export function _markOneRead(id) {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, unread: false, is_viewed: true } : n));
  _broadcast();
  if (id) {
    markNotificationViewed(id, true).catch((err) => {
      console.warn("[NotificationDrawer] Failed to mark notification as viewed on backend:", err);
    });
  }
}

export function _markAllRead() {
  markAllNotificationAsRead()
    .then(res => {
      console.log("[NotificationDrawer] Backend mark-all-read response:", res);
      // Optimistic update: mark all as viewed locally
      _notifications = _notifications.map((n) => ({ ...n, unread: false, is_viewed: true }));
      _broadcast();
    })
    .catch((err) => {
      console.error("[NotificationDrawer] Mark all read failed:", err);
      // Fallback: optimistic update only
      _notifications = _notifications.map((n) => ({ ...n, unread: false, is_viewed: true }));
      _broadcast();
    });
}

// ── Helper to parse structured key-value information from notification messages ───
export function parseStructuredNotification(message, notification = {}) {
  const result = {
    leadOwner: notification.senderName || notification.lead_owner || "",
    productName: notification.product_name || "",
    stage: (notification.raw && (notification.raw.stage_name || notification.raw.stage)) || "",
    companyName: notification.company_name || "",
    contactName: notification.contact_name || "",
    leadId: notification.lead_id || notification.target_id || "",
    nextAction: "",
    status: "",
    lostReason: "",
    otherFields: [],
    rawText: message || ""
  };

  if (!message || typeof message !== "string") return result;

  let cleanMsg = message.trim();
  if (/^New Lead Created:\s*/i.test(cleanMsg)) {
    cleanMsg = cleanMsg.replace(/^New Lead Created:\s*/i, "");
  } else if (/^Lead Deleted \([^)]+\):\s*/i.test(cleanMsg)) {
    cleanMsg = cleanMsg.replace(/^Lead Deleted \([^)]+\):\s*/i, "");
  } else if (/^Lead Deleted:\s*/i.test(cleanMsg)) {
    cleanMsg = cleanMsg.replace(/^Lead Deleted:\s*/i, "");
  }

  // Split either by newline or by comma followed by a Key: pattern
  const parts = cleanMsg.includes("\n")
    ? cleanMsg.split("\n")
    : cleanMsg.split(/,\s*(?=[A-Za-z0-9\s_-]+:)/);

  parts.forEach((part) => {
    const colonIdx = part.indexOf(":");
    if (colonIdx !== -1) {
      const rawKey = part.slice(0, colonIdx).trim();
      const val = part.slice(colonIdx + 1).trim();
      const keyLower = rawKey.toLowerCase();

      if (keyLower.includes("lead owner") || keyLower === "owner") {
        result.leadOwner = val;
      } else if (keyLower.includes("product name") || keyLower === "product") {
        result.productName = val;
      } else if (keyLower.includes("stage changed to") || keyLower === "stage") {
        result.stage = val;
      } else if (keyLower.includes("company") || keyLower.includes("company name")) {
        result.companyName = val;
      } else if (keyLower.includes("contact") || keyLower.includes("contact name")) {
        result.contactName = val;
      } else if (keyLower.includes("next action") || keyLower.includes("action")) {
        result.nextAction = val;
      } else if (keyLower.includes("lead id") || keyLower === "target" || keyLower === "lead_id") {
        result.leadId = val;
      } else if (keyLower.includes("status")) {
        result.status = val;
      } else if (keyLower.includes("lost reason") || keyLower.includes("reason")) {
        result.lostReason = val;
      } else {
        result.otherFields.push({ key: rawKey, value: val });
      }
    } else if (part.trim()) {
      result.otherFields.push({ key: "", value: part.trim() });
    }
  });

  return result;
}

// ── Notification Detail Component ──────────────────────────────────────────
function NotificationDetail({ notification, onBack, onOpenLead, now = Date.now() }) {
  if (!notification) return null;

  const parsed = parseStructuredNotification(notification.message, notification);
  const displayLeadId = parsed.leadId || notification.lead_id || notification.target_id || "";
  const formattedLeadId = displayLeadId ? (displayLeadId.startsWith("#") ? displayLeadId : `#${displayLeadId}`) : "";

  const notifTypeNorm = String(notification.notification_type || "").toUpperCase();
  const isOverdueLocked = notifTypeNorm.includes("OVERDUE") || notifTypeNorm.includes("LOCKED");
  const isCreated = notifTypeNorm.includes("LEAD_CREATED") || notifTypeNorm.includes("NEW_LEAD") || String(notification.message || "").toLowerCase().includes("new lead created");
  const isDeleted = notifTypeNorm.includes("LEAD_DELETED") || notifTypeNorm.includes("DELETE") || String(notification.message || "").toLowerCase().includes("lead deleted");
  const isReminder = notifTypeNorm.includes("REMINDER");

  const stageUpper = String(parsed.stage || notification.stage || "").toUpperCase();
  const isWon = stageUpper.includes("WON");
  const isLost = stageUpper.includes("LOST") || stageUpper.includes("DROP");

  const stageBadgeStyle = isWon
    ? { bg: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "rgba(16, 185, 129, 0.35)" }
    : isLost
      ? { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.35)" }
      : { bg: "rgba(0, 212, 170, 0.12)", color: "#00D4AA", border: "rgba(0, 212, 170, 0.25)" };

  const dynamicTypeTitle = notifTypeNorm
    .split("_")
    .map(w => w ? (w.charAt(0) + w.slice(1).toLowerCase()) : "")
    .join(" ")
    .trim();

  const bannerTitle = isOverdueLocked
    ? "Activity Overdue & Locked"
    : isCreated
      ? "New Lead Created"
      : isDeleted
        ? "Lead Deleted (Inactive)"
        : isReminder
          ? "Lead Reminder"
          : (parsed.stage ? `Stage Changed To ${parsed.stage}` : (notification.stage || dynamicTypeTitle || "Pipeline Update"));

  const bannerBg = isOverdueLocked
    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.08) 100%)"
    : isCreated
      ? "linear-gradient(135deg, rgba(59, 130, 246, 0.14) 0%, rgba(37, 99, 235, 0.05) 100%)"
      : isDeleted
        ? "linear-gradient(135deg, rgba(239, 68, 68, 0.14) 0%, rgba(185, 28, 28, 0.05) 100%)"
        : isReminder
          ? "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)"
          : "linear-gradient(135deg, rgba(0, 212, 170, 0.08) 0%, rgba(0, 198, 255, 0.04) 100%)";

  const bannerBorder = isOverdueLocked
    ? "1px solid rgba(239, 68, 68, 0.4)"
    : isCreated
      ? "1px solid rgba(59, 130, 246, 0.35)"
      : isDeleted
        ? "1px solid rgba(239, 68, 68, 0.35)"
        : isReminder
          ? "1px solid rgba(245, 158, 11, 0.35)"
          : "1px solid rgba(0, 212, 170, 0.28)";

  const fieldItems = [
    {
      label: "Lead Owner",
      value: parsed.leadOwner,
      icon: <FiUser style={{ color: "#00D4AA" }} />
    },
    {
      label: "Company Name",
      value: parsed.companyName,
      icon: <FiBriefcase style={{ color: "#00C6FF" }} />
    },
    {
      label: "Contact Name",
      value: parsed.contactName,
      icon: <FiUser style={{ color: "#818CF8" }} />
    },
    {
      label: "Product Name",
      value: parsed.productName,
      icon: <FiPackage style={{ color: "#A855F7" }} />
    },
    ...(parsed.stage ? [{
      label: "Stage",
      value: parsed.stage,
      icon: <FiTrendingUp style={{ color: stageBadgeStyle.color }} />,
      isBadge: true,
      badgeStyle: stageBadgeStyle
    }] : []),
    ...(parsed.nextAction ? [{
      label: "Next Action",
      value: parsed.nextAction,
      icon: <FiClock style={{ color: "#F59E0B" }} />,
      color: "#F59E0B"
    }] : []),
    ...(parsed.status ? [{
      label: "Status",
      value: parsed.status,
      icon: <FiCheckCircle style={{ color: "#00D4AA" }} />
    }] : []),
    ...(parsed.lostReason ? [{
      label: "Lost Reason",
      value: parsed.lostReason,
      icon: <FiAlertCircle style={{ color: "#EF4444" }} />,
      color: "#FCA5A5"
    }] : []),
    ...parsed.otherFields.map(f => ({
      label: f.key || "Information",
      value: f.value,
      icon: <FiActivity style={{ color: "#94A3B8" }} />
    }))
  ].filter(item => Boolean(item.value));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "notifDetailFadeIn 0.22s ease" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid var(--t-border, rgba(49,151,149,0.22))",
          background: "var(--t-surface-solid, rgba(14,20,28,0.98))",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "34px",
            height: "34px",
            border: "1px solid var(--t-border, rgba(255,255,255,0.08))",
            borderRadius: "9px",
            background: "var(--t-surface-alt, rgba(255,255,255,0.03))",
            color: "var(--t-fg-muted, #CBD5E1)",
            cursor: "pointer",
            fontSize: "1rem",
            transition: "all 0.16s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--t-teal-tint, rgba(0,212,170,0.15))";
            e.currentTarget.style.color = "var(--t-teal, #00D4AA)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--t-surface-alt, rgba(255,255,255,0.03))";
            e.currentTarget.style.color = "var(--t-fg-muted, #CBD5E1)";
          }}
        >
          <FiArrowLeft />
        </button>
        <span style={{ fontSize: "1.05rem", fontWeight: 600, letterSpacing: "0.5px", color: "var(--t-fg, #FFFFFF)", fontFamily: "'Helvetica'" }}>
          Notification Details
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Top Summary Banner */}
        <div
          style={{
            border: bannerBorder,
            borderRadius: "14px",
            padding: "18px",
            background: bannerBg,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isReminder
                  ? "linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))"
                  : "linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(0, 198, 255, 0.25))",
                border: isReminder
                  ? "1px solid rgba(245, 158, 11, 0.45)"
                  : "1px solid rgba(0, 212, 170, 0.45)",
                color: isReminder ? "#F59E0B" : "var(--t-teal, #00D4AA)",
                fontSize: "1.25rem",
                flexShrink: 0,
                boxShadow: isReminder ? "0 0 16px rgba(245, 158, 11, 0.2)" : "0 0 16px rgba(0, 212, 170, 0.2)"
              }}
            >
              {isReminder ? <FiClock /> : <FiBell />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "1.08rem", color: "var(--t-fg, #FFFFFF)", fontWeight: 800, fontFamily: "'Helvetica'" }}>
                  {bannerTitle}
                </span>
                {formattedLeadId && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 10px",
                      borderRadius: "16px",
                      fontSize: "0.76rem",
                      fontWeight: 800,
                      background: isReminder ? "rgba(245, 158, 11, 0.15)" : "var(--t-teal-tint, rgba(0, 212, 170, 0.15))",
                      color: isReminder ? "#F59E0B" : "var(--t-teal, #00D4AA)",
                      border: isReminder ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid var(--t-border, rgba(0, 212, 170, 0.3))",
                      fontFamily: "'Helvetica'",
                    }}
                  >
                    <FiTarget style={{ fontSize: "11px" }} />
                    {formattedLeadId}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--t-fg-muted, #94A3B8)", fontWeight: 600, marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FiClock style={{ fontSize: "12px" }} />
                <span>{_formatNotifTime(notification.timestamp || notification.created_at || notification.time, now)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Structured Field Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--t-fg-muted, #94A3B8)", textTransform: "uppercase", letterSpacing: "0.06em", paddingLeft: "4px" }}>
            Event Information
          </div>

          {fieldItems.map((item, idx) => {
            const valStr = String(item.value || "");
            const isLongText = valStr.length > 25 || valStr.includes("\n") || item.label === "Information" || item.label === "Description" || item.label === "Details" || item.label === "Notes" || item.label === "Message";

            if (isLongText) {
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    padding: "14px 16px",
                    background: "var(--t-surface-alt, rgba(17, 24, 39, 0.75))",
                    border: "1px solid var(--t-border, rgba(255, 255, 255, 0.08))",
                    borderRadius: "12px",
                    transition: "all 0.15s ease",
                    width: "100%",
                    boxSizing: "border-box"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--t-teal, rgba(0, 212, 170, 0.3))";
                    e.currentTarget.style.background = "var(--t-surface-solid, rgba(17, 24, 39, 0.95))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--t-border, rgba(255, 255, 255, 0.08))";
                    e.currentTarget.style.background = "var(--t-surface-alt, rgba(17, 24, 39, 0.75))";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      background: "var(--t-surface-solid, rgba(255, 255, 255, 0.04))",
                      border: "1px solid var(--t-border, rgba(255, 255, 255, 0.08))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "14px",
                      flexShrink: 0
                    }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--t-fg-muted, #94A3B8)", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
                      {item.label}
                    </span>
                  </div>

                  <div style={{
                    fontSize: "0.88rem",
                    fontWeight: 600,
                    color: item.color || "var(--t-fg, #F1F5F9)",
                    fontFamily: "'Inter', sans-serif",
                    lineHeight: "1.6",
                    textAlign: "left",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    background: "rgba(0, 0, 0, 0.25)",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    width: "100%",
                    boxSizing: "border-box"
                  }}>
                    {item.value}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "var(--t-surface-alt, rgba(17, 24, 39, 0.75))",
                  border: "1px solid var(--t-border, rgba(255, 255, 255, 0.07))",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  flexWrap: "wrap"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--t-teal, rgba(0, 212, 170, 0.3))";
                  e.currentTarget.style.background = "var(--t-surface-solid, rgba(17, 24, 39, 0.95))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--t-border, rgba(255, 255, 255, 0.07))";
                  e.currentTarget.style.background = "var(--t-surface-alt, rgba(17, 24, 39, 0.75))";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "110px" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "7px",
                    background: "var(--t-surface-solid, rgba(255, 255, 255, 0.04))",
                    border: "1px solid var(--t-border, rgba(255, 255, 255, 0.08))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    flexShrink: 0
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: "0.82rem", color: "var(--t-fg-muted, #94A3B8)", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
                    {item.label}
                  </span>
                </div>

                {item.isBadge ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 12px",
                      borderRadius: "14px",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      background: item.badgeStyle?.bg || "rgba(0, 212, 170, 0.15)",
                      color: item.badgeStyle?.color || "#00D4AA",
                      border: `1px solid ${item.badgeStyle?.border || "rgba(0, 212, 170, 0.3)"}`,
                    }}
                  >
                    {item.value}
                  </span>
                ) : (
                  <span style={{
                    fontSize: "0.9rem",
                    fontWeight: 700,
                    color: item.color || "var(--t-fg, #F1F5F9)",
                    fontFamily: "'Space Grotesk', sans-serif",
                    textAlign: "right",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    maxWidth: "100%"
                  }}>
                    {item.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Action footer */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          padding: "16px 20px",
          borderTop: "1px solid var(--t-border, rgba(49,151,149,0.18))",
          background: "var(--t-surface-solid, rgba(9,14,20,0.98))",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            flex: 1,
            padding: "11px 16px",
            borderRadius: "10px",
            fontSize: "0.9rem",
            fontWeight: 700,
            cursor: "pointer",
            background: "var(--t-surface-alt, rgba(255,255,255,0.04))",
            color: "var(--t-fg-muted, #CBD5E1)",
            border: "1px solid var(--t-border, rgba(255,255,255,0.1))",
            transition: "all 0.16s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--t-row-hover, rgba(255,255,255,0.08))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--t-surface-alt, rgba(255,255,255,0.04))")}
        >
          Back to List
        </button>
      </div>
    </div>
  );
}

// ── IN-APP FLOATING TOAST NOTIFICATION PORTAL ────────────────────────────────
function NotificationToastPortal() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleNewToast = (notif) => {
      if (!notif) return;
      const id = notif.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newToast = { id, notif, createdAt: Date.now() };

      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

      // Auto dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    };

    const unsub = _subscribeToast(handleNewToast);
    return unsub;
  }, []);

  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: '84px',
        right: '24px',
        zIndex: 100020,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        maxWidth: '420px',
        width: 'calc(100vw - 48px)'
      }}
    >
      <style>{`
        @keyframes toastSlideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .notif-toast-card {
          animation: toastSlideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          pointer-events: auto;
        }
      `}</style>
      {toasts.map(({ id, notif }) => {
        const parsed = parseStructuredNotification(notif.message, notif);
        const typeBadge = getNotificationTypeBadge(notif.type || notif.type_label);
        const titleText = parsed?.title || notif.title || notif.type_label || "New Notification";
        const messageText = parsed?.fullText || notif.message || "You have received a new notification.";

        return (
          <div
            key={id}
            className="notif-toast-card"
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent("open_notification_drawer"));
              } catch (_) { }
              setToasts((prev) => prev.filter((t) => t.id !== id));
            }}
            style={{
              background: 'rgba(10, 18, 30, 0.95)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(0, 212, 170, 0.4)',
              borderLeft: '5px solid #00D4AA',
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), 0 0 16px rgba(0, 212, 170, 0.15)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'transform 0.15s ease'
            }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#00D4AA',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Helvetica'"
                }}>
                  🔔 You've got a new notification
                </span>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts((prev) => prev.filter((t) => t.id !== id));
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  lineHeight: 1
                }}
              >
                <FiX />
              </button>
            </div>

            {/* Notification Title & Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: typeBadge.bg || 'rgba(0, 212, 170, 0.15)',
                  color: typeBadge.color || '#00D4AA',
                  border: `1px solid ${typeBadge.border || 'rgba(0, 212, 170, 0.3)'}`,
                  fontSize: '10.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                {typeBadge.label || 'UPDATE'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF', fontFamily: "'Helvetica'" }}>
                {titleText}
              </span>
            </div>

            {/* Message Body */}
            <div style={{ fontSize: '12px', color: '#CBD5E1', lineHeight: 1.4, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {messageText}
            </div>

            {/* Footer Hint */}
            <div style={{ fontSize: '10.5px', color: '#00D4AA', fontWeight: 600, marginTop: '2px', opacity: 0.9 }}>
              Click to view notification details →
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );
}

// ── MAIN NOTIFICATION DRAWER COMPONENT ──────────────────────────────────────
export default function NotificationDrawer({ isOpen, onClose, onOpenLeadDetails }) {
  const [notifications, setNotifications] = useState(() => [..._notifications]);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState("all");

  // Live timer: updates every 5 seconds so relative timestamps ("Just now", "1m ago", "50m ago") update dynamically in real time
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to singleton state
  useEffect(() => {
    fetchInitialNotifications();
    const unsubscribe = _subscribe(setNotifications);
    return unsubscribe;
  }, []);

  // Handle open / close animations
  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
      setSelectedNotif(null);
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else if (isMounted) {
      setIsVisible(false);
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
        setSelectedNotif(null);
      }, NOTIFICATION_DRAWER_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const unreadCount = useMemo(() => notifications.filter((n) => n.unread).length, [notifications]);

  const displayedNotifications = useMemo(() => {
    if (activeTab === "unread") return notifications.filter(n => n.unread);
    return notifications;
  }, [notifications, activeTab]);

  const handleCardClick = (notification, e) => {
    if (e && typeof e.stopPropagation === "function") {
      e.stopPropagation();
    }
    if (notification.unread) {
      _markOneRead(notification.id);
    }
    setSelectedNotif(notification);
  };

  const drawerContent = isMounted ? (
    <>
      <style>{`
        @keyframes notifDetailFadeIn {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .notif-drawer-panel {
          width: min(390px, 100vw);
        }

        .notif-list-container::-webkit-scrollbar {
          width: 5px;
        }
        .notif-list-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .notif-list-container::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 170, 0.25);
          border-radius: 4px;
        }
        .notif-list-container::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 170, 0.45);
        }

        /* Tablet responsiveness */
        @media (min-width: 641px) and (max-width: 1024px) {
          .notif-drawer-panel {
            width: min(420px, 85vw) !important;
          }
          .notif-drawer-header {
            padding: 16px 18px !important;
          }
          .notif-drawer-body {
            padding: 12px 14px !important;
          }
          .notif-card-item {
            padding: 12px 14px !important;
            margin-bottom: 8px !important;
          }
        }

        /* Mobile responsiveness */
        @media (max-width: 640px) {
          .notif-drawer-panel {
            width: 100vw !important;
          }
          .notif-drawer-header {
            padding: 14px 16px !important;
          }
          .notif-drawer-body {
            padding: 10px 12px !important;
          }
          .notif-card-item {
            padding: 10px 12px !important;
            margin-bottom: 6px !important;
          }
        }
      `}</style>

      {/* Clear Backdrop Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 100000,
          opacity: isVisible && !isClosing ? 1 : 0,
          pointerEvents: isVisible && !isClosing ? "auto" : "none",
          transition: `opacity ${NOTIFICATION_DRAWER_ANIMATION_MS}ms ease`,
        }}
      />

      {/* Slide-out Drawer Panel */}
      <div
        className="notif-drawer-panel"
        data-notification-drawer="true"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--t-surface-solid, #090e15)",
          borderLeft: "1px solid var(--t-border, rgba(0, 212, 170, 0.3))",
          boxShadow: "-12px 0 40px rgba(0, 0, 0, 0.25)",
          color: "var(--t-fg, #FFFFFF)",
          zIndex: 100001,
          transform: isVisible && !isClosing ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
          opacity: isVisible && !isClosing ? 1 : 0,
          transition: `transform ${NOTIFICATION_DRAWER_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${NOTIFICATION_DRAWER_ANIMATION_MS}ms ease`,
        }}
      >
        {selectedNotif ? (
          <NotificationDetail
            notification={selectedNotif}
            onBack={() => setSelectedNotif(null)}
            onOpenLead={onOpenLeadDetails}
            now={now}
          />
        ) : (
          <>
            {/* Drawer Header */}
            <div
              className="notif-drawer-header"
              style={{
                display: "flex",
                flexDirection: "column",
                borderBottom: "1px solid rgba(0, 212, 170, 0.18)",
                background: "radial-gradient(100% 100% at 50% 0%, rgba(0, 212, 170, 0.08) 0%, rgba(5, 10, 16, 0) 100%), linear-gradient(180deg, #0A121E 0%, #04080E 100%)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
                flexShrink: 0,
              }}
            >
              {/* Top Row: Icon, Title, Close Button */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 16px",
                  gap: "10px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(0, 212, 170, 0.12)",
                      border: "1px solid rgba(0, 212, 170, 0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                  >
                    <FiBell style={{ color: "#00D4AA", fontSize: "16px" }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      className="notif-header-title"
                      style={{
                        fontSize: "1rem",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: "#FFFFFF",
                        fontFamily: "Inter, 'Helvetica Neue', sans-serif"
                      }}
                    >
                      Notifications
                    </span>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close notifications"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "30px",
                    height: "30px",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.04)",
                    color: "#94A3B8",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 75, 43, 0.15)";
                    e.currentTarget.style.color = "#FF4B2B";
                    e.currentTarget.style.borderColor = "rgba(255, 75, 43, 0.35)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                    e.currentTarget.style.color = "#94A3B8";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  }}
                >
                  <FiX style={{ fontSize: "15px" }} />
                </button>
              </div>

              {/* Separate Filter Tab Strip (Equal Spacing) */}
              <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                {/* All Notifications Tab */}
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    border: activeTab === "all" ? "1px solid #00D4AA" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: activeTab === "all" ? "rgba(0, 212, 170, 0.12)" : "transparent",
                    color: activeTab === "all" ? "#00D4AA" : "#94A3B8",
                    cursor: "pointer",
                    transition: "all 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== "all") {
                      e.currentTarget.style.color = "#E2E8F0";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "all") {
                      e.currentTarget.style.color = "#94A3B8";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    }
                  }}
                >
                  <span style={{ whiteSpace: "nowrap" }}>All Notifications</span>
                  <span
                    style={{
                      minWidth: "18px",
                      height: "18px",
                      padding: "0 5px",
                      borderRadius: "9px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: activeTab === "all" ? "rgba(0, 212, 170, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      color: activeTab === "all" ? "#00D4AA" : "#94A3B8",
                      lineHeight: 1,
                      flexShrink: 0
                    }}
                  >
                    {notifications.length}
                  </span>
                </button>

                {/* Unread Tab */}
                <button
                  type="button"
                  onClick={() => setActiveTab("unread")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    border: activeTab === "unread" ? "1px solid #00D4AA" : "1px solid rgba(255, 255, 255, 0.1)",
                    background: activeTab === "unread" ? "rgba(0, 212, 170, 0.12)" : "transparent",
                    color: activeTab === "unread" ? "#00D4AA" : "#94A3B8",
                    cursor: "pointer",
                    transition: "all 0.18s ease"
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== "unread") {
                      e.currentTarget.style.color = "#E2E8F0";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "unread") {
                      e.currentTarget.style.color = "#94A3B8";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                    }
                  }}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Unread</span>
                  <span
                    style={{
                      minWidth: "18px",
                      height: "18px",
                      padding: "0 5px",
                      borderRadius: "9px",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: activeTab === "unread" ? "rgba(0, 212, 170, 0.25)" : "rgba(255, 255, 255, 0.08)",
                      color: activeTab === "unread" ? "#00D4AA" : "#94A3B8",
                      lineHeight: 1,
                      flexShrink: 0
                    }}
                  >
                    {unreadCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="notif-drawer-body notif-list-container" style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
              {displayedNotifications.length === 0 ? (
                <div
                  className="notif-empty-container"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "280px",
                    gap: "14px",
                    padding: "24px",
                    textAlign: "center",
                    color: "var(--t-fg-muted, #64748B)",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "rgba(0, 212, 170, 0.08)",
                      border: "1px solid rgba(0, 212, 170, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 0 24px rgba(0, 212, 170, 0.15)",
                    }}
                  >
                    <FiBellOff style={{ fontSize: "26px", color: "#00D4AA", opacity: 0.9 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FFFFFF", fontFamily: "'Helvetica'" }}>
                      {activeTab === "unread" ? "No unread notifications" : "No notifications found"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#94A3B8", maxWidth: "250px", lineHeight: 1.45 }}>
                      {activeTab === "unread"
                        ? "You've read all your notifications! Check back later for updates."
                        : "You're all caught up! New notifications and lead updates will appear here."}
                    </span>
                  </div>
                </div>
              ) : (
                displayedNotifications.map((notification) => {
                  const typeBadge = getNotificationTypeBadge(notification.notification_type);
                  const IconComp = typeBadge.Icon;
                  const displayLeadId = notification.lead_id || notification.target_id || (notification.notification_id ? notification.notification_id.replace(/^NTF-/i, "LD-") : "");
                  const formattedId = displayLeadId ? (displayLeadId.startsWith("#") ? displayLeadId : `#${displayLeadId}`) : "";
                  const parsed = parseStructuredNotification(notification.message, notification);

                  return (
                    <div
                      key={notification.id}
                      className="notif-card-item"
                      onClick={(e) => handleCardClick(notification, e)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "12px 14px",
                        marginBottom: "10px",
                        background: notification.unread
                          ? "linear-gradient(135deg, rgba(14, 25, 38, 0.95) 0%, rgba(8, 14, 22, 0.9) 100%)"
                          : "linear-gradient(135deg, rgba(16, 24, 34, 0.45) 0%, rgba(8, 12, 18, 0.45) 100%)",
                        border: notification.unread
                          ? "1px solid rgba(0, 212, 170, 0.38)"
                          : "1px solid rgba(255, 255, 255, 0.06)",
                        borderLeft: notification.unread
                          ? "3px solid #00D4AA"
                          : "3px solid transparent",
                        borderRadius: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        position: "relative",
                        boxShadow: notification.unread ? "0 4px 18px rgba(0, 212, 170, 0.12)" : "0 2px 8px rgba(0, 0, 0, 0.2)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.55)";
                        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 212, 170, 0.18)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = notification.unread
                          ? "rgba(0, 212, 170, 0.38)"
                          : "rgba(255, 255, 255, 0.06)";
                        e.currentTarget.style.boxShadow = notification.unread ? "0 4px 18px rgba(0, 212, 170, 0.12)" : "0 2px 8px rgba(0, 0, 0, 0.2)";
                      }}
                    >
                      {/* Top Header Row */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                          {/* Icon Box */}
                          <div
                            style={{
                              width: "30px",
                              height: "30px",
                              borderRadius: "8px",
                              background: typeBadge.bg,
                              color: typeBadge.color || "#00D4AA",
                              border: `1px solid ${typeBadge.border || "rgba(0, 212, 170, 0.3)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.85rem",
                              flexShrink: 0,
                              boxShadow: "0 0 10px rgba(0, 212, 170, 0.12)"
                            }}
                          >
                            <IconComp />
                          </div>

                          {/* Lead ID & Title */}
                          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
                            {formattedId && (
                              <span
                                style={{
                                  fontSize: "0.76rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.03em",
                                  color: "#00D4AA",
                                  fontFamily: "'Helvetica'",
                                }}
                              >
                                {formattedId}
                              </span>
                            )}
                            <div
                              style={{
                                fontSize: "0.88rem",
                                fontWeight: 700,
                                color: "#FFFFFF",
                                lineHeight: 1.25,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {parsed.companyName || parsed.productName || notification.title || "Lead Update"}
                            </div>
                          </div>
                        </div>

                        {/* Type Badge & Read Check */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              background: typeBadge.bg,
                              color: typeBadge.color,
                              border: `1px solid ${typeBadge.border}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {typeBadge.label}
                          </span>
                          {notification.unread && (
                            <button
                              type="button"
                              title="Mark as read"
                              onClick={(e) => {
                                e.stopPropagation();
                                _markOneRead(notification.id);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#00D4AA",
                                padding: "2px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.95rem",
                                opacity: 0.9,
                                transition: "all 0.16s ease",
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.9")}
                            >
                              <FiCheckCircle />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Notification Message Text Body */}
                      {notification.message && (
                        <p
                          style={{
                            fontSize: "0.82rem",
                            lineHeight: 1.45,
                            color: notification.unread ? "#E2E8F0" : "#94A3B8",
                            fontWeight: 400,
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            textAlign: "left",
                            whiteSpace: "pre-wrap",
                            margin: "2px 0 0 0"
                          }}
                        >
                          {notification.message}
                        </p>
                      )}

                      {/* Card Footer Row: View Details & Timestamp */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: "2px",
                          paddingTop: "4px",
                          borderTop: "1px solid rgba(255, 255, 255, 0.04)"
                        }}
                      >
                        <span style={{
                          fontSize: "0.72rem",
                          color: "#00D4AA",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          opacity: 0.88
                        }}>
                          View Details <FiArrowRight style={{ fontSize: "11px" }} />
                        </span>

                        <span style={{
                          fontSize: "0.72rem",
                          color: "#64748B",
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          <FiClock style={{ fontSize: "11px" }} />
                          {_formatNotifTime(notification.timestamp || notification.created_at || notification.time, now)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            {notifications.length > 0 && (
              <div
                style={{
                  padding: "12px 18px",
                  borderTop: "1px solid rgba(0, 212, 170, 0.2)",
                  background: "linear-gradient(180deg, #080D16 0%, #060A10 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: unreadCount > 0 ? "space-between" : "center",
                  gap: "12px",
                  flexShrink: 0
                }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "#94A3B8",
                    fontWeight: 500,
                    textAlign: unreadCount > 0 ? "left" : "center"
                  }}
                >
                  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up"}
                </span>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => _markAllRead()}
                    style={{
                      background: "linear-gradient(135deg, rgba(0, 212, 170, 0.18), rgba(0, 198, 255, 0.08))",
                      border: "1px solid rgba(0, 212, 170, 0.4)",
                      color: "#00D4AA",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      transition: "all 0.18s ease",
                      boxShadow: "0 2px 10px rgba(0, 212, 170, 0.15)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(0, 212, 170, 0.25)";
                      e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.6)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "linear-gradient(135deg, rgba(0, 212, 170, 0.18), rgba(0, 198, 255, 0.08))";
                      e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.4)";
                    }}
                  >
                    <FiCheckCircle style={{ fontSize: "14px" }} />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  ) : null;

  return (
    <>
      <NotificationToastPortal />
      {isMounted && typeof document !== 'undefined' && ReactDOM.createPortal(drawerContent, document.body)}
    </>
  );
}

