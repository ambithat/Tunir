import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createLead, uploadLeadProposal } from '../../api/leadApi';
import { getLeadersDropdown } from '../../api/leaderApi';
import {
  getProductDropdown,
  getLeaderStageDropdown,
  getLeadProductStatusDropdown
} from '../../api/statusTypeApi';
import { getContactsDropdown, getContactById } from '../../api/contactApi';
import { COUNTRY_OPTIONS, getPhoneRulesForCountry, validatePhoneNumber } from '../../utils/countryData';
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiUser,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiGlobe,
  FiCalendar,
  FiPackage,
  FiCheckCircle,
  FiLayers,
  FiChevronDown,
  FiCheck,
  FiSearch,
  FiFileText,
  FiUploadCloud,
  FiPaperclip,
  FiAlertCircle
} from 'react-icons/fi';

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

// ── Custom Glassmorphic Select Component ─────────────────────────────────────
function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  icon: Icon = null,
  height = '42px',
  searchable = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
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

  // Normalize options array
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
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          height: height,
          padding: '0 14px',
          borderRadius: '8px',
          border: isOpen ? '1px solid var(--t-teal, #00D4AA)' : '1px solid var(--t-border, rgba(49, 151, 149, 0.35))',
          background: disabled ? 'var(--t-surface-alt, rgba(5, 8, 14, 0.6))' : 'var(--t-surface-solid, rgba(5, 8, 14, 0.95))',
          color: selectedOpt ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)',
          fontSize: '13.5px',
          fontFamily: "'Inter', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.85 : 1,
          boxShadow: isOpen ? '0 0 14px rgba(0, 212, 170, 0.25)' : 'none',
          transition: 'all 0.16s ease',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {Icon && <Icon style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '14px', flexShrink: 0 }} />}
          {selectedOpt?.color && (
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedOpt.color, flexShrink: 0 }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedOpt ? 'var(--t-fg, #FFFFFF)' : 'var(--t-fg-muted, #64748B)', fontWeight: selectedOpt ? 600 : 400 }}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
          {selectedOpt?.sublabel && (
            <span style={{ fontSize: '11px', color: 'var(--t-fg-subtle, #8CA0B8)', background: 'var(--t-surface-alt, rgba(255,255,255,0.06))', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
              {selectedOpt.sublabel}
            </span>
          )}
        </div>
        <FiChevronDown
          style={{
            fontSize: '15px',
            color: isOpen ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg-muted, #8CA0B8)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s ease',
            flexShrink: 0
          }}
        />
      </button>

      {/* Popover Dropdown Menu */}
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
          backdropFilter: 'blur(14px)',
          animation: 'slideIn 0.15s ease'
        }}>
          {searchable && normalizedOptions.length > 5 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--t-surface-alt, rgba(0,0,0,0.5))', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--t-border, rgba(49, 151, 149, 0.25))', height: '30px' }}>
                <FiSearch style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '12px' }} />
                <input
                  type="text"
                  autoFocus
                  placeholder="Filter options..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--t-fg, #FFF)',
                    fontSize: '12px',
                    width: '100%',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ maxHeight: '210px', overflowY: 'auto', padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 14px', color: 'var(--t-fg-muted, #64748B)', fontSize: '12.5px', textAlign: 'center' }}>
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
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: isSelected ? 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))' : 'transparent',
                      color: isSelected ? 'var(--t-teal, #00D4AA)' : 'var(--t-fg, #E2E8F0)',
                      fontSize: '13px',
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
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: opt.color }} />
                      )}
                      <span>{opt.label}</span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '11px', color: 'var(--t-fg-subtle, #8CA0B8)', background: 'var(--t-surface-alt, rgba(255,255,255,0.06))', padding: '1px 5px', borderRadius: '4px' }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && <FiCheck style={{ color: '#00D4AA', fontSize: '14px' }} />}
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

