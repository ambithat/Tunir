// src/components/activities/ActivityView.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiRefreshCw,
  FiLayers,
  FiEdit2,
  FiEye,
  FiTrash2,
  FiCalendar,
  FiClock,
  FiUser,
  FiCheckCircle,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiSave,
  FiFileText,
  FiArrowRight,
  FiActivity,
  FiRotateCcw,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiGlobe,
  FiPackage
} from 'react-icons/fi';
import {
  getActivities,
  updateActivity,
  deleteActivity,
  bulkDeleteActivities,
  deleteAllActivities
} from '../../api/activityApi';
import {
  getActivityTypeDropdown,
  getActivityOutcomeDropdown,
  getActivityStatusDropdown
} from '../../api/statusTypeApi';
import { getLeadersDropdown } from '../../api/leaderApi';
import { useAuth } from '../../context/AuthContext';
import { isExecutive, isSuperAdmin, hasAdminAccess } from '../../utils/authRoles';
import { formatCountryDisplay } from '../../utils/countryData';
import { getDateRangeParams, getTodayISO, validateActivityDate, isBackwardDate, isDateBefore, isValidDateStr, validateDateFilterRange } from '../../utils/dateUtils';

/**
 * Robust API error parser for FastAPI / Pydantic validation errors and standard backend responses
 */
export function formatApiError(err, fallback = "Operation failed.") {
  if (!err) return fallback;

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

  const data = err?.response?.data || err?.data;
  if (data) {
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
    if (typeof data.error === "string" && data.error.trim()) return data.error.trim();
    if (typeof data.msg === "string" && data.msg.trim()) return data.msg.trim();
  }

  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim();
  }

  return fallback;
}

// Dynamic Table Columns Configuration
const ALL_COLUMNS = [
  { key: 'activity_id', label: 'Activity ID', defaultVisible: false },
  { key: 'lead_id', label: 'Lead ID', defaultVisible: true },
  { key: 'company', label: 'Company', defaultVisible: true },
  { key: 'product_name', label: 'Product', defaultVisible: true },
  { key: 'contact_name', label: 'Contact', defaultVisible: true },
  { key: 'lead_owner_name', label: 'Lead Owner', defaultVisible: true },
  { key: 'activity_date', label: 'Activity Date', defaultVisible: true },
  { key: 'activity_type_name', label: 'Activity Type', defaultVisible: true },
  { key: 'next_action', label: 'Next Action', defaultVisible: true },
  { key: 'next_action_date', label: 'Next Action Date', defaultVisible: true },
  { key: 'outcome_name', label: 'Outcome', defaultVisible: true },
  { key: 'action_status_name', label: 'Action Status', defaultVisible: true },
  { key: 'overdue_reason', label: 'Overdue Reason', defaultVisible: false },
  { key: 'is_active', label: 'Active', defaultVisible: false },
  { key: 'created_at', label: 'Created At', defaultVisible: false }
];

const getProductDisplay = (act) => {
  if (!act) return '—';
  if (Array.isArray(act.products) && act.products.length > 0) {
    const names = act.products.map(p => p.product_name || p.product || (p.product_id ? `Product #${p.product_id}` : '')).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return act.product_name || act.product || '—';
};

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return isoString;
  }
};

const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return isoString;
  }
};

