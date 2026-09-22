// src/components/admin/UserManagementView.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './UserManagement.css';
import ProductStatusTab from '../leads/ProductStatusTab';
import DropdownMastersTab from '../leads/DropdownMastersTab';
import PermissionDelegationTab from './PermissionDelegationTab';
import WeeklyReportsTab from './WeeklyReportsTab';
import { getLeaders, createLeader, updateLeader, deleteLeader, bulkDeleteLeaders, searchLeaders, reassignLeader, reassignProducts, getLeadersDropdown, getLeaderProducts } from '../../api/leaderApi';
import { getLeads } from '../../api/leadApi';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess, isSuperAdmin } from '../../utils/authRoles';
import {
  MdAdd,
  MdEdit,
  MdCheckCircle,
  MdPerson,
  MdEmail,
  MdFingerprint,
  MdSearch,
  MdSave,
  MdWarning,
  MdCircle,
  MdDelete,
  MdLayers,
  MdList,
  MdRefresh,
  MdFileDownload,
  MdWork,
  MdLock,
  MdVisibility,
  MdVisibilityOff,
  MdVpnKey,
  MdPictureAsPdf,
  MdChevronLeft,
  MdChevronRight
} from 'react-icons/md';

const ADMIN_TABS = [
  { id: "leaders", label: "Leaders Directory", icon: <MdPerson />, color: "#00D4AA" },
  { id: "dropdown_masters", label: "Product & Status Type Master", icon: <MdList />, color: "#10b981" },
  { id: "permission_delegation", label: "Permission Delegation", icon: <MdVpnKey />, color: "#818CF8" },
  { id: "weekly_pdfs", label: "Weekly Executive Reports", icon: <MdPictureAsPdf />, color: "#EF4444" },
];

const DESIGNATION_META = {
  "product manager": { color: "#FFAA00", bg: "rgba(255,170,0,0.15)", border: "rgba(255,170,0,0.3)" },
  default: { color: "#00D4AA", bg: "rgba(0,212,170,0.15)", border: "rgba(0,212,170,0.3)" }
};

/**
 * Robust API error parser for FastAPI / Pydantic validation errors and standard backend responses
 */
export function formatApiError(err, fallback = "Operation failed.") {
  if (!err) return fallback;

  // 1. Check if backend returned detail (FastAPI / Pydantic validation schema)
  const detail = err?.response?.data?.detail || err?.data?.detail;
  if (detail) {
    if (Array.isArray(detail)) {
      const messages = detail.map((d) => {
        if (typeof d === "string") return d;
        if (typeof d === "object" && d !== null) {
          const loc = Array.isArray(d.loc)
            ? d.loc.filter((l) => l !== "body" && l !== "query" && l !== "path").join(" → ")
            : "";
          const msg = d.msg || d.message || JSON.stringify(d);
          if (loc) {
            const prettyLoc = loc.charAt(0).toUpperCase() + loc.slice(1);
            return `${prettyLoc}: ${msg}`;
          }
          return msg;
        }
        return String(d);
      }).filter(Boolean);

      if (messages.length > 0) {
        return messages.join(" | ");
      }
    } else if (typeof detail === "string") {
      return detail;
    } else if (typeof detail === "object") {
      return detail.msg || detail.message || JSON.stringify(detail);
    }
  }

  // 2. Check for standard backend error/message fields
  const data = err?.response?.data || err?.data;
  if (data) {
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data.msg === "string" && data.msg.trim()) return data.msg.trim();
  }

  // 3. Fallback to standard error message
  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}

// ─── UI Atoms ────────────────────────────────────────────────────────────────

const getInitials = (name) =>
  (name || 'U').split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

const Avatar = ({ initials, designation, size = 44 }) => {
  const m = DESIGNATION_META[designation] || DESIGNATION_META.default;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 800,
      background: m.bg, border: `2px solid ${m.border}`, color: m.color,
      flexShrink: 0, letterSpacing: "0.5px", fontFamily: "Inter, sans-serif"
    }}>{initials}</div>
  );
};

const DesignationPill = ({ designation, style = {} }) => {
  const m = DESIGNATION_META[designation] || DESIGNATION_META.default;
  return (
    <span className="um-designation-pill" style={{
      padding: "2px 7px", borderRadius: 5, fontSize: "10.5px", fontWeight: 800,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: "nowrap", letterSpacing: "0.3px", textTransform: "uppercase",
      overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px",
      display: "inline-block", verticalAlign: "middle", ...style
    }} title={designation || 'Leader'}>{designation || 'Leader'}</span>
  );
};

const ROLE_META = {
  'super admin': { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', color: '#EF4444' },
  'admin': { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', color: '#F59E0B' },
  'user': { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', color: '#38BDF8' },
  default: { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', color: '#CBD5E1' }
};

const RolePill = ({ role }) => {
  const r = (role || '').toLowerCase();
  const m = ROLE_META[r] || ROLE_META.default;
  const label = role ? role.toUpperCase() : 'USER';
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: "nowrap", letterSpacing: "0.3px", textTransform: "uppercase"
    }}>{label}</span>
  );
};

const StatusBadge = ({ status }) => (
  <span className="um-status-badge" style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 700,
    background: status ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.12)",
    color: status ? "#10b981" : "#94a3b8",
    border: `1px solid ${status ? "rgba(16,185,129,0.35)" : "rgba(100,116,139,0.25)"}`,
    whiteSpace: "nowrap"
  }}>
    <MdCircle style={{ fontSize: "0.5rem" }} />
    {status ? "Active" : "Inactive"}
  </span>
);

const Toggle = ({ on, onColor = "#00D4AA", onClick }) => (
  <div onClick={onClick} style={{
    width: 44, height: 24, borderRadius: 14, flexShrink: 0, cursor: "pointer",
    background: on ? onColor : "rgba(255,255,255,0.06)",
    border: `1.5px solid ${on ? onColor : "rgba(255,255,255,0.15)"}`,
    position: "relative", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    boxShadow: on ? `0 0 12px ${onColor}40` : "none"
  }}>
    <div style={{
      width: 18, height: 18, borderRadius: "50%", background: on ? "#071018" : "#fff",
      position: "absolute", top: 1.5, left: on ? 22 : 2.5,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      boxShadow: "0 2px 5px rgba(0,0,0,0.4)"
    }} />
  </div>
);

const InputField = ({ label, icon, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    <label style={{
      fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8",
      textTransform: "uppercase", letterSpacing: "0.8px",
      display: "flex", alignItems: "center", gap: 6
    }}>
      {icon && <span style={{ color: "#00D4AA", fontSize: "1rem" }}>{icon}</span>}
      {label}
    </label>
    {children}
  </div>
);

const inpStyle = {
  background: "rgba(5, 8, 14, 0.85)",
  border: "1px solid rgba(49, 151, 149, 0.28)",
  borderRadius: 10, padding: "12px 16px", color: "#f1f5f9",
  fontSize: "0.95rem", fontFamily: "Inter, sans-serif",
  outline: "none", width: "100%", boxSizing: "border-box",
  transition: "all 0.3s ease"
};

const PrimaryBtn = ({ children, onClick, type = "button", style = {} }) => (
  <button type={type} onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "11px 22px",
    background: "linear-gradient(135deg, #009B82, #00D4AA)",
    border: "none", borderRadius: 10, color: "#070C12",
    fontSize: "0.9rem", fontWeight: 800, fontFamily: "Inter, sans-serif",
    cursor: "pointer", transition: "all 0.22s ease",
    boxShadow: "0 4px 16px rgba(0,212,170,0.3)", ...style
  }}>{children}</button>
);

const PanelHeader = ({ icon, iconBg, iconColor, title, sub, actions }) => (
  <div className="um-panel-header-wrap" style={{
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    marginBottom: 20, paddingBottom: 16,
    borderBottom: "1px solid rgba(49,151,149,0.14)", flexWrap: "wrap"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: iconBg, color: iconColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.4rem", boxShadow: `0 0 20px ${iconColor}20`
      }}>{icon}</div>
      <div>
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.01em" }}>{title}</h3>
        <p style={{ margin: "4px 0 0", fontSize: "0.83rem", color: "#64748b" }}>{sub}</p>
      </div>
    </div>
    {actions && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div>}
  </div>
);

