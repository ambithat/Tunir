// src/components/leads/DropdownMastersTab.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getProductDropdown, createProduct, updateProduct, deleteProduct,
  getLeaderStageDropdown, createLeaderStage, updateLeaderStage, deleteLeaderStage,
  getLeadProductStatusDropdown, createLeadProductStatus, updateLeadProductStatus, deleteLeadProductStatus,
  getActivityTypeDropdown, createActivityType, updateActivityType, deleteActivityType,
  getActivityOutcomeDropdown, createActivityOutcome, updateActivityOutcome, deleteActivityOutcome,
  getActivityStatusDropdown, createActivityStatus, updateActivityStatus, deleteActivityStatus
} from '../../api/statusTypeApi';
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiX,
  FiRefreshCw,
  FiPackage,
  FiLayers,
  FiActivity,
  FiCheckCircle,
  FiBookmark,
  FiClock,
  FiSave,
  FiAlertTriangle,
  FiAlertCircle
} from 'react-icons/fi';

const MASTER_CONFIGS = [
  {
    id: 'product',
    title: 'Products Master',
    itemLabel: 'Product Name',
    quote: '“Empowering sales intelligence through next-gen product solutions.”',
    icon: FiPackage,
    color: '#00D4AA',
    fieldKey: 'product',
    placeholder: 'e.g. Zala-T16, Meglan-T, AI Captain',
    apiGet: getProductDropdown,
    apiCreate: createProduct,
    apiUpdate: updateProduct,
    apiDelete: deleteProduct
  },
  {
    id: 'leader_stage',
    title: 'Lead Stages',
    itemLabel: 'Stage Name',
    quote: '“Every great customer journey moves forward one stage at a time.”',
    icon: FiLayers,
    color: '#3B82F6',
    fieldKey: 'leader_stage',
    placeholder: 'e.g. Qualification, Negotiation, Won',
    apiGet: getLeaderStageDropdown,
    apiCreate: createLeaderStage,
    apiUpdate: updateLeaderStage,
    apiDelete: deleteLeaderStage
  },
  {
    id: 'lead_product',
    title: 'Lead Status',
    itemLabel: 'Status Name',
    quote: '“Tracking pipeline momentum and product fit across active opportunities.”',
    icon: FiBookmark,
    color: '#818CF8',
    fieldKey: 'status',
    placeholder: 'e.g. New, Contacted, Qualified',
    apiGet: getLeadProductStatusDropdown,
    apiCreate: createLeadProductStatus,
    apiUpdate: updateLeadProductStatus,
    apiDelete: deleteLeadProductStatus
  },
  {
    id: 'activity_type',
    title: 'Activity Types',
    itemLabel: 'Activity Type',
    quote: '“Meaningful client interactions build enduring business partnerships.”',
    icon: FiActivity,
    color: '#F59E0B',
    fieldKey: 'activity_type',
    placeholder: 'e.g. Call, Meeting, Demo, Site Visit',
    apiGet: getActivityTypeDropdown,
    apiCreate: createActivityType,
    apiUpdate: updateActivityType,
    apiDelete: deleteActivityType
  },
  {
    id: 'activity_outcome',
    title: 'Daily Activity Outcomes',
    itemLabel: 'Outcome Value',
    quote: '“Turning daily sales touchpoints into clear, actionable outcomes.”',
    icon: FiCheckCircle,
    color: '#10B981',
    fieldKey: 'outcome',
    placeholder: 'e.g. Positive, Interested, Closed Won',
    apiGet: getActivityOutcomeDropdown,
    apiCreate: createActivityOutcome,
    apiUpdate: updateActivityOutcome,
    apiDelete: deleteActivityOutcome
  },
  {
    id: 'activity_status',
    title: 'Daily Activity Status',
    itemLabel: 'Action Status',
    quote: '“Consistent execution and disciplined follow-through drive top performance.”',
    icon: FiClock,
    color: '#818CF8',
    fieldKey: 'action_status',
    placeholder: 'e.g. Completed, Pending, In Progress',
    apiGet: getActivityStatusDropdown,
    apiCreate: createActivityStatus,
    apiUpdate: updateActivityStatus,
    apiDelete: deleteActivityStatus
  }
];