const getOutcomeBadgeStyle = (outcomeName) => {
  const s = (outcomeName || '').toLowerCase();
  if (s.includes('positive') || s.includes('interest') || s.includes('won') || s.includes('success')) {
    return { background: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
  }
  if (s.includes('negative') || s.includes('lost') || s.includes('reject')) {
    return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
  }
  if (s.includes('pending') || s.includes('follow') || s.includes('neutral')) {
    return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
  }
  return { background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' };
};

const getStatusBadgeStyle = (statusName) => {
  const s = (statusName || '').toLowerCase();
  if (s.includes('completed') || s.includes('done') || s.includes('closed')) {
    return { background: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
  }
  if (s.includes('not completed') || s.includes('overdue') || s.includes('cancelled')) {
    return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
  }
  return { background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
};

// Custom Select Component for Clean Dark UI
function CustomSelect({ value, onChange, options = [], placeholder = 'Select...', icon: Icon, height = '42px', searchable = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleDocClick = (e) => {
      if (selectRef.current && !selectRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  useEffect(() => {
    if (isOpen && selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  const selectedOpt = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!searchable || !query) return options;
    return options.filter(o =>
      String(o.label || '').toLowerCase().includes(query.toLowerCase()) ||
      String(o.value || '').toLowerCase().includes(query.toLowerCase())
    );
  }, [options, searchable, query]);

  return (
    <div ref={selectRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 100020 : 'auto' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          height,
          padding: '0 12px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #00D4AA' : '1px solid var(--t-border)',
          background: 'var(--t-surface-alt)',
          color: selectedOpt ? 'var(--t-fg)' : 'var(--t-fg-muted)',
          fontSize: '13.5px',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 12px rgba(0, 212, 170, 0.2)' : 'none',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {Icon && <Icon style={{ color: 'var(--t-teal)', fontSize: '15px', flexShrink: 0 }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
        </div>
        <FiChevronDown style={{ color: 'var(--t-fg-muted)', fontSize: '14px', flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {isOpen && (
        <div
          className="custom-filter-dropdown-scroll"
          style={{
            position: 'absolute',
            top: openUpward ? 'auto' : 'calc(100% + 4px)',
            bottom: openUpward ? 'calc(100% + 4px)' : 'auto',
            left: 0,
            right: 0,
            background: '#0B1118',
            border: '1px solid rgba(0, 212, 170, 0.35)',
            borderRadius: '8px',
            padding: '6px',
            zIndex: 100050,
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
            maxHeight: '180px',
            overflowY: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0, 212, 170, 0.4) rgba(0, 0, 0, 0.2)'
          }}
        >
          {searchable && (
            <div style={{ padding: '4px 4px 8px 4px' }}>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type to filter..."
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 10px',
                  background: '#131D28',
                  border: '1px solid var(--t-border)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: '10px', color: '#64748B', fontSize: '12.5px', textAlign: 'center' }}>No options found</div>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={i}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: isSelected ? '#00D4AA' : '#CBD5E1',
                    background: isSelected ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontWeight: isSelected ? 700 : 500 }}>{opt.label}</span>
                  {isSelected && <FiCheck style={{ fontSize: '13px' }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper to format next action label from ID ─────
function formatNextActionLabel(activityOrVal, typesMaster = []) {
  if (!activityOrVal) return '—';
  let val = activityOrVal;
  if (typeof activityOrVal === 'object') {
    if (activityOrVal.next_action_name) return activityOrVal.next_action_name;
    val = activityOrVal.next_action_type_id !== undefined && activityOrVal.next_action_type_id !== null ? activityOrVal.next_action_type_id : activityOrVal.next_action;
  }
  if (!val) return '—';
  const strVal = String(val).trim();
  if (!strVal) return '—';
  const found = typesMaster.find(t => String(t.id || t.activity_type_id || t.type_id || t.value) === strVal);
  if (found) {
    return found.activity_type || found.activity_type_name || found.type_name || found.name || found.label || strVal;
  }
  return strVal;
}

// ── Helper to resolve actual activity values to match master dropdown IDs ─────
function resolveActivityForm(activity, typesMaster = [], outcomesMaster = [], statusesMaster = [], leaders = []) {
  if (!activity) {
    return {
      lead_owner_id: '',
      activity_date: '',
      activity_type_id: '',

      next_action: '',
      next_action_date: '',
      outcome_id: '',
      action_status_id: '',
      is_active: true
    };
  }

  // 1. Resolve Activity Type ID
  let resolvedTypeId = '';
  if (activity.activity_type_id !== undefined && activity.activity_type_id !== null && activity.activity_type_id !== '') {
    resolvedTypeId = String(activity.activity_type_id);
  }
  if (!resolvedTypeId || (typesMaster.length > 0 && !typesMaster.some(t => String(t.id || t.activity_type_id || t.type_id || t.value) === resolvedTypeId))) {
    const rawName = String(activity.activity_type_name || activity.activity_type || activity.type_name || '').trim().toLowerCase();
    if (rawName && typesMaster.length > 0) {
      const found = typesMaster.find(t => {
        const tName = String(t.activity_type || t.activity_type_name || t.type_name || t.name || t.label || '').trim().toLowerCase();
        return tName === rawName;
      });
      if (found) resolvedTypeId = String(found.id || found.activity_type_id || found.type_id || found.value);
    }
  }

  // 2. Resolve Outcome ID
  let resolvedOutcomeId = '';
  if (activity.outcome_id !== undefined && activity.outcome_id !== null && activity.outcome_id !== '') {
    resolvedOutcomeId = String(activity.outcome_id);
  }
  if (!resolvedOutcomeId || (outcomesMaster.length > 0 && !outcomesMaster.some(o => String(o.id || o.outcome_id || o.value) === resolvedOutcomeId))) {
    const rawName = String(activity.outcome_name || activity.outcome || '').trim().toLowerCase();
    if (rawName && outcomesMaster.length > 0) {
      const found = outcomesMaster.find(o => {
        const oName = String(o.outcome || o.outcome_name || o.name || o.label || '').trim().toLowerCase();
        return oName === rawName;
      });
      if (found) resolvedOutcomeId = String(found.id || found.outcome_id || found.value);
    }
  }

  // 3. Resolve Action Status ID
  let resolvedStatusId = '';
  if (activity.action_status_id !== undefined && activity.action_status_id !== null && activity.action_status_id !== '') {
    resolvedStatusId = String(activity.action_status_id);
  }
  if (!resolvedStatusId || (statusesMaster.length > 0 && !statusesMaster.some(s => String(s.id || s.action_status_id || s.status_id || s.value) === resolvedStatusId))) {
    const rawName = String(activity.action_status_name || activity.action_status || activity.status_name || activity.status || '').trim().toLowerCase();
    if (rawName && statusesMaster.length > 0) {
      const found = statusesMaster.find(s => {
        const sName = String(s.action_status || s.action_status_name || s.status || s.status_name || s.name || s.label || '').trim().toLowerCase();
        return sName === rawName;
      });
      if (found) resolvedStatusId = String(found.id || found.action_status_id || found.status_id || found.value);
    }
  }

  // 4. Resolve Lead Owner ID
  let resolvedOwnerId = '';
  if (activity.lead_owner_id !== undefined && activity.lead_owner_id !== null && activity.lead_owner_id !== '') {
    resolvedOwnerId = String(activity.lead_owner_id);
  }
  if (!resolvedOwnerId || (leaders.length > 0 && !leaders.some(l => String(l.leader_id || l.emp_id || l.id || l.value) === resolvedOwnerId))) {
    const rawName = String(activity.lead_owner_name || activity.owner || activity.lead_owner || '').trim().toLowerCase();
    if (rawName && leaders.length > 0) {
      const found = leaders.find(l => {
        const lName = String(l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.name || l.label || '').trim().toLowerCase();
        return lName === rawName || String(l.leader_id || l.emp_id || l.id).toLowerCase() === rawName;
      });
      if (found) resolvedOwnerId = String(found.leader_id || found.emp_id || found.id || found.value);
    }
  }

  // 5. Resolve Next Action Type ID
  let resolvedNextActionTypeId = '';
  if (activity.next_action_type_id !== undefined && activity.next_action_type_id !== null && activity.next_action_type_id !== '') {
    resolvedNextActionTypeId = String(activity.next_action_type_id);
  } else if (activity.next_action !== undefined && activity.next_action !== null && activity.next_action !== '') {
    resolvedNextActionTypeId = String(activity.next_action);
  }
  if (!resolvedNextActionTypeId || (typesMaster.length > 0 && !typesMaster.some(t => String(t.id || t.activity_type_id || t.type_id || t.value) === resolvedNextActionTypeId))) {
    const rawName = String(activity.next_action_name || activity.next_action || '').trim().toLowerCase();
    if (rawName && typesMaster.length > 0) {
      const found = typesMaster.find(t => {
        const tName = String(t.activity_type || t.activity_type_name || t.type_name || t.name || t.label || '').trim().toLowerCase();
        return tName === rawName;
      });
      if (found) resolvedNextActionTypeId = String(found.id || found.activity_type_id || found.type_id || found.value);
    }
  }

  // 6. Clean Dates
  const cleanActivityDate = activity.activity_date ? String(activity.activity_date).split('T')[0] : '';
  const cleanNextActionDate = activity.next_action_date ? String(activity.next_action_date).split('T')[0] : '';

  return {
    lead_owner_id: resolvedOwnerId,
    activity_date: cleanActivityDate,
    activity_type_id: resolvedTypeId,
    meeting_plan: activity.meeting_plan || '',
    meeting_action_remarks: activity.meeting_action_remarks || '',
    next_action_type_id: resolvedNextActionTypeId,
    next_action: resolvedNextActionTypeId,
    next_action_date: cleanNextActionDate,
    next_meeting_plan: activity.next_meeting_plan || '',
    outcome_id: resolvedOutcomeId,
    action_status_id: resolvedStatusId,
    overdue_reason: activity.overdue_reason || '',
    is_active: activity.is_active !== undefined ? Boolean(activity.is_active) : true
  };
}

// ── Edit Activity Modal ───────────────────────────────────────────────────────
function EditActivityModal({
  isOpen,
  activity,
  initialEditMode = true,
  onClose,
  onUpdated,
  typesMaster = [],
  outcomesMaster = [],
  statusesMaster = [],
  leaders = []
}) {
  const currentUserObj = useMemo(() => {
    try {
      const stored = localStorage.getItem('user_data');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const currentUserRole = String(currentUserObj?.role || currentUserObj?.user_role || '').toLowerCase();
  const isCeoOrCfo = currentUserRole.includes('admin') || currentUserRole.includes('super');

  const userRoleStr = String(currentUserObj?.role || '').toLowerCase().trim();
  const isSuperAdmin = userRoleStr === 'super admin' || userRoleStr === 'superadmin' || userRoleStr === 'super_admin';

  const isOverdue = (() => {
    if (!activity) return false;
    const statusId = String(activity.action_status_id || activity.status_id || '');
    if (statusId === '8') return true;
    const statusName = String(activity.action_status_name || activity.action_status || activity.status || '').toLowerCase();
    return statusName.includes('overdue');
  })();

  const isCompleted = (() => {
    if (!activity) return false;
    const statusName = String(
      activity.action_status_name ||
      activity.action_status ||
      activity.status ||
      activity.outcome_name ||
      ''
    ).toLowerCase();
    return statusName.includes('completed') || statusName.includes('done') || statusName.includes('closed');
  })();

  const canEdit = (!isOverdue && !isCompleted) || isSuperAdmin;

  const [isAssigningForSomeone, setIsAssigningForSomeone] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [localTypes, setLocalTypes] = useState(typesMaster);
  const [localOutcomes, setLocalOutcomes] = useState(outcomesMaster);
  const [localStatuses, setLocalStatuses] = useState(statusesMaster);
  const [localLeaders, setLocalLeaders] = useState(leaders);
  const [form, setForm] = useState(() => resolveActivityForm(activity, typesMaster, outcomesMaster, statusesMaster, leaders));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isStatusChanged, setIsStatusChanged] = useState(false);

  const hasChanges = useMemo(() => {
    if (!activity) return false;
    const initial = resolveActivityForm(activity, localTypes, localOutcomes, localStatuses, localLeaders);
    return (
      String(form.lead_owner_id || '') !== String(initial.lead_owner_id || '') ||
      String(form.activity_type_id || '') !== String(initial.activity_type_id || '') ||
      String(form.meeting_plan || '').trim() !== String(initial.meeting_plan || '').trim() ||
      String(form.meeting_action_remarks || '').trim() !== String(initial.meeting_action_remarks || '').trim() ||
      String(form.next_action_type_id || '') !== String(initial.next_action_type_id || '') ||
      String(form.next_action_date || '') !== String(initial.next_action_date || '') ||
      String(form.next_meeting_plan || '').trim() !== String(initial.next_meeting_plan || '').trim() ||
      String(form.outcome_id || '') !== String(initial.outcome_id || '') ||
      String(form.action_status_id || '') !== String(initial.action_status_id || '') ||
      String(form.overdue_reason || '').trim() !== String(initial.overdue_reason || '').trim() ||
      Boolean(form.is_active) !== Boolean(initial.is_active)
    );
  }, [form, activity, localTypes, localOutcomes, localStatuses, localLeaders]);

  // Sync passed master lists to local state
  useEffect(() => {
    if (typesMaster.length > 0) setLocalTypes(typesMaster);
    if (outcomesMaster.length > 0) setLocalOutcomes(outcomesMaster);
    if (statusesMaster.length > 0) setLocalStatuses(statusesMaster);
    if (leaders.length > 0) setLocalLeaders(leaders);
  }, [typesMaster, outcomesMaster, statusesMaster, leaders]);

  // Fetch dropdowns if empty when opened
  useEffect(() => {
    if (!isOpen) return;
    if (localTypes.length === 0) {
      getActivityTypeDropdown().then(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (raw.length > 0) setLocalTypes(raw);
      }).catch(() => { });
    }
    if (localOutcomes.length === 0) {
      getActivityOutcomeDropdown().then(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (raw.length > 0) setLocalOutcomes(raw);
      }).catch(() => { });
    }
    if (localStatuses.length === 0) {
      getActivityStatusDropdown().then(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (raw.length > 0) setLocalStatuses(raw);
      }).catch(() => { });
    }
    if (localLeaders.length === 0) {
      getLeadersDropdown().then(res => {
        const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        if (raw.length > 0) setLocalLeaders(raw.filter(l => l.is_active !== false));
      }).catch(() => { });
    }
  }, [isOpen]);

  // Initialize or update form fields with actual data
  useEffect(() => {
    if (activity && isOpen) {
      setIsEditMode(initialEditMode);
      setForm(resolveActivityForm(activity, localTypes, localOutcomes, localStatuses, localLeaders));
      setErrorMsg('');
      setIsStatusChanged(false);
    }
  }, [activity, isOpen, initialEditMode, localTypes, localOutcomes, localStatuses, localLeaders]);

  if (!isOpen || !activity) return null;

  const leadId = activity.lead_id || activity.lead?.lead_id || (activity.lead_no ? `#${activity.lead_no}` : '');
  const companyName = activity.company || activity.lead?.company || '—';
  const contactPerson = activity.contact_name || activity.lead?.contact_name || '—';
  const contactEmail = activity.contact_email || activity.lead?.email || '—';
  const contactPhone = activity.contact_phone || activity.lead?.phone_no || '—';
  const contactDesignation = activity.contact_designation || activity.lead?.designation || '—';
  const country = activity.country || activity.lead?.country || 'India';
  const leadSource = activity.lead_source || activity.lead?.lead_source || '';
  const createdAt = activity.created_at || '';
  const updatedAt = activity.updated_at || '';

  // Determine single source of truth for conditional fields visibility based strictly on current Action Status
  const currentStatusObj = localStatuses.find(s => String(s.id || s.action_status_id || s.status_id || s.value) === String(form.action_status_id));
  const currentStatusName = String(
    currentStatusObj?.action_status ||
    currentStatusObj?.action_status_name ||
    currentStatusObj?.status ||
    currentStatusObj?.status_name ||
    currentStatusObj?.name ||
    currentStatusObj?.label ||
    activity?.action_status_name ||
    activity?.action_status ||
    ''
  ).trim().toLowerCase();

  const isStatusPending = !currentStatusName || currentStatusName.includes('pending');
  const showConditionalFields = !isStatusPending && (
    currentStatusName.includes('completed') ||
    currentStatusName.includes('not completed') ||
    currentStatusName.includes('not_completed') ||
    currentStatusName.includes('done') ||
    currentStatusName.includes('closed')
  );

  // Single source of truth for mandatory form field validity
  const isFormValid = (() => {
    // 1. Basic required fields
    if (!form.action_status_id) return false;

    // 2. Overdue reason requirement
    if ((isOverdue || Boolean(activity?.overdue_reason)) && (!form.overdue_reason || !form.overdue_reason.trim())) {
      return false;
    }

    // 3. Conditional fields requirements when Action Status is Completed or Not Completed
    if (showConditionalFields) {
      if (!form.meeting_action_remarks || !form.meeting_action_remarks.trim()) return false;
      if (!form.outcome_id) return false;

      const selectedOutcomeObj = localOutcomes.find(o => String(o.id || o.outcome_id || o.value) === String(form.outcome_id));
      const selectedOutcomeName = String(selectedOutcomeObj?.outcome || selectedOutcomeObj?.outcome_name || selectedOutcomeObj?.name || selectedOutcomeObj?.label || activity?.outcome_name || '').toLowerCase();
      const isOutcomeWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

      if (!isOutcomeWonOrLost) {
        if (!form.next_action) return false;
        if (!form.next_action_date) return false;
        if (form.activity_date && isDateBefore(form.next_action_date, form.activity_date)) return false;
      }
    }

    return true;
  })();

  const isSaveEnabled = canEdit && hasChanges && isFormValid && !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      setErrorMsg(
        isCompleted
          ? 'This activity has been completed. Only a Super Admin can modify completed activities.'
          : 'This activity is overdue. Only a Super Admin can modify overdue activities.'
      );
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (form.next_action_date && form.activity_date && isDateBefore(form.next_action_date, form.activity_date)) {
        setErrorMsg(`Next Action Date cannot be before the Activity Date (${String(form.activity_date).split('T')[0]}). Please select a date on or after the Activity Date.`);
        setIsSubmitting(false);
        return;
      }
      if (form.next_action_date && !validateActivityDate(form.next_action_date, 'Next Action Date')) {
        setErrorMsg('Next action date cannot be in the past (backward date like yesterday).');
        setIsSubmitting(false);
        return;
      }

      // Determine if selected outcome is Won or Lost
      const selectedOutcomeObj = localOutcomes.find(o => String(o.id || o.outcome_id || o.value) === String(form.outcome_id));
      const selectedOutcomeName = String(selectedOutcomeObj?.outcome || selectedOutcomeObj?.outcome_name || selectedOutcomeObj?.name || selectedOutcomeObj?.label || activity.outcome_name || '').toLowerCase();
      const isWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

      // Validation for Overdue Reason
      if (isOverdue || Boolean(activity.overdue_reason)) {
        if (!form.overdue_reason || !form.overdue_reason.trim()) {
          setErrorMsg('Overdue Reason is mandatory for overdue activities.');
          setIsSubmitting(false);
          return;
        }
      }

      // Validation strictly dependent on Action Status requiring conditional fields ("Completed" or "Not Completed")
      if (showConditionalFields) {
        if (!form.meeting_action_remarks || !form.meeting_action_remarks.trim()) {
          setErrorMsg('Meeting Action Remarks are mandatory.');
          setIsSubmitting(false);
          return;
        }
        if (!form.outcome_id) {
          setErrorMsg('Please select an Outcome.');
          setIsSubmitting(false);
          return;
        }
        if (!isWonOrLost) {
          if (!form.next_action) {
            setErrorMsg('Please select a Next Action for ongoing activity.');
            setIsSubmitting(false);
            return;
          }
          if (!form.next_action_date) {
            setErrorMsg('Please select a Next Action Date for ongoing activity.');
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Calculate diff payload
      const diff = {};
      if (form.lead_owner_id !== (activity.lead_owner_id || '')) diff.lead_owner_id = form.lead_owner_id || null;
      if (String(form.activity_type_id) !== String(activity.activity_type_id || '')) diff.activity_type_id = form.activity_type_id ? Number(form.activity_type_id) : null;
      if (form.meeting_plan !== (activity.meeting_plan || '')) diff.meeting_plan = form.meeting_plan.trim() || null;
      if (form.meeting_action_remarks !== (activity.meeting_action_remarks || '')) diff.meeting_action_remarks = form.meeting_action_remarks.trim() || null;

      if (isWonOrLost) {
        if (activity.next_action_type_id || activity.next_action) diff.next_action_type_id = null;
        if (activity.next_action_date) diff.next_action_date = null;
        if (activity.next_meeting_plan) diff.next_meeting_plan = null;
      } else {
        const curNextAction = form.next_action_type_id !== undefined && form.next_action_type_id !== '' ? form.next_action_type_id : form.next_action;
        const origNextAction = activity.next_action_type_id !== undefined && activity.next_action_type_id !== null && activity.next_action_type_id !== '' ? String(activity.next_action_type_id) : (activity.next_action || '');
        if (String(curNextAction || '') !== String(origNextAction || '')) {
          diff.next_action_type_id = curNextAction ? Number(curNextAction) : null;
        }
        if (form.next_action_date !== (activity.next_action_date ? String(activity.next_action_date).split('T')[0] : '')) diff.next_action_date = form.next_action_date || null;
        if (form.next_meeting_plan !== (activity.next_meeting_plan || '')) diff.next_meeting_plan = form.next_meeting_plan.trim() || null;
      }

      if (String(form.outcome_id) !== String(activity.outcome_id || '')) diff.outcome_id = form.outcome_id ? Number(form.outcome_id) : null;
      if (String(form.action_status_id) !== String(activity.action_status_id || '')) diff.action_status_id = form.action_status_id ? Number(form.action_status_id) : null;
      if (form.overdue_reason !== (activity.overdue_reason || '')) diff.overdue_reason = form.overdue_reason.trim() || null;
      if (form.is_active !== activity.is_active) diff.is_active = Boolean(form.is_active);

      // If no changes made, simply close without making unnecessary API call
      if (Object.keys(diff).length === 0) {
        setIsEditMode(false);
        onClose();
        return;
      }

      await updateActivity(activity.activity_id, diff);

      // Find label names for instantaneous UI update
      const matchedType = localTypes.find(t => String(t.id || t.activity_type_id || t.type_id || t.value) === String(form.activity_type_id));
      const matchedOutcome = localOutcomes.find(o => String(o.id || o.outcome_id || o.value) === String(form.outcome_id));
      const matchedStatus = localStatuses.find(s => String(s.id || s.action_status_id || s.status_id || s.value) === String(form.action_status_id));
      const matchedOwner = localLeaders.find(l => String(l.leader_id || l.emp_id || l.id || l.value) === String(form.lead_owner_id));

      onUpdated({
        ...activity,
        ...form,
        activity_type_name: matchedType ? (matchedType.activity_type || matchedType.activity_type_name || matchedType.type_name || matchedType.name || matchedType.label) : activity.activity_type_name,
        outcome_name: matchedOutcome ? (matchedOutcome.outcome || matchedOutcome.outcome_name || matchedOutcome.name || matchedOutcome.label) : activity.outcome_name,
        action_status_name: matchedStatus ? (matchedStatus.action_status || matchedStatus.action_status_name || matchedStatus.status || matchedStatus.status_name || matchedStatus.name || matchedStatus.label) : activity.action_status_name,
        lead_owner_name: matchedOwner ? (matchedOwner.full_name || matchedOwner.name || `${matchedOwner.first_name || ''} ${matchedOwner.last_name || ''}`.trim() || matchedOwner.label) : activity.lead_owner_name,
        updated_at: new Date().toISOString()
      });
      setIsEditMode(false);
      onClose();
    } catch (err) {
      console.error('[EditActivityModal] ❌ Failed to update activity:', err);
      setErrorMsg(formatApiError(err, 'Failed to update activity. Please verify input.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const outcomeBadge = getOutcomeBadgeStyle(activity.outcome_name || '');
  const statusBadge = getStatusBadgeStyle(activity.action_status_name || 'Open');

  const inputStyle = {
    width: '100%',
    height: '42px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid var(--t-border)',
    background: 'var(--t-surface-alt)',
    color: '#FFFFFF',
    fontSize: '13.5px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='%2300D4AA' height='20' viewBox='0 0 24 24' width='20' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: '36px'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 700,
    color: '#94A3B8',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  // Shared Lead & Contact Context Component
  const renderLeadContactContext = () => (
    <div style={{
      background: 'rgba(255, 255, 255, 0.025)',
      border: '1px solid rgba(0, 212, 170, 0.22)',
      borderRadius: '12px',
      padding: '14px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: 'rgba(0, 212, 170, 0.15)',
            border: '1px solid rgba(0, 212, 170, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00D4AA',
            fontSize: '14px'
          }}>
            <FiBriefcase />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target Lead & Account Context
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', marginTop: '1px' }}>
              {companyName}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {leadId && (
            <span style={{
              fontSize: '13px',
              fontFamily: "'Helvetica'",
              fontWeight: 800,
              color: '#38BDF8',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '3px 10px',
              borderRadius: '6px'
            }}>
              Lead #{leadId}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        alignItems: 'start',
        padding: '2px 8px'
      }}>
        {/* Contact Person */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
            <FiUser style={{ color: '#00D4AA', fontSize: '13px' }} /> Contact Person
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px', paddingLeft: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contactPerson}>
            {contactPerson}
          </div>
          {contactDesignation && contactDesignation !== '—' && (
            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px', paddingLeft: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contactDesignation}>
              {contactDesignation}
            </div>
          )}
        </div>

        {/* Email Address */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
            <FiMail style={{ color: '#00C6FF', fontSize: '13px' }} /> Email Address
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--t-cyan)', marginTop: '4px', paddingLeft: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contactEmail}>
            {contactEmail}
          </div>
        </div>

        {/* Phone Number */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
            <FiPhone style={{ color: '#38BDF8', fontSize: '13px' }} /> Phone Number
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px', paddingLeft: '12px', fontFamily: "'Helvetica'", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={contactPhone}>
            {contactPhone}
          </div>
        </div>

        {/* Country */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px', height: '20px' }}>
            Country
          </div>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#E2E8F0', marginTop: '4px', paddingLeft: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={formatCountryDisplay(country)}>
            {formatCountryDisplay(country)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--t-scrim, rgba(4, 8, 14, 0.75))',
      backdropFilter: 'blur(12px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #0D141F)',
        border: '1px solid var(--t-border, rgba(0, 212, 170, 0.3))',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--t-card-shadow, 0 25px 60px rgba(0, 0, 0, 0.7))',
        color: 'var(--t-fg, #FFFFFF)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--t-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.45))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 198, 255, 0.15))',
              border: '1px solid rgba(0, 212, 170, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--t-teal, #00D4AA)',
              fontSize: '20px',
              flexShrink: 0
            }}>
              <FiActivity />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  fontFamily: "'Helvetica'",
                  fontWeight: 800,
                  color: 'var(--t-teal, #00D4AA)',
                  background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.12))',
                  border: '1px solid var(--t-border, rgba(0, 212, 170, 0.3))',
                  padding: '2px 8px',
                  borderRadius: '5px'
                }}>
                  #{activity.activity_id}
                </span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px', color: 'var(--t-fg, #FFFFFF)' }}>
                {isEditMode ? 'Edit Activity Details' : 'Activity Details & Inspector'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View / Edit Mode Toggle Button */}
            {!isEditMode ? (
              canEdit ? (
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.12))',
                    border: '1px solid var(--t-border, rgba(0, 212, 170, 0.4))',
                    color: 'var(--t-teal, #00D4AA)',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--t-teal-tint, rgba(0, 212, 170, 0.12))'}
                >
                  <FiEdit2 style={{ fontSize: '13px' }} /> Edit Activity
                </button>
              ) : (
                <span style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 800,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#EF4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <FiAlertCircle /> {isCompleted ? 'Locked (Completed)' : 'Locked (Overdue)'}
                </span>
              )
            ) : (
              <span style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: 'rgba(0, 198, 255, 0.15)',
                color: '#00C6FF',
                border: '1px solid rgba(0, 198, 255, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                Editing Mode
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                if (isEditMode) {
                  setIsEditMode(false);
                } else {
                  onClose();
                }
              }}
              title={isEditMode ? "Cancel Edit & Return to Details" : "Close Modal"}
              style={{
                border: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))',
                background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.05))',
                color: 'var(--t-fg-muted, #8CA0B8)',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isEditMode ? (
          /* ── VIEW / INSPECTOR MODE ── */
          <div style={{ overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Associated Lead & Contact Context Card */}
            {renderLeadContactContext()}

            {/* 2. Structured Column Values Grid */}
            <div style={{
              background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--t-border, rgba(255, 255, 255, 0.07))',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '18px 16px',
              alignItems: 'start'
            }}>
              {/* Row 1: Text Fields (4 Columns) */}
              {/* Lead Owner */}
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Lead Owner</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '4px' }}>
                  {activity.lead_owner_name || 'Unassigned'}
                </div>
              </div>

              {/* Activity Date */}
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Activity Date</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #F8FAFC)', marginTop: '4px' }}>
                  {formatDate(activity.activity_date)}
                </div>
              </div>

              {/* Next Follow-Up Date (Shown only if present) */}
              {activity.next_action_date && (
                <div>
                  <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Next Follow-Up Date</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #F8FAFC)', marginTop: '4px' }}>
                    {formatDate(activity.next_action_date)}
                  </div>
                </div>
              )}

              {/* Lead ID */}
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Lead ID</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#38BDF8', marginTop: '4px', fontFamily: "'Helvetica'" }}>
                  {activity.lead_owner_id || (activity.lead_id ? `LDR-${String(activity.lead_id).padStart(4, '0')}` : '—')}
                </div>
              </div>

              {/* Row 2: All 4 Colored Badge Divs */}
              {/* Outcome (Shown only if present) */}
              {activity.outcome_name && (
                <div>
                  <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Outcome</div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{
                      padding: '5px 14px',
                      borderRadius: '7px',
                      fontSize: '13px',
                      fontWeight: 700,
                      background: outcomeBadge.background,
                      color: outcomeBadge.color,
                      border: outcomeBadge.border,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      minWidth: '80px'
                    }}>
                      {activity.outcome_name}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Status */}
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Action Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '5px 14px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 800,
                    background: statusBadge.background,
                    color: statusBadge.color,
                    border: statusBadge.border,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}>
                    {activity.action_status_name || 'Open'}
                  </span>
                </div>
              </div>


              {/* Activity Type */}
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--t-fg-muted, #94A3B8)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>Activity Type</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '5px 14px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 800,
                    background: 'rgba(56, 189, 248, 0.14)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    minWidth: '80px'
                  }}>
                    {activity.activity_type_name || 'Call'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Associated Products Card */}
            {Array.isArray(activity.products) && activity.products.length > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: '1px solid rgba(0, 212, 170, 0.22)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPackage /> Associated Lead Products ({activity.products.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {activity.products.map((p, pIdx) => (
                    <span key={p.product_register_id || pIdx} style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(0, 212, 170, 0.12)',
                      border: '1px solid rgba(0, 212, 170, 0.3)',
                      color: '#00D4AA',
                      fontSize: '12.5px',
                      fontWeight: 700
                    }}>
                      {p.product_name || `Product #${p.product_id}`} {p.product_register_id ? `(${p.product_register_id})` : ''} • Stage: {p.stage_name || '—'} • Status: {p.status_name || '—'} • Value: ₹{Number(p.project_value || 0).toLocaleString('en-IN')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Detailed Content Cards (Shown only if non-empty data exists) */}
            {((activity.meeting_plan && activity.meeting_plan.trim()) || (activity.next_action && activity.next_action.trim()) || (activity.summary && activity.summary.trim()) || (activity.meeting_action_remarks && activity.meeting_action_remarks.trim()) || (activity.overdue_reason && activity.overdue_reason.trim())) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Meeting Plan */}
                {activity.meeting_plan && activity.meeting_plan.trim() && (
                  <div style={{
                    background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--t-border, rgba(255, 255, 255, 0.07))',
                    borderRadius: '10px',
                    padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      <FiFileText /> Meeting Plan
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--t-fg, #E2E8F0)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {activity.meeting_plan}
                    </div>
                  </div>
                )}

                {/* Meeting Action Remarks */}
                {activity.meeting_action_remarks && activity.meeting_action_remarks.trim() && (
                  <div style={{
                    background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--t-border, rgba(255, 255, 255, 0.07))',
                    borderRadius: '10px',
                    padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      <FiFileText /> Meeting Action Remarks
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--t-fg, #E2E8F0)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {activity.meeting_action_remarks}
                    </div>
                  </div>
                )}

                {/* Next Action */}
                {activity.next_action && activity.next_action.trim() && (
                  <div style={{
                    background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                    border: '1px solid var(--t-border, rgba(255, 255, 255, 0.07))',
                    borderRadius: '10px',
                    padding: '16px 18px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: 'var(--t-cyan, #38BDF8)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      <FiArrowRight /> Next Scheduled Action
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--t-fg, #E2E8F0)', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {formatNextActionLabel(activity.next_action, localTypes)}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* 5. Audit & Metadata Footnote */}
            {(createdAt || updatedAt) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: '#64748B',
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '8px 14px'
              }}>
                <span>Created: <strong style={{ color: '#94A3B8' }}>{formatDateTime(createdAt)}</strong></span>
                {updatedAt && (
                  <span>Last Updated: <strong style={{ color: '#94A3B8' }}>{formatDateTime(updatedAt)}</strong></span>
                )}
              </div>
            )}

          </div>
        ) : (
          /* ── IN-PLACE EDIT MODE ── */
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            {/* Prominent Overdue Activity Notice Banner */}
            {isOverdue ? (
              <div style={{
                padding: '14px 18px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(185, 28, 28, 0.35))',
                border: '1px solid #EF4444',
                color: '#FCA5A5',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FiAlertCircle style={{ color: '#EF4444', fontSize: '22px', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      ⚠️ Overdue Activity Notice
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#FCA5A5', marginTop: '2px' }}>
                      This activity is currently marked as <strong style={{ color: '#EF4444' }}>OVERDUE</strong>.
                      {isSuperAdmin
                        ? ' As a Super Admin, you can review and update this activity and its mandatory overdue reason below.'
                        : ' Only a Super Admin can modify overdue activities.'}
                    </div>
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 10px rgba(239, 68, 68, 0.5)',
                  flexShrink: 0
                }}>
                  OVERDUE
                </span>
              </div>
            ) : (!canEdit && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FiAlertCircle style={{ flexShrink: 0 }} />
                {isCompleted && 'This activity has been completed. Only a Super Admin can modify completed activities.'}
              </div>
            ))}

            {/* 1. Associated Lead & Contact Context Card */}
            {renderLeadContactContext()}

            {/* 2. Activity Date & Activity Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}><FiCalendar /> Activity Date</label>
                <input
                  type="date"
                  disabled={true}
                  readOnly={true}
                  value={form.activity_date || ''}
                  style={{
                    ...inputStyle,
                    cursor: 'not-allowed',
                    opacity: 0.7,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))'
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}><FiActivity /> Activity Type</label>
                <select
                  disabled
                  value={form.activity_type_id || ''}
                  onChange={e => setForm({ ...form, activity_type_id: e.target.value })}
                  style={{ ...selectStyle, opacity: 0.7, cursor: 'not-allowed', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                >
                  {!form.activity_type_id && (
                    <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                      -- Select Activity Type --
                    </option>
                  )}
                  {form.activity_type_id && !localTypes.some(t => String(t.id || t.activity_type_id || t.type_id || t.value) === String(form.activity_type_id)) && (
                    <option value={form.activity_type_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                      {activity.activity_type_name || activity.activity_type || form.activity_type_id}
                    </option>
                  )}
                  {localTypes.map(t => {
                    const id = String(t.id || t.activity_type_id || t.type_id || t.value);
                    const label = t.activity_type || t.activity_type_name || t.type_name || t.name || t.label || id;
                    return (
                      <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Meeting Plan Field */}
            <div>
              <label style={labelStyle}><FiFileText /> Meeting Plan</label>
              <textarea
                disabled={!isCeoOrCfo || !canEdit}
                value={form.meeting_plan || ''}
                onChange={e => setForm({ ...form, meeting_plan: e.target.value })}
                placeholder="Enter meeting plan..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--t-border, rgba(49, 151, 149, 0.3))',
                  background: 'var(--t-surface-solid, rgba(4, 8, 14, 0.8))',
                  color: 'var(--t-fg, #FFFFFF)',
                  fontSize: '13.5px',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  opacity: (isCeoOrCfo && canEdit) ? 1 : 0.7,
                  cursor: (isCeoOrCfo && canEdit) ? 'text' : 'not-allowed'
                }}
              />
            </div>

            {/* 3. Lead Owner & Action Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Lead Owner</label>
                </div>
                <select
                  value={form.lead_owner_id || ''}
                  onChange={e => setForm({ ...form, lead_owner_id: e.target.value })}
                  disabled={true}
                  style={{
                    ...selectStyle,
                    opacity: 0.7,
                    cursor: 'not-allowed',
                    borderColor: 'rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {!form.lead_owner_id && (
                    <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                      -- Assign Owner --
                    </option>
                  )}
                  {form.lead_owner_id && !localLeaders.some(l => String(l.leader_id || l.emp_id || l.id || l.value) === String(form.lead_owner_id)) && (
                    <option value={form.lead_owner_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                      {activity.lead_owner_name || activity.owner || form.lead_owner_id}
                    </option>
                  )}
                  {localLeaders.map(l => {
                    const id = String(l.leader_id || l.emp_id || l.id || l.value);
                    const name = l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.name || l.label || id;
                    return (
                      <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                        {name} ({id})
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label style={labelStyle}><FiCheckCircle /> Action Status</label>
                <select
                  disabled={!canEdit}
                  value={form.action_status_id || ''}
                  onChange={e => {
                    const newStatusId = e.target.value;
                    const selectedStatusObj = localStatuses.find(s => String(s.id || s.action_status_id || s.status_id || s.value) === String(newStatusId));
                    const newStatusName = String(
                      selectedStatusObj?.action_status ||
                      selectedStatusObj?.action_status_name ||
                      selectedStatusObj?.status ||
                      selectedStatusObj?.status_name ||
                      selectedStatusObj?.name ||
                      selectedStatusObj?.label ||
                      ''
                    ).trim().toLowerCase();

                    const isNewStatusPending = !newStatusName || newStatusName.includes('pending');
                    const isNewStatusCompletedOrNot = !isNewStatusPending && (
                      newStatusName.includes('completed') ||
                      newStatusName.includes('not completed') ||
                      newStatusName.includes('not_completed') ||
                      newStatusName.includes('done') ||
                      newStatusName.includes('closed')
                    );

                    if (!isNewStatusCompletedOrNot) {
                      // Reset values of hidden conditional fields when Action Status is set back to Pending
                      setForm(prev => ({
                        ...prev,
                        action_status_id: newStatusId,
                        meeting_action_remarks: '',
                        outcome_id: '',
                        next_action_type_id: '',
                        next_action: '',
                        next_action_date: '',
                        next_meeting_plan: ''
                      }));
                    } else {
                      setForm(prev => ({
                        ...prev,
                        action_status_id: newStatusId
                      }));
                    }
                    setIsStatusChanged(true);
                  }}
                  style={{ ...selectStyle, opacity: canEdit ? 1 : 0.7, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                >
                  {!form.action_status_id && (
                    <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                      -- Select Status --
                    </option>
                  )}
                  {form.action_status_id && !localStatuses.some(s => String(s.id || s.action_status_id || s.status_id || s.value) === String(form.action_status_id)) && (
                    <option value={form.action_status_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                      {activity.action_status_name || activity.action_status || form.action_status_id}
                    </option>
                  )}
                  {localStatuses
                    .filter(s => {
                      const label = String(s.action_status || s.action_status_name || s.status || s.status_name || s.name || s.label || '').toLowerCase();
                      return !label.includes('overdue');
                    })
                    .map(s => {
                      const id = String(s.id || s.action_status_id || s.status_id || s.value);
                      const label = s.action_status || s.action_status_name || s.status || s.status_name || s.name || s.label || id;
                      return (
                        <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                          {label}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {/* 4. Meeting Action Remarks, Outcome, Next Action, Next Action Date & Next Meeting Plan */}
            {showConditionalFields && (() => {
              const selectedOutcomeObj = localOutcomes.find(o => String(o.id || o.outcome_id || o.value) === String(form.outcome_id));
              const selectedOutcomeName = String(selectedOutcomeObj?.outcome || selectedOutcomeObj?.outcome_name || selectedOutcomeObj?.name || selectedOutcomeObj?.label || activity.outcome_name || '').toLowerCase();
              const isOutcomeWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

              return (
                <>
                  {/* Meeting Action Remarks */}
                  <div>
                    <label style={labelStyle}>
                      <FiFileText /> Meeting Action Remarks {showConditionalFields && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    <textarea
                      disabled={!canEdit}
                      value={form.meeting_action_remarks || ''}
                      onChange={e => setForm({ ...form, meeting_action_remarks: e.target.value })}
                      placeholder="Enter meeting action remarks..."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--t-border, rgba(49, 151, 149, 0.3))',
                        background: 'var(--t-surface-solid, rgba(4, 8, 14, 0.8))',
                        color: 'var(--t-fg, #FFFFFF)',
                        fontSize: '13.5px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        opacity: canEdit ? 1 : 0.7
                      }}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      <FiCheckCircle /> Outcome {showConditionalFields && <span style={{ color: '#EF4444' }}>*</span>}
                    </label>
                    <select
                      disabled={!canEdit}
                      value={form.outcome_id || ''}
                      onChange={e => setForm({ ...form, outcome_id: e.target.value })}
                      style={{ ...selectStyle, opacity: canEdit ? 1 : 0.7, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                    >
                      {!form.outcome_id && (
                        <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                          -- Select Outcome --
                        </option>
                      )}
                      {form.outcome_id && !localOutcomes.some(o => String(o.id || o.outcome_id || o.value) === String(form.outcome_id)) && (
                        <option value={form.outcome_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                          {activity.outcome_name || activity.outcome || form.outcome_id}
                        </option>
                      )}
                      {localOutcomes.map(o => {
                        const id = String(o.id || o.outcome_id || o.value);
                        const label = o.outcome || o.outcome_name || o.name || o.label || id;
                        return (
                          <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {!isOutcomeWonOrLost ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div>
                          <label style={labelStyle}>
                            <FiArrowRight /> Next Action {showConditionalFields && <span style={{ color: '#EF4444' }}>*</span>}
                          </label>
                          <select
                            disabled={!canEdit}
                            value={form.next_action || ''}
                            onChange={e => setForm({ ...form, next_action: e.target.value })}
                            style={{ ...selectStyle, opacity: canEdit ? 1 : 0.7, cursor: canEdit ? 'pointer' : 'not-allowed' }}
                          >
                            {!form.next_action && (
                              <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                                -- Select Next Action --
                              </option>
                            )}
                            {form.next_action && !localTypes.some(t => String(t.id || t.activity_type_id || t.type_id || t.value) === String(form.next_action)) && (
                              <option value={form.next_action} style={{ background: '#0D141F', color: '#00D4AA' }}>
                                {form.next_action}
                              </option>
                            )}
                            {localTypes.map(t => {
                              const id = String(t.id || t.activity_type_id || t.type_id || t.value);
                              const label = t.activity_type || t.activity_type_name || t.type_name || t.name || t.label || id;
                              return (
                                <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>
                            <FiClock /> Next Action Date {showConditionalFields && <span style={{ color: '#EF4444' }}>*</span>}
                          </label>
                          <input
                            type="date"
                            min={form.activity_date ? String(form.activity_date).split('T')[0] : getTodayISO()}
                            disabled={!canEdit}
                            value={form.next_action_date || ''}
                            onChange={e => {
                              const val = e.target.value;
                              if (val && isBackwardDate(val)) {
                                alert("Invalid Next Action Date: Next action date cannot be in the past (backward date like yesterday). Please select today or a future date.");
                                return;
                              }
                              if (val && form.activity_date && isDateBefore(val, form.activity_date)) {
                                alert(`Invalid Next Action Date: Next action date cannot be before Activity Date (${String(form.activity_date).split('T')[0]}). Please select a date on or after Activity Date.`);
                                return;
                              }
                              setForm({ ...form, next_action_date: val });
                            }}
                            onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                            style={{ ...inputStyle, cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.7 }}
                          />
                        </div>
                      </div>

                      {/* Next Meeting Plan */}
                      <div>
                        <label style={labelStyle}><FiFileText /> Next Meeting Plan</label>
                        <textarea
                          disabled={!canEdit}
                          value={form.next_meeting_plan || ''}
                          onChange={e => setForm({ ...form, next_meeting_plan: e.target.value })}
                          placeholder="Enter next meeting plan..."
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--t-border, rgba(49, 151, 149, 0.3))',
                            background: 'var(--t-surface-solid, rgba(4, 8, 14, 0.8))',
                            color: 'var(--t-fg, #FFFFFF)',
                            fontSize: '13.5px',
                            fontFamily: "'Inter', sans-serif",
                            outline: 'none',
                            boxSizing: 'border-box',
                            resize: 'vertical',
                            opacity: canEdit ? 1 : 0.7
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{
                      padding: '10px 14px',
                      background: 'rgba(0, 198, 255, 0.08)',
                      border: '1px solid rgba(0, 198, 255, 0.25)',
                      borderRadius: '8px',
                      color: '#00C6FF',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <FiCheckCircle style={{ color: '#00C6FF', flexShrink: 0 }} />
                      <span>Outcome is marked as Won / Lost — No further Next Action required.</span>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Overdue Reason (Shown for overdue activities) */}
            {(isOverdue || form.overdue_reason || activity.overdue_reason) && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <label style={{ ...labelStyle, color: '#F87171' }}>
                  <FiAlertCircle /> Overdue Reason <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  disabled={!canEdit}
                  value={form.overdue_reason || ''}
                  onChange={e => setForm({ ...form, overdue_reason: e.target.value })}
                  placeholder="Enter reason for overdue activity..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'var(--t-surface-solid, rgba(4, 8, 14, 0.8))',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontFamily: "'Inter', sans-serif",
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    opacity: canEdit ? 1 : 0.7
                  }}
                />
              </div>
            )}




            {/* 7. Audit & Metadata Footnote in Edit Mode */}
            {(createdAt || updatedAt) && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: '#64748B',
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '8px 14px'
              }}>
                <span>Created: <strong style={{ color: '#94A3B8' }}>{formatDateTime(createdAt)}</strong></span>
                {updatedAt && (
                  <span>Last Updated: <strong style={{ color: '#94A3B8' }}>{formatDateTime(updatedAt)}</strong></span>
                )}
              </div>
            )}

            {/* 8. Footer Buttons in Edit Mode */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Cancel Edit
              </button>
              <button
                type="submit"
                disabled={!isSaveEnabled}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: isSaveEnabled ? 'linear-gradient(135deg, #009B82, #00D4AA)' : 'rgba(255, 255, 255, 0.1)',
                  color: isSaveEnabled ? '#070C12' : '#64748B',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSaveEnabled ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: isSaveEnabled ? '0 2px 14px rgba(0, 212, 170, 0.35)' : 'none',
                  opacity: isSaveEnabled ? 1 : 0.6
                }}
              >
                <FiSave /> {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Delete Activity Dialog ───────────────────────────────────────────────────
function ConfirmDeleteDialog({ isOpen, title, message, onClose, onConfirm, isDeleting }) {
  if (!isOpen) return null;

  const idMatch = message ? message.match(/#([A-Za-z0-9_-]+)/) : null;
  const entityId = idMatch ? `#${idMatch[1]}` : null;
  const parenMatch = message ? message.match(/\(([^)]+)\)/) : null;
  const entitySubtitle = parenMatch ? parenMatch[1] : null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1100,
      background: 'rgba(4, 8, 14, 0.84)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #0d131a)',
        border: '1px solid var(--t-red, rgba(239, 68, 68, 0.35))',
        borderRadius: '20px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px 24px 24px',
        boxShadow: 'var(--t-card-shadow, 0 30px 70px rgba(0, 0, 0, 0.95))',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center'
      }}>
        {/* Top subtle ambient glow bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #EF4444, transparent)'
        }} />

        {/* Centered Trash Icon */}
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.22) 0%, rgba(185, 28, 28, 0.12) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#EF4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          margin: '0 auto 16px',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)'
        }}>
          <FiTrash2 />
        </div>

        {/* Centered Title */}
        <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', letterSpacing: '-0.01em', textAlign: 'center' }}>
          {title || 'Confirm Deletion'}
        </h3>

        {/* Centered Description */}
        <div style={{ fontSize: '14px', color: 'var(--t-fg-muted, #94A3B8)', lineHeight: 1.55, textAlign: 'center' }}>
          {entityId ? (
            <>
              Are you sure you want to permanently delete
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.14)',
                color: '#FCA5A5',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontWeight: 700,
                fontSize: '12.5px',
                fontFamily: "'Helvetica'",
                margin: '0 5px'
              }}>
                {entityId}
              </span>
              {entitySubtitle && <strong style={{ color: 'var(--t-fg, #F8FAFC)' }}>({entitySubtitle})</strong>}?
            </>
          ) : (
            message
          )}
        </div>

        {/* Equal Width 50/50 Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px', width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '9px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--t-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--t-fg-muted, #CBD5E1)',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
              color: '#FFFFFF',
              border: '1px solid rgba(248, 113, 113, 0.4)',
              boxShadow: '0 6px 20px rgba(220, 38, 38, 0.4)',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: isDeleting ? 0.7 : 1
            }}
          >
            <FiTrash2 /> {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ActivityView Component ──────────────────────────────────────────────
export default function ActivityView({
  onOpenAddActivity,
  onOpenLeadDetails,
  refreshKey,
  lastAction,
  initialStatusFilter,
  initialOwnerFilter
}) {
  const { user } = useAuth();
  const isExecutiveUser = isExecutive(user);
  const isUserSuperAdmin = isSuperAdmin(user);
  const [activeStatusFilter, setActiveStatusFilter] = useState('Active'); // Default to Active activities only ('Active' | 'Inactive' | 'All')

  const [activitiesData, setActivitiesData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');    // debounced — drives filtering & server calls
  const [searchInput, setSearchInput] = useState('');     // raw typed value — bound to <input>
  const [isSearchingServer, setIsSearchingServer] = useState(false); // server search in-flight
  // Unified Filters state
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [outcomeFilter, setOutcomeFilter] = useState('All Outcomes');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter && initialStatusFilter !== 'all' ? initialStatusFilter : 'All Statuses');
  const [ownerFilter, setOwnerFilter] = useState(initialOwnerFilter && initialOwnerFilter !== 'all' ? initialOwnerFilter : 'All Owners');
  const [activityDateFilter, setActivityDateFilter] = useState('all');
  const [activityFromDate, setActivityFromDate] = useState('');
  const [activityToDate, setActivityToDate] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  // Click-outside listener for floating filter popover
  useEffect(() => {
    const handleOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false);
      }
    };
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isFilterMenuOpen]);

  // Sync filter when navigating or switching views
  useEffect(() => {
    if (initialStatusFilter && initialStatusFilter !== 'all') {
      setStatusFilter(initialStatusFilter);
    } else {
      setStatusFilter('All Statuses');
    }
  }, [initialStatusFilter, refreshKey]);

  useEffect(() => {
    if (initialOwnerFilter && initialOwnerFilter !== 'all') {
      setOwnerFilter(initialOwnerFilter);
    } else {
      setOwnerFilter('All Owners');
    }
  }, [initialOwnerFilter, refreshKey]);

  // Toast Notification state
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const lastHandledActionRef = useRef(lastAction?.timestamp || null);

  const showToast = useCallback((type, message) => {
    setToast({ show: true, type, message });
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (lastAction && lastAction.timestamp && lastAction.timestamp !== lastHandledActionRef.current) {
      lastHandledActionRef.current = lastAction.timestamp;
      showToast(lastAction.type || 'success', lastAction.message);
    }
  }, [lastAction, showToast]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // In-Memory Page Cache: Holds fetched pages so navigating forward/back NEVER refetches
  const pageCacheRef = useRef({});

  // Dynamic Columns Visibility State
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const init = {};
    ALL_COLUMNS.forEach(c => { init[c.key] = c.defaultVisible; });
    return init;
  });
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target)) {
        setColumnPickerOpen(false);
      }
    };
    if (columnPickerOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [columnPickerOpen]);

  // Dropdown Masters for Modals & Filters
  const [typesMaster, setTypesMaster] = useState([]);
  const [outcomesMaster, setOutcomesMaster] = useState([]);
  const [statusesMaster, setStatusesMaster] = useState([]);
  const [leaders, setLeaders] = useState([]);

  // Modals state
  const [editModalState, setEditModalState] = useState({ isOpen: false, activity: null, initialEditMode: true });
  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDeleting: false
  });

  // Fetch Dropdown Masters on mount
  useEffect(() => {
    Promise.allSettled([
      getActivityTypeDropdown(),
      getActivityOutcomeDropdown(),
      getActivityStatusDropdown(),
      getLeadersDropdown()
    ]).then(([typesRes, outcomesRes, statusesRes, leadersRes]) => {
      if (typesRes.status === 'fulfilled' && typesRes.value) {
        setTypesMaster(Array.isArray(typesRes.value.data) ? typesRes.value.data : (Array.isArray(typesRes.value) ? typesRes.value : []));
      }
      if (outcomesRes.status === 'fulfilled' && outcomesRes.value) {
        setOutcomesMaster(Array.isArray(outcomesRes.value.data) ? outcomesRes.value.data : (Array.isArray(outcomesRes.value) ? outcomesRes.value : []));
      }
      if (statusesRes.status === 'fulfilled' && statusesRes.value) {
        setStatusesMaster(Array.isArray(statusesRes.value.data) ? statusesRes.value.data : (Array.isArray(statusesRes.value) ? statusesRes.value : []));
      }
      if (leadersRes.status === 'fulfilled' && leadersRes.value) {
        const raw = Array.isArray(leadersRes.value.data) ? leadersRes.value.data : (Array.isArray(leadersRes.value) ? leadersRes.value : []);
        setLeaders(raw.filter(l => l.is_active !== false));
      }
    });
  }, []);

  // Persistent cursor map per page number: { 1: null, 2: 'ACT-0071', 3: 'ACT-0120', ... }
  const pageCursorMapRef = useRef({ 1: null });

  // Fetch paginated activities with In-Memory Page Caching & has_more tracking
  const loadActivities = useCallback(async (page = 1, forceRefresh = false, searchOverride = undefined) => {
    const activeSearch = searchOverride !== undefined ? searchOverride : searchQuery;
    const activeFilterKey = activeStatusFilter || 'All';
    const activeOwnerKey = ownerFilter || 'All Owners';
    const cacheKey = `p_${page}_sz_${pageSize}_tp_${typeFilter}_oc_${outcomeFilter}_st_${statusFilter}_ow_${activeOwnerKey}_act_${activeFilterKey}_dt_${activityDateFilter}_${activityFromDate}_${activityToDate}_q_${activeSearch.trim()}`;

    // 1. Check if this page data already exists in our client cache (always bypass for date filters to fetch live data)
    const hasDateFilter = activityDateFilter === 'custom' ? (Boolean(activityFromDate) && Boolean(activityToDate)) : (Boolean(activityDateFilter) && activityDateFilter !== 'all');
    const shouldBypassClientCache = forceRefresh || hasDateFilter;

    if (!shouldBypassClientCache && pageCacheRef.current[cacheKey]) {
      const cached = pageCacheRef.current[cacheKey];
      setActivitiesData(cached.data);
      setTotalCount(cached.total);
      setHasMore(Boolean(cached.has_more));
      setCurrentPage(page);
      setFetchError(null);
      return;
    }

    if (page === 1) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      // Retrieve cursor for page (checks persistent map first, then fallback)
      const prevPageKey = `p_${page - 1}_sz_${pageSize}_tp_${typeFilter}_oc_${outcomeFilter}_st_${statusFilter}_ow_${activeOwnerKey}_act_${activeFilterKey}_dt_${activityDateFilter}_${activityFromDate}_${activityToDate}_q_${activeSearch.trim()}`;
      const prevCached = pageCacheRef.current[prevPageKey];
      const cursor = page > 1 ? (pageCursorMapRef.current[page] || prevCached?.next_cursor || null) : null;

      const isActiveParam = activeStatusFilter === 'All' ? null : (activeStatusFilter === 'Active' ? true : false);

      // Map filters to IDs
      let selectedTypeId = null;
      if (typeFilter && typeFilter !== 'All Types' && typeFilter !== 'All') {
        const found = typesMaster.find(t => {
          const tName = (t.activity_type || t.activity_type_name || t.type_name || t.name || '').toLowerCase();
          return tName === typeFilter.toLowerCase() || String(t.activity_type_id) === String(typeFilter) || String(t.type_id) === String(typeFilter) || String(t.id) === String(typeFilter);
        });
        selectedTypeId = found ? (found.activity_type_id || found.id || found.type_id) : null;
      }

      let selectedOutcomeId = null;
      if (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') {
        const found = outcomesMaster.find(o => {
          const oName = (o.outcome || o.outcome_name || o.name || '').toLowerCase();
          return oName === outcomeFilter.toLowerCase() || String(o.outcome_id) === String(outcomeFilter) || String(o.id) === String(outcomeFilter);
        });
        selectedOutcomeId = found ? (found.outcome_id || found.id) : null;
      }

      let selectedStatusId = null;
      if (statusFilter && statusFilter !== 'All Statuses' && statusFilter !== 'All') {
        const found = statusesMaster.find(s => {
          const sName = (s.action_status || s.action_status_name || s.status || s.status_name || s.name || '').toLowerCase();
          return sName === statusFilter.toLowerCase() ||
            String(s.action_status_id) === String(statusFilter) ||
            String(s.status_id) === String(statusFilter) ||
            String(s.id) === String(statusFilter);
        });
        selectedStatusId = found ? (found.action_status_id || found.status_id || found.id || found.action_status) : statusFilter;
      }

      let selectedOwnerId = null;
      let selectedOwnerLeaderId = null;
      if (ownerFilter && ownerFilter !== 'All Owners' && ownerFilter !== 'All') {
        const found = leaders.find(l => {
          const lName = (l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim();
          return lName === ownerFilter || String(l.leader_id) === String(ownerFilter) || String(l.emp_id) === String(ownerFilter);
        });
        selectedOwnerId = found ? (found.full_name || found.name || ownerFilter) : ownerFilter;
        selectedOwnerLeaderId = found ? (found.leader_id || found.emp_id || found.id || ownerFilter) : ownerFilter;
      }

      // Construct search parameter: JSON array of filter objects or global search text
      const filterObjects = [];

      if (typeFilter && typeFilter !== 'All Types' && typeFilter !== 'All') {
        if (selectedTypeId !== null) {
          filterObjects.push({ activity_type_id: selectedTypeId });
        } else {
          filterObjects.push({ activity_type: typeFilter });
        }
      }

      if (statusFilter && statusFilter !== 'All Statuses' && statusFilter !== 'All') {
        if (selectedStatusId !== null) {
          filterObjects.push({ action_status_id: selectedStatusId });
        } else {
          filterObjects.push({ action_status: statusFilter });
        }
      }

      if (outcomeFilter && outcomeFilter !== 'All Outcomes' && outcomeFilter !== 'All') {
        if (selectedOutcomeId !== null) {
          filterObjects.push({ outcome_id: selectedOutcomeId });
        } else {
          filterObjects.push({ outcome: outcomeFilter });
        }
      }

      if (isExecutiveUser && ownerFilter && ownerFilter !== 'All Owners' && ownerFilter !== 'All') {
        if (selectedOwnerLeaderId) {
          filterObjects.push({ lead_owner_id: selectedOwnerLeaderId });
        } else {
          filterObjects.push({ lead_owner: selectedOwnerId || ownerFilter });
        }
      }

      let searchParam = undefined;
      if (filterObjects.length > 0) {
        searchParam = JSON.stringify(filterObjects);
      } else if (activeSearch.trim()) {
        searchParam = activeSearch.trim();
      }

      const dateParams = getDateRangeParams(activityDateFilter, activityFromDate, activityToDate);

      const response = await getActivities({
        limit: pageSize,
        cursor: page > 1 ? cursor : null,
        is_active: isActiveParam,
        search: searchParam,
        from_date: dateParams.from_date,
        to_date: dateParams.to_date
      });

      let items = [];
      let total = 0;
      let nextCursor = null;
      let isHasMore = false;

      if (response && Array.isArray(response.data)) {
        items = response.data;
        total = response.total !== undefined ? response.total : response.data.length;
        nextCursor = response.next_cursor || null;
        isHasMore = response.has_more !== undefined ? Boolean(response.has_more) : (items.length >= pageSize);
      } else if (Array.isArray(response)) {
        items = response;
        total = response.length;
        isHasMore = items.length >= pageSize;
      } else {
        items = [];
        total = 0;
        isHasMore = false;
      }

      if (nextCursor) {
        pageCursorMapRef.current[page + 1] = nextCursor;
      }

      // Store in memory cache
      pageCacheRef.current[cacheKey] = {
        data: items,
        total: total,
        next_cursor: nextCursor,
        has_more: isHasMore
      };

      setActivitiesData(items);
      setTotalCount(total);
      setHasMore(isHasMore);
      setCurrentPage(page);
      setFetchError(null);
    } catch (err) {
      console.warn('[ActivityView] ⚠️ Fetch failed from server:', err);
      const errMsg = err.response?.data?.message || err.message || 'Unable to retrieve activities from server.';
      setFetchError(errMsg);
      if (!pageCacheRef.current[cacheKey]) {
        pageCacheRef.current[cacheKey] = {
          data: [],
          total: 0,
          next_cursor: null,
          has_more: false
        };
      }
      setActivitiesData([]);
      setTotalCount(0);
      setHasMore(false);
      setCurrentPage(page);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, typeFilter, outcomeFilter, statusFilter, ownerFilter, activeStatusFilter, isExecutiveUser, searchQuery, typesMaster, outcomesMaster, statusesMaster, leaders, activityDateFilter, activityFromDate, activityToDate]);

  const isInitialMount = useRef(true);
  const prevRefreshKey = useRef(refreshKey);

  // Initial load or only when refreshKey is actually incremented or filters change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadActivities(1, false);
      return;
    }

    pageCacheRef.current = {};
    pageCursorMapRef.current = { 1: null };
    loadActivities(1, true);
  }, [refreshKey, loadActivities]);

  // ── Smart Search with 350ms Debounce ─────────────────────────────────────────
  const prevSearchRef = useRef(searchQuery);

  // Debounce: 350ms after user stops typing, commit searchInput → searchQuery
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Server-side search — fires only when searchQuery actually changes or is cleared
  useEffect(() => {
    const prev = prevSearchRef.current;
    prevSearchRef.current = searchQuery;

    // 1. Search term actively typed
    if (searchQuery.trim()) {
      setIsSearchingServer(true);
      let cancelled = false;
      pageCacheRef.current = {};
      pageCursorMapRef.current = { 1: null };
      loadActivities(1, true, searchQuery.trim())
        .then(() => { if (!cancelled) setIsSearchingServer(false); })
        .catch(() => { if (!cancelled) setIsSearchingServer(false); });
      return () => { cancelled = true; };
    }

    // 2. Search cleared from an existing non-empty search
    if (prev.trim() !== '' && !searchQuery.trim()) {
      pageCacheRef.current = {};
      pageCursorMapRef.current = { 1: null };
      loadActivities(1, true, '');
    }
  }, [searchQuery, loadActivities]);

  // Explicit refresh button handler
  const handleExplicitRefresh = () => {
    pageCacheRef.current = {};
    pageCursorMapRef.current = { 1: null };
    loadActivities(1, true);
  };

  // Bulk Activity Selection States
  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [isSelectAllPages, setIsSelectAllPages] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setIsSelectAllPages(true);
      setSelectedActivityIds((filtered || []).map(a => a.activity_id));
    } else {
      setIsSelectAllPages(false);
      setSelectedActivityIds([]);
    }
  };

  const handleToggleIndividualActivity = (activityId, checked) => {
    setIsSelectAllPages(false);
    if (checked) {
      setSelectedActivityIds(prev => [...prev, activityId]);
    } else {
      setSelectedActivityIds(prev => prev.filter(id => id !== activityId));
    }
  };

  const handleBulkDeleteActivities = () => {
    let idsToDelete = [...selectedActivityIds];
    if (isSelectAllPages || selectedActivityIds.length === 0) {
      idsToDelete = filtered.map(a => a.activity_id).filter(Boolean);
    }
    const count = idsToDelete.length;
    if (count === 0) {
      showToast('info', 'No activities selected for deletion.');
      return;
    }

    setDeleteDialogState({
      isOpen: true,
      title: 'Bulk Delete Selected Activities',
      message: `Are you sure you want to permanently delete ${count} selected activity(ies)? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await bulkDeleteActivities({ ids: idsToDelete });
          showToast('success', `Successfully deleted ${count} activity(ies).`);
          setSelectedActivityIds([]);
          setIsSelectAllPages(false);
          setIsDeleteMode(false);
          pageCacheRef.current = {};
          await loadActivities(1, true);
        } catch (err) {
          console.error('[ActivityView] Bulk delete activities error:', err);
          showToast('error', formatApiError(err, 'Failed to delete activities.'));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  const handleDeleteAllActivities = () => {
    const hasActiveFilters = Boolean(searchQuery.trim()) ||
      typeFilter !== 'All Types' ||
      outcomeFilter !== 'All Outcomes' ||
      statusFilter !== 'All Statuses' ||
      (ownerFilter && ownerFilter !== 'All Owners') ||
      activityDateFilter !== 'all' ||
      activeStatusFilter !== 'All';

    if (hasActiveFilters) {
      const idsToDelete = filtered.map(a => a.activity_id).filter(Boolean);
      const count = idsToDelete.length;
      if (count === 0) {
        showToast('info', 'No matching activities to delete.');
        return;
      }

      setDeleteDialogState({
        isOpen: true,
        title: 'Delete Filtered Activities',
        message: `Are you sure you want to permanently delete all ${count} activity(ies) matching your currently applied filters? This action cannot be undone.`,
        isDeleting: false,
        onConfirm: async () => {
          setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
          try {
            await bulkDeleteActivities({ ids: idsToDelete });
            showToast('success', `Successfully deleted ${count} filtered activity(ies).`);
            setSelectedActivityIds([]);
            setIsSelectAllPages(false);
            setIsDeleteMode(false);
            pageCacheRef.current = {};
            await loadActivities(1, true);
          } catch (err) {
            console.error('[ActivityView] Delete filtered activities error:', err);
            showToast('error', formatApiError(err, 'Failed to delete filtered activities.'));
          } finally {
            setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
          }
        }
      });
    } else {
      const totalActNum = totalCount || (filtered ? filtered.length : 0);
      setDeleteDialogState({
        isOpen: true,
        title: '⚠️ PERMANENTLY DELETE ALL ACTIVITIES',
        message: `CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE ALL ${totalActNum} ACTIVITIES in the system? This action CANNOT BE UNDONE!`,
        isDeleting: false,
        onConfirm: async () => {
          setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
          try {
            await deleteAllActivities();
            setSelectedActivityIds([]);
            setIsSelectAllPages(false);
            setIsDeleteMode(false);
            pageCacheRef.current = {};
            await loadActivities(1, true);
            showToast('success', 'All activities have been permanently deleted.');
          } catch (err) {
            console.error('[ActivityView] Delete all activities error:', err);
            showToast('error', formatApiError(err, 'Failed to delete all activities.'));
          } finally {
            setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
          }
        }
      });
    }
  };

  // Delete Activity Handler
  const handleDeleteActivity = (act) => {
    setDeleteDialogState({
      isOpen: true,
      title: 'Delete Activity Entry',
      message: `Are you sure you want to permanently delete activity #${act.activity_id} (Lead #${act.lead_id})? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await deleteActivity(act.activity_id);
          pageCacheRef.current = {};
          await loadActivities(currentPage, true);
          showToast('success', `Activity #${act.activity_id} (Lead #${act.lead_id}) deleted successfully.`);
        } catch (err) {
          console.error('[ActivityView] Delete activity error:', err);
          showToast('error', formatApiError(err, `Failed to delete activity #${act.activity_id}.`));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Toggle / Activate Activity Handler for Admins
  const handleToggleActivateActivity = async (act) => {
    const actId = act.activity_id || act.id;
    try {
      await updateActivity(actId, { is_active: true });
      pageCacheRef.current = {};
      await loadActivities(currentPage, true);
      showToast('success', `Activity #${actId} is now active.`);
    } catch (err) {
      console.error('[ActivityView] Activate activity error:', err);
      showToast('error', formatApiError(err, `Failed to activate activity #${actId}.`));
    }
  };

  // Formatters
  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (_) {
      return isoString;
    }
  };

  // Badge styles
  const getOutcomeBadgeStyle = (outcomeName) => {
    const s = (outcomeName || '').toLowerCase();
    if (s.includes('positive') || s.includes('interest') || s.includes('won') || s.includes('success')) {
      return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
    }
    if (s.includes('negative') || s.includes('lost') || s.includes('reject')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
    }
    if (s.includes('pending') || s.includes('follow') || s.includes('neutral')) {
      return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
    }
    return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' };
  };

  const getStatusBadgeStyle = (statusName) => {
    const s = (statusName || '').toLowerCase();
    if (s.includes('completed') || s.includes('done') || s.includes('closed')) {
      return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
    }
    if (s.includes('not completed') || s.includes('overdue') || s.includes('cancelled')) {
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
    }
    return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
  };

  // Filter options
  const typeFilterOptions = useMemo(() => {
    const list = [{ value: 'All Types', label: 'All Types' }];
    typesMaster.forEach(t => {
      const name = t.activity_type || t.name || t.type_name;
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    activitiesData.forEach(a => {
      if (a.activity_type_name && !list.some(item => item.value === a.activity_type_name)) {
        list.push({ value: a.activity_type_name, label: a.activity_type_name });
      }
    });
    return list;
  }, [typesMaster, activitiesData]);

  const outcomeFilterOptions = useMemo(() => {
    const list = [{ value: 'All Outcomes', label: 'All Outcomes' }];
    outcomesMaster.forEach(o => {
      const name = o.outcome || o.name || o.outcome_name;
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    activitiesData.forEach(a => {
      if (a.outcome_name && !list.some(item => item.value === a.outcome_name)) {
        list.push({ value: a.outcome_name, label: a.outcome_name });
      }
    });
    return list;
  }, [outcomesMaster, activitiesData]);

  const statusFilterOptions = useMemo(() => {
    const list = [{ value: 'All Statuses', label: 'All Statuses' }];
    statusesMaster.forEach(s => {
      const name = s.action_status || s.action_status_name || s.status || s.status_name || s.name;
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    activitiesData.forEach(a => {
      if (a.action_status_name && !list.some(item => item.value === a.action_status_name)) {
        list.push({ value: a.action_status_name, label: a.action_status_name });
      }
    });
    if (!list.some(item => String(item.value).toLowerCase().includes('overdue'))) {
      list.push({ value: 'Overdue', label: 'Overdue' });
    }
    return list;
  }, [statusesMaster, activitiesData]);

  const activeStatusFilterOptions = useMemo(() => [
    { value: 'All', label: 'All Status' },
    { value: 'Active', label: 'Active Activities' },
    { value: 'Inactive', label: 'Inactive Activities' }
  ], []);

  const datePresetOptions = useMemo(() => [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'custom', label: 'Custom Date Range' }
  ], []);

  const ownerFilterOptions = useMemo(() => {
    const list = [{ value: 'All Owners', label: 'All Owners' }];
    leaders.forEach(l => {
      const name = (l.full_name || l.name || '').trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    activitiesData.forEach(a => {
      const name = (a.lead_owner_name || '').trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    return list;
  }, [leaders, activitiesData]);

  // Compute number of active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter && typeFilter !== 'All Types') count++;
    if (statusFilter && statusFilter !== 'All Statuses') count++;
    if (outcomeFilter && outcomeFilter !== 'All Outcomes') count++;
    if (activityDateFilter === 'custom') {
      if (activityFromDate && activityToDate) count++;
    } else if (activityDateFilter && activityDateFilter !== 'all') {
      count++;
    }
    if (isExecutiveUser && ownerFilter && ownerFilter !== 'All Owners') count++;
    if (isExecutiveUser && activeStatusFilter && activeStatusFilter !== 'All') count++;
    return count;
  }, [typeFilter, statusFilter, outcomeFilter, activityDateFilter, isExecutiveUser, ownerFilter, activeStatusFilter]);

  const handleResetFilters = useCallback(() => {
    setTypeFilter('All Types');
    setStatusFilter('All Statuses');
    setOutcomeFilter('All Outcomes');
    setActivityDateFilter('all');
    setActivityFromDate('');
    setActivityToDate('');
    if (isExecutiveUser) {
      setOwnerFilter('All Owners');
      setActiveStatusFilter('All');
    }
    setCurrentPage(1);
  }, [isExecutiveUser]);

  const getActivityDateLabel = (filterVal, from, to) => {
    if (filterVal === 'today') return 'Today';
    if (filterVal === 'yesterday') return 'Yesterday';
    if (filterVal === 'last_7_days') return 'Last 7 Days';
    if (filterVal === 'last_30_days') return 'Last 30 Days';
    if (filterVal === 'this_month') return 'This Month';
    if (filterVal === 'custom') {
      if (from && to) return `${from} to ${to}`;
      if (from) return `From ${from}`;
      if (to) return `Up to ${to}`;
      return 'Custom Range';
    }
    return 'All Time';
  };

  // Client filtering
  const filtered = useMemo(() => {
    return activitiesData.filter(act => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        (act.activity_id && String(act.activity_id).toLowerCase().includes(q)) ||
        (act.lead_id && String(act.lead_id).toLowerCase().includes(q)) ||
        (act.lead_owner_name && act.lead_owner_name.toLowerCase().includes(q)) ||
        (act.leader_name && act.leader_name.toLowerCase().includes(q)) ||
        (act.leader && act.leader.toLowerCase().includes(q)) ||
        (act.contact_name && act.contact_name.toLowerCase().includes(q)) ||
        (act.contact && act.contact.toLowerCase().includes(q)) ||
        (act.company && act.company.toLowerCase().includes(q)) ||
        (act.company_name && act.company_name.toLowerCase().includes(q)) ||
        (act.activity_type_name && act.activity_type_name.toLowerCase().includes(q)) ||
        (act.summary && act.summary.toLowerCase().includes(q)) ||
        (act.next_action && act.next_action.toLowerCase().includes(q)) ||
        (act.outcome_name && act.outcome_name.toLowerCase().includes(q)) ||
        (act.action_status_name && act.action_status_name.toLowerCase().includes(q));

      const matchType = typeFilter === 'All Types' || typeFilter === 'All' ||
        (act.activity_type_name && act.activity_type_name.toLowerCase() === typeFilter.toLowerCase()) ||
        String(act.activity_type_id) === String(typeFilter);

      const matchOutcome = outcomeFilter === 'All Outcomes' || outcomeFilter === 'All' ||
        (act.outcome_name && act.outcome_name.toLowerCase() === outcomeFilter.toLowerCase()) ||
        String(act.outcome_id) === String(outcomeFilter);

      const matchStatus = statusFilter === 'All Statuses' || statusFilter === 'All' ||
        (act.action_status_name && act.action_status_name.toLowerCase() === statusFilter.toLowerCase()) ||
        (act.action_status && String(act.action_status).toLowerCase() === statusFilter.toLowerCase()) ||
        String(act.action_status_id) === String(statusFilter);

      const matchOwner = ownerFilter === 'All Owners' || ownerFilter === 'All' ||
        (act.lead_owner_name && act.lead_owner_name.toLowerCase() === ownerFilter.toLowerCase()) ||
        String(act.lead_owner_id) === String(ownerFilter);
      const matchActive = activeStatusFilter === 'All' ||
        (activeStatusFilter === 'Active' ? Boolean(act.is_active !== false) : !act.is_active);

      const matchDate = (() => {
        if (activityDateFilter === 'all') return true;
        const dateStr = act.activity_date || act.created_at || act.created_date;
        if (!dateStr) return false;
        const aDate = new Date(dateStr);
        if (isNaN(aDate.getTime())) return true;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (activityDateFilter === 'today') {
          return aDate >= startOfToday;
        }
        if (activityDateFilter === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return aDate >= startOfYesterday && aDate < startOfToday;
        }
        if (activityDateFilter === 'last_7_days') {
          const past7 = new Date(startOfToday);
          past7.setDate(past7.getDate() - 7);
          return aDate >= past7;
        }
        if (activityDateFilter === 'last_30_days') {
          const past30 = new Date(startOfToday);
          past30.setDate(past30.getDate() - 30);
          return aDate >= past30;
        }
        if (activityDateFilter === 'this_month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return aDate >= startOfMonth;
        }
        if (activityDateFilter === 'custom') {
          if (activityFromDate) {
            const from = new Date(activityFromDate);
            from.setHours(0, 0, 0, 0);
            if (aDate < from) return false;
          }
          if (activityToDate) {
            const to = new Date(activityToDate);
            to.setHours(23, 59, 59, 999);
            if (aDate > to) return false;
          }
          return true;
        }
        return true;
      })();

      return matchQuery && matchType && matchOutcome && matchStatus && matchOwner && matchActive && matchDate;
    });
  }, [activitiesData, searchQuery, typeFilter, outcomeFilter, statusFilter, ownerFilter, activeStatusFilter, isExecutiveUser, activityDateFilter, activityFromDate, activityToDate]);

  const displayTotalActivities = totalCount || (filtered ? filtered.length : 0);
  const totalPages = Math.max(1, Math.ceil(displayTotalActivities / pageSize));

  // Next/Prev navigation bounds based on server cursor & total pages
  const canGoNext = hasMore || currentPage < totalPages;
  const canGoPrev = currentPage > 1;

  // Should pagination controls be displayed?
  const showPagination = displayTotalActivities > pageSize || currentPage > 1 || hasMore;

  // Navigation Handlers - triggers server query with next_cursor when moving to next page
  const handleNextPage = () => {
    if (!canGoNext) return;
    loadActivities(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (!canGoPrev) return;
    loadActivities(currentPage - 1);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!filtered.length) {
      alert('No activities to export.');
      return;
    }
    const colsToExport = ALL_COLUMNS.filter(c => visibleColumns[c.key]);
    const headers = colsToExport.map(c => `"${c.label}"`).join(',');
    const rows = filtered.map(row => {
      return colsToExport.map(c => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'boolean') val = val ? 'Active' : 'Inactive';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Activities_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const glassCard = {
    background: 'var(--t-surface-solid)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--t-border)',
    borderRadius: '12px',
    boxShadow: 'var(--t-card-shadow)'
  };

  return (
    <div className="activity-main-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'clamp(12px, 1.2vw, 20px)', gap: '10px' }}>

      {/* Top Action Bar */}
      <div style={{ ...glassCard, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 40, overflow: 'visible' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', width: '100%' }}>

          {/* Left: Search & Filter Selects */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '320px' }}>

            {/* Search */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              {isSearchingServer
                ? <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                : <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px' }} />
              }
              <input
                type="text"
                placeholder="Search leader, contact, company, summary, next action..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px 0 40px',
                  borderRadius: '8px',
                  border: '1px solid var(--t-border)',
                  background: 'var(--t-surface-alt)',
                  color: 'var(--t-fg)',
                  fontSize: '13.5px',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Unified Filters Consolidated Dropdown */}
            <div ref={filterMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen(prev => !prev)}
                style={{
                  height: '42px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  border: isFilterMenuOpen || activeFiltersCount > 0 ? '1px solid #00D4AA' : '1px solid var(--t-border)',
                  background: isFilterMenuOpen || activeFiltersCount > 0 ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)',
                  color: isFilterMenuOpen || activeFiltersCount > 0 ? '#00D4AA' : 'var(--t-fg)',
                  fontFamily: "'Helvetica'",
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isFilterMenuOpen ? '0 0 14px rgba(0, 212, 170, 0.25)' : 'none'
                }}
              >
                <FiFilter style={{ fontSize: '14px' }} />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: '10px',
                    background: '#00D4AA',
                    color: '#070C12',
                    fontSize: '11px',
                    fontWeight: 800
                  }}>
                    {activeFiltersCount}
                  </span>
                )}
                <FiChevronDown style={{
                  fontSize: '13px',
                  transform: isFilterMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.18s ease'
                }} />
              </button>

              {/* Floating Filters Popover Panel */}
              {isFilterMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 100060,
                    width: '340px',
                    maxWidth: 'calc(100vw - 32px)',
                    maxHeight: 'calc(100vh - 150px)',
                    overflowY: 'auto',
                    background: '#0c131d',
                    border: '1px solid rgba(0, 212, 170, 0.35)',
                    borderRadius: '12px',
                    padding: '16px 18px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 212, 170, 0.15)',
                    backdropFilter: 'blur(20px)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Popover Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <FiFilter style={{ color: '#00D4AA', fontSize: '14px' }} />
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                        Filter Activities
                      </span>
                      {activeFiltersCount > 0 && (
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 212, 170, 0.18)', color: '#00D4AA', fontWeight: 700 }}>
                          {activeFiltersCount} active
                        </span>
                      )}
                    </div>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#EF4444',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        <FiRotateCcw style={{ fontSize: '11px' }} /> Reset
                      </button>
                    )}
                  </div>

                  {/* Filter 1: Activity Type */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Activity Type
                    </label>
                    <CustomSelect
                      value={typeFilter}
                      onChange={val => {
                        setTypeFilter(val);
                        setCurrentPage(1);
                      }}
                      options={typeFilterOptions}
                      placeholder="All Types"
                      icon={FiLayers}
                      height="38px"
                    />
                  </div>

                  {/* Filter 2: Action Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Action Status
                    </label>
                    <CustomSelect
                      value={statusFilter}
                      onChange={val => {
                        setStatusFilter(val);
                        setCurrentPage(1);
                      }}
                      options={statusFilterOptions}
                      placeholder="All Statuses"
                      icon={FiCheckCircle}
                      height="38px"
                    />
                  </div>

                  {/* Filter 3: Outcome */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Outcome
                    </label>
                    <CustomSelect
                      value={outcomeFilter}
                      onChange={val => {
                        setOutcomeFilter(val);
                        setCurrentPage(1);
                      }}
                      options={outcomeFilterOptions}
                      placeholder="All Outcomes"
                      icon={FiActivity}
                      height="38px"
                    />
                  </div>

                  {/* Filter 4: Activity Date */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Activity Date
                    </label>
                    <CustomSelect
                      value={activityDateFilter}
                      onChange={val => {
                        setActivityDateFilter(val);
                        setCurrentPage(1);
                      }}
                      options={datePresetOptions}
                      placeholder="All Time"
                      icon={FiCalendar}
                      height="38px"
                    />
                    {activityDateFilter === 'custom' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '3px' }}>From:</div>
                          <input
                            type="date"
                            value={activityFromDate}
                            onChange={e => {
                              const val = e.target.value;
                              if (val && !isValidDateStr(val)) {
                                alert("Wrong date format. Please select a valid From Date.");
                                return;
                              }
                              if (val && activityToDate && val > activityToDate) {
                                alert("Invalid date range: 'From Date' cannot be later than 'To Date'. Please select a valid date range.");
                                return;
                              }
                              setActivityFromDate(val);
                              setCurrentPage(1);
                            }}
                            onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                            style={{
                              width: '100%',
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              background: '#090e15',
                              border: '1px solid rgba(0, 212, 170, 0.3)',
                              color: '#FFFFFF',
                              fontSize: '11.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '3px' }}>To:</div>
                          <input
                            type="date"
                            value={activityToDate}
                            onChange={e => {
                              const val = e.target.value;
                              if (val && !isValidDateStr(val)) {
                                alert("Wrong date format. Please select a valid To Date.");
                                return;
                              }
                              if (val && activityFromDate && val < activityFromDate) {
                                alert("Invalid date range: 'To Date' cannot be earlier than 'From Date'. Please select a valid date range.");
                                return;
                              }
                              setActivityToDate(val);
                              setCurrentPage(1);
                            }}
                            onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                            style={{
                              width: '100%',
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              background: '#090e15',
                              border: '1px solid rgba(0, 212, 170, 0.3)',
                              color: '#FFFFFF',
                              fontSize: '11.5px',
                              outline: 'none',
                              boxSizing: 'border-box',
                              cursor: 'pointer'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Executive Only Filters: Lead Owner / Rep & Active Status */}
                  {isExecutiveUser && (
                    <>
                      {/* Filter 5: Lead Owner / Rep */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Lead Owner / Rep
                        </label>
                        <CustomSelect
                          value={ownerFilter}
                          onChange={val => {
                            setOwnerFilter(val);
                            setCurrentPage(1);
                          }}
                          options={ownerFilterOptions}
                          placeholder="All Owners"
                          icon={FiUser}
                          height="38px"
                          searchable={true}
                        />
                      </div>

                      {/* Filter 6: Active Status */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Active Status
                        </label>
                        <CustomSelect
                          value={activeStatusFilter}
                          onChange={val => {
                            setActiveStatusFilter(val);
                            setCurrentPage(1);
                          }}
                          options={activeStatusFilterOptions}
                          placeholder="All Status"
                          icon={FiCheckCircle}
                          height="38px"
                        />
                      </div>
                    </>
                  )}

                  {/* Popover Footer Done */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsFilterMenuOpen(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        background: 'linear-gradient(90deg, #009B82, #00D4AA)',
                        border: 'none',
                        color: '#070C12',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right: Columns customizer + Export + Add Activity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Dynamic Columns Customizer */}
            <div ref={columnPickerRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setColumnPickerOpen(!columnPickerOpen)}
                style={{
                  height: '42px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--t-border)',
                  borderRadius: '8px',
                  background: 'var(--t-surface-alt)',
                  color: 'var(--t-fg-muted)',
                  fontFamily: "'Helvetica'",
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <FiLayers style={{ color: 'var(--t-teal)' }} /> Columns <FiChevronDown style={{ fontSize: '12px' }} />
              </button>

              {columnPickerOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: '#0B1118',
                  border: '1px solid rgba(0, 212, 170, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  zIndex: 100,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                  minWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#00D4AA', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Toggle Columns
                  </div>
                  {ALL_COLUMNS.map(col => (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: visibleColumns[col.key] ? '#FFFFFF' : '#64748B',
                        cursor: 'pointer',
                        padding: '4px 0'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(visibleColumns[col.key])}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                        style={{ accentColor: '#00D4AA', cursor: 'pointer' }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Export CSV - Commented out */}
            {/* <button
            onClick={handleExportCSV}
            style={{
              height: '42px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid var(--t-border)',
              borderRadius: '8px',
              background: 'var(--t-surface-alt)',
              color: 'var(--t-fg-muted)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <FiDownload /> Export
          </button> */}

            {isUserSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsDeleteMode(prev => {
                    const next = !prev;
                    if (!next) {
                      setSelectedActivityIds([]);
                      setIsSelectAllPages(false);
                    }
                    return next;
                  });
                }}
                title={isDeleteMode ? 'Close selection mode' : 'Select & Delete Activities'}
                style={{
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  background: isDeleteMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1.5px solid ${isDeleteMode ? '#EF4444' : 'rgba(239, 68, 68, 0.35)'}`,
                  color: '#EF4444',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: "'Helvetica'",
                  transition: 'all 0.15s ease',
                  boxShadow: isDeleteMode ? '0 0 12px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                <FiTrash2 style={{ fontSize: '15px' }} />
                <span>
                  {isDeleteMode
                    ? ((selectedActivityIds.length > 0 || isSelectAllPages) ? `Delete Selected (${isSelectAllPages ? displayTotalActivities : selectedActivityIds.length})` : 'Cancel Delete')
                    : 'Delete'}
                </span>
              </button>
            )}

            {/* Add Activity */}
            <button
              onClick={onOpenAddActivity}
              style={{
                height: '42px',
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #009B82, #00D4AA)',
                color: '#070C12',
                fontFamily: "'Inter', sans-serif",
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 170, 0.4)'
              }}
            >
              <FiPlus style={{ strokeWidth: 3 }} /> Log Activity
            </button>
          </div>
        </div>

        {/* Active Filter Pills Row */}
        {activeFiltersCount > 0 && (
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '6px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)', fontWeight: 600 }}>Active Filters:</span>

            {typeFilter !== 'All Types' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 212, 170, 0.12)',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                color: '#00D4AA',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Type: {typeFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setTypeFilter('All Types'); setCurrentPage(1); }} />
              </span>
            )}

            {statusFilter !== 'All Statuses' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 212, 170, 0.12)',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                color: '#00D4AA',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Status: {statusFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setStatusFilter('All Statuses'); setCurrentPage(1); }} />
              </span>
            )}

            {outcomeFilter !== 'All Outcomes' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 212, 170, 0.12)',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                color: '#00D4AA',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Outcome: {outcomeFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setOutcomeFilter('All Outcomes'); setCurrentPage(1); }} />
              </span>
            )}

            {activityDateFilter !== 'all' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 212, 170, 0.12)',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                color: '#00D4AA',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Date: {getActivityDateLabel(activityDateFilter, activityFromDate, activityToDate)}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setActivityDateFilter('all'); setActivityFromDate(''); setActivityToDate(''); setCurrentPage(1); }} />
              </span>
            )}

            {isExecutiveUser && ownerFilter !== 'All Owners' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(0, 198, 255, 0.12)',
                border: '1px solid rgba(0, 198, 255, 0.35)',
                color: '#00C6FF',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Owner: {ownerFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setOwnerFilter('All Owners'); setCurrentPage(1); }} />
              </span>
            )}

            {isExecutiveUser && activeStatusFilter !== 'All' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: activeStatusFilter === 'Active' ? 'rgba(0, 212, 170, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: activeStatusFilter === 'Active' ? '1px solid rgba(0, 212, 170, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: activeStatusFilter === 'Active' ? '#00D4AA' : '#ef4444',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Status: {activeStatusFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setActiveStatusFilter('All'); setCurrentPage(1); }} />
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 6px',
                fontWeight: 600
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
            >
              Clear All
            </button>
          </div>
        )}
      </div>



      {/* Main Table Card */}
      <div style={{ ...glassCard, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '480px' }}>
        {/* ── Bulk Actions Header Bar ─────────────────────────────────────── */}
        {/* ── Bulk Actions Header Bar (Appears ONLY when Delete button is clicked) ─── */}
        {isDeleteMode && !isLoading && !fetchError && filtered.length > 0 && isUserSuperAdmin && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '10px 18px',
            background: 'rgba(239, 68, 68, 0.12)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            flexWrap: 'wrap',
            gap: '12px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 800, color: '#EF4444' }}>
              <input
                type="checkbox"
                checked={isSelectAllPages || (filtered.length > 0 && selectedActivityIds.length === filtered.length)}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#EF4444', width: '16px', height: '16px' }}
              />
              <span>Select All ({displayTotalActivities} Activities)</span>
            </label>

            {/* Right-aligned Actions: Delete Selected + Close X Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleBulkDeleteActivities}
                disabled={selectedActivityIds.length === 0 && !isSelectAllPages}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: (selectedActivityIds.length > 0 || isSelectAllPages) ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.2)',
                  color: (selectedActivityIds.length > 0 || isSelectAllPages) ? '#FFFFFF' : '#FCA5A5',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: (selectedActivityIds.length > 0 || isSelectAllPages) ? 'pointer' : 'not-allowed',
                  opacity: (selectedActivityIds.length > 0 || isSelectAllPages) ? 1 : 0.6,
                  boxShadow: (selectedActivityIds.length > 0 || isSelectAllPages) ? '0 2px 10px rgba(239, 68, 68, 0.4)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiTrash2 />
                <span>Delete Selected ({isSelectAllPages ? displayTotalActivities : selectedActivityIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDeleteMode(false);
                  setSelectedActivityIds([]);
                  setIsSelectAllPages(false);
                }}
                title="Close selection mode"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                  e.currentTarget.style.borderColor = '#EF4444';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
              >
                <FiX />
              </button>
            </div>
          </div>
        )}

        <div className="activity-scroll" style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px' }}>
            <thead>
              <tr>
                {isUserSuperAdmin && isDeleteMode && (
                  <th style={{ ...thStyle, textAlign: 'center', width: '40px', minWidth: '40px' }} />
                )}

                {visibleColumns.activity_id && <th style={thStyle}>Activity ID</th>}
                {visibleColumns.lead_id && <th style={thStyle}>Lead ID</th>}
                {visibleColumns.company && <th style={thStyle}>Company</th>}
                {visibleColumns.product_name && <th style={{ ...thStyle, width: '160px', minWidth: '140px', maxWidth: '180px' }}>Product</th>}
                {visibleColumns.contact_name && <th style={thStyle}>Contact</th>}
                {visibleColumns.lead_owner_name && <th style={thStyle}>Lead Owner</th>}
                {visibleColumns.activity_date && <th style={thStyle}>Activity Date</th>}
                {visibleColumns.activity_type_name && <th style={thStyle}>Activity Type</th>}
                {visibleColumns.next_action && <th style={{ ...thStyle, width: '180px', minWidth: '160px', maxWidth: '200px' }}>Next Action</th>}
                {visibleColumns.next_action_date && <th style={thStyle}>Next Date</th>}
                {visibleColumns.outcome_name && <th style={thStyle}>Outcome</th>}
                {visibleColumns.action_status_name && <th style={thStyle}>Action Status</th>}
                {visibleColumns.overdue_reason && <th style={{ ...thStyle, width: '180px', minWidth: '160px', maxWidth: '200px' }}>Overdue Reason</th>}
                {visibleColumns.is_active && <th style={thStyle}>Active Status</th>}
                {visibleColumns.created_at && <th style={thStyle}>Created At</th>}
                <th style={{
                  ...thStyle,
                  textAlign: 'center',
                  width: '135px',
                  minWidth: '130px',
                  padding: '12px 14px 12px 10px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <td colSpan={16} style={{ padding: '18px 24px' }}>
                      <div className="skeleton-box" style={{ height: '36px', borderRadius: '6px' }} />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr style={{ height: '100%' }}>
                  <td colSpan={15} style={{ padding: '60px 20px', textAlign: 'center', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '24px', marginBottom: '12px' }}>
                        <FiAlertCircle />
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#fca5a5' }}>Failed to Load Activities from Server</div>
                      <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '6px', maxWidth: '420px', margin: '6px auto 16px' }}>{fetchError}</div>
                      <button
                        onClick={handleExplicitRefresh}
                        style={{ padding: '8px 18px', borderRadius: '8px', background: 'rgba(0, 212, 170, 0.15)', border: '1px solid rgba(0, 212, 170, 0.4)', color: '#00D4AA', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Retry Connection
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr style={{ height: '100%' }}>
                  <td colSpan={15} style={{ padding: '80px 0', textAlign: 'center', color: 'var(--t-fg-muted)', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <FiActivity style={{ fontSize: '42px', opacity: 0.4, marginBottom: '12px' }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-fg)' }}>No Activity Records Available</div>
                      <div style={{ fontSize: '13px', color: 'var(--t-fg-muted)', marginTop: '4px' }}>No activity logs exist on the server. Click "Log Activity" to register one.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((act) => {
                  const outcomeStyle = getOutcomeBadgeStyle(act.outcome_name);
                  const statusStyle = getStatusBadgeStyle(act.action_status_name);
                  const companyDisplay = act.company || act.lead?.company || '—';
                  const contactDisplay = act.contact_name || act.lead?.contact_name || '';

                  const isActSelected = isSelectAllPages || selectedActivityIds.includes(act.activity_id);

                  const isRowOverdue = (() => {
                    const statusId = String(act.action_status_id || act.status_id || '');
                    if (statusId === '8') return true;
                    const statusName = String(act.action_status_name || act.action_status || act.status || '').toLowerCase();
                    return statusName.includes('overdue');
                  })();

                  const isRowCompleted = (() => {
                    const statusName = String(
                      act.action_status_name ||
                      act.action_status ||
                      act.status ||
                      act.outcome_name ||
                      ''
                    ).toLowerCase();
                    return statusName.includes('completed') || statusName.includes('done') || statusName.includes('closed');
                  })();

                  const canUserEditRow = (!isRowOverdue && !isRowCompleted) || isUserSuperAdmin;
                  const canUserDeleteRow = (!isRowOverdue && !isRowCompleted) || isUserSuperAdmin;

                  const editRowTooltip = canUserEditRow
                    ? "Edit Activity"
                    : (isRowCompleted
                      ? "Only Super Admins can edit completed activities"
                      : "Only Super Admins can edit overdue activities");

                  const deleteRowTooltip = canUserDeleteRow
                    ? "Delete Activity"
                    : (isRowCompleted
                      ? "Only Super Admins can delete completed activities"
                      : "Only Super Admins can delete overdue activities");

                  return (
                    <tr
                      key={act.activity_id}
                      style={{
                        borderBottom: '1px solid var(--t-border)',
                        background: isActSelected
                          ? 'rgba(239, 68, 68, 0.18)'
                          : (isRowOverdue ? 'rgba(239, 68, 68, 0.12)' : 'transparent'),
                        borderLeft: isRowOverdue ? '4px solid #EF4444' : '4px solid transparent',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActSelected) {
                          e.currentTarget.style.background = isRowOverdue ? 'rgba(239, 68, 68, 0.22)' : 'var(--t-row-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActSelected) {
                          e.currentTarget.style.background = isRowOverdue ? 'rgba(239, 68, 68, 0.12)' : 'transparent';
                        }
                      }}
                      onClick={() => setEditModalState({ isOpen: true, activity: act, initialEditMode: false })}
                    >
                      {/* Checkbox */}
                      {isUserSuperAdmin && isDeleteMode && (
                        <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isActSelected}
                            onChange={(e) => handleToggleIndividualActivity(act.activity_id, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#EF4444', width: '15px', height: '15px' }}
                          />
                        </td>
                      )}


                      {/* Activity ID */}
                      {visibleColumns.activity_id && (
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '5px',
                              background: 'rgba(0, 212, 170, 0.12)',
                              border: '1px solid rgba(0, 212, 170, 0.3)',
                              color: '#00D4AA',
                              fontWeight: 800,
                              fontFamily: "'Helvetica'",
                              cursor: 'default'
                            }}
                          >
                            {act.activity_id ? `#${act.activity_id}` : (act.id ? `#${act.id}` : '—')}
                          </span>
                        </td>
                      )}

                      {/* Lead ID */}
                      {visibleColumns.lead_id && (
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '5px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: '#38bdf8',
                              fontWeight: 600,
                              fontFamily: "'Helvetica'",
                              cursor: 'default'
                            }}
                          >
                            {act.lead_id || (act.lead_no ? `#${act.lead_no}` : '—')}
                          </span>
                        </td>
                      )}

                      {/* Company */}
                      {visibleColumns.company && (
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: '180px',
                            fontWeight: 600,
                            color: 'var(--t-fg)'
                          }}
                          title={companyDisplay}
                        >
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {companyDisplay}
                          </span>
                        </td>
                      )}

                      {/* Product */}
                      {visibleColumns.product_name && (
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: '180px',
                            fontWeight: 600,
                            color: '#00D4AA'
                          }}
                          title={getProductDisplay(act)}
                        >
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {getProductDisplay(act)}
                          </span>
                        </td>
                      )}

                      {/* Contact */}
                      {visibleColumns.contact_name && (
                        <td
                          style={{ ...tdStyle, maxWidth: '180px' }}
                          title={contactDisplay ? `${contactDisplay} ${act.contact_phone || act.contact_email ? `(${act.contact_phone || act.contact_email})` : ''}` : ''}
                        >
                          {contactDisplay ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
                              <span style={{ fontWeight: 600, color: 'var(--t-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {contactDisplay}
                              </span>
                              {(act.contact_phone || act.contact_email) && (
                                <span style={{ fontSize: '11px', color: 'var(--t-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {act.contact_phone || act.contact_email}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--t-fg-muted)' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* Lead Owner */}
                      {visibleColumns.lead_owner_name && (
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: '160px',
                            fontWeight: 600,
                            color: 'var(--t-fg)'
                          }}
                          title={act.lead_owner_name || ''}
                        >
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {act.lead_owner_name || '—'}
                          </span>
                        </td>
                      )}

                      {/* Activity Date */}
                      {visibleColumns.activity_date && (
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg-muted)' }}>
                          {formatDate(act.activity_date)}
                        </td>
                      )}

                      {/* Activity Type */}
                      {visibleColumns.activity_type_name && (
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '80px',
                            padding: '4px 0',
                            borderRadius: '5px',
                            background: 'rgba(59, 130, 246, 0.12)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            fontSize: '12px',
                            fontWeight: 600,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {act.activity_type_name || 'General'}
                          </span>
                        </td>
                      )}



                      {/* Next Action */}
                      {visibleColumns.next_action && (
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: '180px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'var(--t-fg-muted)',
                            fontWeight: 600
                          }}
                          title={act.next_action || ''}
                        >
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {formatNextActionLabel(act.next_action, typesMaster)}
                          </span>
                        </td>
                      )}

                      {/* Next Action Date */}
                      {visibleColumns.next_action_date && (
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg-muted)' }}>
                          {formatDate(act.next_action_date)}
                        </td>
                      )}

                      {/* Outcome */}
                      {visibleColumns.outcome_name && (
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '124px',
                            padding: '4px 0',
                            borderRadius: '5px',
                            background: outcomeStyle.background || outcomeStyle.bg,
                            color: outcomeStyle.color,
                            border: outcomeStyle.border,
                            fontSize: '12px',
                            fontWeight: 600,
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                          }}>
                            {act.outcome_name || '—'}
                          </span>
                        </td>
                      )}

                      {/* Action Status */}
                      {visibleColumns.action_status_name && (
                        <td style={tdStyle}>
                          {isRowOverdue ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              width: '115px',
                              padding: '4px 0',
                              borderRadius: '5px',
                              background: 'rgba(239, 68, 68, 0.25)',
                              color: '#EF4444',
                              border: '1px solid #EF4444',
                              fontSize: '12px',
                              fontWeight: 900,
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 0 12px rgba(239, 68, 68, 0.35)'
                            }}>
                              <FiAlertCircle style={{ fontSize: '12px' }} /> OVERDUE
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '110px',
                              padding: '4px 0',
                              borderRadius: '5px',
                              background: statusStyle.background || statusStyle.bg,
                              color: statusStyle.color,
                              border: statusStyle.border,
                              fontSize: '12px',
                              fontWeight: 600,
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              {act.action_status_name || 'Open'}
                            </span>
                          )}
                        </td>
                      )}



                      {/* Overdue Reason */}
                      {visibleColumns.overdue_reason && (
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: '200px',
                            color: '#F87171'
                          }}
                          title={act.overdue_reason || ''}
                        >
                          <span
                            style={{
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {act.overdue_reason || '—'}
                          </span>
                        </td>
                      )}

                      {/* Active Status */}
                      {visibleColumns.is_active && (
                        <td style={tdStyle}>
                          {act.is_active ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '78px',
                              padding: '3px 0',
                              borderRadius: '4px',
                              background: 'rgba(0, 212, 170, 0.12)',
                              color: '#00D4AA',
                              border: '1px solid rgba(0, 212, 170, 0.3)',
                              fontSize: '11px',
                              fontWeight: 800,
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              ACTIVE
                            </span>
                          ) : (isUserSuperAdmin || hasAdminAccess(user)) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActivateActivity(act);
                              }}
                              title="Make Activity Active"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                background: 'rgba(0, 212, 170, 0.18)',
                                border: '1px solid rgba(0, 212, 170, 0.4)',
                                color: '#00D4AA',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <FiCheckCircle style={{ fontSize: '11px' }} />
                              <span>Activate</span>
                            </button>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '78px',
                              padding: '3px 0',
                              borderRadius: '4px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '11px',
                              fontWeight: 800,
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              INACTIVE
                            </span>
                          )}
                        </td>
                      )}

                      {/* Created At */}
                      {visibleColumns.created_at && (
                        <td style={{ ...tdStyle, color: 'var(--t-fg-muted)' }}>
                          {formatDate(act.created_at)}
                        </td>
                      )}

                      {/* Actions */}
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: 'center',
                          width: '135px',
                          minWidth: '130px',
                          padding: '10px 14px 10px 10px'
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
                          {(isUserSuperAdmin || hasAdminAccess(user)) && act.is_active === false && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActivateActivity(act);
                              }}
                              title="Make Activity Active"
                              style={{
                                padding: '3px 7px',
                                borderRadius: '4px',
                                background: 'rgba(0, 212, 170, 0.18)',
                                border: '1px solid rgba(0, 212, 170, 0.4)',
                                color: '#00D4AA',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                flexShrink: 0
                              }}
                            >
                              <FiCheckCircle style={{ fontSize: '11px' }} />
                              <span>Activate</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canUserEditRow) {
                                setEditModalState({ isOpen: true, activity: act, initialEditMode: true });
                              } else {
                                showToast('error', editRowTooltip);
                              }
                            }}
                            title={editRowTooltip}
                            disabled={!canUserEditRow}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: canUserEditRow ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.08)',
                              border: canUserEditRow ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                              color: canUserEditRow ? '#3b82f6' : '#64748B',
                              cursor: canUserEditRow ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              flexShrink: 0,
                              opacity: canUserEditRow ? 1 : 0.4
                            }}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canUserDeleteRow) {
                                handleDeleteActivity(act);
                              } else {
                                showToast('error', deleteRowTooltip);
                              }
                            }}
                            title={deleteRowTooltip}
                            disabled={!canUserDeleteRow}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: canUserDeleteRow ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.08)',
                              border: canUserDeleteRow ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                              color: canUserDeleteRow ? '#ef4444' : '#64748B',
                              cursor: canUserDeleteRow ? 'pointer' : 'not-allowed',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              flexShrink: 0,
                              opacity: canUserDeleteRow ? 1 : 0.4
                            }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Dynamic has_more Driven Pagination Footer Bar ── */}
        {showPagination && (
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--t-border)',
            background: 'var(--t-surface-alt)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            {/* Left: Summary Info */}
            <div style={{ fontSize: '13px', color: 'var(--t-fg-muted)' }}>
              Showing <strong style={{ color: '#FFFFFF' }}>{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong style={{ color: '#FFFFFF' }}>{(currentPage - 1) * pageSize + filtered.length}</strong> of <strong style={{ color: 'var(--t-teal)' }}>{displayTotalActivities}</strong> activities
              <span style={{ marginLeft: '8px', color: '#64748B', fontSize: '12px' }}>
                (Page {currentPage} of {totalPages})
              </span>
            </div>

            {/* Right: Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Rows Per Page */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13.5px', color: '#94A3B8', fontWeight: 700 }}>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    height: '36px',
                    padding: '0 32px 0 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0, 212, 170, 0.35)',
                    background: `var(--t-surface-alt, #0d141f) url("data:image/svg+xml;utf8,<svg fill='%2300D4AA' height='18' viewBox='0 0 24 24' width='18' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>") no-repeat right 8px center`,
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    fontFamily: "'Helvetica'",
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.6)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(0, 212, 170, 0.35)'}
                >
                  <option value={5} style={{ background: '#0D141F', color: '#FFFFFF' }}>5</option>
                  <option value={10} style={{ background: '#0D141F', color: '#FFFFFF' }}>10</option>
                  <option value={25} style={{ background: '#0D141F', color: '#FFFFFF' }}>25</option>
                  <option value={50} style={{ background: '#0D141F', color: '#FFFFFF' }}>50</option>
                </select>
              </div>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={handlePrevPage}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--t-border)',
                    background: !canGoPrev ? 'rgba(255, 255, 255, 0.02)' : 'var(--t-surface-solid)',
                    color: !canGoPrev ? '#475569' : 'var(--t-fg)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !canGoPrev ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FiChevronLeft /> Prev
                </button>

                <div style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #00D4AA',
                  background: 'linear-gradient(135deg, #009B82, #00D4AA)',
                  color: '#070C12',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(0, 212, 170, 0.35)'
                }}>
                  {currentPage}
                </div>

                <button
                  type="button"
                  disabled={!canGoNext}
                  onClick={handleNextPage}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--t-border)',
                    background: !canGoNext ? 'rgba(255, 255, 255, 0.02)' : 'var(--t-surface-solid)',
                    color: !canGoNext ? '#475569' : 'var(--t-fg)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: !canGoNext ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Next <FiChevronRight />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditActivityModal
        isOpen={editModalState.isOpen}
        activity={editModalState.activity}
        initialEditMode={editModalState.initialEditMode !== undefined ? editModalState.initialEditMode : true}
        typesMaster={typesMaster}
        outcomesMaster={outcomesMaster}
        statusesMaster={statusesMaster}
        leaders={leaders}
        onClose={() => setEditModalState({ isOpen: false, activity: null, initialEditMode: true })}
        onUpdated={async (updatedAct) => {
          pageCacheRef.current = {};
          await loadActivities(currentPage, true);
          showToast('success', `Activity #${updatedAct.activity_id} updated successfully!`);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={deleteDialogState.isOpen}
        title={deleteDialogState.title}
        message={deleteDialogState.message}
        isDeleting={deleteDialogState.isDeleting}
        onClose={() => setDeleteDialogState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteDialogState.onConfirm}
      />

      {/* Floating Toast Notification Banner */}
      {toast && toast.show && (
        <div
          style={{
            position: 'fixed',
            top: '28px',
            right: '28px',
            zIndex: 999999,
            minWidth: '320px',
            maxWidth: '460px',
            background: toast.type === 'success' ? '#091A16' : '#220A0A',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
            borderLeft: `5px solid ${toast.type === 'success' ? '#10B981' : '#EF4444'}`,
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px'
          }}>
            {toast.type === 'success' ? (
              <FiCheck style={{ color: '#10B981', fontSize: '16px', strokeWidth: 3 }} />
            ) : (
              <FiAlertCircle style={{ color: '#EF4444', fontSize: '16px', strokeWidth: 2.5 }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 800,
              color: toast.type === 'success' ? '#10B981' : '#EF4444',
              marginBottom: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {toast.type === 'success' ? 'Success' : 'Operation Failed'}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#F1F5F9',
              lineHeight: 1.45,
              wordBreak: 'break-word'
            }}>
              {toast.message}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setToast(prev => ({ ...prev, show: false }))}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px'
            }}
          >
            <FiX />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .activity-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .activity-scroll::-webkit-scrollbar-track { background: var(--t-surface-alt); border-radius: 4px; }
        .activity-scroll::-webkit-scrollbar-thumb { background: var(--t-border); border-radius: 4px; }
        .activity-scroll::-webkit-scrollbar-thumb:hover { background: var(--t-border-strong); }
        .custom-filter-dropdown-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb { background: rgba(0, 212, 170, 0.4); border-radius: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 212, 170, 0.7); }
      `}</style>
    </div>
  );
}

const thStyle = {
  padding: '14px 16px',
  fontFamily: "'Inter', sans-serif",
  fontSize: 'clamp(12.5px, 0.75vw + 4px, 14px)',
  fontWeight: 800,
  color: 'var(--t-fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  background: 'var(--t-surface-solid, #0B131E)',
  borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))',
  zIndex: 10
};

const tdStyle = {
  padding: '13px 16px',
  fontSize: 'clamp(13.5px, 0.85vw + 4px, 15.5px)',
  color: 'var(--t-fg-mid)',
  fontFamily: "'Inter', sans-serif",
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  textAlign: 'center',
  borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))'
};