const SuccessAlert = ({ msg }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: "14px 20px", borderRadius: 12, marginBottom: 20,
    background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)",
    color: "#10b981", fontSize: "0.9rem", fontWeight: 600,
    boxShadow: "0 4px 20px rgba(16,185,129,0.1)"
  }}>
    <MdCheckCircle style={{ fontSize: "1.2rem" }} />
    {msg}
  </div>
);

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = "Confirm", confirmColor = "#ef4444" }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{
        background: "var(--t-surface-solid, #0c131c)", border: "1px solid var(--t-border, rgba(255,255,255,0.1))",
        borderRadius: 16, padding: "28px 24px 24px", maxWidth: 420, width: "100%",
        boxShadow: "var(--t-card-shadow, 0 24px 60px rgba(0,0,0,0.85))",
        textAlign: "center"
      }}>
        {/* Centered Trash Icon */}
        <div style={{
          width: 54, height: 54, borderRadius: "50%",
          background: `${confirmColor}22`, border: `1px solid ${confirmColor}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: confirmColor, fontSize: "1.5rem", margin: "0 auto 16px"
        }}>
          <MdDelete />
        </div>
        <h3 style={{ margin: "0 0 8px", color: "var(--t-fg, #f1f5f9)", fontSize: "1.1rem", fontWeight: 800, textAlign: "center" }}>{title}</h3>
        <p style={{ margin: "0 0 24px", color: "var(--t-fg-muted, #94a3b8)", fontSize: "0.9rem", lineHeight: 1.6, textAlign: "center" }}>{message}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: "100%", height: 42, background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--t-border, rgba(255,255,255,0.1))", borderRadius: 9,
              color: "var(--t-fg-muted, #94a3b8)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              width: "100%", height: 42,
              background: `linear-gradient(135deg, ${confirmColor}, #b91c1c)`,
              border: "none",
              borderRadius: 9, color: "#FFFFFF",
              fontSize: "0.9rem", fontWeight: 800, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UserManagementView() {
  const { user } = useAuth();
  const isAuthorized = hasAdminAccess(user);

  const [activeTab, setActiveTab] = useState("leaders");
  const [leaders, setLeaders] = useState([]);
  const [totalLeaders, setTotalLeaders] = useState(null);   // server-reported total count
  const [searchResults, setSearchResults] = useState(null); // null = use leaders[], array = server search results
  const [isSearching, setIsSearching] = useState(false);    // backend search in-flight
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");       // debounced value — drives filtering
  const [searchInput, setSearchInput] = useState(""); // raw typed value — bound to <input>
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all', 'active', 'inactive'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Bulk Delete Selection States
  const [selectedLeaderIds, setSelectedLeaderIds] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  const handleExecuteBulkDelete = async () => {
    if (selectedLeaderIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await bulkDeleteLeaders({ ids: selectedLeaderIds });
      setSuccess(true);
      setSuccessMsg(`Successfully deleted ${selectedLeaderIds.length} leaders.`);
      setSelectedLeaderIds([]);
      setBulkDeleteModalOpen(false);
      await loadLeaders(true);
    } catch (err) {
      console.error('[UserManagementView] Bulk Delete Error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to bulk delete leaders.';
      setErrorMsg(`Bulk delete failed: ${msg}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const baseForm = {
    emp_id: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    designation: "",
    role: "user",
    is_active: true
  };
  const [form, setForm] = useState(baseForm);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: "", message: "", onConfirm: null });
  const [deactivateModal, setDeactivateModal] = useState({ isOpen: false, leader: null });
  const [delegationTargetId, setDelegationTargetId] = useState("");
  const [isDelegatingAndDeactivating, setIsDelegatingAndDeactivating] = useState(false);
  const [delegationModalError, setDelegationModalError] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, leader: null });
  const [deleteTargetId, setDeleteTargetId] = useState("");
  const [isDeletingAndDelegating, setIsDeletingAndDelegating] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState("");
  const [dropdownLeaders, setDropdownLeaders] = useState([]);
  const [isLoadingDropdown, setIsLoadingDropdown] = useState(false);

  const [deactivateLeaderProducts, setDeactivateLeaderProducts] = useState([]);
  const [deactivateProductTargets, setDeactivateProductTargets] = useState({});
  const [isLoadingDeactivateProducts, setIsLoadingDeactivateProducts] = useState(false);

  const [deleteLeaderProducts, setDeleteLeaderProducts] = useState([]);
  const [deleteProductTargets, setDeleteProductTargets] = useState({});
  const [isLoadingDeleteProducts, setIsLoadingDeleteProducts] = useState(false);

  // Fetch lightweight leaders list & leader products when deactivation modal opens
  const handleOpenDeactivateModal = async (leaderToDeactivate) => {
    const srcId = leaderToDeactivate?.leader_id || leaderToDeactivate?.id || leaderToDeactivate?.emp_id;
    setDeactivateModal({ isOpen: true, leader: leaderToDeactivate });
    setDelegationTargetId("");
    setDelegationModalError("");
    setDeactivateLeaderProducts([]);
    setDeactivateProductTargets({});
    setIsLoadingDropdown(true);
    setIsLoadingDeactivateProducts(true);

    try {
      const [resDropdown, resProducts] = await Promise.all([
        getLeadersDropdown(true),
        srcId ? getLeaderProducts(srcId).catch(err => {
          console.warn("[UserManagement] getLeaderProducts failed, falling back to getLeads:", err);
          const fetchLimit = Math.min(100, Math.max(10, pageSize || 10));
          return getLeads({ lead_owner_id: srcId, limit: fetchLimit });
        }) : Promise.resolve([])
      ]);

      const list = Array.isArray(resDropdown) ? resDropdown : (resDropdown?.data || []);
      setDropdownLeaders(list);

      const rawProds = Array.isArray(resProducts) ? resProducts : (resProducts?.data || []);
      const prodsMap = new Map();

      rawProds.forEach(p => {
        if (p.product_register_id) {
          prodsMap.set(String(p.product_register_id), {
            product_register_id: String(p.product_register_id),
            product_name: p.product_name || `Product #${p.product_id || p.product_register_id}`,
            company: p.company_name || p.company || 'Associated Lead',
            stage: p.stage || null,
            project_value: p.project_value !== undefined ? p.project_value : null
          });
        } else if (Array.isArray(p.products)) {
          // If fallback getLeads returned lead objects
          p.products.forEach(subP => {
            if (subP.product_register_id) {
              prodsMap.set(String(subP.product_register_id), {
                product_register_id: String(subP.product_register_id),
                product_name: subP.product_name || `Product #${subP.product_id}`,
                company: p.company || 'Associated Lead',
                stage: subP.stage || null,
                project_value: subP.project_value !== undefined ? subP.project_value : null
              });
            }
          });
        }
      });

      setDeactivateLeaderProducts(Array.from(prodsMap.values()));
    } catch (err) {
      console.warn("[UserManagement] Failed to fetch data for deactivation:", err);
      setDropdownLeaders(leaders);
    } finally {
      setIsLoadingDropdown(false);
      setIsLoadingDeactivateProducts(false);
    }
  };

  // Load Leaders from API (strictly only if authorized)
  const loadLeaders = useCallback(async (showToast = false, targetLeaderId = null) => {
    if (!isAuthorized) return;
    setIsRefreshing(true);
    try {
      const fetchLimit = Math.min(100, Math.max(10, pageSize || 10));
      const res = await getLeaders({ limit: fetchLimit }, true);
      let data = [];
      let total = null;
      if (res && Array.isArray(res.data)) {
        data = res.data;
        // API may return total as res.total, res.count, or res.pagination?.total
        total = res.total ?? res.count ?? res.pagination?.total ?? data.length;
      } else if (Array.isArray(res)) {
        data = res;
        total = data.length;
      }
      setLeaders(data);
      setTotalLeaders(total);
      setSearchResults(null); // clear any server search results
      if (targetLeaderId) {
        const found = data.find(l => l.leader_id === targetLeaderId || l.emp_id === targetLeaderId || l.email === targetLeaderId);
        if (found) {
          setSelected(found);
        } else if (data.length > 0) {
          setSelected(data[0]);
        } else {
          setSelected(null);
        }
      } else if (data.length > 0) {
        setSelected(prev => {
          if (prev && data.some(l => l.leader_id === prev.leader_id)) {
            return data.find(l => l.leader_id === prev.leader_id) || prev;
          }
          return data[0];
        });
      } else {
        setSelected(null);
      }
      setFetchError(null);
      setErrorMsg("");
      if (showToast) {
        setSuccessMsg("Leaders directory refreshed from server!");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
      }
    } catch (err) {
      console.warn("[UserManagement] API Fetch error:", err);
      const errMsg = formatApiError(err, "Failed to load leaders from server.");
      setLeaders([]);
      setSelected(null);
      setFetchError(errMsg);
      setErrorMsg(errMsg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthorized, pageSize]);

  useEffect(() => {
    if (isAuthorized) {
      loadLeaders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized]);

  useEffect(() => {
    if (selected && !isAdding && !isEditing) {
      setForm({
        emp_id: selected.emp_id || "",
        first_name: selected.first_name || "",
        last_name: selected.last_name || "",
        email: selected.email || "",
        password: "",
        designation: selected.designation || "",
        is_active: selected.is_active !== undefined ? selected.is_active : true
      });
    }
  }, [selected, isAdding, isEditing]);

  const formatDate = (isoString) => {
    if (!isoString) return 'Not updated yet';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return isoString;
    }
  };

  // Smart search: client-side when all data is loaded, server-side when paginated
  const allDataLoaded = totalLeaders === null || leaders.length >= totalLeaders;

  // Debounce: 350ms after user stops typing, commit searchInput → search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Server-side search effect (fires when debounced `search` settles — no extra timer needed)
  useEffect(() => {
    if (allDataLoaded) {
      setSearchResults(null);
      return;
    }
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    let cancelled = false;
    const fetchLimit = Math.min(100, Math.max(10, pageSize || 10));
    searchLeaders(search.trim(), { limit: fetchLimit })
      .then(res => {
        if (cancelled) return;
        let data = [];
        if (res && Array.isArray(res.data)) data = res.data;
        else if (Array.isArray(res)) data = res;
        setSearchResults(data);
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('[UserManagement] Search error:', err);
        setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => { cancelled = true; setIsSearching(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allDataLoaded]);

  const filtered = useMemo(() => {
    return leaders.filter(l => {
      const q = search.toLowerCase();
      const name = l.full_name || `${l.first_name || ''} ${l.last_name || ''}`;
      const matchSearch = !q ||
        name.toLowerCase().includes(q) ||
        (l.email && l.email.toLowerCase().includes(q)) ||
        (l.emp_id && String(l.emp_id).toLowerCase().includes(q)) ||
        (l.leader_id && String(l.leader_id).toLowerCase().includes(q)) ||
        (l.designation && l.designation.toLowerCase().includes(q)) ||
        (l.role && l.role.toLowerCase().includes(q));

      let matchActive = true;
      if (activeFilterTab === 'active') matchActive = Boolean(l.is_active);
      if (activeFilterTab === 'inactive') matchActive = !l.is_active;

      return matchSearch && matchActive;
    });
  }, [leaders, searchResults, search, activeFilterTab, allDataLoaded]);

  // Reset to page 1 whenever search, filter, or results change
  useEffect(() => { setCurrentPage(1); }, [search, activeFilterTab, searchResults]);

  // Authorization Guard: Strictly limited to Admin / Super Admin
  if (!isAuthorized) {
    const currentDesignation = user?.designation || user?.role || "Staff Member";
    return (
      <div className="um-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '520px', padding: '32px' }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          background: 'rgba(9, 14, 21, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderLeft: '5px solid #EF4444',
          borderRadius: '16px',
          padding: '38px 32px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9), 0 0 35px rgba(239, 68, 68, 0.15)',
          textAlign: 'center',
          backdropFilter: 'blur(16px)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            margin: '0 auto 20px auto',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
          }}>
            <MdLock />
          </div>

          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
            Access Restricted
          </h2>

          <p style={{ fontSize: '14.5px', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 22px 0' }}>
            The Admin Setup & User Management module is strictly restricted to <strong style={{ color: '#00C6FF' }}>Super Admins</strong>.
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '13px',
            color: '#CBD5E1',
            marginBottom: '26px'
          }}>
            <span>Current Role / Designation:</span>
            <span style={{ fontWeight: 800, color: '#FFAA00' }}>{currentDesignation}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('switch-view', { detail: 'dashboard' }));
                }
              }}
              style={{
                padding: '12px 28px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #009B82, #00D4AA)',
                color: '#070C12',
                border: 'none',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 14px rgba(0, 212, 170, 0.35)',
                transition: 'all 0.16s ease'
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedLeaders = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getParsedNames = (leader) => {
    if (!leader) return { first_name: '', last_name: '' };
    if (leader.first_name || leader.last_name) {
      return {
        first_name: leader.first_name || '',
        last_name: leader.last_name || ''
      };
    }
    const parts = (leader.full_name || '').trim().split(/\s+/);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || ''
    };
  };

  const selectLeader = (l) => {
    setSelected(l);
    const { first_name, last_name } = getParsedNames(l);
    setForm({
      emp_id: l.emp_id || "",
      first_name,
      last_name,
      email: l.email || "",
      password: "",
      designation: l.designation || "",
      role: l.role || "user",
      is_active: l.is_active !== undefined ? l.is_active : true
    });
    setIsAdding(false);
    setIsEditing(false);
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setIsEditing(false);
    setShowFormPassword(false);
    setForm({
      emp_id: "",
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      designation: "",
      role: "user",
      is_active: true
    });
    setErrorMsg("");
  };

  const handleStartEdit = () => {
    if (!selected) return;
    setIsEditing(true);
    setIsAdding(false);
    setShowFormPassword(false);
    const { first_name, last_name } = getParsedNames(selected);
    setForm({
      emp_id: selected.emp_id || "",
      first_name,
      last_name,
      email: selected.email || "",
      password: "",
      designation: selected.designation || "",
      role: selected.role || "user",
      is_active: selected.is_active !== undefined ? selected.is_active : true
    });
    setErrorMsg("");
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setShowFormPassword(false);
    setErrorMsg("");
    if (selected) {
      const { first_name, last_name } = getParsedNames(selected);
      setForm({
        emp_id: selected.emp_id || "",
        first_name,
        last_name,
        email: selected.email || "",
        password: "",
        designation: selected.designation || "",
        role: selected.role || "user",
        is_active: selected.is_active !== undefined ? selected.is_active : true
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.first_name.trim() || !form.email.trim()) {
      setErrorMsg("First Name and Email are required.");
      return;
    }

    if (isAdding) {
      if (!form.password || form.password.trim().length < 6) {
        setErrorMsg("Password is required and must have at least 6 characters.");
        return;
      }

      try {
        const payload = {
          emp_id: form.emp_id ? form.emp_id.trim() : `TT00${leaders.length + 1}`,
          first_name: form.first_name.trim(),
          last_name: form.last_name ? form.last_name.trim() : "",
          email: form.email.trim(),
          password: form.password,
          designation: form.designation ? form.designation.trim() : "Sales Lead",
          role: form.role ? form.role.trim() : "user",
          is_active: Boolean(form.is_active)
        };

        const res = await createLeader(payload);
        const createdTarget = res?.data?.leader_id || res?.leader_id || res?.data?.emp_id || payload.emp_id;
        setIsAdding(false);
        setIsEditing(false);
        setSuccessMsg("Leader created successfully!");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await loadLeaders(false, createdTarget);
      } catch (err) {
        setErrorMsg(formatApiError(err, "Failed to create leader."));
      }
    } else if (selected) {
      if (form.password && form.password.trim() && form.password.trim().length < 6) {
        setErrorMsg("Password must have at least 6 characters.");
        return;
      }
      try {
        const { first_name: origFirst, last_name: origLast } = getParsedNames(selected);
        const payload = {
          emp_id: form.emp_id ? form.emp_id.trim() : selected.emp_id,
          first_name: form.first_name.trim(),
          last_name: form.last_name ? form.last_name.trim() : "",
          email: form.email.trim(),
          designation: form.designation ? form.designation.trim() : "",
          role: form.role ? form.role.trim() : "user",
          is_active: Boolean(form.is_active)
        };
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }

        const hasEmpIdChange = payload.emp_id !== (selected.emp_id || '').trim();
        const hasFirstChange = payload.first_name !== origFirst.trim();
        const hasLastChange = payload.last_name !== origLast.trim();
        const hasEmailChange = payload.email !== (selected.email || '').trim();
        const hasDesigChange = payload.designation !== (selected.designation || '').trim();
        const hasActiveChange = payload.is_active !== Boolean(selected.is_active);
        const hasPassChange = Boolean(payload.password);

        if (!hasEmpIdChange && !hasFirstChange && !hasLastChange && !hasEmailChange && !hasDesigChange && !hasActiveChange && !hasPassChange) {
          setSuccessMsg("No changes detected.");
          setSuccess(true);
          setIsEditing(false);
          setTimeout(() => setSuccess(false), 2500);
          return;
        }

        await updateLeader(selected.leader_id, payload);
        setIsEditing(false);
        setSuccessMsg("Leader profile updated successfully!");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await loadLeaders(false, selected.leader_id);
      } catch (err) {
        setErrorMsg(formatApiError(err, "Failed to update leader."));
      }
    }
  };

  const handleOpenDeleteModal = async (leaderToDelete) => {
    const targetLeader = leaderToDelete || selected;
    if (!targetLeader) return;
    const srcId = targetLeader.leader_id || targetLeader.id || targetLeader.emp_id;

    setDeleteModal({ isOpen: true, leader: targetLeader });
    setDeleteTargetId("");
    setDeleteModalError("");
    setDeleteLeaderProducts([]);
    setDeleteProductTargets({});
    setIsLoadingDropdown(true);
    setIsLoadingDeleteProducts(true);

    try {
      const [resDropdown, resProducts] = await Promise.all([
        getLeadersDropdown(true),
        srcId ? getLeaderProducts(srcId).catch(err => {
          console.warn("[UserManagement] getLeaderProducts failed for delete modal, falling back to getLeads:", err);
          const fetchLimit = Math.min(100, Math.max(10, pageSize || 10));
          return getLeads({ lead_owner_id: srcId, limit: fetchLimit });
        }) : Promise.resolve([])
      ]);

      const list = Array.isArray(resDropdown) ? resDropdown : (resDropdown?.data || []);
      setDropdownLeaders(list);

      const rawProds = Array.isArray(resProducts) ? resProducts : (resProducts?.data || []);
      const prodsMap = new Map();

      rawProds.forEach(p => {
        if (p.product_register_id) {
          prodsMap.set(String(p.product_register_id), {
            product_register_id: String(p.product_register_id),
            product_name: p.product_name || `Product #${p.product_id || p.product_register_id}`,
            company: p.company_name || p.company || 'Associated Lead',
            stage: p.stage || null,
            project_value: p.project_value !== undefined ? p.project_value : null
          });
        } else if (Array.isArray(p.products)) {
          p.products.forEach(subP => {
            if (subP.product_register_id) {
              prodsMap.set(String(subP.product_register_id), {
                product_register_id: String(subP.product_register_id),
                product_name: subP.product_name || `Product #${subP.product_id}`,
                company: p.company || 'Associated Lead',
                stage: subP.stage || null,
                project_value: subP.project_value !== undefined ? subP.project_value : null
              });
            }
          });
        }
      });

      setDeleteLeaderProducts(Array.from(prodsMap.values()));
    } catch (err) {
      console.warn("[UserManagement] Failed to fetch data for deletion modal:", err);
      setDropdownLeaders(leaders);
    } finally {
      setIsLoadingDropdown(false);
      setIsLoadingDeleteProducts(false);
    }
  };

  const handleDelete = (idOrLeader) => {
    const leaderToDelete = typeof idOrLeader === 'object' && idOrLeader !== null
      ? idOrLeader
      : (leaders.find(l => (l.leader_id || l.id) === idOrLeader) || selected || { leader_id: idOrLeader, full_name: idOrLeader });
    handleOpenDeleteModal(leaderToDelete);
  };

  const handleConfirmDeleteAndDelegate = async () => {
    if (!deleteModal.leader) return;
    const sourceLeaderId = deleteModal.leader.leader_id || deleteModal.leader.id || deleteModal.leader.emp_id;

    // Build per-product assignments
    const unassignedProducts = [];
    const product_assignments = deleteLeaderProducts.map(prod => {
      const targetId = deleteProductTargets[prod.product_register_id] || deleteTargetId;
      if (!targetId) {
        unassignedProducts.push(prod.product_name || prod.product_register_id);
      }
      return {
        product_register_id: prod.product_register_id,
        target_leader_id: targetId
      };
    });

    if (unassignedProducts.length > 0) {
      setDeleteModalError(`Please select a target leader for product(s): ${unassignedProducts.join(', ')}`);
      return;
    }

    if (!deleteTargetId && product_assignments.length === 0) {
      setDeleteModalError("Please select a target leader for permission delegation.");
      return;
    }

    setIsDeletingAndDelegating(true);
    setDeleteModalError("");

    try {
      await reassignProducts({
        source_leader_id: sourceLeaderId,
        deactivate_source: true,
        product_assignments: product_assignments,
        default_target_leader_id: deleteTargetId || (product_assignments[0]?.target_leader_id || "")
      });

      await deleteLeader(sourceLeaderId);

      const targetLeader = dropdownLeaders.find(l => (l.leader_id || l.id) === deleteTargetId) || leaders.find(l => (l.leader_id || l.id) === deleteTargetId);
      const targetName = targetLeader?.full_name || targetLeader?.name || deleteTargetId || "target leaders";
      const sourceName = deleteModal.leader.full_name || deleteModal.leader.name || sourceLeaderId;

      setIsEditing(false);
      setIsAdding(false);
      setSuccessMsg(`All products delegated to ${targetName}, and leader ${sourceName} deleted successfully.`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4500);

      setDeleteModal({ isOpen: false, leader: null });
      await loadLeaders(false);
    } catch (err) {
      console.error("[UserManagement] Delete and delegate error:", err);
      setDeleteModalError(formatApiError(err, "Failed to delegate permissions and delete leader account."));
    } finally {
      setIsDeletingAndDelegating(false);
    }
  };

  const handleToggleActiveQuick = async () => {
    if (!selected) return;
    const nextStatus = !selected.is_active;
    try {
      await updateLeader(selected.leader_id, { is_active: nextStatus });
      setForm(prev => ({ ...prev, is_active: nextStatus }));
      await loadLeaders(false, selected.leader_id);
    } catch (err) {
      console.warn("[UserManagement] Toggle active error:", err);
      setErrorMsg(formatApiError(err, "Failed to update leader status."));
    }
  };

  const handleConfirmDeactivateAndDelegate = async () => {
    if (!deactivateModal.leader) return;
    const sourceLeaderId = deactivateModal.leader.leader_id || deactivateModal.leader.id || deactivateModal.leader.emp_id;

    // Build per-product assignments
    const unassignedProducts = [];
    const product_assignments = deactivateLeaderProducts.map(prod => {
      const targetId = deactivateProductTargets[prod.product_register_id] || delegationTargetId;
      if (!targetId) {
        unassignedProducts.push(prod.product_name || prod.product_register_id);
      }
      return {
        product_register_id: prod.product_register_id,
        target_leader_id: targetId
      };
    });

    if (unassignedProducts.length > 0) {
      setDelegationModalError(`Please select a target leader for product(s): ${unassignedProducts.join(', ')}`);
      return;
    }

    if (!delegationTargetId && product_assignments.length === 0) {
      setDelegationModalError("Please select a default target leader for permission delegation.");
      return;
    }

    setIsDelegatingAndDeactivating(true);
    setDelegationModalError("");

    try {
      await reassignProducts({
        source_leader_id: sourceLeaderId,
        deactivate_source: true,
        product_assignments: product_assignments,
        default_target_leader_id: delegationTargetId || (product_assignments[0]?.target_leader_id || "")
      });

      await updateLeader(sourceLeaderId, { is_active: false });

      const targetLeader = leaders.find(l => (l.leader_id || l.id) === delegationTargetId);
      const targetName = targetLeader?.full_name || targetLeader?.first_name || delegationTargetId || "target leaders";

      setSuccessMsg(`Permissions delegated to ${targetName} and account deactivated successfully.`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);

      setDeactivateModal({ isOpen: false, leader: null });
      await loadLeaders(false, sourceLeaderId);
    } catch (err) {
      console.error("[UserManagement] Deactivate and delegate error:", err);
      setDelegationModalError(formatApiError(err, "Failed to delegate permissions and deactivate account."));
    } finally {
      setIsDelegatingAndDeactivating(false);
    }
  };

  return (
    <div className="um-page">
      <div className="um-container">

        {/* ── Top Tabs Strip ─────────────────────────────────────────────── */}
        <div className="um-admin-tabstrip">
          {ADMIN_TABS.filter(tab => tab.id !== 'weekly_pdfs' || isSuperAdmin(user)).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`um-admin-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="um-tab-icon">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Tab Content Panel ─────────────────────────────────────────── */}
        <div className="um-content-panel">

          {/* TAB 1: LEADERS DIRECTORY */}
          {activeTab === "leaders" && (
            <div className="um-panel">
              <PanelHeader
                icon={<MdPerson />}
                iconBg="rgba(0,212,170,0.15)"
                iconColor="#00D4AA"
                title="Leaders & Workspace Directory"
                sub="Configure registered enterprise leaders, roles, and authorization levels"
                actions={
                  <>
                    {/* Export button commented out per design directive
                    <button
                      type="button"
                      className="um-btn-secondary"
                      onClick={() => {
                        const csv = ['Leader ID,EMP ID,Name,Email,Designation,Status', ...leaders.map(l => `"${l.leader_id}","${l.emp_id}","${l.full_name}","${l.email}","${l.designation}","${l.is_active ? 'Active' : 'Inactive'}"`)].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `leaders_export_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                      }}
                      style={{ gap: 6 }}
                    >
                      <MdFileDownload style={{ fontSize: "1.1rem" }} />
                      <span>Export</span>
                    </button>
                    */}

                    <PrimaryBtn onClick={handleStartAdd}>
                      <MdAdd style={{ fontSize: "1.1rem" }} />
                      <span>Add New Leader</span>
                    </PrimaryBtn>
                  </>
                }
              />

              {success && <SuccessAlert msg={successMsg} />}
              {errorMsg && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                  background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                  borderLeft: "3px solid #ef4444", borderRadius: 10, marginBottom: 16,
                  color: "#fca5a5", fontSize: "0.88rem", fontWeight: 600
                }}>
                  <MdWarning style={{ color: "#ef4444", fontSize: "1.2rem", flexShrink: 0 }} />
                  <span><strong>Error:</strong> {errorMsg}</span>
                  <button onClick={() => setErrorMsg("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>✕</button>
                </div>
              )}

              <div className="um-two-col">

                {/* Left List */}
                <div className="um-side-card">

                  {/* Filter Pills Bar & Red Trash Can */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <button
                        type="button"
                        className="um-filter-btn"
                        onClick={() => setActiveFilterTab('all')}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '6px',
                          background: activeFilterTab === 'all' ? '#00D4AA' : 'transparent',
                          color: activeFilterTab === 'all' ? '#070C12' : '#94A3B8',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className="um-filter-btn"
                        onClick={() => setActiveFilterTab('active')}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '6px',
                          background: activeFilterTab === 'active' ? '#00D4AA' : 'transparent',
                          color: activeFilterTab === 'active' ? '#070C12' : '#94A3B8',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Active
                      </button>
                      <button
                        type="button"
                        className="um-filter-btn"
                        onClick={() => setActiveFilterTab('inactive')}
                        style={{
                          padding: '5px 14px',
                          borderRadius: '6px',
                          background: activeFilterTab === 'inactive' ? '#00D4AA' : 'transparent',
                          color: activeFilterTab === 'inactive' ? '#070C12' : '#94A3B8',
                          fontSize: '12px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Inactive
                      </button>
                    </div>


                  </div>

                  {/* Search Input Bar */}
                  <div className="um-searchbar" style={{ width: '100%', marginBottom: '4px', flexShrink: 0 }}>
                    {isSearching
                      ? <span style={{ fontSize: '1.1rem', animation: 'spin 0.8s linear infinite', display: 'inline-block', color: '#00D4AA' }}>⟳</span>
                      : <MdSearch style={{ color: "#00D4AA", fontSize: "1.4rem" }} />
                    }
                    <input
                      className="um-search-input"
                      placeholder="Search by name or email..."
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                    />
                  </div>

                  <div className="um-user-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px 4px 4px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0' }}>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="um-user-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 16px',
                            pointerEvents: 'none',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
                          }}
                        >
                          <div className="skeleton-box" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div className="skeleton-box" style={{ width: '48%', height: '16px', borderRadius: '4px' }} />
                              <div className="skeleton-box" style={{ width: '58px', height: '18px', borderRadius: '12px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <div className="skeleton-box" style={{ width: '65px', height: '12px', borderRadius: '4px' }} />
                              <div className="skeleton-box" style={{ width: '50px', height: '12px', borderRadius: '4px' }} />
                              <div className="skeleton-box" style={{ width: '90px', height: '12px', borderRadius: '4px' }} />
                            </div>
                            <div className="skeleton-box" style={{ width: '70px', height: '18px', borderRadius: '12px', marginTop: '2px' }} />
                          </div>
                        </div>
                      ))
                    ) : fetchError ? (
                      <div style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        background: 'rgba(239, 68, 68, 0.04)',
                        border: '1px dashed rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        margin: '10px 0'
                      }}>
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '12px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ef4444',
                          fontSize: '22px'
                        }}>
                          <MdWarning />
                        </div>
                        <div>
                          <div style={{ color: '#fca5a5', fontWeight: 800, fontSize: '15px' }}>
                            Failed to Load Leaders
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '12.5px', marginTop: '4px', maxWidth: '280px', lineHeight: 1.4 }}>
                            {fetchError}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadLeaders(true)}
                          style={{
                            marginTop: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            background: 'rgba(0, 212, 170, 0.15)',
                            border: '1px solid rgba(0, 212, 170, 0.4)',
                            color: '#00D4AA',
                            fontSize: '13px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <MdRefresh /> Retry Connection
                        </button>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="um-empty-msg" style={{ padding: '40px 16px', textAlign: 'center' }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.04)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748B',
                          fontSize: '20px',
                          marginBottom: '8px'
                        }}>
                          <MdPerson />
                        </div>
                        <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '14px' }}>
                          {search ? 'No leaders match your search' : 'No leaders registered yet'}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '12.5px', marginTop: '4px' }}>
                          {search ? 'Try clearing search or active filter' : 'Click "+ Add New Leader" to register one.'}
                        </div>
                      </div>
                    ) : (
                      <>
                        {pagedLeaders.map(l => {
                          const isSel = (!isAdding && selected?.leader_id === l.leader_id);
                          const name = l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Leader';
                          return (
                            <div
                              key={l.leader_id}
                              onClick={() => selectLeader(l)}
                              className={`um-user-row ${isSel ? 'active' : ''}`}
                              style={{
                                padding: '12px 14px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                borderRadius: '10px',
                                boxSizing: 'border-box',
                                marginBottom: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              <div style={{ marginTop: '2px' }}>
                                <Avatar initials={getInitials(name)} designation={l.designation} size={42} />
                              </div>

                              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {/* Top Row: Name + Status Badge */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <span className="um-row-name-text" style={{ textTransform: "capitalize", fontWeight: 600, fontSize: '14.5px', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {name}
                                  </span>
                                  <StatusBadge status={l.is_active} />
                                </div>

                                {/* Email Address Line */}
                                <div className="um-row-email-text" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94A3B8' }}>
                                  <MdEmail style={{ color: 'rgba(0, 212, 170, 0.85)', fontSize: '13.5px', flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={l.email}>
                                    {l.email}
                                  </span>
                                </div>

                                {/* Bottom Row: LDR ID Badge & Designation Pill */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', overflow: 'hidden' }}>
                                  <span className="um-row-id-badge" style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 6px',
                                    borderRadius: '5px',
                                    background: 'rgba(0, 212, 170, 0.12)',
                                    border: '1px solid rgba(0, 212, 170, 0.3)',
                                    color: '#00D4AA',
                                    fontFamily: "'Helvetica'",
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}>
                                    <MdFingerprint style={{ fontSize: '11px' }} />
                                    {l.leader_id || 'LDR-N/A'}
                                  </span>

                                  <DesignationPill designation={l.designation} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* ── Pagination Controls ── */}
                  {!isLoading && !fetchError && filtered.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 4px 0px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      marginTop: 'auto',
                      flexShrink: 0,
                      gap: '8px'
                    }}>
                      {/* Left Summary Text */}
                      <div className="um-pagination-info" style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
                        Showing <strong style={{ color: '#00D4AA' }}>{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong style={{ color: '#FFFFFF' }}>{filtered.length} Leaders</strong>
                      </div>

                      {/* Right: Prev / Page numbers / Next */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '7px',
                            border: currentPage === 1 ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 212, 170, 0.35)',
                            background: currentPage === 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 212, 170, 0.1)',
                            color: currentPage === 1 ? '#475569' : '#00D4AA',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <MdChevronLeft style={{ fontSize: '18px' }} />
                        </button>

                        <button
                          type="button"
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 8px',
                            borderRadius: '7px',
                            border: '1px solid rgba(0, 212, 170, 0.6)',
                            background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(0, 198, 255, 0.15))',
                            color: '#00D4AA',
                            fontSize: '12.5px',
                            fontWeight: 800,
                            boxShadow: '0 0 10px rgba(0, 212, 170, 0.25)',
                            cursor: 'default'
                          }}
                        >
                          {currentPage}
                        </button>

                        <button
                          type="button"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '7px',
                            border: currentPage >= totalPages ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 212, 170, 0.35)',
                            background: currentPage >= totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 212, 170, 0.1)',
                            color: currentPage >= totalPages ? '#475569' : '#00D4AA',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <MdChevronRight style={{ fontSize: '18px' }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Form / Details Inspector */}
                <div className="um-edit-col">
                  {isLoading ? (
                    <div className="um-details-panel" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 20, borderBottom: "1px solid rgba(49,151,149,0.15)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <div className="skeleton-box" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div className="skeleton-box" style={{ width: 180, height: 24, borderRadius: 4 }} />
                            <div className="skeleton-box" style={{ width: 120, height: 14, borderRadius: 4 }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div className="skeleton-box" style={{ width: 110, height: 38, borderRadius: 8 }} />
                          <div className="skeleton-box" style={{ width: 40, height: 38, borderRadius: 8 }} />
                        </div>
                      </div>

                      <div className="um-detail-grid" style={{ marginBottom: 24 }}>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="um-detail-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                            <div className="skeleton-box" style={{ width: "40%", height: 12, borderRadius: 3 }} />
                            <div className="skeleton-box" style={{ width: "75%", height: 18, borderRadius: 4 }} />
                          </div>
                        ))}
                      </div>

                      <div className="skeleton-box" style={{ width: "100%", height: 74, borderRadius: 12 }} />
                    </div>
                  ) : fetchError ? (
                    <div className="um-empty-state" style={{ padding: "50px 24px", borderColor: "rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.02)" }}>
                      <div className="um-empty-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                        <MdWarning />
                      </div>
                      <div className="um-empty-title" style={{ color: "#fca5a5" }}>Directory Service Error</div>
                      <div className="um-empty-hint" style={{ color: "#94a3b8", maxWidth: "380px" }}>
                        Unable to load leader profiles due to a network connection issue or backend service error.
                      </div>
                      <PrimaryBtn onClick={() => loadLeaders(true)} style={{ marginTop: 20 }}>
                        <MdRefresh style={{ fontSize: "1.2rem" }} /> Retry Connection
                      </PrimaryBtn>
                    </div>
                  ) : isAdding || (selected && isEditing) ? (
                    /* ── EDIT / CREATE FORM MODE ── */
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <h4 style={{ margin: 0, color: "#FFFFFF", fontSize: "17px", fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#00D4AA', fontSize: '20px', fontWeight: 800 }}>+</span>
                          <span>{isAdding ? "Create New User" : `Edit User: ${selected?.full_name}`}</span>
                        </h4>
                      </div>

                      <form onSubmit={handleSubmit} className="um-form" autoComplete="off">
                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

                          {/* Inline Form Error Alert */}
                          {errorMsg && (
                            <div style={{
                              display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                              background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.45)",
                              borderLeft: "4px solid #ef4444", borderRadius: 10,
                              color: "#fca5a5", fontSize: "0.88rem", fontWeight: 600
                            }}>
                              <MdWarning style={{ color: "#ef4444", fontSize: "1.3rem", flexShrink: 0 }} />
                              <span style={{ flex: 1, lineHeight: 1.5 }}>{errorMsg}</span>
                              <button
                                type="button"
                                onClick={() => setErrorMsg("")}
                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1rem", padding: "2px 6px" }}
                              >
                                ✕
                              </button>
                            </div>
                          )}

                          {/* Leader ID & EMP ID */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            {!isAdding && selected && (
                              <InputField label="Leader ID" icon={<MdFingerprint />}>
                                <input
                                  style={{ ...inpStyle, opacity: 0.65, color: "#00D4AA", fontFamily: "'Helvetica'", fontWeight: 800 }}
                                  value={selected.leader_id}
                                  disabled
                                />
                              </InputField>
                            )}

                            <InputField label="Employee ID (EMP_ID)" icon={<MdFingerprint />}>
                              <input
                                style={inpStyle}
                                placeholder="e.g. TT001"
                                value={form.emp_id}
                                onChange={e => setForm({ ...form, emp_id: e.target.value })}
                                required
                                name="new_emp_id_field"
                                autoComplete="off"
                              />
                            </InputField>
                          </div>

                          {/* First Name & Last Name */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <InputField label="First Name" icon={<MdPerson />}>
                              <input
                                style={inpStyle}
                                placeholder="First Name"
                                value={form.first_name}
                                onChange={e => setForm({ ...form, first_name: e.target.value })}
                                required
                                name="new_first_name_field"
                                autoComplete="off"
                              />
                            </InputField>

                            <InputField label="Last Name" icon={<MdPerson />}>
                              <input
                                style={inpStyle}
                                placeholder="Last Name"
                                value={form.last_name}
                                onChange={e => setForm({ ...form, last_name: e.target.value })}
                                name="new_last_name_field"
                                autoComplete="off"
                              />
                            </InputField>
                          </div>

                          {/* Email Address */}
                          <InputField label="Email Address" icon={<MdEmail />}>
                            <input
                              type="email"
                              style={inpStyle}
                              placeholder="leader@tardidtech.com"
                              value={form.email}
                              onChange={e => setForm({ ...form, email: e.target.value })}
                              required
                              name="new_leader_email_field"
                              autoComplete="new-email"
                            />
                          </InputField>

                          {/* Password */}
                          <InputField label={isAdding ? "Password *" : "Password (leave blank to keep unchanged)"} icon={<MdLock />}>
                            <div style={{ position: "relative", width: "100%" }}>
                              <input
                                type={showFormPassword ? "text" : "password"}
                                style={{ ...inpStyle, paddingRight: "44px" }}
                                placeholder={isAdding ? "Enter account password (min 6 chars)" : "Enter new password (min 6 chars)"}
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                required={isAdding}
                                name="leader_password_input"
                                autoComplete="new-password"
                              />
                              <button
                                type="button"
                                onClick={() => setShowFormPassword(prev => !prev)}
                                style={{
                                  position: "absolute",
                                  right: "12px",
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  background: "transparent",
                                  border: "none",
                                  color: "#94A3B8",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "18px",
                                  padding: "4px"
                                }}
                                title={showFormPassword ? "Hide password" : "Show password"}
                              >
                                {showFormPassword ? <MdVisibilityOff /> : <MdVisibility />}
                              </button>
                            </div>
                          </InputField>


                          {/* Designation & System Role */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                            <InputField label="Designation" icon={<MdWork />}>
                              <input
                                style={inpStyle}
                                placeholder="e.g. Sales Manager, Regional Lead, Account Executive"
                                value={form.designation}
                                onChange={e => setForm({ ...form, designation: e.target.value })}
                                required
                                name="new_designation_field"
                                autoComplete="off"
                              />
                            </InputField>

                            <InputField label="System Role *" icon={<MdWork />}>
                              <select
                                style={{ ...inpStyle, cursor: "pointer" }}
                                value={form.role || "user"}
                                onChange={e => setForm({ ...form, role: e.target.value })}
                              >
                                <option value="user" style={{ background: '#0D141F', color: '#FFFFFF' }}>User</option>
                                <option value="admin" style={{ background: '#0D141F', color: '#FFFFFF' }}>Admin</option>
                                <option value="super admin" style={{ background: '#0D141F', color: '#FFFFFF' }}>Super Admin</option>
                              </select>
                            </InputField>
                          </div>

                          {/* Is Active Toggle */}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 18px", background: "rgba(5,8,14,0.6)",
                            borderRadius: 10, border: "1px solid rgba(49,151,149,0.2)"
                          }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f1f5f9" }}>Is Active Status:</span>
                            <Toggle on={form.is_active} onColor="#00D4AA" onClick={() => setForm({ ...form, is_active: !form.is_active })} />
                            <span style={{ fontSize: "0.82rem", color: form.is_active ? "#10b981" : "#94a3b8", fontWeight: 700 }}>
                              {form.is_active ? "Active account with full workspace privileges" : "Deactivated account"}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                          <PrimaryBtn type="submit">
                            <MdSave style={{ fontSize: "1.1rem" }} />
                            {isAdding ? "Create Leader" : "Save Changes"}
                          </PrimaryBtn>

                          <button
                            type="button"
                            onClick={handleCancelForm}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px",
                              background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)",
                              borderRadius: 10, color: "#94a3b8", fontSize: "0.9rem", fontWeight: 700,
                              cursor: "pointer", transition: "all 0.22s ease"
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </>
                  ) : selected ? (
                    /* ── READ-ONLY DISPLAY MODE (NO PASSWORD SHOWN) ── */
                    /* ── READ-ONLY DISPLAY MODE ── */
                    <div className="um-details-panel">
                      {/* Header Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '16px',
                        marginBottom: '18px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        flexWrap: 'wrap',
                        gap: 14
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <Avatar initials={getInitials(selected.full_name)} designation={selected.designation} size={48} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 className="um-hero-title" style={{ margin: 0, fontWeight: 600, fontSize: '19.5px', color: '#FFFFFF', letterSpacing: '-0.01em', textTransform: 'capitalize' }}>
                                {selected.full_name}
                              </h3>
                            </div>
                            <div className="um-hero-sub" style={{ color: '#00D4AA', fontWeight: 500, fontSize: '14px', fontFamily: "'Helvetica'", marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{selected.leader_id} · <span style={{ color: '#94A3B8' }}>EMP ID: {selected.emp_id}</span></span>
                            </div>
                          </div>
                        </div>

                        {/* Top Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={handleStartEdit}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 16px',
                              borderRadius: '7px',
                              background: 'rgba(0, 212, 170, 0.12)',
                              border: '1px solid rgba(0, 212, 170, 0.35)',
                              color: '#00D4AA',
                              fontSize: '13.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.12)'}
                          >
                            <MdEdit style={{ fontSize: '16px' }} />
                            <span>Edit Profile</span>
                          </button>

                          <button
                            type="button"
                            title="Delete Leader"
                            onClick={() => handleDelete(selected.leader_id)}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '7px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#EF4444',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.24)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                          >
                            <MdDelete style={{ fontSize: '17px' }} />
                          </button>
                        </div>
                      </div>

                      {/* Clean 2-Column Info Grid */}
                      <div className="um-detail-grid" style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '10px',
                        padding: '18px 22px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '18px 24px',
                        marginBottom: '18px'
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Leader Identifier
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 600, fontSize: '15.5px', color: '#00D4AA', fontFamily: "'Helvetica'", marginTop: '4px', wordBreak: 'break-word' }}>
                            {selected.leader_id}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Employee ID
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 600, fontSize: '15.5px', color: '#00C6FF', fontFamily: "'Helvetica'", marginTop: '4px', wordBreak: 'break-word' }}>
                            {selected.emp_id}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Designation
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 600, fontSize: '15.5px', color: '#FFFFFF', marginTop: '4px', textTransform: 'capitalize', wordBreak: 'break-word' }}>
                            {selected.designation || 'Leader'}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Role
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <RolePill role={selected.role} />
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Account Status
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <StatusBadge status={selected.is_active} />
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Email Address
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 500, fontSize: '15px', color: '#00D4AA', fontFamily: "'Helvetica'", marginTop: '4px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            {selected.email}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Created Timestamp
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 500, fontSize: '15px', color: '#E2E8F0', marginTop: '4px', wordBreak: 'break-word' }}>
                            {formatDate(selected.created_at)}
                          </div>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div className="um-detail-label" style={{ fontWeight: 600, fontSize: '12.5px', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Last Updated
                          </div>
                          <div className="um-detail-val" style={{ fontWeight: 500, fontSize: '15px', color: '#E2E8F0', marginTop: '4px', wordBreak: 'break-word' }}>
                            {formatDate(selected.updated_at)}
                          </div>
                        </div>
                      </div>

                      {/* Clean Access Privilege Control Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        background: 'rgba(255, 255, 255, 0.025)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        flexWrap: 'wrap',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: selected.is_active ? '#00D4AA' : '#EF4444',
                            boxShadow: selected.is_active ? '0 0 10px #00D4AA' : 'none'
                          }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '15px', color: '#FFFFFF' }}>
                              Workspace Access Privileges
                            </div>
                            <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px', fontWeight: 500 }}>
                              {selected.is_active ? 'Active leader account with full workspace privileges.' : 'Deactivated account. User cannot log in.'}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (selected.is_active) {
                              handleOpenDeactivateModal(selected);
                            } else {
                              handleToggleActiveQuick();
                            }
                          }}
                          style={{
                            padding: '9px 18px',
                            borderRadius: '8px',
                            background: selected.is_active ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 212, 170, 0.15)',
                            border: selected.is_active ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(0, 212, 170, 0.4)',
                            color: selected.is_active ? '#F87171' : '#00D4AA',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {selected.is_active ? 'Deactivate Account' : 'Activate Account'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="um-empty-state">
                      <div className="um-empty-icon"><MdPerson /></div>
                      <div className="um-empty-title">No Leader Selected</div>
                      <div className="um-empty-hint">Choose a leader from the directory list on the left or create a new one.</div>
                      <PrimaryBtn onClick={handleStartAdd} style={{ marginTop: 20 }}>
                        <MdAdd style={{ fontSize: "1.2rem" }} /> Add New Leader
                      </PrimaryBtn>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: PRODUCT & STAGE DROPDOWNS (Compact 2-column view) */}
          {activeTab === "dropdown_masters" && <DropdownMastersTab />}

          {/* TAB 3: PERMISSION DELEGATION (Standalone Local State Management) */}
          {activeTab === "permission_delegation" && <PermissionDelegationTab />}

          {/* TAB 4: WEEKLY EXECUTIVE REPORTS (Super Admin Exclusive) */}
          {activeTab === "weekly_pdfs" && <WeeklyReportsTab />}

        </div>

      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Bulk Delete Leaders Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(5, 8, 14, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            background: '#0D141F',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                fontSize: '22px'
              }}>
                <MdWarning />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
                  Confirm Bulk Deletion
                </h3>
                <div style={{ fontSize: '12.5px', color: '#94A3B8', marginTop: '2px' }}>
                  This action cannot be undone.
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', color: '#CBD5E1', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete <strong style={{ color: '#EF4444' }}>{selectedLeaderIds.length}</strong> selected leader(s)?
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94A3B8',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                disabled={isBulkDeleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: isBulkDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  gap: '6px'
                }}
              >
                <MdDelete />
                <span>{isBulkDeleting ? 'Deleting...' : 'Delete Selected'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE & PERMISSION DELEGATION MODAL ───────────────────────── */}
      {deactivateModal.isOpen && deactivateModal.leader && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: 'rgba(5, 8, 14, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            if (!isDelegatingAndDeactivating) {
              setDeactivateModal({ isOpen: false, leader: null });
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#0D141F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}
              >
                <MdWarning />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
                  Deactivate Account & Delegate Permissions
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
                  Deactivating <strong style={{ color: '#F8FAFC' }}>{deactivateModal.leader.full_name || deactivateModal.leader.name}</strong> requires delegating their active leads, activities, and workspace access privileges to another active leader.
                </p>
              </div>
            </div>

            {/* Source Leader Details */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1.5px solid rgba(239, 68, 68, 0.35)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px'
                  }}
                >
                  {getInitials(deactivateModal.leader.full_name)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>
                    {deactivateModal.leader.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    {deactivateModal.leader.designation || 'Leader'} • {deactivateModal.leader.leader_id || deactivateModal.leader.emp_id}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#EF4444',
                  letterSpacing: '0.04em'
                }}
              >
                Deactivating Account
              </span>
            </div>

            {/* Target Leader Selection Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Select Default Target Leader (Optional - Bulk Assign All Products)
              </label>
              <select
                value={delegationTargetId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDelegationTargetId(val);
                  setDelegationModalError('');
                  if (val && deactivateLeaderProducts.length > 0) {
                    const autoTargets = {};
                    deactivateLeaderProducts.forEach(p => {
                      autoTargets[p.product_register_id] = val;
                    });
                    setDeactivateProductTargets(autoTargets);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(5, 8, 14, 0.9)',
                  border: '1px solid rgba(0, 212, 170, 0.35)',
                  color: '#F8FAFC',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">
                  {isLoadingDropdown ? "Loading Leaders from /api/v1/leaders/dropdown..." : "-- Select Single Destination Leader for All Products (Optional) --"}
                </option>
                {dropdownLeaders
                  .filter((l) => {
                    const lid = l.leader_id || l.id;
                    const srcId = deactivateModal.leader?.leader_id || deactivateModal.leader?.id;
                    return l.is_active !== false && lid !== srcId;
                  })
                  .map((l) => {
                    const lid = l.leader_id || l.id;
                    const name = l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`;
                    const desig = l.designation ? ` (${l.designation})` : '';
                    const emp = l.emp_id || lid ? ` - ${l.emp_id || lid}` : '';
                    return (
                      <option key={lid} value={lid}>
                        {name}{desig}{emp}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Per-Product Target Leader Assignments */}
            {deactivateLeaderProducts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Assign Products to Specific Leaders
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {deactivateLeaderProducts.map(prod => (
                    <div
                      key={prod.product_register_id}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(5, 8, 14, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prod.product_name} <span style={{ color: '#64748B', fontWeight: 500 }}>({prod.company})</span>
                      </div>
                      <select
                        value={deactivateProductTargets[prod.product_register_id] || ''}
                        onChange={e => setDeactivateProductTargets({ ...deactivateProductTargets, [prod.product_register_id]: e.target.value })}
                        style={{
                          width: '220px',
                          flexShrink: 0,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(0, 212, 170, 0.3)',
                          color: '#F8FAFC',
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Use Default Target Leader --</option>
                        {dropdownLeaders
                          .filter((l) => {
                            const lid = l.leader_id || l.id;
                            const srcId = deactivateModal.leader?.leader_id || deactivateModal.leader?.id;
                            return l.is_active !== false && lid !== srcId;
                          })
                          .map((l) => {
                            const lid = l.leader_id || l.id;
                            const name = l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`;
                            return (
                              <option key={lid} value={lid}>
                                {name} ({lid})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {delegationModalError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#FCA5A5',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {delegationModalError}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setDeactivateModal({ isOpen: false, leader: null })}
                disabled={isDelegatingAndDeactivating}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#CBD5E1',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              {(() => {
                const canDeactivate = Boolean(delegationTargetId) || (
                  deactivateLeaderProducts.length > 0 && deactivateLeaderProducts.every(p => Boolean(deactivateProductTargets[p.product_register_id]))
                );
                return (
                  <button
                    type="button"
                    onClick={handleConfirmDeactivateAndDelegate}
                    disabled={isDelegatingAndDeactivating || !canDeactivate}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      background: isDelegatingAndDeactivating || !canDeactivate
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'linear-gradient(135deg, #DC2626, #EF4444)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isDelegatingAndDeactivating || !canDeactivate ? 'not-allowed' : 'pointer',
                      boxShadow: isDelegatingAndDeactivating || !canDeactivate ? 'none' : '0 4px 16px rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isDelegatingAndDeactivating ? 'Delegating & Deactivating...' : 'Delegate & Deactivate Account'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE & PERMISSION DELEGATION MODAL ───────────────────────── */}
      {deleteModal.isOpen && deleteModal.leader && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: 'rgba(5, 8, 14, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => {
            if (!isDeletingAndDelegating) {
              setDeleteModal({ isOpen: false, leader: null });
            }
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: '#0D141F',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '16px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.25)',
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  flexShrink: 0
                }}
              >
                <MdDelete />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>
                  Delete Account & Delegate Permissions
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8', lineHeight: 1.5 }}>
                  Deleting <strong style={{ color: '#F8FAFC' }}>{deleteModal.leader.full_name || deleteModal.leader.name}</strong> requires transferring all their registered leads, product pipelines, and activity logs to another active leader before account removal.
                </p>
              </div>
            </div>

            {/* Source Leader Details */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1.5px solid rgba(239, 68, 68, 0.4)',
                    color: '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px'
                  }}
                >
                  {getInitials(deleteModal.leader.full_name || deleteModal.leader.name)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF' }}>
                    {deleteModal.leader.full_name || deleteModal.leader.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    {deleteModal.leader.designation || 'Leader'} • {deleteModal.leader.leader_id || deleteModal.leader.emp_id}
                  </div>
                </div>
              </div>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#EF4444',
                  letterSpacing: '0.04em'
                }}
              >
                Deleting User
              </span>
            </div>

            {/* Target Leader Selection Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 800, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Select Default Target Leader (Optional - Bulk Assign All Products)
              </label>
              <select
                value={deleteTargetId}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeleteTargetId(val);
                  setDeleteModalError('');
                  if (val && deleteLeaderProducts.length > 0) {
                    const autoTargets = {};
                    deleteLeaderProducts.forEach(p => {
                      autoTargets[p.product_register_id] = val;
                    });
                    setDeleteProductTargets(autoTargets);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'rgba(5, 8, 14, 0.9)',
                  border: '1px solid rgba(0, 212, 170, 0.35)',
                  color: '#F8FAFC',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">
                  {isLoadingDropdown ? "Loading Leaders from /api/v1/leaders/dropdown..." : "-- Select Single Destination Leader for All Products (Optional) --"}
                </option>
                {dropdownLeaders
                  .filter((l) => {
                    const lid = l.leader_id || l.id;
                    const srcId = deleteModal.leader?.leader_id || deleteModal.leader?.id;
                    return l.is_active !== false && lid !== srcId;
                  })
                  .map((l) => {
                    const lid = l.leader_id || l.id;
                    const name = l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`;
                    const desig = l.designation ? ` (${l.designation})` : '';
                    const emp = l.emp_id || lid ? ` - ${l.emp_id || lid}` : '';
                    return (
                      <option key={lid} value={lid}>
                        {name}{desig}{emp}
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Per-Product Target Leader Assignments */}
            {deleteLeaderProducts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Assign Products to Specific Leaders
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {deleteLeaderProducts.map(prod => (
                    <div
                      key={prod.product_register_id}
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(5, 8, 14, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {prod.product_name} <span style={{ color: '#64748B', fontWeight: 500 }}>({prod.company})</span>
                      </div>
                      <select
                        value={deleteProductTargets[prod.product_register_id] || ''}
                        onChange={e => setDeleteProductTargets({ ...deleteProductTargets, [prod.product_register_id]: e.target.value })}
                        style={{
                          width: '220px',
                          flexShrink: 0,
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(0, 212, 170, 0.3)',
                          color: '#F8FAFC',
                          fontSize: '12px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Use Default Target Leader --</option>
                        {dropdownLeaders
                          .filter((l) => {
                            const lid = l.leader_id || l.id;
                            const srcId = deleteModal.leader?.leader_id || deleteModal.leader?.id;
                            return l.is_active !== false && lid !== srcId;
                          })
                          .map((l) => {
                            const lid = l.leader_id || l.id;
                            const name = l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`;
                            return (
                              <option key={lid} value={lid}>
                                {name} ({lid})
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Banner */}
            {deleteModalError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#FCA5A5',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                {deleteModalError}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, leader: null })}
                disabled={isDeletingAndDelegating}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#CBD5E1',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              {(() => {
                const canDelete = Boolean(deleteTargetId) || (
                  deleteLeaderProducts.length > 0 && deleteLeaderProducts.every(p => Boolean(deleteProductTargets[p.product_register_id]))
                );
                return (
                  <button
                    type="button"
                    onClick={handleConfirmDeleteAndDelegate}
                    disabled={isDeletingAndDelegating || !canDelete}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '8px',
                      background: isDeletingAndDelegating || !canDelete
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'linear-gradient(135deg, #DC2626, #EF4444)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isDeletingAndDelegating || !canDelete ? 'not-allowed' : 'pointer',
                      boxShadow: isDeletingAndDelegating || !canDelete ? 'none' : '0 4px 16px rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isDeletingAndDelegating ? 'Delegating & Deleting...' : 'Delegate & Delete Account'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
