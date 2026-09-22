// src/components/admin/PermissionDelegationTab.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  MdVpnKey,
  MdSecurity,
  MdPerson,
  MdSearch,
  MdAdd,
  MdSave,
  MdArrowForward,
  MdArrowDropDown,
  MdCheckCircle,
  MdWarning,
  MdRefresh,
  MdChevronLeft,
  MdChevronRight
} from 'react-icons/md';
import {
  getLeaderReassignHistory,
  getLeaderReassignHistoryById,
  createReassignmentHistoryRecord,
  reassignLeader,
  reassignProducts,
  getLeadersDropdown,
  getLeaderProducts
} from '../../api/leaderApi';
import { getLeads } from '../../api/leadApi';
import { formatApiError } from './UserManagementView';

// ─── UI Atoms Matching Leaders Directory ──────────────────────────────────────

const getInitials = (name) => {
  if (!name) return "DL";
  return name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
};

const Avatar = ({ initials, size = 44 }) => (
  <div style={{
    width: size,
    height: size,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size * 0.32,
    fontWeight: 800,
    background: "rgba(0, 212, 170, 0.15)",
    border: "2px solid rgba(0, 212, 170, 0.35)",
    color: "#00D4AA",
    flexShrink: 0,
    letterSpacing: "0.5px",
    fontFamily: "Inter, sans-serif"
  }}>
    {initials}
  </div>
);

const InputField = ({ label, icon, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
    <label className="pdt-field-label">
      {icon && <span style={{ color: "#00D4AA", fontSize: "1em" }}>{icon}</span>}
      {label}
    </label>
    {children}
  </div>
);

const inpStyle = {
  background: "rgba(5, 8, 14, 0.85)",
  border: "1px solid rgba(49, 151, 149, 0.28)",
  borderRadius: 10,
  padding: "12px 16px",
  color: "#f1f5f9",
  fontSize: "0.95rem",
  fontFamily: "Inter, sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "all 0.3s ease"
};

const PrimaryBtn = ({ children, onClick, type = "button", style = {}, disabled }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="pdt-primary-btn"
    style={{
      background: disabled ? "rgba(255, 255, 255, 0.06)" : "linear-gradient(135deg, #009B82, #00D4AA)",
      border: disabled ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
      color: disabled ? "#64748B" : "#070C12",
      cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : "0 4px 16px rgba(0,212,170,0.3)",
      ...style
    }}
  >
    {children}
  </button>
);

const PanelHeader = ({ icon, iconBg, iconColor, title, sub, actions }) => (
  <div className="um-panel-header-wrap" style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid rgba(49,151,149,0.14)",
    flexWrap: "wrap"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        flexShrink: 0,
        background: iconBg,
        color: iconColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.4rem",
        boxShadow: `0 0 20px ${iconColor}20`
      }}>
        {icon}
      </div>
      <div>
        <h3 className="pdt-panel-title">
          {title}
        </h3>
        <p className="pdt-panel-sub">
          {sub}
        </p>
      </div>
    </div>
    {actions}
  </div>
);

// ─── Searchable Leader Dropdown ────────────────────────────────────────────────