// ── 1. Dedicated Insertion Modal ─────────────────────────────────────────────
function AddLookupModal({ config, isOpen, onClose, onAdded, showToast }) {
  const [val, setVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const modalInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setVal('');
      setErr('');
      setTimeout(() => {
        if (modalInputRef.current) modalInputRef.current.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen || !config) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const clean = val.trim();
    if (!clean) {
      setErr(`Please enter a valid ${config.itemLabel}.`);
      return;
    }

    setIsSubmitting(true);
    setErr('');
    try {
      const res = await config.apiCreate(clean);
      const addedItem = res?.data || res || {
        id: Date.now(),
        [config.fieldKey]: clean
      };
      onAdded(addedItem);
      if (showToast) {
        showToast('success', `"${clean}" successfully added to ${config.title}!`);
      }
      onClose();
    } catch (error) {
      console.error('[DropdownMastersTab] Create error:', error);
      const errMsg = error?.response?.data?.detail || error?.response?.data?.message || error?.message || 'Server error occurred.';
      setErr(`Failed to create: ${errMsg}`);
      if (showToast) {
        showToast('error', `Failed to add "${clean}" to ${config.title}: ${errMsg}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const Icon = config.icon;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100000,
      background: 'rgba(0, 0, 0, 0.78)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #0B111A)',
        border: '1px solid var(--t-border, rgba(0, 212, 170, 0.25))',
        borderRadius: '16px',
        maxWidth: '500px',
        width: '100%',
        padding: '24px',
        boxShadow: 'var(--t-card-shadow, 0 20px 50px rgba(0, 0, 0, 0.9))'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: `${config.color}20`,
              border: `1px solid ${config.color}45`,
              color: config.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              <Icon />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)' }}>
                Add New {config.itemLabel}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--t-fg-muted, #8CA0B8)', marginTop: '3px' }}>
                Create a new lookup value in {config.title}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#8CA0B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '17px'
            }}
          >
            <FiX />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit}>
          {err && (
            <div style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {err}
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              color: 'var(--t-fg-muted, #94A3B8)',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '8px'
            }}>
              {config.itemLabel.toUpperCase()}
            </label>
            <input
              ref={modalInputRef}
              type="text"
              required
              placeholder={config.placeholder}
              value={val}
              onChange={e => setVal(e.target.value)}
              style={{
                width: '100%',
                height: '46px',
                background: 'var(--t-bg, rgba(5, 8, 14, 0.95))',
                border: '1px solid var(--t-border, rgba(49, 151, 149, 0.4))',
                borderRadius: '9px',
                padding: '0 16px',
                color: 'var(--t-fg, #FFFFFF)',
                fontSize: '14.5px',
                outline: 'none',
                fontFamily: 'Inter, sans-serif'
              }}
            />
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '11px 22px',
                borderRadius: '9px',
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
                padding: '11px 24px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #009B82, #00D4AA)',
                color: '#070C12',
                border: 'none',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 12px rgba(0, 212, 170, 0.35)'
              }}
            >
              <FiSave /> {isSubmitting ? 'Saving...' : `Save ${config.itemLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 2. Dedicated Custom-Designed Delete Confirmation Modal ───────────────────
function ConfirmDeleteModal({ isOpen, item, config, onClose, onConfirm, isDeleting }) {
  if (!isOpen || !item || !config) return null;

  const itemName = item[config.fieldKey] || item.name || item.label || item.value || '';
  const itemId = item.id;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100001,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #0d131a)',
        border: '1px solid var(--t-red, rgba(239, 68, 68, 0.35))',
        borderRadius: '16px',
        maxWidth: '440px',
        width: '100%',
        padding: '28px 24px 24px',
        boxShadow: 'var(--t-card-shadow, 0 24px 60px rgba(0, 0, 0, 0.95))',
        textAlign: 'center'
      }}>
        {/* Centered Warning Icon */}
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          margin: '0 auto 16px'
        }}>
          <FiAlertTriangle />
        </div>

        {/* Centered Text */}
        <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', textAlign: 'center' }}>
          Delete Entry
        </h3>
        <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--t-fg-muted, #94a3b8)', lineHeight: 1.5, textAlign: 'center' }}>
          Are you sure you want to remove <strong style={{ color: 'var(--t-fg, #FFFFFF)' }}>"{itemName}"</strong> <span style={{ color: '#00D4AA', fontFamily: "'Helvetica'", fontWeight: 700 }}>#{itemId}</span> from {config.title}?
        </p>
        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--t-fg-subtle, #64748B)', textAlign: 'center' }}>
          This item will no longer appear in CRM dropdown selections.
        </p>

        {/* Equal Width 50/50 Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px', width: '100%' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              height: '42px',
              borderRadius: '9px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))',
              color: 'var(--t-fg-muted, #94a3b8)',
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
              background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 2px 14px rgba(239, 68, 68, 0.4)'
            }}
          >
            <FiTrash2 /> {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 3. Single Compact & Spacious Card Component ──────────────────────────────
function MasterTableCard({ config, globalSearch, onOpenAddModal, onOpenDeleteModal, showToast }) {
  const [items, setItems] = useState([]);
  const [localSearch, setLocalSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const loadData = useCallback(async (isManual = false) => {
    setIsRefreshing(true);
    try {
      const res = await config.apiGet(true); // Always fetch live data from server!
      let data = [];
      if (Array.isArray(res)) data = res;
      else if (res && Array.isArray(res.data)) data = res.data;
      setItems(data);
      setFetchError(null);
      if (isManual && showToast) {
        showToast('success', `${config.title} refreshed from server.`);
      }
    } catch (err) {
      setItems([]);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to load entries from server';
      setFetchError(errMsg);
      if (isManual && showToast) {
        showToast('error', `Failed to refresh ${config.title}: ${errMsg}`);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [config, showToast]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const getItemValue = (item) => {
    return item[config.fieldKey] || item.name || item.label || item.value || '';
  };

  const filtered = items.filter(item => {
    const q = (globalSearch || localSearch).toLowerCase().trim();
    if (!q) return true;
    const val = String(getItemValue(item)).toLowerCase();
    const id = String(item.id || '');
    return val.includes(q) || id.includes(q);
  });

  const handleSaveEdit = async (id) => {
    const val = editingText.trim();
    if (!val) return;

    try {
      // Optimistically update local items state instantly
      setItems(prev => prev.map(item => {
        const itemId = item.id;
        if (String(itemId) === String(id)) {
          return {
            ...item,
            [config.fieldKey]: val,
            name: val,
            label: val,
            value: val
          };
        }
        return item;
      }));
      setEditingId(null);

      await config.apiUpdate(id, val);
      await loadData(true); // Re-fetch live data from server!
      if (showToast) {
        showToast('success', `"${val}" in ${config.title} successfully updated!`);
      }
    } catch (err) {
      console.error('[DropdownMastersTab] Update error:', err);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Server error occurred.';
      await loadData(true); // Revert on failure
      if (showToast) {
        showToast('error', `Failed to update entry in ${config.title}: ${errMsg}`);
      }
    }
  };

  const Icon = config.icon;

  return (
    <div className="master-card" style={{
      background: 'var(--t-surface-solid, #0B111A)',
      border: '1px solid var(--t-border, rgba(0, 212, 170, 0.25))',
      borderRadius: '14px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      boxShadow: 'var(--t-card-shadow, 0 12px 40px rgba(0, 0, 0, 0.75))',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
    }}>
      {/* Card Header */}
      <div className="master-card-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: 'var(--t-surface-alt, rgba(0, 212, 170, 0.08))',
        borderBottom: '1px solid var(--t-border, rgba(0, 212, 170, 0.22))'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: `${config.color}20`,
            border: `1px solid ${config.color}45`,
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '19px',
            boxShadow: `0 0 15px ${config.color}20`,
            flexShrink: 0
          }}>
            <Icon />
          </div>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
            <div className="master-card-title" style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {config.title}
            </div>
            <div style={{
              fontSize: '11.5px',
              color: 'var(--t-fg-muted, #94A3B8)',
              fontStyle: 'italic',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {config.quote}
            </div>
          </div>
        </div>

        {/* Header Right Actions: Count, Refresh, + Add Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* <span style={{
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(0, 212, 170, 0.12)',
            border: '1px solid rgba(0, 212, 170, 0.3)',
            color: '#00D4AA',
            fontSize: '11px',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}>
            {items.length} Entries
          </span> */}
{/* 
          <button
            type="button"
            onClick={() => loadData(true)}
            title="Refresh from server"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#8CA0B8',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px'
            }}
          >
            <FiRefreshCw style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none', fontSize: '14px' }} />
          </button> */}

          <button
            type="button"
            onClick={() => onOpenAddModal(config, () => loadData(true))}
            style={{
              height: '34px',
              padding: '0 15px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #009B82, #00D4AA)',
              color: '#070C12',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 10px rgba(0, 212, 170, 0.3)',
              transition: 'all 0.16s ease'
            }}
          >
            <FiPlus style={{ strokeWidth: 3 }} /> Add
          </button>
        </div>
      </div>

      {/* Card Search / Filter Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--t-surface-alt, rgba(5, 8, 14, 0.6))',
        borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.06))'
      }}>
        <div className="um-searchbar" style={{ height: '36px', width: '100%', padding: '0 12px', background: 'var(--t-bg, #070C12)', border: '1px solid var(--t-border, rgba(0, 212, 170, 0.25))', borderRadius: '8px' }}>
          <FiSearch style={{ color: '#00D4AA', fontSize: '14px', flexShrink: 0 }} />
          <input
            className="um-search-input"
            placeholder={`Filter ${config.title.toLowerCase()}…`}
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            style={{ fontSize: '13px', color: 'var(--t-fg, #FFFFFF)' }}
          />
          {localSearch && (
            <span onClick={() => setLocalSearch('')} style={{ color: 'var(--t-fg-muted, #64748B)', cursor: 'pointer', fontSize: '12px' }}>✕</span>
          )}
        </div>
      </div>

      {/* Column Headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '75px 1fr 90px',
        alignItems: 'center',
        padding: '9px 18px',
        background: 'var(--t-surface-alt, rgba(0, 0, 0, 0.4))',
        borderBottom: '1px solid var(--t-border, rgba(0, 212, 170, 0.15))',
        color: 'var(--t-fg-muted, #64748B)',
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase'
      }}>
        <div># ID</div>
        <div>{config.itemLabel.toUpperCase()}</div>
        <div style={{ textAlign: 'right' }}>ACTIONS</div>
      </div>

      {/* 2-Column Table List */}
      <div style={{
        maxHeight: '380px',
        minHeight: '260px',
        overflowY: 'auto',
        padding: '2px 0'
      }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '75px 1fr 90px',
                alignItems: 'center',
                padding: '11px 18px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            >
              <div className="skeleton-box" style={{ width: '38px', height: '22px', borderRadius: '6px' }} />
              <div className="skeleton-box" style={{ width: '65%', height: '16px', borderRadius: '4px' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <div className="skeleton-box" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
                <div className="skeleton-box" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
              </div>
            </div>
          ))
        ) : fetchError ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#fca5a5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <FiAlertTriangle style={{ color: '#ef4444', fontSize: '22px' }} />
            <span style={{ fontSize: '13px', fontWeight: 700 }}>Failed to load entries</span>
            <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px' }}>{fetchError}</span>
            <button
              type="button"
              onClick={loadData}
              style={{
                marginTop: '4px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: 'rgba(0, 212, 170, 0.15)',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                color: '#00D4AA',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#64748B', fontSize: '13.5px' }}>
            No entries found. Click "+ Add" above to create one.
          </div>
        ) : (
          filtered.map((item, idx) => {
            const id = item.id || idx + 1;
            const val = getItemValue(item);
            const isEditing = editingId === id;

            return (
              <div
                key={id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '75px 1fr 90px',
                  alignItems: 'center',
                  padding: '11px 18px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                  transition: 'all 0.16s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 212, 170, 0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'}
              >
                {/* ID Badge */}
                <div>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: `${config.color}15`,
                    border: `1px solid ${config.color}30`,
                    color: config.color,
                    fontFamily: "'Helvetica'",
                    fontWeight: 800,
                    fontSize: '12px'
                  }}>
                    {idx + 1}
                  </span>
                </div>

                {/* Name / Value */}
                <div style={{ paddingRight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit(id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      style={{
                        width: '100%',
                        height: '32px',
                        padding: '0 10px',
                        background: 'var(--t-bg, #070C12)',
                        border: `1px solid ${config.color}`,
                        borderRadius: '6px',
                        color: 'var(--t-fg, #FFFFFF)',
                        fontSize: '13.5px',
                        outline: 'none'
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t-fg, #F1F5F9)' }}>
                      {val}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(id)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: `${config.color}25`,
                          border: `1px solid ${config.color}`,
                          color: config.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        title="Save"
                      >
                        <FiCheck />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#8CA0B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                        title="Cancel"
                      >
                        <FiX />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(id);
                          setEditingText(val);
                        }}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#8CA0B8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Edit"
                        onMouseEnter={e => {
                          e.currentTarget.style.color = '#00D4AA';
                          e.currentTarget.style.borderColor = '#00D4AA';
                          e.currentTarget.style.background = 'rgba(0, 212, 170, 0.12)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = '#8CA0B8';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenDeleteModal(item, config, () => loadData(true))}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          color: '#ef4444',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '13px',
                          transition: 'all 0.15s ease'
                        }}
                        title="Delete"
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                          e.currentTarget.style.borderColor = '#ef4444';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                        }}
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── 4. Main Single-Tab Unified Grid ──────────────────────────────────────────
export default function DropdownMastersTab() {
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Floating Toast Notification State
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((type, message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, type, message });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  }, []);

  // Dedicated Insert Modal State
  const [addModalState, setAddModalState] = useState({
    isOpen: false,
    config: null,
    onAdded: null
  });

  // Dedicated Delete Confirmation Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    item: null,
    config: null,
    onDeleted: null,
    isDeleting: false
  });

  const handleOpenAddModal = (config, onAddedCallback) => {
    setAddModalState({
      isOpen: true,
      config,
      onAdded: onAddedCallback
    });
  };

  const handleCloseAddModal = () => {
    setAddModalState({
      isOpen: false,
      config: null,
      onAdded: null
    });
  };

  const handleOpenDeleteModal = (item, config, onDeletedCallback) => {
    setDeleteModalState({
      isOpen: true,
      item,
      config,
      onDeleted: onDeletedCallback,
      isDeleting: false
    });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalState({
      isOpen: false,
      item: null,
      config: null,
      onDeleted: null,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    const { item, config, onDeleted } = deleteModalState;
    if (!item || !config) return;

    const itemName = item[config.fieldKey] || item.name || item.label || item.value || `Entry #${item.id}`;

    setDeleteModalState(prev => ({ ...prev, isDeleting: true }));
    try {
      await config.apiDelete(item.id);
      if (onDeleted) onDeleted();
      showToast('success', `"${itemName}" successfully removed from ${config.title}.`);
    } catch (err) {
      console.error('[DropdownMastersTab] Delete error:', err);
      const errMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Server error occurred.';
      showToast('error', `Failed to delete "${itemName}" from ${config.title}: ${errMsg}`);
    } finally {
      handleCloseDeleteModal();
    }
  };

  return (
    <div className="um-panel" style={{ flex: 1, minHeight: 0, height: '100%', overflowY: 'auto', padding: '20px 24px', boxSizing: 'border-box', position: 'relative' }}>
      
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
            border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            borderLeft: `5px solid ${toast.type === 'success' ? '#10B981' : '#EF4444'}`,
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(14px)',
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
              {toast.type === 'success' ? 'Operation Succeeded' : 'Operation Failed'}
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
              borderRadius: '4px',
              lineHeight: 1
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Search & Description Bar matching Leaders Directory header theme */}
      <div className="um-panel-header-wrap" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(49, 151, 149, 0.14)',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            flexShrink: 0,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
          }}>
            <FiLayers />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.01em' }}>
              Unified Dropdown Lookup Tables
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: '#64748B' }}>
              Manage catalog offerings, stages, activity classifications, and execution statuses in one place
            </p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="um-searchbar" style={{ maxWidth: '340px', minWidth: '240px', height: '42px' }}>
          <FiSearch style={{ color: '#10B981', fontSize: '16px', flexShrink: 0 }} />
          <input
            className="um-search-input"
            placeholder="Search across all tables…"
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            style={{ fontSize: '13.5px' }}
          />
          {globalSearch && (
            <span onClick={() => setGlobalSearch('')} style={{ color: '#64748B', cursor: 'pointer' }}>✕</span>
          )}
        </div>
      </div>

      {/* 6 Masters in a spacious responsive grid */}
      <div className="master-tables-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '20px',
        paddingBottom: '24px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {MASTER_CONFIGS.map(cfg => (
          <MasterTableCard
            key={cfg.id}
            config={cfg}
            globalSearch={globalSearch}
            onOpenAddModal={handleOpenAddModal}
            onOpenDeleteModal={handleOpenDeleteModal}
            showToast={showToast}
          />
        ))}
      </div>

      {/* 1. Separate Dedicated Insertion Modal */}
      <AddLookupModal
        config={addModalState.config}
        isOpen={addModalState.isOpen}
        onClose={handleCloseAddModal}
        onAdded={(newItem) => {
          if (addModalState.onAdded) {
            addModalState.onAdded(newItem);
          }
        }}
        showToast={showToast}
      />

      {/* 2. Separate Custom-Designed Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalState.isOpen}
        item={deleteModalState.item}
        config={deleteModalState.config}
        isDeleting={deleteModalState.isDeleting}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
      />

    </div>
  );
}
