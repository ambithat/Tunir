import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiPlus,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiRefreshCw,
  FiLayers,
  FiUser,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiGlobe,
  FiCalendar,
  FiAlertTriangle,
  FiSave,
  FiBookmark,
  FiEye,
  FiInfo,
  FiRotateCcw,
  FiFileText,
  FiUploadCloud,
  FiPaperclip,
  FiExternalLink
} from 'react-icons/fi';
import * as XLSX from 'xlsx';
import {
  getLeads,
  updateLead,
  deleteLead,
  bulkDeleteLeads,
  deleteAllLeads,
  addLeadProduct,
  updateLeadProduct,
  deleteLeadProduct,
  uploadLeadProposal
} from '../../api/leadApi';
import { getLeadersDropdown } from '../../api/leaderApi';
import { getContactsDropdown, getContactById } from '../../api/contactApi';
import {
  getProductDropdown,
  getLeaderStageDropdown,
  getLeadProductStatusDropdown
} from '../../api/statusTypeApi';
import { COUNTRY_OPTIONS, formatCountryDisplay, getPhoneRulesForCountry, validatePhoneNumber } from '../../utils/countryData';
import { useAuth } from '../../context/AuthContext';
import { isExecutive, isSuperAdmin, isAdmin } from '../../utils/authRoles';
import { getDateRangeParams, isValidDateStr } from '../../utils/dateUtils';



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
  background: 'var(--t-surface-solid, #0A1017)',
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

const subThStyle = {
  padding: '10px 14px',
  fontSize: 'clamp(12px, 0.75vw + 4px, 13.5px)',
  fontWeight: 800,
  color: 'var(--t-fg-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'center'
};

const subTdStyle = {
  padding: '10px 14px',
  fontSize: 'clamp(13px, 0.8vw + 4px, 14.5px)',
  textAlign: 'center',
  verticalAlign: 'middle',
  color: 'var(--t-fg-mid)'
};






export const PROPOSAL_TYPE_OPTIONS = [
  { value: 'Technical Proposal Sent', label: 'Technical Proposal Sent' },
  { value: 'Techno Commercial Proposal Sent', label: 'Techno Commercial Proposal Sent' }
];

export const isProposalStatus = (statusName, statusId) => {
  if (!statusName && !statusId) return false;
  const s = String(statusName || '').toLowerCase().trim();
  return s.includes('proposal') || String(statusId) === '5';
};

export const isLostStage = (stageName, stageId, stagesMaster = []) => {
  if (stageName && (String(stageName).toLowerCase().includes('lost') || String(stageName).toLowerCase().includes('drop'))) return true;
  if (stageId && stagesMaster.length > 0) {
    const found = stagesMaster.find(s => String(s.id) === String(stageId));
    if (found && (String(found.leader_stage || found.stage || '').toLowerCase().includes('lost') || String(found.leader_stage || found.stage || '').toLowerCase().includes('drop'))) {
      return true;
    }
  }
  return false;
};

export const getStageProbability = (stageName, stageId, stagesMaster = []) => {
  const selStage = stagesMaster.find(s => String(s.id) === String(stageId));
  const sName = String(stageName || selStage?.leader_stage || selStage?.stage || '').toLowerCase().trim();

  if (sName.includes('lost') || sName.includes('drop')) return 0;
  if (sName.includes('low')) return 25;
  if (sName.includes('medium') || sName.includes('med')) return 50;
  if (sName.includes('high')) return 75;
  if (sName.includes('negotiat')) return 90;
  if (sName.includes('won')) return 100;

  if (selStage && selStage.probability !== undefined && selStage.probability !== null) {
    return Number(selStage.probability);
  }

  return 100;
};

export const COMMON_LOST_REASONS = [
  'Price / Budget constraint',
  'Competitor chosen',
  'Project cancelled / postponed',
  'Feature mismatch / Technical limitation',
  'Unresponsive / No decision made',
  'Other'
];

export const getProposalDocumentUrl = (url) => {
  if (!url) return '';
  let rawUrl = String(url).trim();
  if (!rawUrl) return '';

  const bucketBase = process.env.REACT_APP_BUCKET_BASE_URL || 'http://starai.local:8888/buckets';
  const envBase = bucketBase.trim().replace(/\/+$/, '');
  const bucketOrigin = envBase.endsWith('/buckets')
    ? envBase.replace(/\/buckets$/, '')
    : envBase.replace(/\/[^/]*$/, '');

  // 1. If absolute URL, check if it points to backend API (port :8000 or contains bucket/proposal/startai path)
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.port === '8000' || /\/(startai|proposal_sent|buckets)\//i.test(parsed.pathname)) {
        rawUrl = parsed.pathname + parsed.search + parsed.hash;
      } else {
        return rawUrl;
      }
    } catch (_) { }
  }

  // 2. Clean leading slashes
  const cleanPath = rawUrl.replace(/^\/+/, '');

  // 3. If path already starts with "buckets/", attach to bucketOrigin
  if (cleanPath.startsWith('buckets/')) {
    return `${bucketOrigin}/${cleanPath}`;
  }

  // 4. Attach relative path (e.g. "startai/proposal_sent/...") to envBase (which includes /buckets)
  return `${envBase}/${cleanPath}`;
};

export const parseProposalUrls = (urlStr) => {
  if (!urlStr) return [];
  return String(urlStr)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export const getProposalEntries = (item, parentLead = null) => {
  if (!item && !parentLead) return [];

  // 1. Direct proposals array from item
  const itemProposals = item?.proposals;
  if (Array.isArray(itemProposals) && itemProposals.length > 0) {
    return itemProposals.map(p => {
      const docUrl = p.url || p.proposal_document_url || p.proposal_url || p.proposal_link || null;
      return {
        proposal_sent_id: p.proposal_sent_id || p.id,
        proposal_type: p.proposal_type || 'Technical Proposal Sent',
        proposal_document_url: docUrl,
        url: docUrl,
        remarks: p.remarks || null,
        created_at: p.created_at || null,
        created_by: p.created_by || null,
        proposal_file: p.proposal_file || null
      };
    });
  }

  // 2. Direct proposals array from parent lead
  const parentProposals = parentLead?.proposals;
  if (Array.isArray(parentProposals) && parentProposals.length > 0) {
    return parentProposals.map(p => {
      const docUrl = p.url || p.proposal_document_url || p.proposal_url || p.proposal_link || null;
      return {
        proposal_sent_id: p.proposal_sent_id || p.id,
        proposal_type: p.proposal_type || 'Technical Proposal Sent',
        proposal_document_url: docUrl,
        url: docUrl,
        remarks: p.remarks || null,
        created_at: p.created_at || null,
        created_by: p.created_by || null,
        proposal_file: p.proposal_file || null
      };
    });
  }

  // 3. Fallback string fields on item or parentLead
  const targetObj = item || parentLead || {};
  const types = String(targetObj.proposal_type || 'Technical Proposal Sent').split(',').map(s => s.trim());
  const urls = String(targetObj.proposal_document_url || targetObj.proposal_url || targetObj.url || '').split(',').map(s => s.trim()).filter(Boolean);

  if (urls.length === 0 && !targetObj.proposal_type && !targetObj.proposal_document_url) return [];

  const count = Math.max(types.length, urls.length, 1);
  const result = [];
  for (let i = 0; i < count; i++) {
    const docUrl = urls[i] || null;
    result.push({
      proposal_type: types[i] || types[0] || 'Technical Proposal Sent',
      proposal_document_url: docUrl,
      url: docUrl
    });
  }
  return result;
};

export const getProposalFileName = (url) => {
  if (!url) return 'Proposal Document';
  const parts = String(url).split('/');
  return parts[parts.length - 1] || 'Proposal Document';
};

export const handleOpenProposalDoc = (url) => {
  if (!url) return;
  const fullUrl = getProposalDocumentUrl(url);
  if (fullUrl) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
};

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

/*
const DEFAULT_SOURCES = [
  'Direct',
  'Website',
  'LinkedIn',
  'Referral',
  'Cold Call',
  'Conference',
  'Email Campaign',
  'Partner'
];

const DEFAULT_COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Germany',
  'Singapore',
  'United Arab Emirates',
  'Saudi Arabia',
  'Bhutan',
  'Australia',
  'Canada',
  'Japan',
  'France',
  'Netherlands'
];
*/

export const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (_) {
    return isoString;
  }
};

// ── Custom Glassmorphic Select Component ─────────────────────────────────────
function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  icon: Icon = null,
  height = '40px',
  searchable = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const val = opt.value !== undefined
        ? opt.value
        : (opt.id !== undefined
          ? opt.id
          : (opt.leader_id || opt.emp_id || opt.product || opt.leader_stage || opt.status || ''));
      const lbl = opt.label
        || opt.full_name
        || opt.product
        || opt.leader_stage
        || opt.status
        || (opt.first_name ? `${opt.first_name} ${opt.last_name || ''}`.trim() : '')
        || String(val);
      return {
        value: val,
        label: lbl,
        sublabel: opt.sublabel || opt.designation || '',
        color: opt.color || null
      };
    }
    return { value: opt, label: String(opt), sublabel: '', color: null };
  });

  const selectedOpt = normalizedOptions.find((o) => String(o.value) === String(value));

  const filteredOptions = normalizedOptions.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return o.label.toLowerCase().includes(q) || (o.sublabel && o.sublabel.toLowerCase().includes(q));
  });

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 100020 : 'auto' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: height,
          padding: '0 12px',
          borderRadius: '8px',
          border: isOpen ? '1px solid var(--t-teal, #00D4AA)' : '1px solid var(--t-border, rgba(49, 151, 149, 0.35))',
          background: 'var(--t-surface-solid, rgba(5, 8, 14, 0.95))',
          color: selectedOpt ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)',
          fontSize: '13px',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 12px rgba(0, 212, 170, 0.25)' : 'none',
          transition: 'all 0.16s ease',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {Icon && <Icon style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '13px', flexShrink: 0 }} />}
          {selectedOpt?.color && (
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: selectedOpt.color, flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedOpt ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)', fontWeight: selectedOpt ? 600 : 400 }}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
          {selectedOpt?.sublabel && (
            <span style={{ fontSize: '10.5px', color: 'var(--t-fg-subtle, #8CA0B8)', background: 'var(--t-surface-alt, rgba(255,255,255,0.06))', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>
              {selectedOpt.sublabel}
            </span>
          )}
        </div>
        <FiChevronDown
          style={{
            fontSize: '14px',
            color: isOpen ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg-muted, #8CA0B8)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0
          }}
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: openUpward ? 'auto' : 'calc(100% + 4px)',
          bottom: openUpward ? 'calc(100% + 4px)' : 'auto',
          left: 0,
          right: 0,
          zIndex: 100050,
          background: 'var(--t-surface-solid, #0c131d)',
          border: '1px solid var(--t-border, rgba(0, 212, 170, 0.35))',
          borderRadius: '10px',
          boxShadow: 'var(--t-card-shadow, 0 16px 40px rgba(0, 0, 0, 0.95))',
          overflow: 'hidden',
          backdropFilter: 'blur(14px)'
        }}>
          {searchable && normalizedOptions.length > 5 && (
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--t-surface-alt, rgba(0,0,0,0.5))', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--t-border, rgba(49, 151, 149, 0.25))', height: '28px' }}>
                <FiSearch style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '12px' }} />
                <input
                  type="text"
                  autoFocus
                  placeholder="Filter options..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--t-fg, #FFF)', fontSize: '12px', width: '100%', outline: 'none' }}
                />
              </div>
            </div>
          )}

          <div className="custom-filter-dropdown-scroll" style={{ maxHeight: '170px', overflowY: 'auto', padding: '4px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 212, 170, 0.4) rgba(0, 0, 0, 0.2)' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '10px 12px', color: 'var(--t-fg-muted, #64748B)', fontSize: '12px', textAlign: 'center' }}>
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={String(opt.value)}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))' : 'transparent',
                      color: isSelected ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg, #E2E8F0)',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 700 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--t-row-hover, rgba(255, 255, 255, 0.05))';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {opt.color && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: opt.color }} />
                      )}
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '10.5px', color: 'var(--t-fg-subtle, #8CA0B8)', background: 'var(--t-surface-alt, rgba(255,255,255,0.06))', padding: '1px 5px', borderRadius: '4px' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <FiCheck style={{ color: '#00D4AA', fontSize: '13px' }} />}
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