function SearchableLeaderSelect({
  value,
  onChange,
  leaders = [],
  placeholder = "Select a leader...",
  excludeLeaderId = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const selectedLeader = leaders.find(l => (l.leader_id || l.id) === value);

  const filteredLeaders = useMemo(() => {
    if (!query.trim()) return leaders;
    const q = query.toLowerCase().trim();
    return leaders.filter(l => {
      const name = (l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).toLowerCase();
      const id = (l.leader_id || l.id || '').toLowerCase();
      const desg = (l.designation || '').toLowerCase();
      const emp = (l.emp_id || '').toLowerCase();
      return name.includes(q) || id.includes(q) || desg.includes(q) || emp.includes(q);
    });
  }, [leaders, query]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...inpStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          background: "rgba(5, 8, 14, 0.85)",
          borderColor: isOpen ? "#00D4AA" : "rgba(49, 151, 149, 0.28)",
          boxShadow: isOpen ? "0 0 12px rgba(0, 212, 170, 0.25)" : "none",
          minHeight: "46px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {selectedLeader ? (
            <>
              <Avatar initials={getInitials(selectedLeader.full_name || selectedLeader.name)} size={28} />
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span className="pdt-select-title" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedLeader.full_name || selectedLeader.name || `${selectedLeader.first_name || ''} ${selectedLeader.last_name || ''}`.trim()}
                </span>
                <span className="pdt-select-sub">
                  {selectedLeader.leader_id || selectedLeader.id} {selectedLeader.is_active === false ? "· (Inactive)" : ""} {selectedLeader.designation ? `· ${selectedLeader.designation}` : ""} {selectedLeader.role ? `· [${String(selectedLeader.role).toUpperCase()}]` : ""}
                </span>
              </div>
            </>
          ) : (
            <span style={{ color: "#64748B", fontSize: "0.88rem" }}>{placeholder}</span>
          )}
        </div>

        <MdArrowDropDown style={{ fontSize: "1.3rem", color: "#64748B", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#090E17",
            border: "1px solid rgba(0, 212, 170, 0.35)",
            borderRadius: 10,
            zIndex: 1000,
            boxShadow: "0 12px 30px rgba(0,0,0,0.8), 0 0 20px rgba(0, 212, 170, 0.15)",
            overflow: "hidden",
            maxHeight: "280px",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Search Box */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "#05080E" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <MdSearch style={{ position: "absolute", left: 10, color: "#64748B", fontSize: "1.1rem" }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search leader name, ID, role..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                  width: "100%",
                  padding: "7px 10px 7px 32px",
                  borderRadius: 6,
                  border: "1px solid rgba(49, 151, 149, 0.3)",
                  background: "rgba(255, 255, 255, 0.03)",
                  color: "#F8FAFC",
                  fontSize: "0.84rem",
                  outline: "none"
                }}
              />
            </div>
          </div>

          {/* Leaders List */}
          <div style={{ overflowY: "auto", flex: 1, padding: "4px" }}>
            {filteredLeaders.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "#64748B", fontSize: "0.82rem" }}>
                No leaders match "{query}"
              </div>
            ) : (
              filteredLeaders.map(l => {
                const id = l.leader_id || l.id;
                const name = l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || id;
                const isSelected = value === id;
                const isExcluded = excludeLeaderId && excludeLeaderId === id;
                const isInactive = l.is_active === false;

                return (
                  <div
                    key={id}
                    onClick={() => {
                      if (isExcluded) return;
                      onChange(id);
                      setIsOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: 6,
                      cursor: isExcluded ? "not-allowed" : "pointer",
                      opacity: isExcluded ? 0.35 : 1,
                      background: isSelected ? "rgba(0, 212, 170, 0.14)" : "transparent",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={e => {
                      if (!isExcluded && !isSelected) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isExcluded && !isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar initials={getInitials(name)} size={30} />
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: "0.86rem", fontWeight: 700, color: isSelected ? "#00D4AA" : "#F8FAFC" }}>
                            {name}
                          </span>
                          {isInactive && (
                            <span style={{
                              fontSize: "0.68rem",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(239, 68, 68, 0.12)",
                              color: "#EF4444",
                              border: "1px solid rgba(239, 68, 68, 0.25)",
                              fontWeight: 700
                            }}>
                              Inactive
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "#8CA0B8" }}>
                          {id} {l.designation ? `· ${l.designation}` : ""} {l.role ? `· [${String(l.role).toUpperCase()}]` : ""} {isExcluded ? "(Already selected as Source)" : ""}
                        </span>
                      </div>
                    </div>

                    {isSelected && <MdCheckCircle style={{ color: "#00D4AA", fontSize: "1.1rem" }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PERMISSION DELEGATION & REASSIGNMENT TAB ────────────────────────────

export default function PermissionDelegationTab() {
  const [history, setHistory] = useState([]);
  const [activeLeaders, setActiveLeaders] = useState([]);
  const [inactiveLeaders, setInactiveLeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    source_leader_id: "",
    target_leader_id: ""
  });

  const [page, setPage] = useState(0);
  const limit = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 1. Fetch History & Leaders Dropdown (single API for both active and inactive)
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    setFetchError(null);
    try {
      const [historyRes, leadersDropdownRes] = await Promise.all([
        getLeaderReassignHistory(limit, page * limit, search),
        getLeadersDropdown(true)
      ]);

      const historyList = Array.isArray(historyRes)
        ? historyRes
        : (historyRes?.data || historyRes?.items || []);
      setHistory(historyList);

      const allDropdownList = Array.isArray(leadersDropdownRes)
        ? leadersDropdownRes
        : (leadersDropdownRes?.data || []);

      const inactiveList = allDropdownList.filter(l => l.is_active === false);
      const activeList = allDropdownList.filter(l => l.is_active !== false);

      setActiveLeaders(activeList);
      setInactiveLeaders(inactiveList);

      if (historyList.length > 0 && !selected && !isAdding) {
        setSelected(historyList[0]);
      }
    } catch (err) {
      console.error("[PermissionDelegationTab] ❌ Failed to fetch delegation data:", err);
      const msg = formatApiError(err, "Unable to connect to permission delegation service.");
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search]);

  const [sourceProducts, setSourceProducts] = useState([]);
  const [productTargets, setProductTargets] = useState({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!form.source_leader_id) {
      setSourceProducts([]);
      setProductTargets({});
      return;
    }
    setLoadingProducts(true);
    getLeaderProducts(form.source_leader_id)
      .catch(err => {
        console.warn("[PermissionDelegationTab] getLeaderProducts failed, falling back to getLeads:", err);
        return getLeads({ lead_owner_id: form.source_leader_id, limit: 100 });
      })
      .then(res => {
        const rawProds = Array.isArray(res) ? res : (res?.data || []);
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
        setSourceProducts(Array.from(prodsMap.values()));
      })
      .catch(err => {
        console.warn("[PermissionDelegationTab] Failed to fetch source leader products:", err);
        setSourceProducts([]);
      })
      .finally(() => setLoadingProducts(false));
  }, [form.source_leader_id]);

  // Combined leaders list for lookups
  const allLeaders = useMemo(() => {
    return [...inactiveLeaders, ...activeLeaders];
  }, [inactiveLeaders, activeLeaders]);

  // Filter list by search query
  const filteredList = useMemo(() => {
    if (!search.trim()) return history;
    const q = search.toLowerCase().trim();
    return history.filter(item => {
      const srcName = (item.source_leader_name || "").toLowerCase();
      const srcId = (item.source_leader_id || "").toLowerCase();
      const tgtName = (item.target_leader_name || "").toLowerCase();
      const tgtId = (item.target_leader_id || "").toLowerCase();
      const byName = (item.reassigned_by_name || "").toLowerCase();
      const byId = String(item.reassigned_by || "").toLowerCase();
      const id = String(item.id || "").toLowerCase();
      return srcName.includes(q) || srcId.includes(q) || tgtName.includes(q) || tgtId.includes(q) || byName.includes(q) || byId.includes(q) || id.includes(q);
    });
  }, [history, search]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const pagedHistory = useMemo(() => {
    return filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredList, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSelect = (item) => {
    setSelected(item);
    setIsAdding(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const startCreate = () => {
    setIsAdding(true);
    setSelected(null);
    setErrorMsg("");
    setSuccessMsg("");
    setForm({
      source_leader_id: "",
      target_leader_id: ""
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.source_leader_id) {
      setErrorMsg("Please select a Source Leader to reassign from.");
      return;
    }
    if (!form.target_leader_id) {
      setErrorMsg("Please select a Target Leader to reassign to.");
      return;
    }
    if (form.source_leader_id === form.target_leader_id) {
      setErrorMsg("Source Leader and Target Leader cannot be the same person.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const unassignedProducts = [];
      const product_assignments = sourceProducts.map(prod => {
        const targetId = productTargets[prod.product_register_id] || form.target_leader_id;
        if (!targetId) {
          unassignedProducts.push(prod.product_name || prod.product_register_id);
        }
        return {
          product_register_id: prod.product_register_id,
          target_leader_id: targetId
        };
      });

      if (unassignedProducts.length > 0) {
        setErrorMsg(`Please select a target leader for product(s): ${unassignedProducts.join(', ')}`);
        return;
      }

      const res = await reassignProducts({
        source_leader_id: form.source_leader_id,
        deactivate_source: Boolean(form.deactivate_source),
        product_assignments: product_assignments,
        default_target_leader_id: form.target_leader_id || (product_assignments[0]?.target_leader_id || "")
      });

      const successText = res?.message || res?.detail || "Leader reassignment executed successfully!";
      setSuccessMsg(successText);
      setTimeout(() => setSuccessMsg(""), 4500);

      // Refresh history & dropdowns
      await fetchData();
      setIsAdding(false);
    } catch (err) {
      setErrorMsg(formatApiError(err, "Failed to reassign leader."));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSourceObj = allLeaders.find(l => (l.leader_id || l.id) === form.source_leader_id);
  const selectedTargetObj = activeLeaders.find(l => (l.leader_id || l.id) === form.target_leader_id);

  return (
    <div className="um-panel" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* ── Panel Header ── */}
      <PanelHeader
        icon={<MdVpnKey />}
        iconBg="rgba(0, 212, 170, 0.15)"
        iconColor="#00D4AA"
        title="Permission Delegation & Leader Reassignment"
        sub="Reassign pipeline leads, open activities, and portfolio ownership between executive leaders"

      />

      {/* ── Two-Column Body ── */}
      <div className="um-two-col" style={{ flex: 1, minHeight: 0 }}>
        {/* Left Column: Reassignment History */}
        <div className="um-side-card">
          {/* Search bar */}
          <div className="um-searchbar" style={{ width: '100%', marginBottom: '4px', flexShrink: 0 }}>
            <MdSearch style={{ color: "#00D4AA", fontSize: "1.4rem" }} />
            <input
              className="um-search-input"
              placeholder="Search source leader, target leader, ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* History List */}
          <div className="um-user-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px 4px 4px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0' }}>
            {loading && history.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'rgba(5, 8, 14, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 12,
                    marginBottom: 10,
                    pointerEvents: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div className="skeleton-box" style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="skeleton-box" style={{ width: '60%', height: 16, borderRadius: 4 }} />
                      <div className="skeleton-box" style={{ width: '40%', height: 12, borderRadius: 4 }} />
                      <div className="skeleton-box" style={{ width: '70%', height: 12, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <div className="skeleton-box" style={{ width: 50, height: 18, borderRadius: 12 }} />
                    <div className="skeleton-box" style={{ width: 60, height: 12, borderRadius: 4 }} />
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
                    Failed to Load History
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12.5px', marginTop: '4px', maxWidth: '280px', lineHeight: 1.4 }}>
                    {fetchError}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchData}
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
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <MdRefresh style={{ fontSize: '15px' }} /> Retry Connection
                </button>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="um-empty-msg">No reassignment history found</div>
            ) : (
              pagedHistory.map(item => {
                const isSelected = selected?.id === item.id;
                const sourceInitials = getInitials(item.source_leader_name);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`um-user-row ${isSelected ? "active" : ""}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ marginTop: '2px' }}>
                      <Avatar initials={sourceInitials} size={42} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="um-row-name pdt-row-name" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span>{item.source_leader_name}</span>
                        <MdArrowForward style={{ color: "#00D4AA", fontSize: "0.9em" }} />
                        <span style={{ color: "#00D4AA" }}>{item.target_leader_name}</span>
                      </div>

                      <div className="pdt-row-sub">
                        Reassigned by: <strong style={{ color: "#CBD5E1" }}>{item.reassigned_by_name || `ID ${item.reassigned_by}`}</strong>
                      </div>

                      <div className="pdt-row-metrics">
                        <span style={{ color: "#00C6FF" }}>
                          {item.reassigned_leads_count || 0} Leads
                        </span>
                        <span>•</span>
                        <span style={{ color: "#A855F7" }}>
                          {item.reassigned_activities_count || 0} Activities
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className="pdt-badge">
                        #{item.id}
                      </span>
                      <span className="pdt-row-sub" style={{ fontSize: "0.85em" }}>
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Pagination Controls ── */}
          {!loading && !fetchError && filteredList.length > 0 && (
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
              <div className="pdt-pagination-info">
                Showing <strong style={{ color: '#00D4AA' }}>{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredList.length)}</strong> of <strong style={{ color: '#FFFFFF' }}>{filteredList.length} Records</strong>
              </div>

              {/* Right: Prev / Active Page / Next */}
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
                  className="pdt-pagination-btn"
                  style={{
                    padding: '0 8px',
                    border: '1px solid rgba(0, 212, 170, 0.6)',
                    background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.25), rgba(0, 198, 255, 0.15))',
                    color: '#00D4AA',
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

        {/* Right Column: Form or Details Inspector */}
        <div className="um-edit-col">
          {successMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.25)",
              borderLeft: "3px solid #10b981",
              borderRadius: 10,
              marginBottom: 16,
              color: "#a7f3d0",
              fontSize: "0.87rem",
              fontWeight: 500
            }}>
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderLeft: "3px solid #ef4444",
              borderRadius: 10,
              marginBottom: 16,
              color: "#fca5a5",
              fontSize: "0.87rem",
              fontWeight: 500
            }}>
              <span><strong>Error:</strong> {errorMsg}</span>
            </div>
          )}

          {/* 0. LOADING SKELETON FOR INSPECTOR */}
          {loading && history.length === 0 ? (
            <div className="um-details-panel" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 20, borderBottom: "1px solid rgba(49,151,149,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div className="skeleton-box" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="skeleton-box" style={{ width: 220, height: 24, borderRadius: 4 }} />
                    <div className="skeleton-box" style={{ width: 150, height: 14, borderRadius: 4 }} />
                  </div>
                </div>
              </div>

              <div className="um-detail-grid" style={{ marginBottom: 24 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="um-detail-card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
                    <div className="skeleton-box" style={{ width: "45%", height: 12, borderRadius: 3 }} />
                    <div className="skeleton-box" style={{ width: "70%", height: 18, borderRadius: 4 }} />
                  </div>
                ))}
              </div>

              <div className="skeleton-box" style={{ width: "100%", height: 60, borderRadius: 12 }} />
            </div>
          ) : fetchError ? (
            <div className="um-empty-state" style={{ padding: "50px 24px", borderColor: "rgba(239, 68, 68, 0.25)", background: "rgba(239, 68, 68, 0.02)" }}>
              <div className="um-empty-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                <MdWarning />
              </div>
              <div className="um-empty-title" style={{ color: "#fca5a5" }}>Delegation Service Error</div>
              <div className="um-empty-hint" style={{ color: "#94a3b8", maxWidth: "380px" }}>
                {fetchError}
              </div>
              <button
                type="button"
                onClick={fetchData}
                style={{
                  marginTop: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  borderRadius: '8px',
                  background: 'rgba(0, 212, 170, 0.15)',
                  border: '1px solid rgba(0, 212, 170, 0.4)',
                  color: '#00D4AA',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <MdRefresh style={{ fontSize: '15px' }} /> Retry Connection
              </button>
            </div>
          ) : isAdding ? (
            <div style={{ animation: "slideIn 0.25s ease-out" }}>
              <div style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: "#fff",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MdAdd style={{ color: "#00D4AA" }} /> Reassign Leader Accounts & Activities
                </div>
              </div>

              <form onSubmit={handleSubmit} className="um-form">
                <div className="um-form-grid um-fg-2" style={{ gap: "20px 24px" }}>
                  {/* Source Leader (Searchable Dropdown for Inactive Leaders only) */}
                  <div style={{ gridColumn: "span 2" }}>
                    <InputField label="Source Leader (Inactive - Reassign From) *" icon={<MdPerson />}>
                      <SearchableLeaderSelect
                        value={form.source_leader_id}
                        onChange={id => setForm(f => ({ ...f, source_leader_id: id }))}
                        leaders={inactiveLeaders}
                        placeholder={inactiveLeaders.length === 0 ? "No inactive leaders found" : "Search and select inactive source leader..."}
                      />
                    </InputField>
                  </div>

                  {/* Target Leader (Searchable Dropdown for Active Leaders only) */}
                  <div style={{ gridColumn: "span 2" }}>
                    <InputField label="Target Leader (Active - Reassign To) *" icon={<MdPerson />}>
                      <SearchableLeaderSelect
                        value={form.target_leader_id}
                        onChange={id => {
                          setForm(f => ({ ...f, target_leader_id: id }));
                          if (id && sourceProducts.length > 0) {
                            const autoTargets = {};
                            sourceProducts.forEach(p => {
                              autoTargets[p.product_register_id] = id;
                            });
                            setProductTargets(autoTargets);
                          }
                        }}
                        leaders={activeLeaders}
                        placeholder={activeLeaders.length === 0 ? "No active leaders found" : "Search and select active target leader..."}
                        excludeLeaderId={form.source_leader_id}
                      />
                    </InputField>
                  </div>

                  {/* Per-Product Target Leader Selection (Optional) */}
                  {sourceProducts.length > 0 && (
                    <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#00D4AA", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Per-Product Target Leader Mapping (Optional)
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "200px", overflowY: "auto", paddingRight: 4 }}>
                        {sourceProducts.map(prod => (
                          <div
                            key={prod.product_register_id}
                            style={{
                              padding: "12px 14px",
                              background: "rgba(5, 8, 14, 0.6)",
                              border: "1px solid rgba(255, 255, 255, 0.08)",
                              borderRadius: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 12
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#F1F5F9" }}>
                                {prod.product_name}
                              </div>
                              <div style={{ fontSize: "0.76rem", color: "#64748B", marginTop: 2 }}>
                                {prod.company} • #{prod.product_register_id}{prod.stage ? ` • ${prod.stage}` : ''}{prod.project_value ? ` • ₹${prod.project_value.toLocaleString()}` : ''}
                              </div>
                            </div>
                            <select
                              value={productTargets[prod.product_register_id] || ""}
                              onChange={e => setProductTargets({ ...productTargets, [prod.product_register_id]: e.target.value })}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: "rgba(15, 23, 42, 0.9)",
                                border: "1px solid rgba(0, 212, 170, 0.3)",
                                color: "#F8FAFC",
                                fontSize: "0.82rem",
                                outline: "none",
                                cursor: "pointer",
                                maxWidth: "220px"
                              }}
                            >
                              <option value="">Default Target Leader</option>
                              {activeLeaders.map(l => (
                                <option key={l.leader_id || l.id} value={l.leader_id || l.id}>
                                  {l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`}
                                </option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Action Preview Box */}
                  {form.source_leader_id && form.target_leader_id && (
                    <div style={{
                      gridColumn: "span 2",
                      padding: "16px 18px",
                      background: "rgba(0, 212, 170, 0.04)",
                      border: "1px solid rgba(0, 212, 170, 0.25)",
                      borderRadius: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 6 }}>
                        <MdSecurity style={{ color: "#00D4AA" }} />
                        Reassignment Summary:
                      </div>
                      <div style={{ fontSize: "0.86rem", color: "#CBD5E1", lineHeight: 1.5 }}>
                        All active leads and pipeline activities currently owned by{" "}
                        <strong style={{ color: "#00C6FF" }}>
                          {selectedSourceObj?.full_name || selectedSourceObj?.name || form.source_leader_id}
                        </strong>{" "}
                        will be securely transferred to{" "}
                        <strong style={{ color: "#00D4AA" }}>
                          {selectedTargetObj?.full_name || selectedTargetObj?.name || form.target_leader_id}
                        </strong>.
                      </div>
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                  {(() => {
                    const canSubmit = Boolean(form.source_leader_id) && (
                      Boolean(form.target_leader_id) || (
                        sourceProducts.length > 0 && sourceProducts.every(p => Boolean(productTargets[p.product_register_id]))
                      )
                    );
                    return (
                      <PrimaryBtn type="submit" disabled={submitting || !canSubmit}>
                        <MdSave style={{ fontSize: "1.1rem" }} />
                        {submitting ? "Reassigning..." : "Execute Reassignment"}
                      </PrimaryBtn>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setErrorMsg("");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "11px 22px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 10,
                      color: "#94a3b8",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.22s ease"
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : selected ? (
            /* ── 2. READ-ONLY RECORD INSPECTOR ── */
            <div className="um-details-panel">
              {/* Hero Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '14px',
                marginBottom: '16px',
                borderBottom: '1px solid rgba(49, 151, 149, 0.15)',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <Avatar initials={getInitials(selected.source_leader_name)} size={46} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <h3 className="um-hero-title pdt-hero-title">
                        {selected.source_leader_name} <span style={{ color: '#00D4AA' }}>→</span> {selected.target_leader_name}
                      </h3>
                    </div>
                    <div className="um-hero-sub pdt-hero-sub">
                      Reassignment Event #{selected.id} · {selected.created_at ? new Date(selected.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean 2-Column Info Grid matching Leaders Directory */}
              <div className="um-detail-grid" style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '16px 18px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '14px 20px',
                marginBottom: '18px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Reassignment Event ID
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#00D4AA' }}>
                    #{selected.id}
                  </div>
                </div>

                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Source Leader (Transferred From)
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#00C6FF' }}>
                    {selected.source_leader_name} <span style={{ fontSize: '0.85em', color: '#94A3B8', fontWeight: 600 }}>({selected.source_leader_id})</span>
                  </div>
                </div>

                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Target Leader (Transferred To)
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#00D4AA' }}>
                    {selected.target_leader_name} <span style={{ fontSize: '0.85em', color: '#94A3B8', fontWeight: 600 }}>({selected.target_leader_id})</span>
                  </div>
                </div>

                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Executed By
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#FFFFFF' }}>
                    {selected.reassigned_by_name || `Admin ID #${selected.reassigned_by}`}
                  </div>
                </div>

                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Transferred Leads
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#00C6FF' }}>
                    {selected.reassigned_leads_count || 0} Leads
                  </div>
                </div>

                <div>
                  <div className="um-detail-label pdt-detail-label">
                    Transferred Activities
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#A855F7' }}>
                    {selected.reassigned_activities_count || 0} Activities
                  </div>
                </div>

                <div style={{ gridColumn: "span 2" }}>
                  <div className="um-detail-label pdt-detail-label">
                    Timestamp of Delegation / Reassignment
                  </div>
                  <div className="um-detail-val pdt-detail-val" style={{ color: '#F1F5F9' }}>
                    {selected.created_at ? new Date(selected.created_at).toLocaleString() : "N/A"}
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                background: 'rgba(0, 212, 170, 0.04)',
                border: '1px solid rgba(0, 212, 170, 0.2)',
                borderRadius: '10px'
              }}>
                <div>
                  <div className="pdt-summary-title" style={{ color: '#FFFFFF' }}>
                    Portfolio Ownership Handover Complete
                  </div>
                  <div className="pdt-summary-body" style={{ marginTop: '3px' }}>
                    All associated records have been assigned to {selected.target_leader_name}.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── 3. EMPTY STATE ── */
            <div className="um-empty-state">
              <div className="um-empty-icon"><MdVpnKey /></div>
              <div className="um-empty-title">No Reassignment Selected</div>
              <div className="um-empty-hint">Choose a past reassignment event from the list on the left or create a new delegation.</div>
              <PrimaryBtn onClick={startCreate} style={{ marginTop: 20 }}>
                <MdAdd style={{ fontSize: "1.2rem" }} /> Reassign Leaders
              </PrimaryBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