// ── Main AddLeadModal Component ──────────────────────────────────────────────
export default function AddLeadModal({ isOpen, onClose, onAddLead }) {
  // Main Lead Information Form State
  const [form, setForm] = useState({
    lead_owner_id: '',
    lead_source: '',
    company: '',
    contact_name: '',
    designation: '',
    phone_no: '',
    phone_no_2: '',
    email: '',
    country: 'India',
    region: '',
    is_active: true
  });

  // Assigned Products List State
  const [assignedProducts, setAssignedProducts] = useState([]);

  // Live Dropdown Master States
  const [leaders, setLeaders] = useState([]);
  const [productsMaster, setProductsMaster] = useState([]);
  const [stagesMaster, setStagesMaster] = useState([]);
  const [statusesMaster, setStatusesMaster] = useState([]);
  const [contactsMaster, setContactsMaster] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [isFetchingContact, setIsFetchingContact] = useState(false);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAssigningForSomeone, setIsAssigningForSomeone] = useState(false);

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

  // Compute matched logged-in user leader object ID from leaders master
  const resolvedMyOwnerId = useMemo(() => {
    if (!currentUserObj || !Array.isArray(leaders) || leaders.length === 0) {
      return loggedInUserId || '';
    }
    const myId = String(currentUserObj.leader_id || currentUserObj.user_id || currentUserObj.emp_id || currentUserObj.id || '').trim().toLowerCase();
    const myEmail = String(currentUserObj.email || '').trim().toLowerCase();
    const myFirstName = String(currentUserObj.first_name || currentUserObj.name || '').trim().toLowerCase();
    const myLastName = String(currentUserObj.last_name || '').trim().toLowerCase();
    const myFullName = `${myFirstName} ${myLastName}`.trim().toLowerCase();

    const matched = leaders.find(l => {
      const lId = String(l.leader_id || l.user_id || l.emp_id || l.id || '').trim().toLowerCase();
      const lEmail = String(l.email || '').trim().toLowerCase();
      const lName = String(l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim().toLowerCase();
      const lFirstName = String(l.first_name || '').trim().toLowerCase();

      if (myId && lId === myId) return true;
      if (myEmail && lEmail && (lEmail === myEmail || (myFirstName && lEmail.includes(myFirstName)))) return true;
      if (myFullName && myFullName.length > 2 && (lName === myFullName || lName.includes(myFullName) || myFullName.includes(lName))) return true;
      if (myFirstName && myFirstName.length > 2 && (lName.includes(myFirstName) || lFirstName === myFirstName)) return true;
      return false;
    });

    return matched ? String(matched.leader_id || matched.emp_id || matched.id) : (loggedInUserId || String(leaders[0]?.leader_id || leaders[0]?.emp_id || ''));
  }, [currentUserObj, leaders, loggedInUserId]);

  // Fetch Dropdown Options only when modal is open and not yet loaded (avoids duplicate API calls)
  useEffect(() => {
    if (!isOpen) return;

    // If masters already loaded, just ensure form and default products are set when modal opens
    if (leaders.length > 0 && productsMaster.length > 0 && stagesMaster.length > 0 && statusesMaster.length > 0) {
      setErrorMsg('');
      if (!isAssigningForSomeone && resolvedMyOwnerId) {
        setForm(prev => ({ ...prev, lead_owner_id: resolvedMyOwnerId }));
      } else if (!form.lead_owner_id && leaders.length > 0) {
        setForm(prev => ({ ...prev, lead_owner_id: resolvedMyOwnerId || String(leaders[0].leader_id || leaders[0].emp_id || '') }));
      }
      if (assignedProducts.length === 0 && productsMaster.length > 0) {
        setAssignedProducts([
          {
            product_id: productsMaster[0]?.id || 1,
            quantity: 1,
            stage_id: stagesMaster[0]?.id || 1,
            status_id: (statusesMaster.find(st => String(st.status || '').toLowerCase().includes('contacted')) || statusesMaster[0])?.id || 1,
            project_value: '',
            expected_closure: '',
            proposal_type: 'Technical Proposal Sent',
            proposal_file: null,
            lost_reason: '',
            is_active: true
          }
        ]);
      }
      return;
    }

    setErrorMsg('');
    setIsLoadingDropdowns(true);

    Promise.allSettled([
      getLeadersDropdown(false),
      getProductDropdown(false),
      getLeaderStageDropdown(false),
      getLeadProductStatusDropdown(false),
      getContactsDropdown()
    ]).then(([leadersRes, productsRes, stagesRes, statusesRes, contactsRes]) => {
      // 1. Leaders Dropdown (Active only)
      let leadList = [];
      if (leadersRes.status === 'fulfilled' && leadersRes.value) {
        const raw = Array.isArray(leadersRes.value.data) ? leadersRes.value.data : (Array.isArray(leadersRes.value) ? leadersRes.value : []);
        leadList = raw.filter(l => l.is_active !== false);
        setLeaders(leadList);

        const myId = String(currentUserObj?.leader_id || currentUserObj?.user_id || currentUserObj?.emp_id || currentUserObj?.id || '').trim().toLowerCase();
        const myEmail = String(currentUserObj?.email || '').trim().toLowerCase();
        const myFirstName = String(currentUserObj?.first_name || currentUserObj?.name || '').trim().toLowerCase();
        const myLastName = String(currentUserObj?.last_name || '').trim().toLowerCase();
        const myFullName = `${myFirstName} ${myLastName}`.trim().toLowerCase();

        const myLeader = leadList.find(l => {
          const lId = String(l.leader_id || l.user_id || l.emp_id || l.id || '').trim().toLowerCase();
          const lEmail = String(l.email || '').trim().toLowerCase();
          const lName = String(l.full_name || l.name || `${l.first_name || ''} ${l.last_name || ''}`).trim().toLowerCase();
          const lFirstName = String(l.first_name || '').trim().toLowerCase();

          if (myId && lId === myId) return true;
          if (myEmail && lEmail && (lEmail === myEmail || (myFirstName && lEmail.includes(myFirstName)))) return true;
          if (myFullName && myFullName.length > 2 && (lName === myFullName || lName.includes(myFullName) || myFullName.includes(lName))) return true;
          if (myFirstName && myFirstName.length > 2 && (lName.includes(myFirstName) || lFirstName === myFirstName)) return true;
          return false;
        });

        const defaultId = myLeader ? String(myLeader.leader_id || myLeader.emp_id || myLeader.id) : (loggedInUserId || String(leadList[0]?.leader_id || leadList[0]?.emp_id || ''));
        setForm(prev => ({ ...prev, lead_owner_id: defaultId }));
      }

      // 2. Products Master Dropdown
      let prodList = [];
      if (productsRes.status === 'fulfilled' && productsRes.value) {
        const raw = Array.isArray(productsRes.value.data) ? productsRes.value.data : (Array.isArray(productsRes.value) ? productsRes.value : []);
        prodList = [...raw].sort((a, b) => {
          const nameA = String(a?.product || a?.product_name || a?.name || a || '').trim();
          const nameB = String(b?.product || b?.product_name || b?.name || b || '').trim();
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base', numeric: true });
        });
        setProductsMaster(prodList);
      }

      // 3. Stages Master Dropdown
      let stageList = [];
      if (stagesRes.status === 'fulfilled' && stagesRes.value) {
        stageList = Array.isArray(stagesRes.value.data) ? stagesRes.value.data : (Array.isArray(stagesRes.value) ? stagesRes.value : []);
        setStagesMaster(stageList);
      }

      // 4. Statuses Master Dropdown
      let statusList = [];
      if (statusesRes.status === 'fulfilled' && statusesRes.value) {
        statusList = Array.isArray(statusesRes.value.data) ? statusesRes.value.data : (Array.isArray(statusesRes.value) ? statusesRes.value : []);
        setStatusesMaster(statusList);
      }

      // 5. Contacts Master Dropdown
      if (contactsRes && contactsRes.status === 'fulfilled' && contactsRes.value) {
        const rawC = Array.isArray(contactsRes.value.data) ? contactsRes.value.data : (Array.isArray(contactsRes.value) ? contactsRes.value : []);
        setContactsMaster(rawC);
      }

      // Initialize default single product row if empty
      if (assignedProducts.length === 0 && prodList.length > 0) {
        setAssignedProducts([
          {
            product_id: prodList[0]?.id || 1,
            quantity: 1,
            stage_id: stageList[0]?.id || 1,
            status_id: (statusList.find(st => String(st.status || '').toLowerCase().includes('contacted')) || statusList[0])?.id || 1,
            project_value: '',
            expected_closure: '',
            proposal_type: 'Technical Proposal Sent',
            proposal_file: null,
            lost_reason: '',
            is_active: true
          }
        ]);
      }
    }).finally(() => {
      setIsLoadingDropdowns(false);
    });
  }, [isOpen, leaders.length, productsMaster.length, stagesMaster.length, statusesMaster.length]);

  // Add another proposal entry inside a product row
  const handleAddProposalEntry = (productIdx) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || [
        { proposal_type: pRow.proposal_type || 'Technical Proposal Sent', proposal_file: pRow.proposal_file || null, proposal_document_url: null }
      ];
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

  // Remove a proposal entry inside a product row
  const handleRemoveProposalEntry = (productIdx, proposalIdx) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || [];
      if (currentProposals.length > 1) {
        const nextProposals = currentProposals.filter((_, i) => i !== proposalIdx);
        updated[productIdx] = {
          ...pRow,
          proposals: nextProposals,
          proposal_type: nextProposals[0]?.proposal_type || 'Technical Proposal Sent',
          proposal_file: nextProposals[0]?.proposal_file || null
        };
      }
      return updated;
    });
  };

  // Update a proposal entry field (proposal_type, proposal_file, etc.)
  const handleUpdateProposalEntry = (productIdx, proposalIdx, field, value) => {
    setAssignedProducts(prev => {
      const updated = [...prev];
      const pRow = updated[productIdx];
      const currentProposals = pRow.proposals || [
        { proposal_type: pRow.proposal_type || 'Technical Proposal Sent', proposal_file: pRow.proposal_file || null, proposal_document_url: null }
      ];
      const newProposals = [...currentProposals];
      newProposals[proposalIdx] = {
        ...newProposals[proposalIdx],
        [field]: value
      };
      updated[productIdx] = {
        ...pRow,
        proposals: newProposals
      };
      if (proposalIdx === 0) {
        if (field === 'proposal_type') updated[productIdx].proposal_type = value;
        if (field === 'proposal_file') updated[productIdx].proposal_file = value;
      }
      return updated;
    });
  };

  // Add another product row
  const handleAddProductRow = () => {
    setAssignedProducts(prev => [
      ...prev,
      {
        product_id: productsMaster[0]?.id || 1,
        quantity: 1,
        stage_id: stagesMaster[0]?.id || 1,
        status_id: (statusesMaster.find(st => String(st.status || '').toLowerCase().includes('contacted')) || statusesMaster[0])?.id || 1,
        project_value: '',
        expected_closure: '',
        proposal_type: 'Technical Proposal Sent',
        proposal_file: null,
        lost_reason: '',
        is_active: true
      }
    ]);
  };

  // Remove a product row
  const handleRemoveProductRow = (index) => {
    setAssignedProducts(prev => prev.filter((_, idx) => idx !== index));
  };

  // Update specific product row field
  const handleProductRowChange = (index, field, value) => {
    setAssignedProducts(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      let valToSet = (field === 'quantity' || field === 'product_id' || field === 'stage_id' || field === 'status_id')
        ? (parseInt(value, 10) || 0)
        : (field === 'is_active' ? Boolean(value) : value);

      if (field === 'project_value') {
        if (value === '' || value === null || value === undefined) {
          valToSet = '';
        } else {
          const clean = String(value).replace(/[^0-9.]/g, '');
          valToSet = clean;
        }
      }

      const updated = {
        ...item,
        [field]: valToSet
      };

      const curStageId = field === 'stage_id' ? valToSet : updated.stage_id;
      const selStage = stagesMaster.find(s => String(s.id) === String(curStageId));

      if (field === 'stage_id') {
        const lost = isLostStage(selStage?.leader_stage, curStageId, stagesMaster);
        if (lost && !updated.lost_reason) {
          updated.lost_reason = 'Price / Budget constraint';
        } else if (!lost) {
          updated.lost_reason = '';
        }
      }

      const prob = getStageProbability(selStage?.leader_stage, curStageId, stagesMaster);
      updated.probability = prob;

      const projVal = updated.project_value !== '' && updated.project_value !== null && !isNaN(Number(updated.project_value))
        ? Math.max(0, Number(updated.project_value))
        : 0;

      updated.pipeline = projVal * (prob / 100);
      updated.won = prob === 100 ? projVal : 0;

      return updated;
    }));
  };

  // Submit and Create Lead via POST /api/v1/leads
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.contact_name || !form.contact_name.trim()) {
      setErrorMsg('Contact Person is mandatory. Please select a contact or enter a contact person name.');
      return;
    }

    if (!form.company || !form.company.trim()) {
      setErrorMsg('Company Name is mandatory. Please enter a company name.');
      return;
    }

    if (!form.phone_no || !form.phone_no.trim()) {
      setErrorMsg('Primary Phone Number is mandatory. Please enter a primary phone number.');
      return;
    }

    // Country-specific mobile number validation
    const p1Err = validatePhoneNumber(form.phone_no, form.country || 'India', 'Primary Phone Number');
    if (p1Err) {
      setErrorMsg(p1Err);
      return;
    }
    const p2Err = validatePhoneNumber(form.phone_no_2, form.country || 'India', 'Secondary Phone Number');
    if (p2Err) {
      setErrorMsg(p2Err);
      return;
    }

    if (!form.email || !form.email.trim()) {
      setErrorMsg('Email Address is mandatory. Please enter an email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setErrorMsg('Please enter a valid Email Address (e.g. contact@navy.gov.in).');
      return;
    }

    setIsSubmitting(true);

    // Prepare exact backend schema payload
    const payload = {
      company: String(form.company).trim(),
      is_active: Boolean(form.is_active),
      products: assignedProducts.map(p => {
        const selStage = stagesMaster.find(sm => sm.id === p.stage_id);
        const isLost = isLostStage(selStage?.leader_stage, p.stage_id, stagesMaster);
        const finalLostReason = isLost ? (p.lost_reason ? String(p.lost_reason).trim() : 'Lost') : null;

        const prodItem = {
          product_id: parseInt(p.product_id, 10) || 0,
          quantity: Math.max(1, parseInt(p.quantity, 10) || 1),
          status_id: parseInt(p.status_id, 10) || 0,
          stage_id: parseInt(p.stage_id, 10) || 0,
          project_value: p.project_value !== '' && p.project_value !== null && !isNaN(Number(p.project_value)) ? Number(p.project_value) : 0,
          expected_closure: p.expected_closure ? String(p.expected_closure).trim() : null,
          is_active: p.is_active !== undefined ? Boolean(p.is_active) : true
        };
        if (p.proposal_type) prodItem.proposal_type = String(p.proposal_type).trim();
        if (finalLostReason) prodItem.lost_reason = finalLostReason;
        return prodItem;
      })
    };

    if (form.lead_owner_id && String(form.lead_owner_id).trim()) payload.lead_owner_id = String(form.lead_owner_id).trim();
    if (form.lead_source && String(form.lead_source).trim()) payload.lead_source = String(form.lead_source).trim();
    if (form.contact_name && String(form.contact_name).trim()) payload.contact_name = String(form.contact_name).trim();
    if (form.designation && String(form.designation).trim()) payload.designation = String(form.designation).trim();
    if (form.phone_no && String(form.phone_no).trim()) payload.phone_no = String(form.phone_no).trim();
    if (form.phone_no_2 && String(form.phone_no_2).trim()) payload.phone_no_2 = String(form.phone_no_2).trim();
    if (form.email && String(form.email).trim()) payload.email = String(form.email).trim();
    payload.country = form.country && String(form.country).trim() ? String(form.country).trim() : 'India';
    if (form.region && String(form.region).trim()) payload.region = String(form.region).trim();

    try {
      const res = await createLead(payload);
      const createdLead = res?.data || res || {
        lead_id: Date.now(),
        created_date: new Date().toISOString(),
        ...payload
      };

      // Upload proposal files for any products that had proposal entries
      const createdProducts = createdLead?.products || [];
      for (let i = 0; i < assignedProducts.length; i++) {
        const prod = assignedProducts[i];
        const proposalsList = prod.proposals || (prod.proposal_file ? [{ proposal_type: prod.proposal_type, proposal_file: prod.proposal_file }] : []);
        if (proposalsList.length > 0) {
          const matchedProd = createdProducts[i] || createdProducts.find(cp => cp.product_id === prod.product_id);
          const prId = matchedProd?.product_register_id;
          const uploadedUrls = [];
          const uploadedTypes = [];
          for (const entry of proposalsList) {
            if (entry.proposal_file) {
              try {
                const upRes = await uploadLeadProposal({
                  file: entry.proposal_file,
                  proposal_type: entry.proposal_type || 'Technical Proposal Sent',
                  lead_id: createdLead?.lead_id || undefined,
                  product_register_id: prId || undefined
                });
                const url = upRes?.proposal_document_url || upRes?.data?.proposal_document_url || upRes?.url || upRes?.data?.url;
                if (url) {
                  uploadedUrls.push(url);
                  uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
                }
              } catch (uploadErr) {
                console.error('[AddLeadModal] Proposal upload failed:', uploadErr);
              }
            } else if (entry.proposal_document_url) {
              uploadedUrls.push(entry.proposal_document_url);
              uploadedTypes.push(entry.proposal_type || 'Technical Proposal Sent');
            }
          }
          if (matchedProd && uploadedUrls.length > 0) {
            matchedProd.proposal_document_url = uploadedUrls.join(', ');
            matchedProd.proposal_type = uploadedTypes.join(', ');
            matchedProd.proposals = proposalsList.map((p, pIdx) => ({
              proposal_type: p.proposal_type || 'Technical Proposal Sent',
              proposal_document_url: uploadedUrls[pIdx] || p.proposal_document_url || null
            }));
          }
        }
      }

      if (onAddLead) {
        onAddLead(createdLead);
      }
      onClose();
    } catch (err) {
      console.error('[AddLeadModal] Failed to insert lead:', err);
      setErrorMsg(formatApiError(err, 'Failed to insert lead.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '42px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid var(--t-border, rgba(49, 151, 149, 0.35))',
    background: 'var(--t-surface-solid, rgba(5, 8, 14, 0.95))',
    color: 'var(--t-fg, #FFFFFF)',
    fontSize: '13.5px',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 800,
    color: 'var(--t-fg-muted, #94A3B8)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--t-scrim, rgba(0, 0, 0, 0.75))',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
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
        width: '100%',
        maxWidth: '820px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: 'var(--t-card-shadow, 0 24px 60px rgba(0, 0, 0, 0.95))',
        color: 'var(--t-fg, #FFFFFF)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--t-border, rgba(49, 151, 149, 0.2))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.45))'
        }}>
          <div>
            <div style={{ fontSize: '11.5px', letterSpacing: '0.15em', color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', fontWeight: 800 }}>
              Lead Register System
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', marginTop: '2px' }}>
              Create New Lead Entry
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))',
              background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.05))',
              color: 'var(--t-fg-muted, #8CA0B8)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#EF4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--t-surface-alt, rgba(255, 255, 255, 0.05))'; e.currentTarget.style.color = 'var(--t-fg-muted, #8CA0B8)'; }}
          >
            <FiX />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {errorMsg && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px'
            }}>
              {errorMsg}
            </div>
          )}

          {/* Section 1: Core Company & Contact Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Contact Person *</label>
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
                        country: 'India',
                        region: ''
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
                  options={[
                    { value: '__ADD_NEW__', label: '+ Add New Contact', sublabel: 'Manual Text Entry' },
                    ...contactsMaster.map(c => ({
                      value: String(c.contact_id || c.id),
                      label: c.contact_name || 'Contact',
                      sublabel: c.company ? c.company : (c.email || c.phone_no_1 || '')
                    }))
                  ]}
                  value={selectedContactId}
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
                        country: 'India',
                        region: ''
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
                          phone_no_2: (target.phone_no_2 || prev.phone_no_2 || '').replace(/\D/g, ''),
                          email: target.email || prev.email,
                          country: target.country || prev.country,
                          region: target.region || prev.region
                        }));
                      }
                    } catch (err) {
                      console.error('[AddLeadModal] Contact auto-fill error:', err);
                    } finally {
                      setIsFetchingContact(false);
                    }
                  }}
                  placeholder="Select Contact or Add New..."
                  searchable={true}
                  icon={FiUser}
                />
              )}
            </div>
            <div>
              <label style={labelStyle}><FiBriefcase /> Company Name *</label>
              <input
                required
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. Indian Navy / GRSE Ltd."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 2: Primary Phone & Secondary Phone side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><FiPhone /> Phone Number (Primary) *</label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={getPhoneRulesForCountry(form.country || 'India').maxDigits}
                value={form.phone_no}
                onChange={(e) => setForm({ ...form, phone_no: e.target.value.replace(/\D/g, '').slice(0, getPhoneRulesForCountry(form.country || 'India').maxDigits) })}
                placeholder={`e.g. Mobile number (${getPhoneRulesForCountry(form.country || 'India').label})`}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}><FiPhone /> Phone Number 2 (Secondary)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={getPhoneRulesForCountry(form.country || 'India').maxDigits}
                value={form.phone_no_2}
                onChange={(e) => setForm({ ...form, phone_no_2: e.target.value.replace(/\D/g, '').slice(0, getPhoneRulesForCountry(form.country || 'India').maxDigits) })}
                placeholder={`e.g. Secondary number (${getPhoneRulesForCountry(form.country || 'India').label})`}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 3: Email Address & Designation / Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><FiMail /> Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. contact@navy.gov.in"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Designation / Role</label>
              <input
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. Procurement Director"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Row 4: Country & Region / Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              />
            </div>
            <div>
              <label style={labelStyle}><FiGlobe /> Region / Area</label>
              <input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                placeholder="e.g. North Zone / New Delhi"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Section 2: Owner, Source & Financials */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Lead Owner</label>
               
               {/* dont touch it - it's for future use */}
               
                {/* {!isCeoOrCfo && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isAssigningForSomeone;
                      setIsAssigningForSomeone(next);
                      if (!next && resolvedMyOwnerId) {
                        setForm(prev => ({ ...prev, lead_owner_id: resolvedMyOwnerId }));
                      }
                    }}
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
                    {isAssigningForSomeone ? 'Reset to My Account' : 'Assign for someone else'}
                  </button>
                )} */}
              </div>
              <CustomSelect
                value={form.lead_owner_id || resolvedMyOwnerId}
                onChange={(val) => setForm({ ...form, lead_owner_id: val })}
                options={leaders.map(l => ({
                  value: String(l.leader_id || l.emp_id || l.id),
                  label: l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || String(l.leader_id || l.emp_id),
                  sublabel: l.designation || 'Leader'
                }))}
                placeholder="Select Lead Owner..."
                searchable={true}
                icon={FiUser}
                disabled={!isAssigningForSomeone}
              />
            </div>
            <div>
              <label style={labelStyle}>Lead Source</label>
              <input
                value={form.lead_source}
                onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                placeholder="e.g. Direct, Website, Referral"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Section 3: Assigned Products with Commercials */}
          <div style={{
            background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.35))',
            border: '1px solid var(--t-border, rgba(49, 151, 149, 0.22))',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiPackage style={{ color: 'var(--t-teal, #00D4AA)', fontSize: '16px' }} />
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)' }}>
                  Assigned Product & Commercials
                </span>
              </div>
              {/* 
              <button
                type="button"
                onClick={handleAddProductRow}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: 'var(--t-teal-tint, rgba(0, 212, 170, 0.15))',
                  border: '1px solid var(--t-border, rgba(0, 212, 170, 0.35))',
                  color: 'var(--t-teal, #00D4AA)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiPlus /> Add Product
              </button>
              */}
            </div>

            {assignedProducts.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t-fg-muted, #64748B)', fontSize: '13px' }}>
                No products assigned yet. Click "+ Add Product" to assign a product line.
              </div>
            ) : (
              assignedProducts.map((pRow, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: 'var(--t-surface-alt, rgba(5, 8, 14, 0.85))',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))'
                  }}
                >
                  {/* Row 1: Product, Qty, Stage, Status, Delete */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 80px 1.4fr 1.4fr 36px',
                    gap: '10px',
                    alignItems: 'center'
                  }}>
                    {/* 1. Custom Product Dropdown */}
                    <div>
                      <label style={{ fontSize: '11px', color: '#8CA0B8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Product *
                      </label>
                      <CustomSelect
                        value={pRow.product_id}
                        onChange={(val) => handleProductRowChange(idx, 'product_id', val)}
                        options={productsMaster.map(p => ({ value: p.id, label: p.product }))}
                        placeholder="Select Product..."
                        height="38px"
                        searchable={true}
                      />
                    </div>

                    {/* 2. Quantity */}
                    <div>
                      <label style={{ fontSize: '11px', color: '#8CA0B8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={pRow.quantity}
                        onChange={(e) => handleProductRowChange(idx, 'quantity', e.target.value)}
                        style={{ ...inputStyle, height: '38px', fontSize: '13px', textAlign: 'center' }}
                      />
                    </div>

                    {/* 3. Custom Stage Dropdown */}
                    <div>
                      <label style={{ fontSize: '11px', color: '#8CA0B8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Stage
                      </label>
                      <CustomSelect
                        value={pRow.stage_id}
                        onChange={(val) => handleProductRowChange(idx, 'stage_id', val)}
                        options={stagesMaster.map(s => ({ value: s.id, label: s.leader_stage }))}
                        placeholder="Select Stage..."
                        height="38px"
                        searchable={false}
                      />
                    </div>

                    {/* 4. Custom Status Dropdown */}
                    <div>
                      <label style={{ fontSize: '11px', color: '#8CA0B8', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                        Status
                      </label>
                      <CustomSelect
                        value={pRow.status_id}
                        onChange={(val) => handleProductRowChange(idx, 'status_id', val)}
                        options={statusesMaster
                          .filter(st => {
                            const s = String(st.status || st.status_name || st.name || '').toLowerCase().trim();
                            return s.includes('contacted') || s.includes('proposal');
                          })
                          .map(st => ({ value: st.id, label: st.status }))
                        }
                        placeholder="Select Status..."
                        height="38px"
                        searchable={false}
                      />
                    </div>

                  
                   
                  </div>

                  {/* Row 2: Individual Product Project Value & Expected Closure Date */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <div>
                      <label style={{ fontSize: '11px', color: '#00D4AA', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#00D4AA' }}>₹</span> Project Value (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={pRow.project_value}
                        onKeyDown={e => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                        onChange={(e) => {
                          const cleanVal = e.target.value.replace(/[^0-9.]/g, '');
                          handleProductRowChange(idx, 'project_value', cleanVal);
                        }}
                        placeholder="e.g. 5000000"
                        style={{ ...inputStyle, height: '38px', fontSize: '13px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', color: '#00C6FF', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <FiCalendar /> Expected Closure Date
                      </label>
                      <input
                        type="date"
                        value={pRow.expected_closure}
                        onChange={(e) => handleProductRowChange(idx, 'expected_closure', e.target.value)}
                        onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                        style={{ ...inputStyle, height: '38px', fontSize: '13px', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Proposal Details if Status is Proposal Sent */}
                  {(() => {
                    const selSt = statusesMaster.find(st => String(st.id) === String(pRow.status_id));
                    if (!isProposalStatus(selSt?.status, pRow.status_id)) return null;

                    const proposalsList = pRow.proposals || [
                      { proposal_type: pRow.proposal_type || 'Technical Proposal Sent', proposal_file: pRow.proposal_file || null, proposal_document_url: null }
                    ];

                    return (
                      <div style={{
                        background: 'rgba(0, 198, 255, 0.05)',
                        border: '1px solid rgba(0, 198, 255, 0.25)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        marginTop: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        {/* Header with Title & + Add Another Proposal Button */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00C6FF', fontSize: '13px', fontWeight: 800 }}>
                            <FiFileText /> Proposal Details
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddProposalEntry(idx)}
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
                        {proposalsList.map((pEntry, pIdx) => (
                          <div key={pIdx} style={{ background: 'rgba(4, 8, 14, 0.5)', border: '1px solid rgba(0, 198, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#00C6FF', fontWeight: 700 }}>
                              <span>Proposal #{pIdx + 1}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
                              <div>
                                <label style={{ fontSize: '11px', color: '#00C6FF', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                  Proposal Type *
                                </label>
                                <CustomSelect
                                  value={pEntry.proposal_type || 'Technical Proposal Sent'}
                                  onChange={(val) => handleUpdateProposalEntry(idx, pIdx, 'proposal_type', val)}
                                  options={PROPOSAL_TYPE_OPTIONS}
                                  height="38px"
                                  searchable={false}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', color: '#00C6FF', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                                  Upload Proposal File
                                </label>
                                {pEntry.proposal_file ? (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0, 212, 170, 0.12)', border: '1px solid rgba(0, 212, 170, 0.35)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', color: '#00D4AA', height: '38px', boxSizing: 'border-box' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      <FiPaperclip /> <strong>{pEntry.proposal_file.name}</strong>
                                    </div>
                                    <FiX style={{ cursor: 'pointer', color: '#EF4444', marginLeft: '6px' }} onClick={() => handleUpdateProposalEntry(idx, pIdx, 'proposal_file', null)} />
                                  </div>
                                ) : (
                                  <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    padding: '0 10px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px dashed rgba(0, 212, 170, 0.4)',
                                    color: '#00D4AA',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxSizing: 'border-box'
                                  }}>
                                    <FiUploadCloud style={{ fontSize: '14px' }} /> Upload Document
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                      style={{ display: 'none' }}
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          handleUpdateProposalEntry(idx, pIdx, 'proposal_file', e.target.files[0]);
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Row 4: Lost Reason if Stage is Lost */}
                  {(() => {
                    const selStage = stagesMaster.find(s => String(s.id) === String(pRow.stage_id));
                    if (!isLostStage(selStage?.leader_stage, pRow.stage_id, stagesMaster)) return null;

                    return (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '8px',
                        padding: '12px 14px',
                        marginTop: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontSize: '12px', fontWeight: 800 }}>
                          <FiAlertCircle /> Lost Reason *
                        </div>
                        <input
                          type="text"
                          list={`addlead-lost-reasons-${idx}`}
                          value={pRow.lost_reason || ''}
                          onChange={(e) => handleProductRowChange(idx, 'lost_reason', e.target.value)}
                          placeholder="Select or enter reason for loss..."
                          style={{ ...inputStyle, height: '38px', fontSize: '13px', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                        />
                        <datalist id={`addlead-lost-reasons-${idx}`}>
                          {COMMON_LOST_REASONS.map(r => (
                            <option key={r} value={r} />
                          ))}
                        </datalist>
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>

          {/* Form Actions Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 22px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94a3b8',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '11px 28px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #009B82, #00D4AA)',
                color: '#070C12',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 14px rgba(0, 212, 170, 0.35)'
              }}
            >
              <FiCheckCircle /> {isSubmitting ? 'Creating Lead...' : 'Insert Lead'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