// ── 1. Full Lead Details View & In-Place Edit Modal (PATCH /api/v1/leads/{lead_id}) ────────
function EditLeadModal({ isOpen, lead, initialEditMode = true, onClose, onUpdated, leaders = [], productsMaster = [], stagesMaster = [], statusesMaster = [], contactsMaster = [] }) {
  const { user } = useAuth();
  const isAdminOrSuperAdmin = isAdmin(user);
  const [currentLead, setCurrentLead] = useState(lead);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products'
  const [selectedContactId, setSelectedContactId] = useState('');

  const activeLead = currentLead || lead;

  const [isFetchingContact, setIsFetchingContact] = useState(false);
  const [form, setForm] = useState({
    lead_owner_id: '',
    lead_source: 'Direct',
    company: '',
    contact_name: '',
    designation: '',
    phone_no: '',
    email: '',
    country: 'India',
    is_active: true
  });
  const [assignedProducts, setAssignedProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [isAssigningForSomeone, setIsAssigningForSomeone] = useState(false);
  const initialSnapshotRef = useRef(null);

  const editModalContactOptions = useMemo(() => {
    const opts = [
      { value: '__ADD_NEW__', label: '+ Add New Contact', sublabel: 'Manual Text Entry' }
    ];

    const curName = form.contact_name || activeLead?.contact_name || activeLead?.contact_person || '';
    const curVal = selectedContactId || curName;

    const isMatchedInMaster = (contactsMaster || []).some(c => String(c.contact_id || c.id) === String(selectedContactId));

    if (curName && !isMatchedInMaster) {
      opts.push({
        value: curVal || curName,
        label: curName,
        sublabel: form.company ? form.company : 'Current Contact'
      });
    }

    (contactsMaster || []).forEach(c => {
      const cId = String(c.contact_id || c.id);
      if (!opts.some(o => String(o.value) === cId)) {
        opts.push({
          value: cId,
          label: c.contact_name || 'Contact',
          sublabel: c.company ? c.company : (c.email || c.phone_no_1 || '')
        });
      }
    });

    return opts;
  }, [contactsMaster, form.contact_name, form.company, activeLead, selectedContactId]);

  const currentUserObj = useMemo(() => {
    try {
      const stored = localStorage.getItem('user_data');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const currentUserRole = String(currentUserObj?.role || currentUserObj?.user_role || '').toLowerCase();
  const loggedInUserId = String(currentUserObj?.leader_id || currentUserObj?.user_id || currentUserObj?.id || '').trim();
  const isCeoOrCfo = currentUserRole.includes('admin') || currentUserRole.includes('super');

  useEffect(() => {
    if (isOpen && lead) {
      setIsEditMode(initialEditMode);

      // Determine initial lead_owner_id
      let initialOwnerId = '';
      if (lead.lead_owner_id !== undefined && lead.lead_owner_id !== null && String(lead.lead_owner_id).toLowerCase() !== 'null' && String(lead.lead_owner_id).trim() !== '') {
        initialOwnerId = String(lead.lead_owner_id);
      } else if (lead.leader_id || lead.owner_id) {
        initialOwnerId = String(lead.leader_id || lead.owner_id);
      } else if (lead.lead_owner_name || lead.owner || lead.lead_owner) {
        const ownerName = String(lead.lead_owner_name || lead.owner || lead.lead_owner).toLowerCase();
        const foundLeader = leaders.find(l => {
          const fullName = `${l.first_name || ''} ${l.last_name || ''}`.trim().toLowerCase();
          const lName = String(l.name || l.leader_name || '').toLowerCase();
          return fullName === ownerName || lName === ownerName;
        });
        if (foundLeader) {
          initialOwnerId = String(foundLeader.leader_id || foundLeader.emp_id || foundLeader.id);
        }
      }

      if (!initialOwnerId && !isCeoOrCfo && loggedInUserId) {
        initialOwnerId = loggedInUserId;
      }

      // Determine initial contact_name and selectedContactId
      const contactName = lead.contact_name || lead.contact_person || lead.contact || lead.contact_person_name || '';
      let initialContactId = '';
      if (lead.contact_id || lead.contact_person_id) {
        initialContactId = String(lead.contact_id || lead.contact_person_id);
      } else if (contactName && Array.isArray(contactsMaster)) {
        const matchedContact = contactsMaster.find(c =>
          (c.contact_name || c.name || c.contact_person || '').toLowerCase() === contactName.toLowerCase()
        );
        if (matchedContact) {
          initialContactId = String(matchedContact.contact_id || matchedContact.id || matchedContact.value);
        }
      }

      if (!initialContactId && contactName) {
        initialContactId = contactName;
      }

      setSelectedContactId(initialContactId);

      setForm({
        lead_owner_id: initialOwnerId,
        lead_source: lead.lead_source || lead.source || 'Direct',
        company: lead.company || lead.company_name || lead.account || '',
        contact_name: contactName,
        designation: lead.designation || lead.contact_designation || lead.position || '',
        phone_no: (lead.phone_no || lead.phone || lead.mobile_no || lead.mobile || '').replace(/\D/g, ''),
        email: lead.email || lead.contact_email || '',
        country: lead.country || 'India',
        is_active: lead.is_active !== undefined ? Boolean(lead.is_active) : true
      });

      const initialProds = Array.isArray(lead.products) ? lead.products.map(p => {
        let pid = p.product_id;
        let pname = p.product_name || p.product || '';
        if ((!pid || pid === 0) && pname && productsMaster.length > 0) {
          const found = productsMaster.find(pm => (pm.product || pm.product_name || '').toLowerCase() === pname.toLowerCase());
          if (found) pid = found.id;
        }

        let stgId = p.stage_id;
        let stgName = p.stage_name || p.stage || p.leader_stage || '';
        if ((!stgId || stgId === 0) && stgName && stagesMaster.length > 0) {
          const found = stagesMaster.find(sm => (sm.leader_stage || sm.stage || '').toLowerCase() === stgName.toLowerCase());
          if (found) stgId = found.id;
        }

        let stsId = p.status_id;
        let stsName = p.status_name || p.status || '';
        if ((!stsId || stsId === 0) && stsName && statusesMaster.length > 0) {
          const found = statusesMaster.find(stm => (stm.status || stm.status_name || '').toLowerCase() === stsName.toLowerCase());
          if (found) stsId = found.id;
        }

        const proposalsList = getProposalEntries(p, lead);

        return {
          product_register_id: p.product_register_id || undefined,
          lead_id: p.lead_id || lead.lead_id,
          product_id: pid !== undefined && pid !== null ? pid : (productsMaster[0]?.id || 1),
          product_name: pname || productsMaster.find(pm => String(pm.id) === String(pid))?.product || 'Product',
          quantity: p.quantity !== undefined && p.quantity !== null ? p.quantity : 1,
          stage_id: stgId !== undefined && stgId !== null ? stgId : (stagesMaster[0]?.id || 1),
          stage_name: stgName || (stgId ? stagesMaster.find(sm => String(sm.id) === String(stgId))?.leader_stage : '') || 'New',
          status_id: stsId !== undefined && stsId !== null ? stsId : (statusesMaster[0]?.id || 1),
          status_name: stsName || statusesMaster.find(stm => String(stm.id) === String(stsId))?.status || 'New',
          probability: p.probability !== undefined && p.probability !== null ? p.probability : 100,
          project_value: p.project_value !== undefined && p.project_value !== null ? p.project_value : 0,
          expected_closure: p.expected_closure ? String(p.expected_closure).split('T')[0] : '',
          pipeline: p.pipeline !== undefined && p.pipeline !== null ? p.pipeline : (Number(p.project_value || 0) * (Number(p.probability || 100) / 100)),
          risk_matrix: p.risk_matrix || 'Clear',
          proposals: proposalsList,
          proposal_type: p.proposal_type || proposalsList.map(pr => pr.proposal_type).join(', ') || (isProposalStatus(stsName, stsId) ? 'Technical Proposal Sent' : null),
          proposal_document_url: p.proposal_document_url || proposalsList.map(pr => pr.proposal_document_url).filter(Boolean).join(', ') || null,
          proposal_file: null,
          lost_reason: p.lost_reason || (isLostStage(stgName, stgId, stagesMaster) ? 'Price / Budget constraint' : null),
          created_at: p.created_at || null,
          won: p.won !== undefined && p.won !== null ? (typeof p.won === 'number' ? p.won : (Number(p.won) || 0)) : 0,
          is_active: p.is_active !== undefined ? Boolean(p.is_active) : true
        };
      }) : [];

      setAssignedProducts(initialProds);
      initialSnapshotRef.current = {
        form: {
          lead_owner_id: initialOwnerId,
          lead_source: lead.lead_source || lead.source || 'Direct',
          company: lead.company || lead.company_name || lead.account || '',
          contact_name: contactName,
          designation: lead.designation || lead.contact_designation || lead.position || '',
          phone_no: (lead.phone_no || lead.phone || lead.mobile_no || lead.mobile || '').replace(/\D/g, ''),
          email: lead.email || lead.contact_email || '',
          country: lead.country || 'India',
          is_active: lead.is_active !== undefined ? Boolean(lead.is_active) : true,
          selectedContactId: initialContactId
        },
        products: initialProds
      };
      setErrorMsg('');
      setActiveTab('overview');
    }
  }, [isOpen, lead, initialEditMode, productsMaster, stagesMaster, statusesMaster]);

  const hasChanges = useMemo(() => {
    if (!isOpen || !lead || !initialSnapshotRef.current) return false;
    const initForm = initialSnapshotRef.current.form;
    const initProds = initialSnapshotRef.current.products || [];

    const formChanged =
      String(form.lead_owner_id || '') !== String(initForm.lead_owner_id || '') ||
      String(form.lead_source || '') !== String(initForm.lead_source || '') ||
      String(form.company || '').trim() !== String(initForm.company || '').trim() ||
      String(form.contact_name || '').trim() !== String(initForm.contact_name || '').trim() ||
      String(form.designation || '').trim() !== String(initForm.designation || '').trim() ||
      String(form.phone_no || '').trim() !== String(initForm.phone_no || '').trim() ||
      String(form.email || '').trim() !== String(initForm.email || '').trim() ||
      String(form.country || '').trim() !== String(initForm.country || '').trim() ||
      Boolean(form.is_active) !== Boolean(initForm.is_active) ||
      String(selectedContactId || '') !== String(initForm.selectedContactId || '');

    if (formChanged) return true;
    if (assignedProducts.length !== initProds.length) return true;

    return assignedProducts.some((p, idx) => {
      const orig = initProds[idx];
      if (!orig) return true;
      return (
        String(p.product_id || '') !== String(orig.product_id || '') ||
        String(p.quantity || 1) !== String(orig.quantity || 1) ||
        String(p.stage_id || '') !== String(orig.stage_id || '') ||
        String(p.status_id || '') !== String(orig.status_id || '') ||
        String(p.project_value || 0) !== String(orig.project_value || 0) ||
        String(p.expected_closure || '') !== String(orig.expected_closure || '') ||
        String(p.proposal_type || '') !== String(orig.proposal_type || '') ||
        String(p.proposal_document_url || '') !== String(orig.proposal_document_url || '') ||
        String(p.lost_reason || '') !== String(orig.lost_reason || '') ||
        Boolean(p.is_active) !== Boolean(orig.is_active)
      );
    });
  }, [isOpen, lead, form, assignedProducts, selectedContactId]);

  if (!isOpen || !lead) return null;

  const handleAddProductRow = () => {
    const defaultProd = productsMaster[0] || null;
    const defaultStage = stagesMaster[0] || null;
    const defaultStatus = statusesMaster[0] || null;

    if (!defaultProd || !defaultStage || !defaultStatus) return;

    setAssignedProducts(prev => [
      ...prev,
      {
        product_id: defaultProd.id,
        product_name: defaultProd.product || defaultProd.product_name || '',
        quantity: 1,
        stage_id: defaultStage.id,
        stage_name: defaultStage.leader_stage || defaultStage.stage || '',
        status_id: defaultStatus.id,
        status_name: defaultStatus.status || defaultStatus.status_name || '',
        probability: 100,
        project_value: 0,
        expected_closure: '',
        pipeline: 0,
        won: 0,
        risk_matrix: 'Clear',
        proposal_type: isProposalStatus(defaultStatus.status, defaultStatus.id) ? 'Technical Proposal Sent' : null,
        proposal_document_url: null,
        proposal_file: null,
        lost_reason: isLostStage(defaultStage.leader_stage, defaultStage.id, stagesMaster) ? 'Price / Budget constraint' : null,
        is_active: true
      }
    ]);
  };

  const handleProductChange = (index, field, value) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      let valToSet = value;

      if (field === 'project_value') {
        if (value === '' || value === null || value === undefined) {
          valToSet = '';
        } else {
          valToSet = String(value).replace(/[^0-9.]/g, '');
        }
      }

      updated[index] = { ...updated[index], [field]: valToSet };

      // Determine stage metadata & status metadata
      const curStageId = field === 'stage_id' ? valToSet : updated[index].stage_id;
      const selStage = stagesMaster.find(sm => String(sm.id) === String(curStageId));
      const stageName = field === 'stage_name' ? valToSet : (selStage?.leader_stage || selStage?.stage || updated[index].stage_name || '');

      const isLost = isLostStage(stageName, curStageId, stagesMaster);

      if (field === 'status_name' || field === 'status_id') {
        const isProp = isProposalStatus(
          field === 'status_name' ? valToSet : updated[index].status_name,
          field === 'status_id' ? valToSet : updated[index].status_id
        );
        if (isProp && !updated[index].proposal_type) {
          updated[index].proposal_type = 'Technical Proposal Sent';
        }
      }

      if (field === 'stage_name' || field === 'stage_id') {
        updated[index].stage_name = stageName;
        if (isLost && !updated[index].lost_reason) {
          updated[index].lost_reason = 'Price / Budget constraint';
        } else if (!isLost) {
          updated[index].lost_reason = null;
        }
      }

      // Dynamically recalculate probability (lost=0%, low=25%, medium=50%, high=75%, negotiation=90%, won=100%)
      const prob = getStageProbability(stageName, curStageId, stagesMaster);
      updated[index].probability = prob;

      const projVal = updated[index].project_value !== '' && updated[index].project_value !== null && !isNaN(Number(updated[index].project_value))
        ? Math.max(0, Number(updated[index].project_value))
        : 0;

      updated[index].pipeline = projVal * (prob / 100);
      updated[index].won = prob === 100 ? projVal : 0;

      return updated;
    });
  };

  const handleAddModalProposalEntry = (productIdx) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || getProposalEntries(pRow);
      updated[productIdx] = {
        ...pRow,
        proposals: [
          ...currentProposals,
          { proposal_type: 'Technical Proposal Sent', proposal_file: null, proposal_document_url: null }
        ]
      };
      return updated;
    });
  };

  const handleRemoveModalProposalEntry = (productIdx, proposalIdx) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || getProposalEntries(pRow);
      if (currentProposals.length > 1) {
        const nextProposals = currentProposals.filter((_, i) => i !== proposalIdx);
        updated[productIdx] = {
          ...pRow,
          proposals: nextProposals,
          proposal_type: nextProposals.map(p => p.proposal_type).join(', '),
          proposal_document_url: nextProposals.map(p => p.proposal_document_url).filter(Boolean).join(', ')
        };
      }
      return updated;
    });
  };

  const handleUpdateModalProposalEntry = (productIdx, proposalIdx, field, value) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || getProposalEntries(pRow);
      const newProposals = [...currentProposals];
      newProposals[proposalIdx] = {
        ...newProposals[proposalIdx],
        [field]: value
      };
      updated[productIdx] = {
        ...pRow,
        proposals: newProposals
      };
      return updated;
    });
  };

  const handleRemoveProductRow = (index) => {
    setAssignedProducts(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!form.company.trim()) {
      setErrorMsg('Company name is required.');
      return;
    }

    // Country-specific mobile number validation
    const phoneErr = validatePhoneNumber(form.phone_no, form.country || 'India', 'Phone Number');
    if (phoneErr) {
      setErrorMsg(phoneErr);
      return;
    }

    setIsSubmitting(true);

    const payload = {
      lead_owner_id: form.lead_owner_id ? String(form.lead_owner_id) : null,
      lead_source: form.lead_source ? String(form.lead_source) : null,
      company: form.company.trim(),
      contact_name: form.contact_name ? form.contact_name.trim() : null,
      designation: form.designation ? form.designation.trim() : null,
      phone_no: form.phone_no ? form.phone_no.trim() : null,
      email: form.email ? form.email.trim() : null,
      country: form.country && form.country.trim() ? form.country.trim() : 'India',
      is_active: Boolean(form.is_active),
      products: assignedProducts.map(p => {
        const selStage = stagesMaster.find(sm => sm.id === p.stage_id);
        const stageName = p.stage_name || selStage?.leader_stage || '';
        const isLost = isLostStage(stageName, p.stage_id, stagesMaster);

        const item = {
          product_id: parseInt(p.product_id, 10) || 1,
          quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
          status_id: p.status_id !== '' && p.status_id !== null && p.status_id !== undefined ? parseInt(p.status_id, 10) : 1,
          stage_id: p.stage_id !== '' && p.stage_id !== null && p.stage_id !== undefined ? parseInt(p.stage_id, 10) : 1,
          project_value: p.project_value !== '' && p.project_value !== null && !isNaN(Number(p.project_value)) ? Number(p.project_value) : 0,
          expected_closure: p.expected_closure ? String(p.expected_closure).slice(0, 10) : null,
          proposal_type: p.proposal_type ? String(p.proposal_type).trim() : null,
          proposal_document_url: p.proposal_document_url ? String(p.proposal_document_url).trim() : null,
          lost_reason: isLost ? (p.lost_reason ? String(p.lost_reason).trim() : 'Lost') : null,
          is_active: p.is_active !== undefined ? Boolean(p.is_active) : true
        };
        if (p.product_register_id) {
          item.product_register_id = String(p.product_register_id).trim();
        }
        return item;
      })
    };

    try {
      const serverRes = await updateLead(lead.lead_id, payload);

      // Upload proposal files for any products that had proposal entries
      for (const p of assignedProducts) {
        const proposalsList = p.proposals || (p.proposal_file ? [{ proposal_type: p.proposal_type, proposal_file: p.proposal_file, proposal_document_url: p.proposal_document_url }] : getProposalEntries(p));
        if (proposalsList.length > 0) {
          const uploadedUrls = [];
          const uploadedTypes = [];
          for (const entry of proposalsList) {
            if (entry.proposal_file) {
              try {
                const upRes = await uploadLeadProposal({
                  file: entry.proposal_file,
                  proposal_type: entry.proposal_type || 'Technical Proposal Sent',
                  lead_id: lead.lead_id,
                  product_register_id: p.product_register_id || undefined
                });
                const uploadedUrl = upRes?.proposal_document_url || upRes?.data?.proposal_document_url || upRes?.url || upRes?.data?.url;
                if (uploadedUrl) {
                  uploadedUrls.push(uploadedUrl);
                  uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
                  entry.proposal_document_url = uploadedUrl;
                }
              } catch (uploadErr) {
                console.error('[EditLeadModal] Proposal upload failed for product:', p.product_register_id, uploadErr);
              }
            } else if (entry.proposal_document_url) {
              uploadedUrls.push(entry.proposal_document_url);
              uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
            }
          }
          if (uploadedUrls.length > 0) {
            p.proposal_document_url = uploadedUrls.join(', ');
            p.proposal_type = uploadedTypes.join(', ');
            p.proposals = proposalsList;
          }
        }
      }

      // Resolve product metadata for immediate UI sync
      const resolvedProducts = (payload.products || []).map((p) => {
        const origProd = (assignedProducts || []).find(op => op.product_register_id === p.product_register_id) || (lead.products || []).find(op => op.product_register_id === p.product_register_id);
        const selProduct = productsMaster.find(pm => pm.id === p.product_id);
        const selStage = stagesMaster.find(sm => sm.id === p.stage_id);
        const selStatus = statusesMaster.find(stm => stm.id === p.status_id);
        const isLost = isLostStage(selStage?.leader_stage || origProd?.stage_name, p.stage_id, stagesMaster);

        return {
          ...origProd,
          ...p,
          product_name: selProduct?.product || origProd?.product_name || `Product #${p.product_id}`,
          stage_name: selStage?.leader_stage || origProd?.stage_name || `Stage #${p.stage_id}`,
          status_name: selStatus?.status || origProd?.status_name || 'New',
          probability: origProd?.probability !== undefined ? origProd.probability : (selStage?.probability ?? 100),
          won: origProd?.won || 0,
          pipeline: origProd?.pipeline || p.project_value,
          risk_matrix: origProd?.risk_matrix || 'Clear',
          proposal_type: origProd?.proposal_type || (isProposalStatus(selStatus?.status, p.status_id) ? (origProd?.proposal_type || 'Technical Proposal Sent') : null),
          proposal_document_url: origProd?.proposal_document_url || null,
          lost_reason: isLost ? (origProd?.lost_reason || p.lost_reason || 'Lost') : null,
          product_register_id: p.product_register_id || `PRD-${Date.now().toString().slice(-4)}`
        };
      });

      const freshLeadObj = (serverRes && serverRes.lead_id) ? serverRes : (serverRes?.data?.lead_id ? serverRes.data : null);

      const selLeader = leaders.find(l => String(l.leader_id || l.emp_id) === String(payload.lead_owner_id));
      const updatedLeadData = freshLeadObj ? {
        ...freshLeadObj,
        lead_owner_name: freshLeadObj.lead_owner_name || (selLeader ? (selLeader.full_name || `${selLeader.first_name} ${selLeader.last_name || ''}`.trim()) : (lead.lead_owner_name || 'Unassigned')),
        products: Array.isArray(freshLeadObj.products) && freshLeadObj.products.length > 0
          ? freshLeadObj.products.map(fp => {
            const selProd = productsMaster.find(pm => String(pm.id) === String(fp.product_id));
            const selStage = stagesMaster.find(sm => String(sm.id) === String(fp.stage_id));
            const selStatus = statusesMaster.find(stm => String(stm.id) === String(fp.status_id));
            return {
              ...fp,
              product_name: fp.product_name || selProd?.product || `Product #${fp.product_id}`,
              stage_name: fp.stage_name || selStage?.leader_stage || `Stage #${fp.stage_id}`,
              status_name: fp.status_name || selStatus?.status || 'New'
            };
          })
          : resolvedProducts
      } : {
        ...lead,
        ...payload,
        lead_owner_name: selLeader ? (selLeader.full_name || `${selLeader.first_name} ${selLeader.last_name || ''}`.trim()) : (lead.lead_owner_name || 'Unassigned'),
        products: resolvedProducts
      };

      setCurrentLead(updatedLeadData);
      onUpdated(updatedLeadData);
      setIsEditMode(false); // Return to View mode displaying updated data
    } catch (err) {
      console.error('[LeadDetailsModal] Failed to patch lead:', err);
      setErrorMsg(formatApiError(err, 'Failed to update lead. Please verify inputs.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid rgba(49, 151, 149, 0.35)',
    background: 'rgba(5, 8, 14, 0.95)',
    color: '#FFFFFF',
    fontSize: '13px',
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
    backgroundPosition: 'right 10px center',
    paddingRight: '30px'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11.5px',
    fontWeight: 800,
    color: '#94A3B8',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  const currentOwnerObj = leaders.find(l => String(l.leader_id || l.emp_id) === String(form.lead_owner_id));
  const currentOwnerName = currentOwnerObj ? (currentOwnerObj.full_name || `${currentOwnerObj.first_name} ${currentOwnerObj.last_name || ''}`.trim()) : (lead.lead_owner_name || 'Unassigned');

  const totalCalcProjectValue = assignedProducts.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0);
  const totalCalcPipeline = assignedProducts.reduce((sum, p) => sum + (Number(p.pipeline) || 0), 0);

  const subThStyle = {
    padding: '10px 10px',
    fontSize: '11px',
    fontWeight: 800,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    textAlign: 'center',
    whiteSpace: 'nowrap'
  };

  const subTdStyle = {
    padding: '9px 10px',
    fontSize: '12.5px',
    color: '#F8FAFC',
    textAlign: 'center',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap'
  };

  const formatINR = (val, compact = false) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    const abs = Math.abs(num);
    if (compact && abs >= 1e7) {
      const cr = num / 1e7;
      return `₹${cr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
    }
    if (compact && abs >= 1e5) {
      const lk = num / 1e5;
      return `₹${lk.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
    }
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  };

  const getStageBadge = (stageName) => {
    const s = (stageName || '').toLowerCase();
    if (s.includes('won')) return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
    if (s.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
    if (s.includes('negotiation') || s.includes('high')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
    if (s.includes('qualified') || s.includes('proposal')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' };
    return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' };
  };

  const getRiskBadge = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
    if (r.includes('revenue') || r.includes('clear')) return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--t-scrim, rgba(0, 0, 0, 0.75))',
      backdropFilter: 'blur(10px)',
      zIndex: 100000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #090e15)',
        border: '1px solid var(--t-border, rgba(0, 212, 170, 0.35))',
        borderRadius: '16px',
        width: '900px',
        maxWidth: '92vw',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--t-card-shadow, 0 24px 60px rgba(0, 0, 0, 0.95))',
        color: 'var(--t-fg, #FFFFFF)'
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 26px',
          borderBottom: '1px solid var(--t-border, rgba(49, 151, 149, 0.22))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--t-surface-solid, rgba(14,20,28,0.98))',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 198, 255, 0.15))',
              border: '1px solid rgba(0, 212, 170, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--t-teal, #00D4AA)',
              fontSize: '20px'
            }}>
              <FiBriefcase />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', letterSpacing: '0.12em', color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', fontWeight: 800, fontFamily: "'Helvetica'" }}>
                  #{activeLead.lead_id}
                </span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '2px' }}>
                {isEditMode ? (form.company || activeLead.company || 'Lead Details') : (activeLead.company || 'Lead Details')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                title="Edit Lead"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))',
                  border: '1px solid var(--t-border, rgba(0, 212, 170, 0.4))',
                  color: 'var(--t-teal, #00D4AA)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 212, 170, 0.28)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))'; }}
              >
                <FiEdit2 /> Edit Lead
              </button>
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
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#EF4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--t-surface-alt, rgba(255, 255, 255, 0.05))'; e.currentTarget.style.color = 'var(--t-fg-muted, #8CA0B8)'; }}
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '0 26px',
          borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
          background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.25))',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'overview' ? '2px solid var(--t-teal, #00D4AA)' : '2px solid transparent',
              color: activeTab === 'overview' ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg-muted, #94A3B8)',
              fontSize: '14.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FiUser /> Lead Profile & Contacts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            style={{
              padding: '12px 18px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'products' ? '2px solid var(--t-teal, #00D4AA)' : '2px solid transparent',
              color: activeTab === 'products' ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg-muted, #94A3B8)',
              fontSize: '14.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FiPackage /> Product Register
          </button>
        </div>

        {/* Modal Body: VIEW vs EDIT Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0, 212, 170, 0.3) rgba(255, 255, 255, 0.03)'
          }}
        >
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {/* ── Summary KPIs bar (Common to both View and Edit) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', flexShrink: 0 }}>
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.08))', border: '1px solid var(--t-border, rgba(0, 212, 170, 0.25))', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Products Assigned</div>
              <div style={{ fontSize: '19.5px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '2px', whiteSpace: 'nowrap' }}>{assignedProducts.length} Items</div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--t-cyan-tint, rgba(0, 198, 255, 0.08))', border: '1px solid var(--t-border, rgba(0, 198, 255, 0.25))', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Project Value</div>
              <div
                title={`₹ ${totalCalcProjectValue.toLocaleString('en-IN')}`}
                style={{
                  fontSize: totalCalcProjectValue >= 1e9 ? '16.5px' : '19.5px',
                  fontWeight: 700,
                  color: 'var(--t-fg, #FFFFFF)',
                  marginTop: '2px',
                  fontFamily: "'Helvetica'",
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {formatINR(totalCalcProjectValue, totalCalcProjectValue >= 1e7)}
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Pipeline</div>
              <div
                title={`₹ ${totalCalcPipeline.toLocaleString('en-IN')}`}
                style={{
                  fontSize: totalCalcPipeline >= 1e9 ? '16.5px' : '19.5px',
                  fontWeight: 700,
                  color: 'var(--t-fg, #FFFFFF)',
                  marginTop: '2px',
                  fontFamily: "'Helvetica'",
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {formatINR(totalCalcPipeline, totalCalcPipeline >= 1e7)}
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.04))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.1))', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lead Owner</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', minWidth: 0 }}>
                <div title={currentOwnerName} style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentOwnerName}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 1: LEAD PROFILE & DETAILS ──────────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isEditMode ? (
                /* ── VIEW MODE (READ ONLY) ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Account & Contact Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {/* Card 1: Account Information */}
                    <div style={{
                      background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                      border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
                      borderRadius: '12px',
                      padding: '18px 22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      minWidth: 0
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 700, color: 'var(--t-teal, #00D4AA)', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.06))', paddingBottom: '10px' }}>
                        <FiBriefcase style={{ fontSize: '16px' }} /> Company & Register Details
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Company Name:</span>
                        <span title={activeLead.company || '—'} style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{activeLead.company || '—'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Country:</span>
                        <span title={activeLead.country || '—'} style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{formatCountryDisplay(activeLead.country || '—')}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Lead Source:</span>
                        <span title={activeLead.lead_source || 'Direct'} style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{activeLead.lead_source || 'Direct'}</span>
                      </div>
                    </div>

                    {/* Card 2: Contact Person & Ownership */}
                    <div style={{
                      background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                      border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
                      borderRadius: '12px',
                      padding: '18px 22px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      minWidth: 0
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 700, color: 'var(--t-cyan, #00C6FF)', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.06))', paddingBottom: '10px' }}>
                        <FiUser style={{ fontSize: '16px' }} /> Contact Person & Ownership
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Contact Person:</span>
                        <span title={activeLead.contact_name || '—'} style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{activeLead.contact_name || '—'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Designation:</span>
                        <span title={activeLead.designation || '—'} style={{ color: '#F1F5F9', fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>{activeLead.designation || '—'}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Email Address:</span>
                        {activeLead.email ? (
                          <a href={`mailto:${activeLead.email}`} title={activeLead.email} style={{ color: 'var(--t-cyan, #00C6FF)', textDecoration: 'none', fontFamily: "'Helvetica'", fontSize: '13.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                            {activeLead.email}
                          </a>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px', minWidth: 0 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Phone Number:</span>
                        {activeLead.phone_no ? (
                          <span title={activeLead.phone_no} style={{ color: '#FFFFFF', fontFamily: "'Helvetica'", fontSize: '13.5px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                            {activeLead.phone_no}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        fontSize: '13.5px',
                        minWidth: 0,
                        paddingTop: '8px',
                        borderTop: '1px solid var(--t-border, rgba(255, 255, 255, 0.06))'
                      }}>
                        <span style={{ color: '#94A3B8', fontWeight: 600, flexShrink: 0 }}>Assigned Leader:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span title={lead.lead_owner_name || currentOwnerName} style={{ color: 'var(--t-teal, #00D4AA)', fontWeight: 800, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lead.lead_owner_name || currentOwnerName}
                          </span>
                          {(lead.lead_owner_id || form.lead_owner_id) && (
                            <span style={{
                              fontSize: '11px',
                              fontFamily: "'Helvetica'",
                              color: 'var(--t-teal, #00D4AA)',
                              background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.12))',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              flexShrink: 0
                            }}>
                              {lead.lead_owner_id || form.lead_owner_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── EDIT MODE (FORM INPUTS) ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Contact Person</label>
                        {selectedContactId === '__ADD_NEW__' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedContactId('');
                              setForm(prev => ({
                                ...prev,
                                contact_name: '',
                                company: '',
                                designation: '',
                                phone_no: '',
                                phone_no_2: '',
                                email: '',
                                country: 'India'
                              }));
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#00D4AA',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            Select Existing Contact
                          </button>
                        )}
                      </div>

                      {selectedContactId === '__ADD_NEW__' ? (
                        <input
                          value={form.contact_name}
                          onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                          placeholder="Type contact name manually..."
                          style={inputStyle}
                        />
                      ) : (
                        <CustomSelect
                          options={editModalContactOptions}
                          value={selectedContactId || form.contact_name || ''}
                          onChange={async (cId) => {
                            setSelectedContactId(cId);
                            if (cId === '__ADD_NEW__') {
                              setForm(prev => ({
                                ...prev,
                                contact_name: '',
                                company: '',
                                designation: '',
                                phone_no: '',
                                phone_no_2: '',
                                email: '',
                                country: 'India'
                              }));
                              return;
                            }
                            setIsFetchingContact(true);
                            try {
                              let cDetails = null;
                              try {
                                cDetails = await getContactById(cId);
                              } catch (err) {
                                console.warn('getContactById failed, using cached item:', err);
                              }
                              const target = cDetails || contactsMaster.find(c => String(c.contact_id || c.id) === String(cId));
                              if (target) {
                                setForm(prev => ({
                                  ...prev,
                                  company: target.company || prev.company,
                                  contact_name: target.contact_name || prev.contact_name,
                                  designation: target.designation !== undefined && target.designation !== null ? target.designation : prev.designation,
                                  phone_no: (target.phone_no_1 || target.phone_no || prev.phone_no || '').replace(/\D/g, ''),
                                  email: target.email || prev.email,
                                  country: target.country || prev.country
                                }));
                              }
                            } catch (err) {
                              console.error('[EditLeadModal] Contact auto-fill error:', err);
                            } finally {
                              setIsFetchingContact(false);
                            }
                          }}
                          placeholder="Select Contact or Add New..."
                          searchable={true}
                          icon={FiUser}
                          height="42px"
                        />
                      )}
                    </div>
                    <div>
                      <label style={labelStyle}><FiBriefcase /> Company Name *</label>
                      <input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={labelStyle}><FiMail /> Email Address</label>
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}><FiPhone /> Phone Number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={getPhoneRulesForCountry(form.country || 'India').maxDigits}
                        value={form.phone_no}
                        onChange={e => setForm({ ...form, phone_no: e.target.value.replace(/\D/g, '').slice(0, getPhoneRulesForCountry(form.country || 'India').maxDigits) })}
                        placeholder={`e.g. Mobile number (${getPhoneRulesForCountry(form.country || 'India').label})`}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label style={labelStyle}>Designation</label>
                      <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Country</label>
                      <CustomSelect
                        value={form.country || 'India'}
                        onChange={(val) => setForm({ ...form, country: val })}
                        options={COUNTRY_OPTIONS.map(c => ({
                          value: c.name,
                          label: c.label,
                          sublabel: c.code
                        }))}
                        placeholder="Select Country..."
                        searchable={true}
                        height="42px"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Lead Owner</label>
                      {/* dont touch it --> it is for future purpose*/}
                      
                        {/* {!isCeoOrCfo && (
                          <button
                            type="button"
                            onClick={() => setIsAssigningForSomeone(prev => !prev)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isAssigningForSomeone ? '#00D4AA' : '#38BDF8',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                          >
                            {isAssigningForSomeone ? 'Reset' : 'Assign for someone else'}
                          </button>
                        )} */}
                      </div>
                      <select
                        value={form.lead_owner_id || ''}
                        onChange={e => setForm({ ...form, lead_owner_id: e.target.value })}
                        disabled={!isAssigningForSomeone}
                        style={{
                          ...selectStyle,
                          opacity: isAssigningForSomeone ? 1 : 0.7,
                          cursor: isAssigningForSomeone ? 'pointer' : 'not-allowed',
                          borderColor: !isAssigningForSomeone ? 'rgba(255, 255, 255, 0.1)' : selectStyle.borderColor
                        }}
                      >
                        {form.lead_owner_id && !leaders.some(l => String(l.leader_id || l.emp_id) === String(form.lead_owner_id)) && (
                          <option value={form.lead_owner_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                            {lead.lead_owner_name || lead.owner || form.lead_owner_id}
                          </option>
                        )}
                        {!form.lead_owner_id && (
                          <option value="" style={{ background: '#0D141F', color: '#64748B' }}>-- Select Owner --</option>
                        )}
                        {leaders.map(l => {
                          const id = l.leader_id || l.emp_id;
                          const name = l.full_name || `${l.first_name} ${l.last_name || ''}`.trim();
                          return (
                            <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                              {name} ({id})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Lead Source</label>
                      <input
                        value={form.lead_source || ''}
                        onChange={e => setForm({ ...form, lead_source: e.target.value })}
                        placeholder="e.g. Direct, Website, Referral"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Active Status Switch */}
                  {isAdminOrSuperAdmin && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#FFFFFF' }}>Lead Register Status</div>
                        <div style={{ fontSize: '12px', color: '#94A3B8' }}>Toggle whether this lead is registered in active pipeline</div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={e => setForm({ ...form, is_active: e.target.checked })}
                          style={{ width: '18px', height: '18px', accentColor: '#00D4AA', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: form.is_active ? '#00D4AA' : '#EF4444' }}>
                          {form.is_active ? 'Registered Lead' : 'Archived Lead'}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── TAB 2: ASSIGNED PRODUCTS REGISTER ──────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'products' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF' }}>
                    <FiPackage style={{ color: '#00D4AA', fontSize: '17px' }} />
                    Assigned Product Register
                  </div>
                </div>


              </div>

              {assignedProducts.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748B', fontSize: '13.5px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <FiPackage style={{ fontSize: '32px', color: '#64748B', marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                  No products currently assigned to this lead. {isEditMode ? 'Click "+ Add Product" above to assign one.' : ''}
                </div>
              ) : !isEditMode ? (
                /* ── PRODUCTS VIEW CARDS (HERO 4-TILE VIEW FOR SINGLE PRODUCT, 2-COL GRID FOR MULTI) ── */
                assignedProducts.length === 1 ? (
                  /* ── SINGLE PRODUCT HERO CARD ── */
                  (() => {
                    const pRow = assignedProducts[0];
                    const stgBadge = getStageBadge(pRow.stage_name);
                    const rskBadge = getRiskBadge(pRow.risk_matrix);
                    const projVal = Number(pRow.project_value || 0);
                    const pipeVal = Number(pRow.pipeline || (projVal * (Number(pRow.probability || 100) / 100)));
                    const wonVal = Number(pRow.won || 0);

                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(0, 212, 170, 0.02) 100%)',
                        border: '1px solid rgba(0, 212, 170, 0.25)',
                        borderRadius: '14px',
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)'
                      }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 198, 255, 0.15))',
                              border: '1px solid rgba(0, 212, 170, 0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#00D4AA',
                              fontSize: '19px',
                              flexShrink: 0
                            }}>
                              <FiPackage />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span title={pRow.product_name || `Product #${pRow.product_id}`} style={{ fontSize: '16.5px', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {pRow.product_name || `Product #${pRow.product_id}`}
                                </span>
                                {pRow.product_register_id && (
                                  <span style={{
                                    fontSize: '11.5px',
                                    fontFamily: "'Helvetica'",
                                    color: '#00D4AA',
                                    background: 'rgba(0, 212, 170, 0.14)',
                                    border: '1px solid rgba(0, 212, 170, 0.3)',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    fontWeight: 700,
                                    flexShrink: 0
                                  }}>
                                    {pRow.product_register_id}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                                Assigned Product Record
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <span style={{
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontSize: '13.5px',
                              fontWeight: 800,
                              background: stgBadge.bg,
                              color: stgBadge.color,
                              border: stgBadge.border,
                              whiteSpace: 'nowrap'
                            }}>
                              Stage: {pRow.stage_name || 'New'}
                            </span>
                           
                          </div>
                        </div>

                        {/* 4 Spacious Key Metric Tiles */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                          {/* Tile 1: Order & Status */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.025)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quantity</div>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#F8FAFC', marginTop: '2px' }}>{pRow.quantity || 1} Units</div>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#CBD5E1', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pRow.status_name || 'New'}</div>
                            </div>
                          </div>

                          {/* Tile 2: Probability & Risk */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.025)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Probability</div>
                              <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#00D4AA', fontFamily: "'Helvetica'", marginTop: '2px' }}>
                                {pRow.probability !== undefined && pRow.probability !== null ? `${pRow.probability}%` : '100%'}
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Risk Matrix</div>
                              <div style={{ marginTop: '2px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: rskBadge.bg,
                                  color: rskBadge.color,
                                  border: rskBadge.border,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {pRow.risk_matrix || 'Clear'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Tile 3: Project Value & Pipeline */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.025)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Project Value</div>
                              <div
                                title={`₹ ${projVal.toLocaleString('en-IN')}`}
                                style={{
                                  fontSize: '15.5px',
                                  fontWeight: 800,
                                  color: '#FFFFFF',
                                  fontFamily: "'Helvetica'",
                                  marginTop: '2px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {formatINR(projVal, projVal >= 1e7)}
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weighted Pipeline</div>
                              <div
                                title={`₹ ${pipeVal.toLocaleString('en-IN')}`}
                                style={{
                                  fontSize: '14px',
                                  fontWeight: 800,
                                  color: '#f59e0b',
                                  fontFamily: "'Helvetica'",
                                  marginTop: '2px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {formatINR(pipeVal, pipeVal >= 1e7)}
                              </div>
                            </div>
                          </div>

                          {/* Tile 4: Won Revenue & Closure Date */}
                          <div style={{
                            background: 'rgba(255, 255, 255, 0.025)',
                            border: '1px solid rgba(255, 255, 255, 0.07)',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Won Revenue</div>
                              <div
                                title={`₹ ${wonVal.toLocaleString('en-IN')}`}
                                style={{
                                  fontSize: '15.5px',
                                  fontWeight: 800,
                                  color: wonVal > 0 ? '#00D4AA' : '#64748B',
                                  fontFamily: "'Helvetica'",
                                  marginTop: '2px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {formatINR(wonVal, wonVal >= 1e7)}
                              </div>
                            </div>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                              <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expected Closure</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#CBD5E1', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                {pRow.expected_closure || activeLead?.expected_closure || lead?.expected_closure || '—'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Proposal Details Strip */}
                        {(pRow.proposal_type || pRow.proposal_document_url || isProposalStatus(pRow.status_name, pRow.status_id) || (lead?.proposals && lead.proposals.length > 0) || (activeLead?.proposals && activeLead.proposals.length > 0)) && (
                          <div style={{
                            background: 'linear-gradient(90deg, rgba(0, 198, 255, 0.08), rgba(0, 212, 170, 0.06))',
                            border: '1px solid rgba(0, 198, 255, 0.25)',
                            borderRadius: '10px',
                            padding: '10px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '165px',
                            overflowY: 'auto',
                            paddingRight: '4px'
                          }}>
                            {getProposalEntries(pRow, activeLead || lead).map((pEntry, pIdx) => (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(0, 198, 255, 0.15)', border: '1px solid rgba(0, 198, 255, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00C6FF' }}>
                                    <FiFileText />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Proposal Details #{pIdx + 1}
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#00C6FF' }}>
                                      {pEntry.proposal_type || 'Proposal Sent'}
                                    </div>
                                  </div>
                                </div>

                                {pEntry.proposal_document_url ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: 'rgba(0, 212, 170, 0.15)',
                                      border: '1px solid rgba(0, 212, 170, 0.35)',
                                      color: '#00D4AA',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <FiPaperclip /> View Document ({getProposalFileName(pEntry.proposal_document_url)}) <FiExternalLink style={{ fontSize: '11px' }} />
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11.5px', color: '#64748B', fontStyle: 'italic' }}>No document attached</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Lost Reason Details Strip */}
                        {(isLostStage(pRow.stage_name, pRow.stage_id, stagesMaster) || pRow.lost_reason) && (
                          <div style={{
                            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.08), rgba(249, 115, 22, 0.06))',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '10px',
                            padding: '10px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginTop: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                                <FiAlertCircle />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Lost Reason
                                </div>
                                <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#F87171' }}>
                                  {pRow.lost_reason || 'Deal Marked as Lost'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  /* ── MULTIPLE PRODUCTS (2-COLUMN GRID VIEW) ── */
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px',
                    maxHeight: '235px',
                    overflowY: 'auto',
                    paddingRight: assignedProducts.length > 2 ? '6px' : '0',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 212, 170, 0.35) rgba(255, 255, 255, 0.03)'
                  }}>
                    {assignedProducts.map((pRow, idx) => {
                      const stgBadge = getStageBadge(pRow.stage_name);
                      const rskBadge = getRiskBadge(pRow.risk_matrix);
                      const projVal = Number(pRow.project_value || 0);
                      const pipeVal = Number(pRow.pipeline || (projVal * (Number(pRow.probability || 100) / 100)));
                      const wonVal = Number(pRow.won || 0);

                      return (
                        <div key={pRow.product_register_id || idx} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          minWidth: 0
                        }}>
                          {/* Product Card Header */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                              <FiPackage style={{ color: '#00D4AA', fontSize: '16px', flexShrink: 0 }} />
                              <span title={pRow.product_name || `Product #${pRow.product_id}`} style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {pRow.product_name || `Product #${pRow.product_id}`}
                              </span>
                              {pRow.product_register_id && (
                                <span style={{
                                  fontSize: '11px',
                                  fontFamily: "'Helvetica'",
                                  color: '#00D4AA',
                                  background: 'rgba(0, 212, 170, 0.12)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  flexShrink: 0
                                }}>
                                  {pRow.product_register_id}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <span style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 800,
                                background: stgBadge.bg,
                                color: stgBadge.color,
                                border: stgBadge.border,
                                whiteSpace: 'nowrap'
                              }}>
                                Stage: {pRow.stage_name || 'New'}
                              </span>
                              <span style={{
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 800,
                                background: pRow.is_active !== false ? 'rgba(0, 212, 170, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: pRow.is_active !== false ? '#00D4AA' : '#EF4444',
                                border: pRow.is_active !== false ? '1px solid rgba(0, 212, 170, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                                whiteSpace: 'nowrap'
                              }}>
                                {pRow.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>

                          {/* Product Card Key-Value Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 16px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Quantity:</span>
                              <span style={{ color: '#F8FAFC', fontWeight: 700, whiteSpace: 'nowrap' }}>{pRow.quantity || 1} Units</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Status:</span>
                              <span title={pRow.status_name || 'New'} style={{ color: '#CBD5E1', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pRow.status_name || 'New'}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Probability:</span>
                              <span style={{ color: '#F8FAFC', fontFamily: "'Helvetica'", fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {pRow.probability !== undefined && pRow.probability !== null ? `${pRow.probability}%` : '100%'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Project Value:</span>
                              <span
                                title={`₹ ${projVal.toLocaleString('en-IN')}`}
                                style={{
                                  color: '#F8FAFC',
                                  fontWeight: 800,
                                  fontFamily: "'Helvetica'",
                                  fontSize: '12.5px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'right',
                                  minWidth: 0
                                }}
                              >
                                {formatINR(projVal, projVal >= 1e7)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Pipeline:</span>
                              <span
                                title={`₹ ${pipeVal.toLocaleString('en-IN')}`}
                                style={{
                                  color: '#f59e0b',
                                  fontWeight: 800,
                                  fontFamily: "'Helvetica'",
                                  fontSize: '12.5px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'right',
                                  minWidth: 0
                                }}
                              >
                                {formatINR(pipeVal, pipeVal >= 1e7)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Won Revenue:</span>
                              <span
                                title={`₹ ${wonVal.toLocaleString('en-IN')}`}
                                style={{
                                  color: wonVal > 0 ? '#00D4AA' : '#64748B',
                                  fontWeight: 800,
                                  fontFamily: "'Helvetica'",
                                  fontSize: '12.5px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'right',
                                  minWidth: 0
                                }}
                              >
                                {formatINR(wonVal, wonVal >= 1e7)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Expected Date:</span>
                              <span style={{ color: '#CBD5E1', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{pRow.expected_closure || activeLead?.expected_closure || lead?.expected_closure || '—'}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                              <span style={{ color: '#64748B', fontSize: '12px', flexShrink: 0 }}>Risk Matrix:</span>
                              <span style={{
                                display: 'inline-block',
                                width: 'fit-content',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: rskBadge.bg,
                                color: rskBadge.color,
                                border: rskBadge.border,
                                whiteSpace: 'nowrap'
                              }}>
                                {pRow.risk_matrix || 'Clear'}
                              </span>
                            </div>

                            {/* Proposal Details inside Multi-Product Card */}
                            {(pRow.proposal_type || pRow.proposal_document_url || isProposalStatus(pRow.status_name, pRow.status_id) || (lead?.proposals && lead.proposals.length > 0)) && (
                              <div style={{
                                gridColumn: 'span 2',
                                background: 'rgba(0, 198, 255, 0.06)',
                                border: '1px solid rgba(0, 198, 255, 0.2)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                marginTop: '4px',
                                maxHeight: '165px',
                                overflowY: 'auto',
                                paddingRight: '4px'
                              }}>
                                {getProposalEntries(pRow, lead).map((pEntry, pIdx) => (
                                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                      <FiFileText style={{ color: '#00C6FF', fontSize: '13px', flexShrink: 0 }} />
                                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#00C6FF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {pEntry.proposal_type || 'Proposal Sent'}
                                      </span>
                                    </div>
                                    {pEntry.proposal_document_url ? (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          padding: '3px 8px',
                                          borderRadius: '4px',
                                          background: 'rgba(0, 212, 170, 0.15)',
                                          border: '1px solid rgba(0, 212, 170, 0.3)',
                                          color: '#00D4AA',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          flexShrink: 0
                                        }}
                                      >
                                        <FiPaperclip /> View ({getProposalFileName(pEntry.proposal_document_url)}) <FiExternalLink style={{ fontSize: '10px' }} />
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>No document</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Lost Reason in Multi-Product Card */}
                            {(isLostStage(pRow.stage_name, pRow.stage_id, stagesMaster) || pRow.lost_reason) && (
                              <div style={{
                                gridColumn: 'span 2',
                                background: 'rgba(239, 68, 68, 0.06)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '4px'
                              }}>
                                <FiAlertCircle style={{ color: '#EF4444', fontSize: '14px', flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', marginRight: '6px' }}>Lost Reason:</span>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#F87171' }}>
                                    {pRow.lost_reason || 'Lost'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* ── PRODUCTS EDIT CARDS (MATCHING LEAD PROFILE CARD STYLE - NO HORIZONTAL SCROLLBAR TABLE) ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {assignedProducts.map((pRow, idx) => {
                    const isLost = isLostStage(pRow.stage_name, pRow.stage_id, stagesMaster);
                    const isProposal = isProposalStatus(pRow.status_name, pRow.status_id);

                    return (
                      <div
                        key={pRow.product_register_id || idx}
                        style={{
                          background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.02))',
                          border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
                          borderRadius: '12px',
                          padding: '18px 22px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px'
                        }}
                      >
                        {/* Header of Product Edit Card */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.06))', paddingBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FiPackage style={{ color: '#00D4AA', fontSize: '18px' }} />
                            <span style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
                              {pRow.product_name || `Product #${idx + 1}`}
                            </span>
                            {pRow.product_register_id ? (
                              <span style={{
                                fontSize: '11.5px',
                                fontFamily: "'Helvetica'",
                                color: '#00D4AA',
                                background: 'rgba(0, 212, 170, 0.14)',
                                border: '1px solid rgba(0, 212, 170, 0.3)',
                                padding: '2px 8px',
                                borderRadius: '5px',
                                fontWeight: 800
                              }}>
                                {pRow.product_register_id}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
                                New Entry
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           
                            {assignedProducts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveProductRow(idx)}
                                title="Remove Product"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '14px'
                                }}
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2-Column Input Grid Matching Lead Profile */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          {/* Product Selection */}
                          <div>
                            <label style={labelStyle}>Product *</label>
                            <select
                              value={pRow.product_id || ''}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                const sel = productsMaster.find(p => String(p.id) === String(val));
                                handleProductChange(idx, 'product_id', val);
                                if (sel) handleProductChange(idx, 'product_name', sel.product || sel.product_name);
                              }}
                              style={selectStyle}
                            >
                              {pRow.product_id && !productsMaster.some(p => String(p.id) === String(pRow.product_id)) && (
                                <option value={pRow.product_id} style={{ background: '#0D141F', color: '#00D4AA' }}>
                                  {pRow.product_name || `Product #${pRow.product_id}`}
                                </option>
                              )}
                              {productsMaster.map(p => (
                                <option key={p.id} value={p.id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                                  {p.product || p.product_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Quantity */}
                          <div>
                            <label style={labelStyle}>Quantity</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={pRow.quantity}
                              onChange={e => handleProductChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                              style={inputStyle}
                            />
                          </div>

                          {/* Stage */}
                          <div>
                            <label style={labelStyle}>Stage</label>
                            <select
                              value={pRow.stage_id || ''}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                const sel = stagesMaster.find(s => String(s.id) === String(val));
                                handleProductChange(idx, 'stage_id', val);
                                if (sel) handleProductChange(idx, 'stage_name', sel.leader_stage || sel.stage);
                              }}
                              style={selectStyle}
                            >
                              {stagesMaster.map(s => (
                                <option key={s.id} value={s.id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                                  {s.leader_stage || s.stage}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Status */}
                          <div>
                            <label style={labelStyle}>Status</label>
                            <select
                              value={pRow.status_id || ''}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : '';
                                const sel = statusesMaster.find(st => String(st.id) === String(val));
                                handleProductChange(idx, 'status_id', val);
                                if (sel) handleProductChange(idx, 'status_name', sel.status || sel.status_name);
                              }}
                              style={selectStyle}
                            >
                              {statusesMaster.map(st => (
                                <option key={st.id} value={st.id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                                  {st.status || st.status_name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Project Value */}
                          <div>
                            <label style={labelStyle}>Project Value (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={pRow.project_value}
                              onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                              onChange={e => {
                                const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                                handleProductChange(idx, 'project_value', cleanVal);
                              }}
                              placeholder="0"
                              style={inputStyle}
                            />
                          </div>

                          {/* Expected Closure Date */}
                          <div>
                            <label style={labelStyle}>Closure Date</label>
                            <input
                              type="date"
                              value={pRow.expected_closure || ''}
                              onChange={e => handleProductChange(idx, 'expected_closure', e.target.value)}
                              onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                              style={{ ...inputStyle, cursor: 'pointer' }}
                            />
                          </div>

                          {/* Proposal Config */}
                          {isProposal && (
                            <div style={{ gridColumn: 'span 2', background: 'rgba(0, 198, 255, 0.05)', border: '1px solid rgba(0, 198, 255, 0.25)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {/* Header with Title & + Add Another Proposal Button */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00C6FF', fontSize: '13px', fontWeight: 800 }}>
                                  <FiFileText /> Proposal Details
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleAddModalProposalEntry(idx)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(0, 212, 170, 0.15)',
                                    border: '1px solid rgba(0, 212, 170, 0.35)',
                                    color: '#00D4AA',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <FiPlus /> Add Another Proposal
                                </button>
                              </div>

                              {/* List of Proposal Entries */}
                              {(() => {
                                const proposalsList = pRow.proposals || (pRow.proposal_file ? [{ proposal_type: pRow.proposal_type, proposal_file: pRow.proposal_file, proposal_document_url: pRow.proposal_document_url }] : getProposalEntries(pRow));
                                const listToRender = proposalsList.length > 0 ? proposalsList : [{ proposal_type: 'Technical Proposal Sent', proposal_file: null, proposal_document_url: null }];

                                return listToRender.map((pEntry, pIdx) => (
                                  <div key={pIdx} style={{ background: 'rgba(4, 8, 14, 0.5)', border: '1px solid rgba(0, 198, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#00C6FF', fontWeight: 700 }}>
                                      <span>Proposal #{pIdx + 1}</span>
                                      {listToRender.length > 1 && (
                                        <FiTrash2
                                          style={{ cursor: 'pointer', color: '#EF4444' }}
                                          title="Remove Proposal"
                                          onClick={() => handleRemoveModalProposalEntry(idx, pIdx)}
                                        />
                                      )}
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                                      <div>
                                        <label style={{ ...labelStyle, fontSize: '11.5px' }}>Proposal Type *</label>
                                        <select
                                          value={pEntry.proposal_type || 'Technical Proposal Sent'}
                                          onChange={e => handleUpdateModalProposalEntry(idx, pIdx, 'proposal_type', e.target.value)}
                                          style={selectStyle}
                                        >
                                          {PROPOSAL_TYPE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label style={{ ...labelStyle, fontSize: '11.5px' }}>Proposal Document</label>
                                        {pEntry.proposal_file ? (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.12)', border: '1px solid rgba(0, 212, 170, 0.35)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA', height: '36px', boxSizing: 'border-box' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              <FiPaperclip /> <strong>{pEntry.proposal_file.name}</strong>
                                            </div>
                                            <FiX style={{ cursor: 'pointer', color: '#EF4444', marginLeft: '6px' }} onClick={() => handleUpdateModalProposalEntry(idx, pIdx, 'proposal_file', null)} />
                                          </div>
                                        ) : pEntry.proposal_document_url ? (
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.08)', border: '1px solid rgba(0, 212, 170, 0.25)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA', height: '36px', boxSizing: 'border-box' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#00D4AA', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                            >
                                              <FiExternalLink /> View Attached ({getProposalFileName(pEntry.proposal_document_url)})
                                            </button>
                                            <label style={{ cursor: 'pointer', color: '#00C6FF', fontSize: '11px', textDecoration: 'underline', marginLeft: '6px' }}>
                                              Replace
                                              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display: 'none' }} onChange={e => { if (e.target.files && e.target.files[0]) handleUpdateModalProposalEntry(idx, pIdx, 'proposal_file', e.target.files[0]); }} />
                                            </label>
                                          </div>
                                        ) : (
                                          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0 10px', height: '36px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', border: '1px dashed rgba(0, 212, 170, 0.4)', color: '#00D4AA', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}>
                                            <FiUploadCloud /> Upload Proposal File
                                            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display: 'none' }} onChange={e => { if (e.target.files && e.target.files[0]) handleUpdateModalProposalEntry(idx, pIdx, 'proposal_file', e.target.files[0]); }} />
                                          </label>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          )}

                          {/* Lost Reason Config */}
                          {isLost && (
                            <div style={{ gridColumn: 'span 2', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '13px', fontWeight: 800 }}>
                                <FiAlertCircle /> Lost Reason *
                              </div>
                              <input
                                type="text"
                                list={`lost-reasons-${idx}`}
                                value={pRow.lost_reason || ''}
                                onChange={e => handleProductChange(idx, 'lost_reason', e.target.value)}
                                placeholder="Select or enter reason for loss..."
                                style={{ ...inputStyle, borderColor: 'rgba(239, 68, 68, 0.35)' }}
                              />
                              <datalist id={`lost-reasons-${idx}`}>
                                {COMMON_LOST_REASONS.map(r => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* ── FOOTER ACTIONS ─────────────────────────────────────────────── */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0
          }}>
            {!isEditMode ? (
              /* ── VIEW MODE FOOTER ── */
              <>
                <div style={{ fontSize: '13px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>
                    Created At: <strong style={{ color: '#00D4AA', fontFamily: "'Helvetica'", fontSize: '13.5px', fontWeight: 800 }}>{formatDate(lead.created_date || lead.created_at)}</strong>
                  </span>
                  {(lead.updated_at || activeLead?.updated_at) && (
                    <>
                      <span>•</span>
                      <span>
                        Updated At: <strong style={{ color: '#00C6FF', fontFamily: "'Helvetica'" }}>{formatDate(lead.updated_at || activeLead?.updated_at)}</strong>
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '9px 24px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#FFFFFF',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              /* ── EDIT MODE FOOTER ── */
              <>
                <div style={{ fontSize: '12.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>
                    Created At: <strong style={{ color: '#00D4AA', fontFamily: "'Helvetica'" }}>{formatDate(lead.created_date || lead.created_at)}</strong>
                  </span>
                  {(lead.updated_at || activeLead?.updated_at) && (
                    <>
                      <span>•</span>
                      <span>
                        Updated At: <strong style={{ color: '#00C6FF', fontFamily: "'Helvetica'" }}>{formatDate(lead.updated_at || activeLead?.updated_at)}</strong>
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
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
                    disabled={isSubmitting || !hasChanges}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      background: hasChanges ? 'linear-gradient(135deg, #009B82, #00D4AA)' : 'rgba(255, 255, 255, 0.1)',
                      color: hasChanges ? '#070C12' : '#64748B',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: hasChanges ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: hasChanges ? '0 2px 14px rgba(0, 212, 170, 0.35)' : 'none',
                      opacity: hasChanges ? 1 : 0.6
                    }}
                  >
                    <FiSave /> {isSubmitting ? 'Saving...' : 'Save & Update Lead'}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 2. Add Product To Lead Modal (POST /api/v1/leads/{lead_id}/products) ──────
function AddLeadProductModal({ isOpen, leadId, onClose, onAdded, productsMaster, stagesMaster, statusesMaster }) {
  const [form, setForm] = useState({
    product_id: '',
    quantity: 1,
    stage_id: '',
    status_id: '',
    project_value: '',
    expected_closure: '',
    won: 0,
    is_active: true,
    proposal_type: 'Technical Proposal Sent',
    proposal_file: null,
    lost_reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        product_id: productsMaster[0]?.id || 1,
        quantity: 1,
        stage_id: stagesMaster[0]?.id || 1,
        status_id: statusesMaster[0]?.id || 1,
        project_value: '',
        expected_closure: '',
        won: 0,
        is_active: true,
        proposal_type: 'Technical Proposal Sent',
        proposal_file: null,
        lost_reason: ''
      });
    }
  }, [isOpen, productsMaster, stagesMaster, statusesMaster]);

  if (!isOpen) return null;

  const currentStatusObj = statusesMaster.find(st => String(st.id) === String(form.status_id));
  const isProp = isProposalStatus(currentStatusObj?.status, form.status_id);

  const currentStageObj = stagesMaster.find(s => String(s.id) === String(form.stage_id));
  const isLost = isLostStage(currentStageObj?.leader_stage, form.stage_id, stagesMaster);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const pId = parseInt(form.product_id, 10) || productsMaster[0]?.id || 1;
    const qty = Math.max(1, parseInt(form.quantity, 10) || 1);
    const stId = form.status_id !== '' && form.status_id !== null ? parseInt(form.status_id, 10) : (statusesMaster[0]?.id || 1);
    const sgId = form.stage_id !== '' && form.stage_id !== null ? parseInt(form.stage_id, 10) : (stagesMaster[0]?.id || 1);
    const projectVal = form.project_value !== '' && !isNaN(Number(form.project_value)) ? Number(form.project_value) : 0;
    const expectedClosure = form.expected_closure || null;
    const won = typeof form.won === 'number' ? form.won : (Number(form.won) || 0);
    const isActive = form.is_active !== undefined ? Boolean(form.is_active) : true;
    const finalLostReason = isLost ? (form.lost_reason ? String(form.lost_reason).trim() : 'Lost') : null;

    const payload = {
      product_id: pId,
      quantity: qty,
      status_id: stId,
      stage_id: sgId,
      project_value: projectVal,
      expected_closure: expectedClosure,
      proposal_type: isProp ? (form.proposal_type || 'Technical Proposal Sent') : null,
      lost_reason: finalLostReason,
      won: won,
      is_active: isActive
    };

    try {
      const res = await addLeadProduct(leadId, payload);
      const selProduct = productsMaster.find(p => p.id === payload.product_id);
      const selStage = stagesMaster.find(s => s.id === payload.stage_id);
      const selStatus = statusesMaster.find(st => st.id === payload.status_id);

      const addedProduct = res?.products?.[0] || res?.data?.products?.[0] || res?.data || res || {
        product_register_id: `PRD-${Date.now().toString().slice(-4)}`,
        lead_id: leadId,
        product_id: payload.product_id,
        product_name: selProduct?.product || 'Product',
        quantity: payload.quantity,
        status_id: payload.status_id,
        status_name: selStatus?.status || 'Active',
        stage_id: payload.stage_id,
        stage_name: selStage?.leader_stage || 'New',
        project_value: projectVal,
        expected_closure: expectedClosure,
        proposal_type: payload.proposal_type,
        lost_reason: finalLostReason,
        won: payload.won,
        is_active: payload.is_active
      };

      const proposalsList = form.proposals || (form.proposal_file ? [{ proposal_type: form.proposal_type, proposal_file: form.proposal_file }] : []);
      if (proposalsList.length > 0) {
        const uploadedUrls = [];
        const uploadedTypes = [];
        for (const entry of proposalsList) {
          if (entry.proposal_file) {
            try {
              const upRes = await uploadLeadProposal({
                file: entry.proposal_file,
                proposal_type: entry.proposal_type || 'Technical Proposal Sent',
                lead_id: leadId,
                product_register_id: addedProduct.product_register_id
              });
              const uploadedUrl = upRes?.proposal_document_url || upRes?.data?.proposal_document_url || upRes?.url || upRes?.data?.url;
              if (uploadedUrl) {
                uploadedUrls.push(uploadedUrl);
                uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
                entry.proposal_document_url = uploadedUrl;
              }
            } catch (uploadErr) {
              console.error('[AddLeadProductModal] Proposal upload failed:', uploadErr);
            }
          }
        }
        if (uploadedUrls.length > 0) {
          addedProduct.proposal_document_url = uploadedUrls.join(', ');
          addedProduct.proposal_type = uploadedTypes.join(', ');
          addedProduct.proposals = proposalsList;
        }
      }

      onAdded(addedProduct);
      onClose();
    } catch (err) {
      console.error('[AddLeadProductModal] Failed:', err);
      const selProduct = productsMaster.find(p => p.id === payload.product_id);
      const selStage = stagesMaster.find(s => s.id === payload.stage_id);
      const selStatus = statusesMaster.find(st => st.id === payload.status_id);

      onAdded({
        product_register_id: `PRD-${Date.now().toString().slice(-4)}`,
        lead_id: leadId,
        product_id: payload.product_id,
        product_name: selProduct?.product || 'Product',
        quantity: payload.quantity,
        status_id: payload.status_id,
        status_name: selStatus?.status || 'Active',
        stage_id: payload.stage_id,
        stage_name: selStage?.leader_stage || 'New',
        project_value: projectVal,
        expected_closure: expectedClosure,
        proposal_type: payload.proposal_type,
        lost_reason: finalLostReason,
        won: payload.won,
        is_active: payload.is_active
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid rgba(49, 151, 149, 0.35)',
    background: 'rgba(5, 8, 14, 0.95)',
    color: '#FFFFFF',
    fontSize: '13px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 800,
    color: '#94A3B8',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(12px)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#090e15', border: '1px solid rgba(0, 212, 170, 0.35)', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(0, 212, 170, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(49, 151, 149, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0, 212, 170, 0.15)', border: '1px solid rgba(0, 212, 170, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4AA', fontSize: '18px' }}>
              <FiPackage />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>Add Product to Lead #{leadId}</h3>
              <div style={{ fontSize: '11.5px', color: '#8CA0B8' }}>Assign a new product catalog item to this lead</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#8CA0B8', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiX /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Product</label>
            <CustomSelect
              value={form.product_id}
              onChange={val => setForm({ ...form, product_id: val })}
              options={productsMaster.map(p => ({ value: p.id, label: p.product }))}
              searchable={true}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" min="1" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pipeline Stage</label>
              <CustomSelect
                value={form.stage_id}
                onChange={val => {
                  const sel = stagesMaster.find(s => String(s.id) === String(val));
                  const lost = isLostStage(sel?.leader_stage, val, stagesMaster);
                  setForm({
                    ...form,
                    stage_id: val,
                    lost_reason: lost ? (form.lost_reason || 'Price / Budget constraint') : ''
                  });
                }}
                options={stagesMaster.map(s => ({ value: s.id, label: s.leader_stage }))}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lifecycle Status</label>
            <CustomSelect
              value={form.status_id}
              onChange={val => setForm({ ...form, status_id: val })}
              options={statusesMaster.map(st => ({ value: st.id, label: st.status }))}
            />
          </div>

          {/* Lost Reason Option */}
          {isLost && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '12.5px', fontWeight: 800 }}>
                <FiAlertCircle /> Lost Reason *
              </div>
              <input
                type="text"
                list="modal-add-lost-reasons"
                value={form.lost_reason}
                onChange={e => setForm({ ...form, lost_reason: e.target.value })}
                placeholder="Enter or select reason for loss..."
                style={{ ...inputStyle, borderColor: 'rgba(239, 68, 68, 0.35)' }}
              />
              <datalist id="modal-add-lost-reasons">
                {COMMON_LOST_REASONS.map(r => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          )}

          {/* Proposal Sent Options */}
          {isProp && (
            <div style={{
              background: 'rgba(0, 198, 255, 0.05)',
              border: '1px solid rgba(0, 198, 255, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Header with Title & + Add Another Proposal Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00C6FF', fontSize: '12.5px', fontWeight: 800 }}>
                  <FiFileText /> Proposal Details
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentProposals = form.proposals || [{ proposal_type: form.proposal_type || 'Technical Proposal Sent', proposal_file: form.proposal_file || null }];
                    setForm({
                      ...form,
                      proposals: [
                        ...currentProposals,
                        { proposal_type: 'Technical Proposal Sent', proposal_file: null }
                      ]
                    });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(0, 212, 170, 0.15)',
                    border: '1px solid rgba(0, 212, 170, 0.35)',
                    color: '#00D4AA',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus /> Add Another Proposal
                </button>
              </div>

              {/* List of Proposal Entries */}
              {(() => {
                const proposalsList = form.proposals || [{ proposal_type: form.proposal_type || 'Technical Proposal Sent', proposal_file: form.proposal_file || null }];

                return proposalsList.map((pEntry, pIdx) => (
                  <div key={pIdx} style={{ background: 'rgba(4, 8, 14, 0.5)', border: '1px solid rgba(0, 198, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#00C6FF', fontWeight: 700 }}>
                      <span>Proposal #{pIdx + 1}</span>
                      {proposalsList.length > 1 && (
                        <FiTrash2
                          style={{ cursor: 'pointer', color: '#EF4444' }}
                          title="Remove Proposal"
                          onClick={() => {
                            const nextProposals = proposalsList.filter((_, i) => i !== pIdx);
                            setForm({ ...form, proposals: nextProposals });
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <label style={{ ...labelStyle, color: '#00C6FF' }}>Proposal Type *</label>
                        <CustomSelect
                          value={pEntry.proposal_type || 'Technical Proposal Sent'}
                          onChange={val => {
                            const nextProposals = [...proposalsList];
                            nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_type: val };
                            setForm({ ...form, proposals: nextProposals });
                          }}
                          options={PROPOSAL_TYPE_OPTIONS}
                        />
                      </div>

                      <div>
                        <label style={{ ...labelStyle, color: '#00C6FF' }}>Proposal Document</label>
                        {pEntry.proposal_file ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.12)', border: '1px solid rgba(0, 212, 170, 0.35)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <FiPaperclip /> <strong>{pEntry.proposal_file.name}</strong>
                            </div>
                            <FiX
                              style={{ cursor: 'pointer', color: '#EF4444' }}
                              onClick={() => {
                                const nextProposals = [...proposalsList];
                                nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_file: null };
                                setForm({ ...form, proposals: nextProposals });
                              }}
                            />
                          </div>
                        ) : (
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px dashed rgba(0, 212, 170, 0.4)',
                            color: '#00D4AA',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}>
                            <FiUploadCloud style={{ fontSize: '15px' }} /> Upload Proposal File
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              style={{ display: 'none' }}
                              onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                  const nextProposals = [...proposalsList];
                                  nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_file: e.target.files[0] };
                                  setForm({ ...form, proposals: nextProposals });
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Project Value (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={form.project_value}
                onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                onChange={e => {
                  const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                  setForm({ ...form, project_value: cleanVal });
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Expected Closure Date</label>
              <input type="date" value={form.expected_closure} onChange={e => setForm({ ...form, expected_closure: e.target.value })} onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }} style={{ ...inputStyle, cursor: 'pointer' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '9px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #009B82, #00D4AA)', color: '#070C12', border: 'none', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiPlus /> {isSubmitting ? 'Adding...' : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 3. Edit Lead Product Modal (PATCH /api/v1/leads/{lead_id}/products/{pr_id})
function EditLeadProductModal({ isOpen, leadId, product, onClose, onUpdated, productsMaster, stagesMaster, statusesMaster }) {
  const [form, setForm] = useState({
    product_id: '',
    quantity: 1,
    stage_id: '',
    status_id: '',
    won: 0,
    is_active: true,
    proposal_type: 'Technical Proposal Sent',
    proposal_document_url: null,
    proposal_file: null,
    lost_reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      const initialProposals = getProposalEntries(product);
      setForm({
        product_id: product.product_id || '',
        quantity: product.quantity || 1,
        stage_id: product.stage_id || '',
        status_id: product.status_id || '',
        won: typeof product.won === 'number' ? product.won : (Number(product.won) || 0),
        is_active: product.is_active !== undefined ? Boolean(product.is_active) : true,
        proposals: initialProposals,
        proposal_type: product.proposal_type || initialProposals.map(p => p.proposal_type).join(', ') || 'Technical Proposal Sent',
        proposal_document_url: product.proposal_document_url || initialProposals.map(p => p.proposal_document_url).filter(Boolean).join(', ') || null,
        proposal_file: null,
        lost_reason: product.lost_reason || ''
      });
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const currentStatusObj = statusesMaster.find(st => String(st.id) === String(form.status_id));
  const isProp = isProposalStatus(currentStatusObj?.status, form.status_id) || isProposalStatus(product.status_name, product.status_id);

  const currentStageObj = stagesMaster.find(s => String(s.id) === String(form.stage_id));
  const isLost = isLostStage(currentStageObj?.leader_stage, form.stage_id, stagesMaster) || isLostStage(product.stage_name, product.stage_id, stagesMaster);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const pId = parseInt(form.product_id, 10) || product.product_id;
    const qty = Math.max(1, parseInt(form.quantity, 10) || product.quantity || 1);
    const stId = form.status_id !== '' && form.status_id !== null ? parseInt(form.status_id, 10) : (product.status_id || 0);
    const sgId = form.stage_id !== '' && form.stage_id !== null ? parseInt(form.stage_id, 10) : (product.stage_id || 0);
    const won = typeof form.won === 'number' ? form.won : (Number(form.won) || 0);
    const isActive = form.is_active !== undefined ? Boolean(form.is_active) : (product.is_active !== undefined ? Boolean(product.is_active) : true);
    const finalLostReason = isLost ? (form.lost_reason ? String(form.lost_reason).trim() : 'Lost') : null;

    const productPayload = {
      product_register_id: product.product_register_id,
      product_id: pId,
      quantity: qty,
      status_id: stId,
      stage_id: sgId,
      proposal_type: isProp ? (form.proposal_type || 'Technical Proposal Sent') : null,
      proposal_document_url: form.proposal_document_url || null,
      lost_reason: finalLostReason,
      won: won,
      is_active: isActive
    };

    try {
      await updateLeadProduct(leadId, product.product_register_id, productPayload);
      const selProduct = productsMaster.find(p => p.id === pId);
      const selStage = stagesMaster.find(s => s.id === sgId);
      const selStatus = statusesMaster.find(st => st.id === stId);

      const proposalsList = form.proposals || (form.proposal_file ? [{ proposal_type: form.proposal_type, proposal_file: form.proposal_file, proposal_document_url: form.proposal_document_url }] : getProposalEntries(form));
      let docUrl = form.proposal_document_url;
      let propType = form.proposal_type;

      if (proposalsList.length > 0) {
        const uploadedUrls = [];
        const uploadedTypes = [];
        for (const entry of proposalsList) {
          if (entry.proposal_file) {
            try {
              const upRes = await uploadLeadProposal({
                file: entry.proposal_file,
                proposal_type: entry.proposal_type || 'Technical Proposal Sent',
                lead_id: leadId,
                product_register_id: product.product_register_id
              });
              const uploadedUrl = upRes?.proposal_document_url || upRes?.data?.proposal_document_url || upRes?.url || upRes?.data?.url;
              if (uploadedUrl) {
                uploadedUrls.push(uploadedUrl);
                uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
                entry.proposal_document_url = uploadedUrl;
              }
            } catch (uploadErr) {
              console.error('[EditLeadProductModal] Proposal upload failed:', uploadErr);
            }
          } else if (entry.proposal_document_url) {
            uploadedUrls.push(entry.proposal_document_url);
            uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
          }
        }
        if (uploadedUrls.length > 0) {
          docUrl = uploadedUrls.join(', ');
          propType = uploadedTypes.join(', ');
        }
      }

      onUpdated({
        ...product,
        product_id: pId,
        quantity: qty,
        status_id: stId,
        stage_id: sgId,
        won: won,
        is_active: isActive,
        proposal_type: propType,
        proposal_document_url: docUrl,
        proposals: proposalsList,
        lost_reason: finalLostReason,
        product_name: selProduct ? selProduct.product : product.product_name,
        stage_name: selStage ? selStage.leader_stage : product.stage_name,
        status_name: selStatus ? selStatus.status : product.status_name
      });
      onClose();
    } catch (err) {
      console.error('[EditLeadProductModal] Failed:', err);
      onUpdated({
        ...product,
        product_id: pId,
        quantity: qty,
        status_id: stId,
        stage_id: sgId,
        won: won,
        lost_reason: finalLostReason,
        is_active: isActive
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    borderRadius: '8px',
    border: '1px solid rgba(49, 151, 149, 0.35)',
    background: 'rgba(5, 8, 14, 0.95)',
    color: '#FFFFFF',
    fontSize: '13px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '11.5px',
    fontWeight: 800,
    color: '#94A3B8',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(12px)', zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#090e15', border: '1px solid rgba(0, 212, 170, 0.35)', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(0, 212, 170, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(49, 151, 149, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(0, 212, 170, 0.15)', border: '1px solid rgba(0, 212, 170, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4AA', fontSize: '18px' }}>
              <FiPackage />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#FFFFFF' }}>Edit Product Entry</h3>
              <div style={{ fontSize: '11.5px', color: '#8CA0B8' }}>Update registration #{product.product_register_id}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#8CA0B8', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiX /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Product</label>
            <CustomSelect
              value={form.product_id}
              onChange={val => setForm({ ...form, product_id: val })}
              options={productsMaster.map(p => ({ value: p.id, label: p.product }))}
              searchable={true}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pipeline Stage</label>
              <CustomSelect
                value={form.stage_id}
                onChange={val => {
                  const sel = stagesMaster.find(s => String(s.id) === String(val));
                  const lost = isLostStage(sel?.leader_stage, val, stagesMaster);
                  setForm({
                    ...form,
                    stage_id: val,
                    lost_reason: lost ? (form.lost_reason || 'Price / Budget constraint') : ''
                  });
                }}
                options={stagesMaster.map(s => ({ value: s.id, label: s.leader_stage }))}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Lifecycle Status</label>
            <CustomSelect
              value={form.status_id}
              onChange={val => setForm({ ...form, status_id: val })}
              options={statusesMaster.map(st => ({ value: st.id, label: st.status }))}
            />
          </div>

          {/* Lost Reason Option */}
          {isLost && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '12.5px', fontWeight: 800 }}>
                <FiAlertCircle /> Lost Reason *
              </div>
              <input
                type="text"
                list="modal-edit-lost-reasons"
                value={form.lost_reason}
                onChange={e => setForm({ ...form, lost_reason: e.target.value })}
                placeholder="Enter or select reason for loss..."
                style={{ ...inputStyle, borderColor: 'rgba(239, 68, 68, 0.35)' }}
              />
              <datalist id="modal-edit-lost-reasons">
                {COMMON_LOST_REASONS.map(r => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          )}

          {/* Proposal Sent Options */}
          {isProp && (
            <div style={{
              background: 'rgba(0, 198, 255, 0.05)',
              border: '1px solid rgba(0, 198, 255, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Header with Title & + Add Another Proposal Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00C6FF', fontSize: '12.5px', fontWeight: 800 }}>
                  <FiFileText /> Proposal Details
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const currentProposals = form.proposals || (form.proposal_file ? [{ proposal_type: form.proposal_type, proposal_file: form.proposal_file, proposal_document_url: form.proposal_document_url }] : getProposalEntries(form));
                    setForm({
                      ...form,
                      proposals: [
                        ...currentProposals,
                        { proposal_type: 'Technical Proposal Sent', proposal_file: null, proposal_document_url: null }
                      ]
                    });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    background: 'rgba(0, 212, 170, 0.15)',
                    border: '1px solid rgba(0, 212, 170, 0.35)',
                    color: '#00D4AA',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <FiPlus /> Add Another Proposal
                </button>
              </div>

              {/* List of Proposal Entries */}
              {(() => {
                const proposalsList = form.proposals || (form.proposal_file ? [{ proposal_type: form.proposal_type, proposal_file: form.proposal_file, proposal_document_url: form.proposal_document_url }] : getProposalEntries(form));
                const listToRender = proposalsList.length > 0 ? proposalsList : [{ proposal_type: 'Technical Proposal Sent', proposal_file: null, proposal_document_url: null }];

                return listToRender.map((pEntry, pIdx) => (
                  <div key={pIdx} style={{ background: 'rgba(4, 8, 14, 0.5)', border: '1px solid rgba(0, 198, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#00C6FF', fontWeight: 700 }}>
                      <span>Proposal #{pIdx + 1}</span>
                      {listToRender.length > 1 && (
                        <FiTrash2
                          style={{ cursor: 'pointer', color: '#EF4444' }}
                          title="Remove Proposal"
                          onClick={() => {
                            const nextProposals = listToRender.filter((_, i) => i !== pIdx);
                            setForm({ ...form, proposals: nextProposals });
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <label style={{ ...labelStyle, color: '#00C6FF' }}>Proposal Type *</label>
                        <CustomSelect
                          value={pEntry.proposal_type || 'Technical Proposal Sent'}
                          onChange={val => {
                            const nextProposals = [...listToRender];
                            nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_type: val };
                            setForm({ ...form, proposals: nextProposals });
                          }}
                          options={PROPOSAL_TYPE_OPTIONS}
                        />
                      </div>

                      <div>
                        <label style={{ ...labelStyle, color: '#00C6FF' }}>Proposal Document</label>
                        {pEntry.proposal_file ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.12)', border: '1px solid rgba(0, 212, 170, 0.35)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <FiPaperclip /> <strong>{pEntry.proposal_file.name}</strong>
                            </div>
                            <FiX
                              style={{ cursor: 'pointer', color: '#EF4444' }}
                              onClick={() => {
                                const nextProposals = [...listToRender];
                                nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_file: null };
                                setForm({ ...form, proposals: nextProposals });
                              }}
                            />
                          </div>
                        ) : pEntry.proposal_document_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.08)', border: '1px solid rgba(0, 212, 170, 0.25)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA', height: '38px', boxSizing: 'border-box' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#00D4AA', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              <FiExternalLink /> View Attached ({getProposalFileName(pEntry.proposal_document_url)})
                            </button>
                            <label style={{ cursor: 'pointer', color: '#00C6FF', fontSize: '11px', textDecoration: 'underline', marginLeft: '6px' }}>
                              Replace
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  if (e.target.files && e.target.files[0]) {
                                    const nextProposals = [...listToRender];
                                    nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_file: e.target.files[0] };
                                    setForm({ ...form, proposals: nextProposals });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px dashed rgba(0, 212, 170, 0.4)',
                            color: '#00D4AA',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}>
                            <FiUploadCloud /> Upload Proposal File
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                              style={{ display: 'none' }}
                              onChange={e => {
                                if (e.target.files && e.target.files[0]) {
                                  const nextProposals = [...listToRender];
                                  nextProposals[pIdx] = { ...nextProposals[pIdx], proposal_file: e.target.files[0] };
                                  setForm({ ...form, proposals: nextProposals });
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '9px 22px', borderRadius: '8px', background: 'linear-gradient(135deg, #009B82, #00D4AA)', color: '#070C12', border: 'none', fontSize: '13px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiSave /> {isSubmitting ? 'Saving...' : 'Update Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 4. Confirm Delete Modal (Leads or Products) ──────────────────────────────
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
      zIndex: 100002,
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

        {/* Centered Warning Icon */}
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
          <FiAlertTriangle />
        </div>

        {/* Centered Title */}
        <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', letterSpacing: '-0.01em', textAlign: 'center' }}>
          {title || 'Confirm Deletion'}
        </h3>

        {/* Centered Description */}
        <div style={{ fontSize: '14px', color: 'var(--t-fg-muted, #94A3B8)', lineHeight: 1.55, textAlign: 'center' }}>
          {entityId ? (
            <>
              Are you sure you want to permanently delete lead
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
              gap: '8px',
              opacity: isDeleting ? 0.7 : 1,
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={e => {
              if (!isDeleting) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(220, 38, 38, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={e => {
              if (!isDeleting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
              }
            }}
          >
            <FiTrash2 style={{ fontSize: '15px' }} />
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main LeadRegisterView Component ──────────────────────────────────────────
export default function LeadRegisterView({ onOpenAddLead, onOpenLeadDetails, initialStageFilter, initialOwnerFilter, refreshKey, lastAction }) {
  const { user } = useAuth();
  const isExecutiveUser = isExecutive(user);
  const isUserSuperAdmin = isSuperAdmin(user);
  const [activeStatusFilter, setActiveStatusFilter] = useState('Active'); // Default to Active leads only ('Active' | 'Inactive' | 'All')

  const [leadsData, setLeadsData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');    // debounced — drives filtering & server calls
  const [searchInput, setSearchInput] = useState('');     // raw typed value — bound to <input>
  const [isSearchingServer, setIsSearchingServer] = useState(false); // server search in-flight

  // Unified Filters state
  const [stageFilter, setStageFilter] = useState(initialStageFilter && initialStageFilter !== 'all' ? initialStageFilter : 'All Stages');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [productFilter, setProductFilter] = useState('All Products');
  const [ownerFilter, setOwnerFilter] = useState(initialOwnerFilter && initialOwnerFilter !== 'all' ? initialOwnerFilter : 'All Owners');
  const [contactFilter, setContactFilter] = useState('All Contacts');
  const [createdDateFilter, setCreatedDateFilter] = useState('all');
  const [createdFromDate, setCreatedFromDate] = useState('');
  const [createdToDate, setCreatedToDate] = useState('');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef(null);

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [activeProductPopover, setActiveProductPopover] = useState(null);

  // Sync filters whenever initial props or navigation refreshKey change
  useEffect(() => {
    if (initialStageFilter && initialStageFilter !== 'all') {
      setStageFilter(initialStageFilter);
    } else {
      setStageFilter('All Stages');
    }
  }, [initialStageFilter, refreshKey]);

  useEffect(() => {
    if (initialOwnerFilter && initialOwnerFilter !== 'all') {
      setOwnerFilter(initialOwnerFilter);
    } else {
      setOwnerFilter('All Owners');
    }
  }, [initialOwnerFilter, refreshKey]);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportMenuRef = useRef(null);

  // Click-outside listener for floating filter popover
  useEffect(() => {
    const handleOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    if (isFilterMenuOpen || showExportMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isFilterMenuOpen, showExportMenu]);

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

  // Dropdown Masters for Modals and Filters
  const [leaders, setLeaders] = useState([]);
  const [productsMaster, setProductsMaster] = useState([]);
  const [stagesMaster, setStagesMaster] = useState([]);
  const [statusesMaster, setStatusesMaster] = useState([]);
  const [contactsMaster, setContactsMaster] = useState([]);

  // Modals state
  const [editLeadState, setEditLeadState] = useState({ isOpen: false, lead: null, initialEditMode: true });
  const [addProductState, setAddProductState] = useState({ isOpen: false, leadId: null });
  const [editProductState, setEditProductState] = useState({ isOpen: false, leadId: null, product: null });
  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDeleting: false
  });

  // Fetch Dropdown Masters
  const fetchDropdownMasters = useCallback(async (force = true) => {
    try {
      const [leadersRes, productsRes, stagesRes, statusesRes, contactsRes] = await Promise.allSettled([
        getLeadersDropdown(force),
        getProductDropdown(force),
        getLeaderStageDropdown(force),
        getLeadProductStatusDropdown(force),
        getContactsDropdown()
      ]);

      if (leadersRes.status === 'fulfilled' && leadersRes.value) {
        const raw = Array.isArray(leadersRes.value.data) ? leadersRes.value.data : (Array.isArray(leadersRes.value) ? leadersRes.value : []);
        setLeaders(raw.filter(l => l.is_active !== false));
      }
      if (productsRes.status === 'fulfilled' && productsRes.value) {
        const raw = Array.isArray(productsRes.value.data) ? productsRes.value.data : (Array.isArray(productsRes.value) ? productsRes.value : []);
        const sorted = [...raw].sort((a, b) => {
          const nameA = String(a?.product || a?.product_name || a?.name || a || '').trim();
          const nameB = String(b?.product || b?.product_name || b?.name || b || '').trim();
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
        });
        setProductsMaster(sorted);
      }
      if (stagesRes.status === 'fulfilled' && stagesRes.value) {
        setStagesMaster(Array.isArray(stagesRes.value.data) ? stagesRes.value.data : (Array.isArray(stagesRes.value) ? stagesRes.value : []));
      }
      if (statusesRes.status === 'fulfilled' && statusesRes.value) {
        setStatusesMaster(Array.isArray(statusesRes.value.data) ? statusesRes.value.data : (Array.isArray(statusesRes.value) ? statusesRes.value : []));
      }
      if (contactsRes.status === 'fulfilled' && contactsRes.value) {
        const raw = Array.isArray(contactsRes.value.data) ? contactsRes.value.data : (Array.isArray(contactsRes.value) ? contactsRes.value : []);
        setContactsMaster(raw);
      }
    } catch (e) {
      console.warn('[LeadRegisterView] Dropdown masters fetch error:', e);
    }
  }, []);

  // Whenever component mounts or refreshKey changes (e.g. user clicks tab or creates lead)
  useEffect(() => {
    fetchDropdownMasters(false);
  }, [fetchDropdownMasters, refreshKey]);

  // Persistent cursor map per page number: { 1: null, 2: 'LD-0071', 3: 'LD-0120', ... }
  const pageCursorMapRef = useRef({ 1: null });

  // Fetch leads dynamically with In-Memory Page Caching & has_more tracking
  const loadLeadRegister = useCallback(async (page = 1, forceRefresh = false, searchOverride = undefined) => {
    const activeSearch = searchOverride !== undefined ? searchOverride : searchQuery;
    const activeFilterKey = activeStatusFilter || 'All';
    const activeOwnerKey = ownerFilter || 'All Owners';
    const cacheKey = `p_${page}_sz_${pageSize}_st_${stageFilter}_sts_${statusFilter}_prd_${productFilter}_ow_${activeOwnerKey}_cnt_${contactFilter}_dt_${createdDateFilter}_${createdFromDate}_${createdToDate}_act_${activeFilterKey}_q_${activeSearch.trim()}`;

    // 1. Check if this page data already exists in our client cache (always bypass for date filters to fetch live data)
    const hasDateFilter = createdDateFilter === 'custom' ? (Boolean(createdFromDate) && Boolean(createdToDate)) : (Boolean(createdDateFilter) && createdDateFilter !== 'all');
    const shouldBypassClientCache = forceRefresh || hasDateFilter;

    if (!shouldBypassClientCache && pageCacheRef.current[cacheKey]) {
      const cached = pageCacheRef.current[cacheKey];
      setLeadsData(cached.data);
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
      const prevPageKey = `p_${page - 1}_sz_${pageSize}_st_${stageFilter}_sts_${statusFilter}_prd_${productFilter}_ow_${activeOwnerKey}_cnt_${contactFilter}_dt_${createdDateFilter}_${createdFromDate}_${createdToDate}_act_${activeFilterKey}_q_${activeSearch.trim()}`;
      const prevCached = pageCacheRef.current[prevPageKey];
      const cursor = page > 1 ? (pageCursorMapRef.current[page] || prevCached?.next_cursor || null) : null;

      const isActiveParam = activeStatusFilter === 'All' ? null : (activeStatusFilter === 'Active' ? true : false);

      let selectedOwnerId = null;
      if (ownerFilter && ownerFilter !== 'All Owners' && ownerFilter !== 'All') {
        const foundLeader = leaders.find(l => {
          const lName = (l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim();
          return lName === ownerFilter || String(l.leader_id) === String(ownerFilter) || String(l.emp_id) === String(ownerFilter);
        });
        selectedOwnerId = foundLeader ? (foundLeader.full_name || foundLeader.name || ownerFilter) : ownerFilter;
      }

      // Find stage_id from stageFilter (getLeaderStageDropdown API)
      let selectedStageId = null;
      if (stageFilter && stageFilter !== 'All Stages') {
        const foundStage = stagesMaster.find(s => (s.leader_stage || s.stage_name || s.stage) === stageFilter || String(s.stage_id) === stageFilter || String(s.leader_stage_id) === stageFilter || String(s.id) === stageFilter);
        selectedStageId = foundStage ? (foundStage.stage_id || foundStage.leader_stage_id || foundStage.id) : null;
      }

      // Find status_id from statusFilter (getLeadProductStatusDropdown API)
      let selectedStatusId = null;
      if (statusFilter && statusFilter !== 'All Statuses') {
        const foundStatus = statusesMaster.find(s => (s.status || s.status_name || s.name) === statusFilter || String(s.status_id) === statusFilter || String(s.id) === statusFilter);
        selectedStatusId = foundStatus ? (foundStatus.status_id || foundStatus.id) : null;
      }

      // Construct search query parameter incorporating Product, Lead Owner ID, Contact Person & Text Query
      let searchParam = activeSearch.trim();

      if (productFilter && productFilter !== 'All Products' && productFilter !== 'All') {
        const foundProd = productsMaster.find(p => (p.product || p.product_name) === productFilter || String(p.product_id) === String(productFilter) || String(p.id) === String(productFilter));
        const prodVal = foundProd ? (foundProd.product || foundProd.product_name || productFilter) : productFilter;
        searchParam = searchParam ? `${searchParam} ${prodVal}` : String(prodVal);
      }

      if (contactFilter && contactFilter !== 'All Contacts' && contactFilter !== 'All') {
        searchParam = searchParam ? `${searchParam} ${contactFilter}` : String(contactFilter);
      }

      if (isExecutiveUser && selectedOwnerId && !searchParam.includes(selectedOwnerId)) {
        searchParam = searchParam ? `${searchParam} ${selectedOwnerId}` : String(selectedOwnerId);
      }

      const dateParams = getDateRangeParams(createdDateFilter, createdFromDate, createdToDate);

      const response = await getLeads({
        limit: pageSize,
        cursor: page > 1 ? cursor : null,
        is_active: isActiveParam,
        search: searchParam || undefined,
        lead_owner_id: selectedOwnerId || undefined,
        stage_id: selectedStageId || undefined,
        status_id: selectedStatusId || undefined,
        contact_name: contactFilter && contactFilter !== 'All Contacts' ? contactFilter : undefined,
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

      // Save into Client Cache
      pageCacheRef.current[cacheKey] = {
        data: items,
        total: total,
        next_cursor: nextCursor,
        has_more: isHasMore
      };

      setLeadsData(items);
      setTotalCount(total);
      setHasMore(isHasMore);
      setCurrentPage(page);
      setFetchError(null);
    } catch (err) {
      console.warn('[LeadRegisterView] ⚠️ Fetch failed from server:', err);
      const errMsg = err.response?.data?.message || err.message || 'Unable to retrieve leads from server.';
      setFetchError(errMsg);
      if (!pageCacheRef.current[cacheKey]) {
        pageCacheRef.current[cacheKey] = {
          data: [],
          total: 0,
          next_cursor: null,
          has_more: false
        };
      }
      setLeadsData([]);
      setTotalCount(0);
      setHasMore(false);
      setCurrentPage(page);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, stageFilter, statusFilter, productFilter, ownerFilter, contactFilter, createdDateFilter, createdFromDate, createdToDate, activeStatusFilter, isExecutiveUser, searchQuery, leaders, stagesMaster, statusesMaster, productsMaster]);

  // Fetch ALL matching rows based on applied filters using backend response `total` key for Export
  const fetchAllFilteredLeadsForExport = async () => {
    setIsExporting(true);
    try {
      let selectedOwnerId = null;
      if (isExecutiveUser && ownerFilter && ownerFilter !== 'All Owners' && ownerFilter !== 'All') {
        const foundLeader = leaders.find(l => {
          const lName = (l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim();
          return lName === ownerFilter || l.leader_id === ownerFilter || l.emp_id === ownerFilter;
        });
        selectedOwnerId = foundLeader ? (foundLeader.full_name || foundLeader.name || ownerFilter) : ownerFilter;
      }

      let selectedStageId = null;
      if (stageFilter && stageFilter !== 'All Stages') {
        const foundStage = stagesMaster.find(s => (s.leader_stage || s.stage_name || s.stage) === stageFilter || String(s.stage_id) === stageFilter || String(s.leader_stage_id) === stageFilter || String(s.id) === stageFilter);
        selectedStageId = foundStage ? (foundStage.stage_id || foundStage.leader_stage_id || foundStage.id) : null;
      }

      let selectedStatusId = null;
      if (statusFilter && statusFilter !== 'All Statuses') {
        const foundStatus = statusesMaster.find(s => (s.status || s.status_name || s.name) === statusFilter || String(s.status_id) === statusFilter || String(s.id) === statusFilter);
        selectedStatusId = foundStatus ? (foundStatus.status_id || foundStatus.id) : null;
      }

      const activeSearch = searchQuery || '';
      const isActiveParam = activeStatusFilter === 'Active' ? true : (activeStatusFilter === 'Archived' ? false : null);

      let searchParam = activeSearch.trim();

      if (productFilter && productFilter !== 'All Products' && productFilter !== 'All') {
        const foundProd = productsMaster.find(p => (p.product || p.product_name) === productFilter || String(p.product_id) === String(productFilter) || String(p.id) === String(productFilter));
        const prodVal = foundProd ? (foundProd.product || foundProd.product_name || productFilter) : productFilter;
        searchParam = searchParam ? `${searchParam} ${prodVal}` : String(prodVal);
      }

      if (contactFilter && contactFilter !== 'All Contacts' && contactFilter !== 'All') {
        searchParam = searchParam ? `${searchParam} ${contactFilter}` : String(contactFilter);
      }

      if (isExecutiveUser && selectedOwnerId && !searchParam.includes(selectedOwnerId)) {
        searchParam = searchParam ? `${searchParam} ${selectedOwnerId}` : String(selectedOwnerId);
      }

      // 1. Initial GET request to retrieve backend total count key
      const initialRes = await getLeads({
        limit: 1,
        is_active: isActiveParam,
        search: searchParam || undefined,
        lead_owner_id: selectedOwnerId || undefined,
        stage_id: selectedStageId || undefined,
        status_id: selectedStatusId || undefined,
        contact_name: contactFilter && contactFilter !== 'All Contacts' ? contactFilter : undefined
      });

      const totalCountToFetch = initialRes?.total !== undefined ? initialRes.total : (totalCount || 500);

      if (!totalCountToFetch || totalCountToFetch === 0) {
        alert('No leads found matching the applied filters.');
        return null;
      }

      // 2. Fetch full dataset in 1 GET call using limit = total
      const fullRes = await getLeads({
        limit: totalCountToFetch,
        is_active: isActiveParam,
        search: searchParam || undefined,
        lead_owner_id: selectedOwnerId || undefined,
        stage_id: selectedStageId || undefined,
        contact_name: contactFilter && contactFilter !== 'All Contacts' ? contactFilter : undefined
      });

      let items = Array.isArray(fullRes?.data) ? fullRes.data : (Array.isArray(fullRes) ? fullRes : []);
      const filteredItems = filterLeadsArray(items);

      if (!filteredItems || filteredItems.length === 0) {
        alert('No leads found matching the applied filters.');
        return null;
      }

      return filteredItems;
    } catch (err) {
      console.error('[Export] Error fetching complete dataset for export:', err);
      alert('Failed to retrieve full lead dataset for export. Please try again.');
      return null;
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setShowExportMenu(false);
    const data = await fetchAllFilteredLeadsForExport();
    if (!data || !data.length) return;

    const excelRows = data.map(l => {
      const prods = Array.isArray(l.products) ? l.products : [];
      const totVal = prods.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0) || (l.project_value ? Number(l.project_value) : 0);
      const totPipe = prods.reduce((sum, p) => sum + (Number(p.pipeline) || 0), 0) || (l.pipeline ? Number(l.pipeline) : 0);
      const prodSummary = prods.map(p => `${p.product_name || 'Product'} (Qty: ${p.quantity || 1}, Value: ₹${p.project_value || 0})`).join('; ');
      const stages = Array.from(new Set(prods.map(p => p.stage_name || p.status_name || 'New'))).join(', ');
      const risks = Array.from(new Set(prods.map(p => p.risk_matrix || 'Clear'))).join(', ');

      return {
        'Lead ID': l.lead_id,
        'Created Date': formatDate(l.created_date),
        'Updated At': l.updated_at ? formatDate(l.updated_at) : '—',
        'Lead Owner ID': l.lead_owner_id || '',
        'Lead Owner Name': l.lead_owner_name || 'Unassigned',
        'Lead Source': l.lead_source || 'Direct',
        'Company': l.company || '',
        'Contact Name': l.contact_name || '',
        'Designation': l.designation || '',
        'Phone Number': l.phone_no || '',
        'Email': l.email || '',
        'Country': l.country || 'India',
        'Total Project Value (₹)': totVal,
        'Total Pipeline (₹)': totPipe,
        'Assigned Products Summary': prodSummary || 'None',
        'Stage(s)': stages || 'None',
        'Risk Matrix': risks || 'Clear',
        'Active Status': l.is_active !== false ? 'Active' : 'Inactive'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);

    // Format column widths for clean readability in Microsoft Excel
    worksheet['!cols'] = [
      { wch: 12 }, // Lead ID
      { wch: 15 }, // Created Date
      { wch: 15 }, // Updated At
      { wch: 15 }, // Lead Owner ID
      { wch: 22 }, // Lead Owner Name
      { wch: 14 }, // Lead Source
      { wch: 26 }, // Company
      { wch: 20 }, // Contact Name
      { wch: 18 }, // Designation
      { wch: 16 }, // Phone Number
      { wch: 26 }, // Email
      { wch: 14 }, // Country
      { wch: 22 }, // Total Project Value (₹)
      { wch: 20 }, // Total Pipeline (₹)
      { wch: 45 }, // Assigned Products Summary
      { wch: 18 }, // Stage(s)
      { wch: 14 }, // Risk Matrix
      { wch: 14 }  // Active Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lead Register');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Lead_Register_Export_${dateStr}.xlsx`);
  };

  const handleExportPDF = async () => {
    setShowExportMenu(false);
    const data = await fetchAllFilteredLeadsForExport();
    if (!data || !data.length) return;

    const totalValueSum = data.reduce((sum, l) => {
      const prods = Array.isArray(l.products) ? l.products : [];
      return sum + (prods.reduce((s, p) => s + (Number(p.project_value) || 0), 0) || (l.project_value ? Number(l.project_value) : 0));
    }, 0);

    const totalPipelineSum = data.reduce((sum, l) => {
      const prods = Array.isArray(l.products) ? l.products : [];
      return sum + (prods.reduce((s, p) => s + (Number(p.pipeline) || 0), 0) || (l.pipeline ? Number(l.pipeline) : 0));
    }, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up window blocked. Please allow pop-ups to export PDF.');
      return;
    }

    const reportTitle = `Lead Register Report - ${new Date().toLocaleDateString()}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #1e293b; margin: 0; padding: 16px; }
          .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #00D4AA; padding-bottom: 10px; margin-bottom: 16px; }
          .title { font-size: 20px; font-weight: 800; color: #0D141F; text-transform: uppercase; letter-spacing: 0.5px; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 3px; }
          .metrics { display: flex; gap: 12px; margin-bottom: 16px; }
          .card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
          .card-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .card-value { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 8px; }
          th { background: #0D141F; color: #00D4AA; font-weight: 700; text-transform: uppercase; padding: 7px 8px; text-align: left; border: 1px solid #1e293b; font-size: 9.5px; }
          td { padding: 7px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .badge-won { background: #dcfce7; color: #166534; }
          .badge-lost { background: #fee2e2; color: #991b1b; }
          .badge-clear { background: #e0f2fe; color: #0369a1; }
          .badge-revenue { background: #fef3c7; color: #92400e; }
          .footer { margin-top: 20px; font-size: 9.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header-bar">
          <div>
            <div class="title">Lead Register Master Report</div>
            <div class="subtitle">Generated: ${new Date().toLocaleString()} | Filter Summary: Status: ${stageFilter || 'All'}, Product: ${productFilter || 'All'}, Owner: ${ownerFilter || 'All'}</div>
          </div>
        </div>

        <div class="metrics">
          <div class="card">
            <div class="card-title">Total Records</div>
            <div class="card-value">${data.length}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Project Value</div>
            <div class="card-value">₹${totalValueSum.toLocaleString()}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Pipeline Value</div>
            <div class="card-value">₹${totalPipelineSum.toLocaleString()}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 70px;">Lead ID</th>
              <th>Created & Updated</th>
              <th>Company</th>
              <th>Contact Details</th>
              <th>Lead Owner</th>
              <th>Products</th>
              <th style="text-align: right;">Project Value (₹)</th>
              <th style="text-align: right;">Pipeline (₹)</th>
              <th>Stage</th>
              <th>Risk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(l => {
      const prods = Array.isArray(l.products) ? l.products : [];
      const totVal = prods.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0) || (l.project_value ? Number(l.project_value) : 0);
      const totPipe = prods.reduce((sum, p) => sum + (Number(p.pipeline) || 0), 0) || (l.pipeline ? Number(l.pipeline) : 0);
      const prodSummary = prods.map(p => `${p.product_name || 'Product'} (x${p.quantity || 1})`).join('<br/>') || 'None';
      const stages = Array.from(new Set(prods.map(p => p.stage_name || p.status_name || 'New'))).join(', ') || 'None';
      const risks = Array.from(new Set(prods.map(p => p.risk_matrix || 'Clear'))).join(', ') || 'Clear';
      const updatedStr = l.updated_at ? formatDate(l.updated_at) : '—';

      return `
                <tr>
                  <td><b>${l.lead_id}</b></td>
                  <td><span style="font-size:9.5px;color:#475569;">C: ${formatDate(l.created_date)}</span><br/><span style="font-size:9.5px;color:#0284c7;font-weight:600;">U: ${updatedStr}</span></td>
                  <td><b>${l.company || '—'}</b><br/><span style="color:#64748b;font-size:9.5px;">${l.country || ''}</span></td>
                  <td>${l.contact_name || '—'}<br/><span style="color:#64748b;font-size:9.5px;">${l.phone_no || l.email || ''}</span></td>
                  <td>${l.lead_owner_name || 'Unassigned'}</td>
                  <td>${prodSummary}</td>
                  <td style="text-align: right;">₹${totVal.toLocaleString()}</td>
                  <td style="text-align: right;">₹${totPipe.toLocaleString()}</td>
                  <td>${stages}</td>
                  <td><span class="badge ${risks === 'LOST' ? 'badge-lost' : (risks === 'Revenue' ? 'badge-revenue' : 'badge-clear')}">${risks}</span></td>
                  <td><span class="badge ${l.is_active !== false ? 'badge-won' : 'badge-lost'}">${l.is_active !== false ? 'Active' : 'Inactive'}</span></td>
                </tr>
              `;
    }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <span>Confidential Sales Management System</span>
          <span>Total Filtered Records: ${data.length}</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Initial load or when filters / page size / refreshKey change (e.g. after lead creation)
  useEffect(() => {
    pageCacheRef.current = {};
    pageCursorMapRef.current = { 1: null };
    loadLeadRegister(1, true);
  }, [loadLeadRegister, refreshKey]);

  // ── Smart Search with 350ms Debouncing ─────────────────────────────────────────
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
      loadLeadRegister(1, true, searchQuery.trim())
        .then(() => { if (!cancelled) setIsSearchingServer(false); })
        .catch(() => { if (!cancelled) setIsSearchingServer(false); });
      return () => { cancelled = true; };
    }

    // 2. Search cleared from an existing non-empty search
    if (prev.trim() !== '' && !searchQuery.trim()) {
      pageCacheRef.current = {};
      pageCursorMapRef.current = { 1: null };
      loadLeadRegister(1, true, '');
    }
  }, [searchQuery, loadLeadRegister]);

  // Handle manual explicit refresh
  const handleExplicitRefresh = () => {
    pageCacheRef.current = {};
    pageCursorMapRef.current = { 1: null };
    fetchDropdownMasters(true);
    loadLeadRegister(1, true);
  };

  const toggleRowExpand = (leadId) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  // Bulk Lead Selection States
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [isSelectAllPages, setIsSelectAllPages] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setIsSelectAllPages(true);
      setSelectedLeadIds((filtered || []).map(l => l.lead_id));
    } else {
      setIsSelectAllPages(false);
      setSelectedLeadIds([]);
    }
  };

  const handleToggleIndividualLead = (leadId, checked) => {
    setIsSelectAllPages(false);
    if (checked) {
      setSelectedLeadIds(prev => [...prev, leadId]);
    } else {
      setSelectedLeadIds(prev => prev.filter(id => id !== leadId));
    }
  };

  // Bulk Delete Selected Leads Handler
  const handleBulkDeleteLeads = () => {
    let idsToDelete = [...selectedLeadIds];
    if (isSelectAllPages || selectedLeadIds.length === 0) {
      idsToDelete = filtered.map(l => l.lead_id).filter(Boolean);
    }
    const count = idsToDelete.length;
    if (count === 0) {
      showToast('info', 'No leads selected for deletion.');
      return;
    }

    setDeleteDialogState({
      isOpen: true,
      title: 'Bulk Delete Selected Leads',
      message: `Are you sure you want to permanently delete ${count} selected lead(s)? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await bulkDeleteLeads({ ids: idsToDelete });
          showToast('success', `Successfully deleted ${count} lead(s).`);
          setSelectedLeadIds([]);
          setIsSelectAllPages(false);
          setIsDeleteMode(false);
          pageCacheRef.current = {};
          await loadLeadRegister(1, true);
        } catch (err) {
          console.error('[LeadRegisterView] Bulk delete leads error:', err);
          showToast('error', formatApiError(err, 'Failed to delete leads.'));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Delete All Leads Handler
  const handleDeleteAllLeads = () => {
    const hasActiveFilters = Boolean(searchQuery.trim()) ||
      stageFilter !== 'All Stages' ||
      statusFilter !== 'All Statuses' ||
      productFilter !== 'All Products' ||
      contactFilter !== 'All Contacts' ||
      (ownerFilter && ownerFilter !== 'All Owners') ||
      activeStatusFilter !== 'All' ||
      createdDateFilter !== 'all';

    if (hasActiveFilters) {
      const idsToDelete = filtered.map(l => l.lead_id).filter(Boolean);
      const count = idsToDelete.length;
      if (count === 0) {
        showToast('info', 'No matching leads to delete.');
        return;
      }

      setDeleteDialogState({
        isOpen: true,
        title: 'Delete Filtered Leads',
        message: `Are you sure you want to permanently delete all ${count} lead(s) matching your currently applied filters? This action cannot be undone.`,
        isDeleting: false,
        onConfirm: async () => {
          setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
          try {
            await bulkDeleteLeads({ ids: idsToDelete });
            showToast('success', `Successfully deleted ${count} filtered lead(s).`);
            setSelectedLeadIds([]);
            setIsSelectAllPages(false);
            setIsDeleteMode(false);
            pageCacheRef.current = {};
            await loadLeadRegister(1, true);
          } catch (err) {
            console.error('[LeadRegisterView] Delete filtered leads error:', err);
            showToast('error', formatApiError(err, 'Failed to delete filtered leads.'));
          } finally {
            setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
          }
        }
      });
    } else {
      const totalLeadsNum = totalCount || (filtered ? filtered.length : 0);
      setDeleteDialogState({
        isOpen: true,
        title: '⚠️ PERMANENTLY DELETE ALL LEADS',
        message: `CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE ALL ${totalLeadsNum} LEADS in the system? This action CANNOT BE UNDONE!`,
        isDeleting: false,
        onConfirm: async () => {
          setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
          try {
            await deleteAllLeads();
            setSelectedLeadIds([]);
            setIsSelectAllPages(false);
            setIsDeleteMode(false);
            pageCacheRef.current = {};
            await loadLeadRegister(1, true);
            showToast('success', 'All leads have been permanently deleted.');
          } catch (err) {
            console.error('[LeadRegisterView] Delete all leads error:', err);
            showToast('error', formatApiError(err, 'Failed to delete all leads.'));
          } finally {
            setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
          }
        }
      });
    }
  };

  // Delete Lead Handler
  const handleDeleteLead = (lead) => {
    setDeleteDialogState({
      isOpen: true,
      title: 'Delete Lead Entry',
      message: `Are you sure you want to permanently delete lead #${lead.lead_id} (${lead.company})? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await deleteLead(lead.lead_id);
          pageCacheRef.current = {};
          await loadLeadRegister(currentPage, true);
          showToast('success', `Lead #${lead.lead_id} (${lead.company}) deleted successfully.`);
        } catch (err) {
          console.error('[LeadRegisterView] Delete lead error:', err);
          showToast('error', formatApiError(err, `Failed to delete lead #${lead.lead_id}.`));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Toggle / Activate Lead Handler for Admins
  const handleToggleActivateLead = async (lead) => {
    const targetLeadId = lead.lead_id || lead.id;
    try {
      await updateLead(targetLeadId, { is_active: true });
      pageCacheRef.current = {};
      await loadLeadRegister(currentPage, true);
      showToast('success', `Lead #${targetLeadId} is now active.`);
    } catch (err) {
      console.error('[LeadRegisterView] Activate lead error:', err);
      showToast('error', formatApiError(err, `Failed to activate lead #${targetLeadId}.`));
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = (leadId, product) => {
    setDeleteDialogState({
      isOpen: true,
      title: 'Remove Product from Lead',
      message: `Are you sure you want to delete ${product.product_name} (#${product.product_register_id}) from lead #${leadId}?`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await deleteLeadProduct(leadId, product.product_register_id);
          pageCacheRef.current = {};
          await loadLeadRegister(currentPage, true);
          showToast('success', `Product #${product.product_register_id} removed from lead #${leadId}.`);
        } catch (err) {
          console.error('[LeadRegisterView] Delete product error:', err);
          showToast('error', formatApiError(err, `Failed to remove product from lead #${leadId}.`));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Helper formatters

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
  };

  // Badges
  const getStageBadgeStyle = (stageName) => {
    const s = (stageName || '').toLowerCase();
    if (s.includes('won')) return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.4)' };
    if (s.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
    if (s.includes('negotiation') || s.includes('high')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' };
    if (s.includes('qualified') || s.includes('proposal')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.4)' };
    return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.3)' };
  };

  const getRiskBadgeStyle = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
    if (r.includes('revenue') || r.includes('clear')) return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' };
  };

  // Stage Filter Options (populated from getLeaderStageDropdown API / stagesMaster)
  const stageFilterOptions = useMemo(() => {
    const list = [{ value: 'All Stages', label: 'All Stages' }];
    stagesMaster.forEach(s => {
      const sName = (s.leader_stage || s.stage_name || s.stage || '').trim();
      if (sName && !list.some(item => item.value.toLowerCase() === sName.toLowerCase())) {
        list.push({ value: sName, label: sName });
      }
    });

    leadsData.forEach(l => {
      if (l.stage_name && !list.some(item => item.value.toLowerCase() === l.stage_name.toLowerCase())) {
        list.push({ value: l.stage_name, label: l.stage_name });
      }
      (l.products || []).forEach(p => {
        const name = (p.stage_name || '').trim();
        if (name && !list.some(item => item.value.toLowerCase() === name.toLowerCase())) {
          list.push({ value: name, label: name });
        }
      });
    });
    return list;
  }, [stagesMaster, leadsData]);

  // Status Filter Options (populated from getLeadProductStatusDropdown API / statusesMaster)
  const statusFilterOptions = useMemo(() => {
    const list = [{ value: 'All Statuses', label: 'All Statuses' }];
    statusesMaster.forEach(st => {
      const stName = (st.status || st.status_name || st.name || '').trim();
      if (stName && !list.some(item => item.value.toLowerCase() === stName.toLowerCase())) {
        list.push({ value: stName, label: stName });
      }
    });

    leadsData.forEach(l => {
      if (l.status_name && !list.some(item => item.value.toLowerCase() === l.status_name.toLowerCase())) {
        list.push({ value: l.status_name, label: l.status_name });
      }
      (l.products || []).forEach(p => {
        const name = (p.status_name || '').trim();
        if (name && !list.some(item => item.value.toLowerCase() === name.toLowerCase())) {
          list.push({ value: name, label: name });
        }
      });
    });
    return list;
  }, [statusesMaster, leadsData]);

  const productFilterOptions = useMemo(() => {
    const list = [{ value: 'All Products', label: 'All Products' }];

    productsMaster.forEach(p => {
      const name = (p.product || p.product_name || '').trim();
      if (name && !list.some(item => item.value.toLowerCase() === name.toLowerCase())) {
        list.push({ value: name, label: name });
      }
    });

    leadsData.forEach(l => {
      (l.products || []).forEach(p => {
        const name = (p.product_name || p.product || '').trim();
        if (name && !list.some(item => item.value.toLowerCase() === name.toLowerCase())) {
          list.push({ value: name, label: name });
        }
      });
    });

    return list;
  }, [productsMaster, leadsData]);

  const ownerFilterOptions = useMemo(() => {
    const list = [{ value: 'All Owners', label: 'All Owners' }];
    leaders.forEach(l => {
      const name = (l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({
          value: name,
          label: name,
          sublabel: l.leader_id || ''
        });
      }
    });
    leadsData.forEach(l => {
      const name = (l.lead_owner_name || '').trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({ value: name, label: name });
      }
    });
    return list;
  }, [leaders, leadsData]);

  // Contact Person Filter Options (populated from /api/v1/contacts/dropdown)
  const contactFilterOptions = useMemo(() => {
    const list = [{ value: 'All Contacts', label: 'All Contacts' }];
    contactsMaster.forEach(c => {
      const name = (c.contact_name || c.name || '').trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({
          value: name,
          label: name,
          sublabel: c.company || c.designation || undefined
        });
      }
    });
    leadsData.forEach(l => {
      const name = (l.contact_name || '').trim();
      if (name && !list.some(item => item.value === name)) {
        list.push({
          value: name,
          label: name,
          sublabel: l.company || l.designation || undefined
        });
      }
    });
    return list;
  }, [contactsMaster, leadsData]);

  // Created At Date Preset Options
  const datePresetOptions = useMemo(() => [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last_7_days', label: 'Last 7 Days' },
    { value: 'last_30_days', label: 'Last 30 Days' },
    { value: 'this_month', label: 'This Month' },
    { value: 'custom', label: 'Custom Date Range' }
  ], []);

  const activeStatusFilterOptions = useMemo(() => [
    { value: 'All', label: 'All Status' },
    { value: 'Active', label: 'Active Leads' },
    { value: 'Inactive', label: 'Inactive Leads' }
  ], []);

  // Compute number of active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (stageFilter && stageFilter !== 'All Stages') count++;
    if (statusFilter && statusFilter !== 'All Statuses') count++;
    if (productFilter && productFilter !== 'All Products') count++;
    if (isExecutiveUser && ownerFilter && ownerFilter !== 'All Owners') count++;
    if (contactFilter && contactFilter !== 'All Contacts') count++;
    if (createdDateFilter === 'custom') {
      if (createdFromDate && createdToDate) count++;
    } else if (createdDateFilter && createdDateFilter !== 'all') {
      count++;
    }
    if (isExecutiveUser && activeStatusFilter && activeStatusFilter !== 'All') count++;
    return count;
  }, [stageFilter, statusFilter, productFilter, isExecutiveUser, ownerFilter, contactFilter, createdDateFilter, activeStatusFilter]);

  const handleResetFilters = useCallback(() => {
    setStageFilter('All Stages');
    setStatusFilter('All Statuses');
    setProductFilter('All Products');
    if (isExecutiveUser) setOwnerFilter('All Owners');
    setContactFilter('All Contacts');
    setCreatedDateFilter('all');
    setCreatedFromDate('');
    setCreatedToDate('');
    if (isExecutiveUser) setActiveStatusFilter('All');
    setCurrentPage(1);
  }, [isExecutiveUser]);

  const getCreatedDateLabel = (filterVal, from, to) => {
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

  // Reusable filtering logic for both UI rendering and PDF/Excel Exports
  const filterLeadsArray = useCallback((data) => {
    if (!Array.isArray(data)) return [];
    return data.filter(lead => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.contact_name && lead.contact_name.toLowerCase().includes(q)) ||
        (lead.designation && lead.designation.toLowerCase().includes(q)) ||
        (lead.phone_no && String(lead.phone_no).toLowerCase().includes(q)) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.country && lead.country.toLowerCase().includes(q)) ||
        (lead.lead_source && lead.lead_source.toLowerCase().includes(q)) ||
        (lead.lead_owner_name && lead.lead_owner_name.toLowerCase().includes(q)) ||
        (lead.lead_id && String(lead.lead_id).toLowerCase().includes(q));

      const matchStage = stageFilter === 'All Stages' || stageFilter === 'All' ||
        (lead.stage_name && lead.stage_name.toLowerCase() === stageFilter.toLowerCase()) ||
        (lead.products && lead.products.some(p => (
          p.stage_name && p.stage_name.toLowerCase() === stageFilter.toLowerCase()
        )));

      const matchStatus = statusFilter === 'All Statuses' || statusFilter === 'All' ||
        (lead.status_name && lead.status_name.toLowerCase() === statusFilter.toLowerCase()) ||
        (lead.products && lead.products.some(p => (
          p.status_name && p.status_name.toLowerCase() === statusFilter.toLowerCase()
        )));

      const matchProduct = productFilter === 'All Products' || productFilter === 'All' ||
        (lead.products && lead.products.some(p => (
          (p.product_name && p.product_name.toLowerCase() === productFilter.toLowerCase()) ||
          (p.product && p.product.toLowerCase() === productFilter.toLowerCase()) ||
          String(p.product_id) === String(productFilter)
        )));

      const matchOwner = ownerFilter === 'All Owners' || ownerFilter === 'All' ||
        lead.lead_owner_name === ownerFilter || String(lead.lead_owner_id) === String(ownerFilter);

      const matchContact = contactFilter === 'All Contacts' || contactFilter === 'All' ||
        (lead.contact_name && lead.contact_name.toLowerCase() === contactFilter.toLowerCase()) ||
        (lead.contact_id && String(lead.contact_id) === contactFilter);

      const matchActive = activeStatusFilter === 'All' ||
        (activeStatusFilter === 'Active' ? Boolean(lead.is_active !== false) : !lead.is_active);

      const matchDate = (() => {
        if (createdDateFilter === 'all') return true;
        if (!lead.created_date) return false;
        const leadDate = new Date(lead.created_date);
        if (isNaN(leadDate.getTime())) return true;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (createdDateFilter === 'today') {
          return leadDate >= startOfToday;
        }
        if (createdDateFilter === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return leadDate >= startOfYesterday && leadDate < startOfToday;
        }
        if (createdDateFilter === 'last_7_days') {
          const past7 = new Date(startOfToday);
          past7.setDate(past7.getDate() - 7);
          return leadDate >= past7;
        }
        if (createdDateFilter === 'last_30_days') {
          const past30 = new Date(startOfToday);
          past30.setDate(past30.getDate() - 30);
          return leadDate >= past30;
        }
        if (createdDateFilter === 'this_month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return leadDate >= startOfMonth;
        }
        if (createdDateFilter === 'custom') {
          if (createdFromDate) {
            const from = new Date(createdFromDate);
            from.setHours(0, 0, 0, 0);
            if (leadDate < from) return false;
          }
          if (createdToDate) {
            const to = new Date(createdToDate);
            to.setHours(23, 59, 59, 999);
            if (leadDate > to) return false;
          }
          return true;
        }
        return true;
      })();

      return matchQuery && matchStage && matchStatus && matchProduct && matchOwner && matchContact && matchActive && matchDate;
    });
  }, [searchQuery, stageFilter, statusFilter, productFilter, ownerFilter, contactFilter, activeStatusFilter, isExecutiveUser, createdDateFilter, createdFromDate, createdToDate]);

  const filtered = useMemo(() => filterLeadsArray(leadsData), [filterLeadsArray, leadsData]);

  const displayTotalLeads = totalCount || (filtered ? filtered.length : 0);

  // Next Page cache check
  const activeFilterKey = activeStatusFilter || 'All';
  const nextPageKey = `p_${currentPage + 1}_sz_${pageSize}_st_${stageFilter}_ow_${ownerFilter}_cnt_${contactFilter}_dt_${createdDateFilter}_${createdFromDate}_${createdToDate}_act_${activeFilterKey}`;
  const canGoNext = hasMore || Boolean(pageCacheRef.current[nextPageKey]);
  const canGoPrev = currentPage > 1;

  // Should pagination controls be displayed?
  // Only display if has_more is true OR user has navigated beyond page 1 OR multiple pages exist
  const showPagination = hasMore || currentPage > 1 || (totalCount > pageSize);

  // Navigate to next page (retrieves from cache if available, otherwise fetches)
  const handleNextPage = () => {
    if (!canGoNext) return;
    loadLeadRegister(currentPage + 1);
  };

  // Navigate to prev page (always retrieved instantly from cache without network call!)
  const handlePrevPage = () => {
    if (!canGoPrev) return;
    loadLeadRegister(currentPage - 1);
  };

  const glassCard = {
    background: 'var(--t-surface-solid)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--t-border)',
    borderRadius: '12px',
    boxShadow: 'var(--t-card-shadow)'
  };

  return (
    <div className="lead-main-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'clamp(12px, 1.2vw, 20px)', gap: '10px' }}>

      {/* Top Action Bar */}
      <div style={{ ...glassCard, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 40, overflow: 'visible' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
          {/* Left Side: Search & Unified Filter Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '320px' }}>

            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
              {isSearchingServer
                ? <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                : <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px' }} />
              }
              <input
                type="text"
                placeholder="Search company, contact, email, phone, ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px 0 40px',
                  borderRadius: '8px',
                  border: '1px solid var(--t-border)',
                  background: 'var(--t-surface-alt)',
                  color: 'var(--t-fg)',
                  fontSize: 'clamp(13.5px, 0.8vw + 4px, 15px)',
                  fontFamily: "'Inter', sans-serif",
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Unified Filter Button & Floating Dropdown Popover */}
            <div style={{ position: 'relative' }} ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen(prev => !prev)}
                style={{
                  height: '42px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  background: activeFiltersCount > 0 ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)',
                  border: activeFiltersCount > 0 ? '1px solid var(--t-teal)' : '1px solid var(--t-border)',
                  color: activeFiltersCount > 0 ? 'var(--t-teal)' : 'var(--t-fg-mid)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: 'clamp(13.5px, 0.8vw + 4px, 15px)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 150ms ease'
                }}
              >
                <FiFilter style={{ fontSize: '15px' }} />
                <span>Filters</span>
                {activeFiltersCount > 0 && (
                  <span style={{
                    background: 'var(--t-teal)',
                    color: '#0A1017',
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: '10px',
                    lineHeight: '16px'
                  }}>
                    {activeFiltersCount}
                  </span>
                )}
                <FiChevronDown style={{ transform: isFilterMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>

              {/* Floating Unified Filter Dropdown Panel */}
              {isFilterMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '380px',
                    maxWidth: '92vw',
                    maxHeight: '430px',
                    background: '#0B131E',
                    border: '1px solid rgba(0, 212, 170, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 48px rgba(0, 0, 0, 0.85), 0 0 24px rgba(0, 212, 170, 0.15)',
                    zIndex: 100060,
                    display: 'flex',
                    flexDirection: 'column',
                    backdropFilter: 'blur(20px)',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                  }}
                >
                  {/* Sticky Popover Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    background: '#0B131E',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    flexShrink: 0
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.02em' }}>
                      <FiFilter style={{ color: 'var(--t-teal)' }} />
                      <span>Filter Leads</span>
                      {activeFiltersCount > 0 && (
                        <span style={{ fontSize: '11px', background: 'rgba(0, 212, 170, 0.2)', color: 'var(--t-teal)', padding: '2px 6px', borderRadius: '4px' }}>
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
                          color: '#94A3B8',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 600
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                      >
                        <FiRotateCcw style={{ fontSize: '12px' }} />
                        Reset All
                      </button>
                    )}
                  </div>

                  {/* Scrollable Single-Column Filter Content */}
                  <div style={{
                    padding: '16px 18px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}>
                    {/* Filter 1: Stage (Loaded from getLeaderStageDropdown API) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Stage
                      </label>
                      <CustomSelect
                        value={stageFilter}
                        onChange={val => {
                          setStageFilter(val);
                          setCurrentPage(1);
                        }}
                        options={stageFilterOptions}
                        placeholder="All Stages"
                        icon={FiLayers}
                        height="38px"
                        searchable={true}
                      />
                    </div>

                    {/* Filter 2: Status (Loaded from getLeadProductStatusDropdown API) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Status
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
                        searchable={true}
                      />
                    </div>

                    {/* Filter 3: Product */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Product
                      </label>
                      <CustomSelect
                        value={productFilter}
                        onChange={val => {
                          setProductFilter(val);
                          setCurrentPage(1);
                        }}
                        options={productFilterOptions}
                        placeholder="All Products"
                        icon={FiPackage}
                        height="38px"
                        searchable={true}
                      />
                    </div>

                    {/* Filter 4: Lead Owner (Executive Only) */}
                    {isExecutiveUser && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Lead Owner
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
                    )}

                    {/* Filter 5: Contact Person (Loaded from /api/v1/contacts/dropdown) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Contact Person
                      </label>
                      <CustomSelect
                        value={contactFilter}
                        onChange={val => {
                          setContactFilter(val);
                          setCurrentPage(1);
                        }}
                        options={contactFilterOptions}
                        placeholder="All Contacts"
                        icon={FiUser}
                        height="38px"
                        searchable={true}
                      />
                    </div>

                    {/* Filter 6: Created At Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        Created Date
                      </label>
                      <CustomSelect
                        value={createdDateFilter}
                        onChange={val => {
                          setCreatedDateFilter(val);
                          setCurrentPage(1);
                        }}
                        options={datePresetOptions}
                        placeholder="All Time"
                        icon={FiCalendar}
                        height="38px"
                      />

                      {/* Custom Date Range Inputs */}
                      {createdDateFilter === 'custom' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                          <div>
                            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', marginBottom: '3px' }}>From</span>
                            <input
                              type="date"
                              value={createdFromDate}
                              onChange={e => {
                                const val = e.target.value;
                                if (val && !isValidDateStr(val)) {
                                  alert("Wrong date format. Please select a valid From Date.");
                                  return;
                                }
                                if (val && createdToDate && val > createdToDate) {
                                  alert("Invalid date range: 'From Date' cannot be later than 'To Date'. Please select a valid date range.");
                                  return;
                                }
                                setCreatedFromDate(val);
                                setCurrentPage(1);
                              }}
                              onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                              style={{
                                width: '100%',
                                height: '34px',
                                background: 'rgba(5, 8, 14, 0.95)',
                                border: '1px solid rgba(49, 151, 149, 0.35)',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '12px',
                                padding: '0 8px',
                                boxSizing: 'border-box',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', marginBottom: '3px' }}>To</span>
                            <input
                              type="date"
                              value={createdToDate}
                              onChange={e => {
                                const val = e.target.value;
                                if (val && !isValidDateStr(val)) {
                                  alert("Wrong date format. Please select a valid To Date.");
                                  return;
                                }
                                if (val && createdFromDate && val < createdFromDate) {
                                  alert("Invalid date range: 'To Date' cannot be earlier than 'From Date'. Please select a valid date range.");
                                  return;
                                }
                                setCreatedToDate(val);
                                setCurrentPage(1);
                              }}
                              onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                              style={{
                                width: '100%',
                                height: '34px',
                                background: 'rgba(5, 8, 14, 0.95)',
                                border: '1px solid rgba(49, 151, 149, 0.35)',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '12px',
                                padding: '0 8px',
                                boxSizing: 'border-box',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Filter 7: Active Status (Executive Only) */}
                    {isExecutiveUser && (
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
                    )}
                  </div>

                  {/* Sticky Popover Footer */}
                  <div style={{
                    padding: '12px 18px',
                    background: '#0B131E',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 500 }}>
                      {activeFiltersCount > 0 ? `${activeFiltersCount} filter(s) active` : 'No active filters'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFilterMenuOpen(false)}
                      style={{
                        padding: '8px 22px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #00D4AA, #00C6FF)',
                        border: 'none',
                        color: '#0A1017',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 212, 170, 0.35)',
                        marginLeft: 'auto'
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ position: 'relative' }} ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(prev => !prev)}
                  disabled={isExporting}
                  style={{
                    height: '42px',
                    padding: '0 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--t-border)',
                    borderRadius: '8px',
                    background: 'var(--t-surface-alt)',
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: 'var(--t-fg)',
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                    opacity: isExporting ? 0.7 : 1
                  }}
                >
                  <FiDownload style={{ fontSize: '15px' }} />
                  {isExporting ? 'Exporting...' : 'Export'}
                  {/* <span style={{ fontSize: '10px', marginLeft: '2px', opacity: 0.7 }}>▼</span> */}
                </button>

                {showExportMenu && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '210px',
                    background: '#0D141F',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 0 15px rgba(0, 212, 170, 0.15)',
                    zIndex: 99,
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <button
                      onClick={handleExportExcel}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: '#E2E8F0',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '16px' }}>📊</span>
                      <div>
                        <div style={{ color: '#FFFFFF', fontWeight: 700 }}>Export to Excel</div>
                        <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Spreadsheet (.csv / .xlsx)</div>
                      </div>
                    </button>

                    <button
                      onClick={handleExportPDF}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        border: 'none',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: '#E2E8F0',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.12)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '16px' }}>📄</span>
                      <div>
                        <div style={{ color: '#FFFFFF', fontWeight: 700 }}>Export to PDF</div>
                        <div style={{ fontSize: '10.5px', color: '#94A3B8' }}>Document (.pdf)</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {isUserSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteMode(prev => {
                      const next = !prev;
                      if (!next) {
                        setSelectedLeadIds([]);
                        setIsSelectAllPages(false);
                      }
                      return next;
                    });
                  }}
                  title={isDeleteMode ? 'Close selection mode' : 'Select & Delete Leads'}
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
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.15s ease',
                    boxShadow: isDeleteMode ? '0 0 12px rgba(239, 68, 68, 0.3)' : 'none'
                  }}
                >
                  <FiTrash2 style={{ fontSize: '15px' }} />
                  <span>
                    {isDeleteMode
                      ? ((selectedLeadIds.length > 0 || isSelectAllPages) ? `Delete Selected (${isSelectAllPages ? displayTotalLeads : selectedLeadIds.length})` : 'Cancel Delete')
                      : 'Delete'}
                  </span>
                </button>
              )}

              <button
                onClick={onOpenAddLead}
                style={{
                  height: '42px',
                  padding: '0 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(90deg, #009B82, #00D4AA)',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#070C12',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(0, 212, 170, 0.4)'
                }}
              >
                <FiPlus style={{ fontSize: '16px', strokeWidth: 3 }} /> New Lead
              </button>
            </div>
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

            {stageFilter !== 'All Stages' && (
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
                Stage: {stageFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setStageFilter('All Stages'); setCurrentPage(1); }} />
              </span>
            )}

            {statusFilter !== 'All Statuses' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                color: '#3B82F6',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Status: {statusFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setStatusFilter('All Statuses'); setCurrentPage(1); }} />
              </span>
            )}

            {productFilter !== 'All Products' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#A855F7',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Product: {productFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setProductFilter('All Products'); setCurrentPage(1); }} />
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

            {contactFilter !== 'All Contacts' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#C084FC',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Contact: {contactFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setContactFilter('All Contacts'); setCurrentPage(1); }} />
              </span>
            )}

            {createdDateFilter !== 'all' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#FBBF24',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Created: {getCreatedDateLabel(createdDateFilter, createdFromDate, createdToDate)}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setCreatedDateFilter('all'); setCreatedFromDate(''); setCreatedToDate(''); setCurrentPage(1); }} />
              </span>
            )}

            {isExecutiveUser && activeStatusFilter !== 'All' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#34D399',
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

      {/* Main Dynamic Table Container */}
      <div style={{ ...glassCard, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                checked={isSelectAllPages || (filtered.length > 0 && selectedLeadIds.length === filtered.length)}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#EF4444', width: '16px', height: '16px' }}
              />
              <span>Select All ({displayTotalLeads} Leads)</span>
            </label>

            {/* Right-aligned Actions: Delete Selected + Close X Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleBulkDeleteLeads}
                disabled={selectedLeadIds.length === 0 && !isSelectAllPages}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: (selectedLeadIds.length > 0 || isSelectAllPages) ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.2)',
                  color: (selectedLeadIds.length > 0 || isSelectAllPages) ? '#FFFFFF' : '#FCA5A5',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: (selectedLeadIds.length > 0 || isSelectAllPages) ? 'pointer' : 'not-allowed',
                  opacity: (selectedLeadIds.length > 0 || isSelectAllPages) ? 1 : 0.6,
                  boxShadow: (selectedLeadIds.length > 0 || isSelectAllPages) ? '0 2px 10px rgba(239, 68, 68, 0.4)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiTrash2 />
                <span>Delete Selected ({isSelectAllPages ? displayTotalLeads : selectedLeadIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDeleteMode(false);
                  setSelectedLeadIds([]);
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

        <div className="lead-register-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: '400px' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1200px' }}>
            <thead>
              <tr>
                {isUserSuperAdmin && isDeleteMode && (
                  <th style={{ ...thStyle, textAlign: 'center', width: '40px', minWidth: '40px' }} />
                )}
                <th style={{ ...thStyle, textAlign: 'center' }}>Lead ID</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Created Date</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Product</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Lead Owner</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Lead Source</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Company</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Contact Person</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Designation</th>
                <th style={{ ...thStyle, textAlign: 'center', width: '130px', minWidth: '130px' }}>Stage</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Project Value (₹)</th>
                <th style={{
                  ...thStyle,
                  textAlign: 'center',
                  width: '96px',
                  minWidth: '96px',
                  maxWidth: '96px'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody style={{ height: (filtered.length === 0 || fetchError) ? '100%' : 'auto' }}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <td colSpan={11} style={{ padding: '18px 24px' }}>
                      <div className="skeleton-box" style={{ height: '36px', borderRadius: '6px' }} />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr style={{ height: '100%' }}>
                  <td colSpan={11} style={{ padding: '60px 20px', textAlign: 'center', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '24px', marginBottom: '12px' }}>
                        <FiAlertTriangle />
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#fca5a5' }}>Failed to Load Leads from Server</div>
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
                  <td colSpan={11} style={{ padding: '70px 0', textAlign: 'center', color: 'var(--t-fg-muted)', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <FiLayers style={{ fontSize: '42px', opacity: 0.4, marginBottom: '12px' }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-fg)' }}>No Leads Available</div>
                      <div style={{ fontSize: '13px', color: 'var(--t-fg-muted)', marginTop: '4px' }}>No lead records exist on the server. Click "+ New Lead" to create one.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const prods = Array.isArray(lead.products) ? lead.products : [];
                  const primaryProduct = prods[0]?.product_name || lead.product_name || '—';
                  const prodCount = prods.length;
                  const primaryStageName = prods[0]?.stage_name || lead.stage_name || 'New';
                  const stageBadge = getStageBadgeStyle(primaryStageName);
                  const totalProjVal = prods.length > 0
                    ? prods.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0)
                    : (Number(lead.project_value) || Number(lead.value) || 0);

                  const isLeadSelected = isSelectAllPages || selectedLeadIds.includes(lead.lead_id);

                  return (
                    <tr
                      key={lead.lead_id}
                      style={{
                        borderBottom: '1px solid var(--t-border)',
                        background: isLeadSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        transition: 'background 140ms ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { if (!isLeadSelected) e.currentTarget.style.background = 'var(--t-row-hover)'; }}
                      onMouseLeave={(e) => { if (!isLeadSelected) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => setEditLeadState({ isOpen: true, lead, initialEditMode: false })}
                    >
                      {/* Checkbox */}
                      {isUserSuperAdmin && isDeleteMode && (
                        <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isLeadSelected}
                            onChange={(e) => handleToggleIndividualLead(lead.lead_id, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#EF4444', width: '15px', height: '15px' }}
                          />
                        </td>
                      )}

                      {/* Lead ID */}
                      <td style={{ ...tdStyle, fontFamily: "'Helvetica'", fontWeight: 600, color: 'var(--t-teal)', textAlign: 'center' }}>
                        #{lead.lead_id}
                      </td>

                      {/* Created Date */}
                      <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--t-fg-muted)', fontWeight: 600, textAlign: 'center' }}>
                        {formatDate(lead.created_date)}
                      </td>

                      {/* Product */}
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg)', textAlign: 'center', maxWidth: '180px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', maxWidth: '100%' }}>
                          <span
                            title={primaryProduct}
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '140px',
                              display: 'inline-block',
                              verticalAlign: 'bottom'
                            }}
                          >
                            {primaryProduct}
                          </span>
                          {prodCount > 1 && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(0, 198, 255, 0.15)',
                              color: '#00C6FF',
                              border: '1px solid rgba(0, 198, 255, 0.3)',
                              flexShrink: 0
                            }}>
                              +{prodCount - 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Lead Owner */}
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg)', textAlign: 'center' }}>
                        {lead.lead_owner_name || 'Unassigned'}
                      </td>

                      {/* Lead Source */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '76px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'var(--t-surface-alt)',
                          border: '1px solid var(--t-border)',
                          fontSize: 'clamp(12.5px, 0.75vw + 4px, 14px)',
                          textAlign: 'center',
                          whiteSpace: 'nowrap'
                        }}>
                          {lead.lead_source || '—'}
                        </span>
                      </td>

                      {/* Company / Account */}
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg)', textAlign: 'center' }}>
                        {lead.company}
                      </td>

                      {/* Contact Person */}
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg)', textAlign: 'center' }}>
                        {lead.contact_name || '—'}
                      </td>

                      {/* Designation */}
                      <td style={{ ...tdStyle, fontSize: '13px', color: 'var(--t-fg-muted)', fontWeight: 600, textAlign: 'center' }}>
                        {lead.designation || '—'}
                      </td>

                      {/* Stage */}
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '110px',
                          minWidth: '110px',
                          maxWidth: '110px',
                          padding: '4px 8px',
                          borderRadius: '5px',
                          background: stageBadge.bg,
                          color: stageBadge.color,
                          border: stageBadge.border,
                          fontSize: '12px',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          textAlign: 'center',
                          boxSizing: 'border-box'
                        }}>
                          {primaryStageName}
                        </span>
                      </td>

                      {/* Project Value */}
                      <td style={{ ...tdStyle, fontFamily: "'Helvetica'", fontWeight: 600, color: 'var(--t-fg)', textAlign: 'center' }}>
                        ₹{totalProjVal.toLocaleString('en-IN')}
                      </td>

                      {/* Row Actions */}
                      <td
                        style={{
                          ...tdStyle,
                          width: '96px',
                          minWidth: '96px',
                          maxWidth: '96px'
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => setEditLeadState({ isOpen: true, lead, initialEditMode: true })}
                            title="Edit Lead"
                            style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '6px', background: 'rgba(0, 212, 170, 0.12)', border: '1px solid rgba(0, 212, 170, 0.3)', color: '#00D4AA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', transition: 'all 0.15s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.12)'}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLead(lead)}
                            title="Delete Lead"
                            style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', transition: 'all 0.15s ease' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
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
              Showing <strong style={{ color: '#FFFFFF' }}>{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong style={{ color: '#FFFFFF' }}>{(currentPage - 1) * pageSize + filtered.length}</strong> of <strong style={{ color: 'var(--t-teal)' }}>{displayTotalLeads}</strong> leads
              <span style={{ marginLeft: '8px', color: '#64748B', fontSize: '12px' }}>
                (Page {currentPage}{displayTotalLeads && displayTotalLeads > 0 ? ` of ${Math.ceil(displayTotalLeads / pageSize)}` : ''})
              </span>
            </div>

            {/* Center & Right: Page Size & Navigation Controls */}
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

              {/* Navigation Buttons (Cached without refetching!) */}
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

      {/* 1. Edit Lead Modal */}
      <EditLeadModal
        isOpen={editLeadState.isOpen}
        lead={editLeadState.lead}
        initialEditMode={editLeadState.initialEditMode !== undefined ? editLeadState.initialEditMode : true}
        leaders={leaders}
        productsMaster={productsMaster}
        stagesMaster={stagesMaster}
        statusesMaster={statusesMaster}
        contactsMaster={contactsMaster}
        onClose={() => setEditLeadState({ isOpen: false, lead: null, initialEditMode: true })}
        onUpdated={async (updatedLead) => {
          if (updatedLead && updatedLead.lead_id) {
            setLeadsData(prev => prev.map(l => (l.lead_id === updatedLead.lead_id ? { ...l, ...updatedLead } : l)));
          }
          pageCacheRef.current = {};
          await loadLeadRegister(currentPage, true);
          showToast('success', `Lead #${updatedLead.lead_id}${updatedLead.company ? ` (${updatedLead.company})` : ''} updated successfully!`);
        }}
      />

      {/* 2. Add Product To Lead Modal */}
      <AddLeadProductModal
        isOpen={addProductState.isOpen}
        leadId={addProductState.leadId}
        productsMaster={productsMaster}
        stagesMaster={stagesMaster}
        statusesMaster={statusesMaster}
        onClose={() => setAddProductState({ isOpen: false, leadId: null })}
        onAdded={async (newProduct) => {
          pageCacheRef.current = {};
          await loadLeadRegister(currentPage, true);
          showToast('success', `Product #${newProduct.product_register_id || ''} assigned to lead #${addProductState.leadId} successfully!`);
        }}
      />

      {/* 3. Edit Lead Product Modal */}
      <EditLeadProductModal
        isOpen={editProductState.isOpen}
        leadId={editProductState.leadId}
        product={editProductState.product}
        productsMaster={productsMaster}
        stagesMaster={stagesMaster}
        statusesMaster={statusesMaster}
        onClose={() => setEditProductState({ isOpen: false, leadId: null, product: null })}
        onUpdated={async (updatedProduct) => {
          pageCacheRef.current = {};
          await loadLeadRegister(currentPage, true);
          showToast('success', `Product #${updatedProduct.product_register_id} updated successfully!`);
        }}
      />

      {/* 4. Confirm Delete Dialog */}
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
        .lead-register-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .lead-register-scroll::-webkit-scrollbar-track { background: var(--t-surface-alt); border-radius: 4px; }
        .lead-register-scroll::-webkit-scrollbar-thumb { background: var(--t-border); border-radius: 4px; }
        .lead-register-scroll::-webkit-scrollbar-thumb:hover { background: var(--t-border-strong); }
        .custom-filter-dropdown-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb { background: rgba(0, 212, 170, 0.4); border-radius: 4px; }
        .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 212, 170, 0.7); }
      `}</style>
    </div>
  );
}