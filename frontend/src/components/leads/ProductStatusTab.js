import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  FiPackage,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiAlertTriangle,
  FiCheck,
  FiAlertCircle
} from 'react-icons/fi';
import {
  getProductDropdown,
  getLeadProductStatusDropdown,
  getLeaderStageDropdown,
  getActivityTypeDropdown,
  getActivityOutcomeDropdown,
  getActivityStatusDropdown
} from '../../api/statusTypeApi';

const SCHEMAS = [
  {
    tableNumber: 4,
    schema: 'statustype',
    tableName: 'product_status_type',
    statusColumn: 'product',
    label: 'Product Master',
    shortLabel: 'Products',
    description: 'Catalog products and software/hardware offerings',
    apiGet: getProductDropdown,
    initialData: []
  },
  {
    tableNumber: 5,
    schema: 'statustype',
    tableName: 'lead_product_status',
    statusColumn: 'status',
    label: 'Lead Product Status',
    shortLabel: 'Lead Product Status',
    description: 'Pipeline product lifecycle statuses',
    apiGet: getLeadProductStatusDropdown,
    initialData: []
  },
  {
    tableNumber: 1,
    schema: 'statustype',
    tableName: 'leader_stage_status_type',
    statusColumn: 'leader_stage',
    label: 'Leader Stage Status',
    shortLabel: 'Stage Status',
    description: 'Lead pipeline stage classification',
    apiGet: getLeaderStageDropdown,
    initialData: []
  },
  {
    tableNumber: 3,
    schema: 'statustype',
    tableName: 'activity_type_status_type',
    statusColumn: 'activity_type',
    label: 'Activity Type Status',
    shortLabel: 'Activity Types',
    description: 'Activity classification types',
    apiGet: getActivityTypeDropdown,
    initialData: []
  },
  {
    tableNumber: 6,
    schema: 'statustype',
    tableName: 'daily_activity_outcome',
    statusColumn: 'outcome',
    label: 'Daily Activity Outcome',
    shortLabel: 'Activity Outcomes',
    description: 'Daily activity completion outcomes',
    apiGet: getActivityOutcomeDropdown,
    initialData: []
  },
  {
    tableNumber: 7,
    schema: 'statustype',
    tableName: 'daily_activity_status',
    statusColumn: 'action_status',
    label: 'Daily Activity Status',
    shortLabel: 'Activity Action Status',
    description: 'Operational status for daily activities',
    apiGet: getActivityStatusDropdown,
    initialData: []
  }
];

const INITIAL_STORE = SCHEMAS.reduce((acc, schema) => {
  acc[schema.tableName] = [];
  return acc;
}, {});

export default function ProductStatusTab() {
  const [store, setStore] = useState(INITIAL_STORE);
  const [selectedTableNumber, setSelectedTableNumber] = useState(4); // Default to product_status_type (#4)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

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

  const currentSchema = SCHEMAS.find(s => s.tableNumber === selectedTableNumber) || SCHEMAS[0];

  const fetchTableData = () => {
    if (currentSchema.apiGet) {
      setIsLoading(true);
      setFetchError(null);
      currentSchema.apiGet(true).then(res => {
        const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setStore(prev => ({
          ...prev,
          [currentSchema.tableName]: data
        }));
        setFetchError(null);
      }).catch((err) => {
        setStore(prev => ({
          ...prev,
          [currentSchema.tableName]: []
        }));
        setFetchError(err?.response?.data?.message || err?.message || 'Failed to load records from server.');
      }).finally(() => {
        setIsLoading(false);
      });
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [currentSchema]);

  // Modals & forms
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editRow, setEditRow] = useState(null);

  const tableData = store[currentSchema.tableName] || [];

  const filteredData = tableData.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const val = String(row[currentSchema.statusColumn] || '').toLowerCase();
    const idStr = String(row.id);
    return val.includes(q) || idStr.includes(q);
  });

  // Select first item if none selected or if selected item not in current filtered list
  const activeSelectedItem = selectedItem && tableData.some(r => r.id === selectedItem.id)
    ? selectedItem
    : (filteredData[0] || null);

  // CRUD: CREATE
  const handleCreate = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const nextId = tableData.length > 0 ? Math.max(...tableData.map(d => d.id)) + 1 : 1;
    const newEntry = {
      id: nextId,
      [currentSchema.statusColumn]: inputValue.trim()
    };

    setStore(prev => ({
      ...prev,
      [currentSchema.tableName]: [...prev[currentSchema.tableName], newEntry]
    }));

    setSelectedItem(newEntry);
    setInputValue('');
    setIsAddModalOpen(false);
    showToast('success', `"${newEntry[currentSchema.statusColumn]}" successfully added!`);
  };

  // CRUD: UPDATE
  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editRow || !inputValue.trim()) return;

    const updated = { ...editRow, [currentSchema.statusColumn]: inputValue.trim() };

    setStore(prev => ({
      ...prev,
      [currentSchema.tableName]: prev[currentSchema.tableName].map(r => r.id === editRow.id ? updated : r)
    }));

    setSelectedItem(updated);
    setEditRow(null);
    setInputValue('');
    setIsEditModalOpen(false);
    showToast('success', `"${updated[currentSchema.statusColumn]}" successfully updated!`);
  };

  // CRUD: DELETE
  const handleDelete = (idToDelete) => {
    const targetId = idToDelete || (activeSelectedItem && activeSelectedItem.id);
    if (!targetId) return;

    const targetRow = tableData.find(r => r.id === targetId);
    const targetName = targetRow ? targetRow[currentSchema.statusColumn] : `Entry #${targetId}`;

    if (window.confirm(`Delete entry #${targetId} from statustype.${currentSchema.tableName}?`)) {
      setStore(prev => ({
        ...prev,
        [currentSchema.tableName]: prev[currentSchema.tableName].filter(r => r.id !== targetId)
      }));

      if (selectedItem && selectedItem.id === targetId) {
        setSelectedItem(null);
      }
      showToast('success', `"${targetName}" successfully deleted!`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', minHeight: 0, flex: 1, overflow: 'hidden', position: 'relative' }}>

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

      {/* Panel Header */}
      <div className="um-panel-hdr um-panel-header-wrap">
        <div className="um-panel-title-wrap">
          <div className="um-panel-icon"><FiPackage /></div>
          <div>
            <h2 className="um-panel-title" style={{ fontSize: '22px' }}>Product & Status Type Master</h2>
            <p className="um-panel-sub" style={{ fontSize: '13.5px' }}>
              Manage product catalog & lookup status categories across the system
            </p>
          </div>
        </div>
        <div className="um-panel-actions">
          <button
            type="button"
            className="um-btn-primary"
            style={{ gap: '7px', fontSize: '13.5px', height: '40px', padding: '0 18px' }}
            onClick={() => {
              setInputValue('');
              setIsAddModalOpen(true);
            }}
          >
            <FiPlus style={{ fontSize: '15px' }} />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* Table Selection Filter Chips */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '6px', alignItems: 'center', scrollbarWidth: 'none' }}>
        {SCHEMAS.map(item => {
          const isActive = item.tableNumber === selectedTableNumber;
          return (
            <button
              key={item.tableName}
              type="button"
              onClick={() => {
                setSelectedTableNumber(item.tableNumber);
                setSelectedItem(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '9px',
                padding: '9px 16px',
                borderRadius: '9px',
                fontSize: '14.5px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                border: isActive ? '1px solid rgba(0, 212, 170, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                background: isActive ? 'rgba(0, 212, 170, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#00D4AA' : '#8CA0B8'
              }}
            >
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Two Column Layout matching User Management */}
      <div className="um-two-col">

        {/* Left Side List */}
        <section className="um-side-card">
          <div className="um-filter-row">
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
              {currentSchema.label}
            </div>
            {activeSelectedItem && (
              <button
                type="button"
                className="um-icon-btn um-icon-btn-danger"
                title="Delete selected item"
                onClick={() => handleDelete(activeSelectedItem.id)}
              >
                <FiTrash2 />
              </button>
            )}
          </div>

          <label className="um-searchbar" style={{ height: '44px' }}>
            <FiSearch style={{ fontSize: '16px' }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={`Search ${currentSchema.statusColumn} or ID...`}
              className="um-search-input"
              style={{ fontSize: '14px' }}
            />
            {searchQuery && (
              <FiX style={{ cursor: 'pointer', fontSize: '16px' }} onClick={() => setSearchQuery('')} />
            )}
          </label>

          <div className="um-user-list">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="um-user-row"
                  style={{
                    padding: '14px 16px',
                    gap: '14px',
                    flexShrink: 0,
                    minHeight: '56px',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <div className="skeleton-box" style={{ width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="skeleton-box" style={{ width: '50%', height: '16px', borderRadius: '4px' }} />
                      <div className="skeleton-box" style={{ width: '45px', height: '18px', borderRadius: '12px' }} />
                    </div>
                    <div className="skeleton-box" style={{ width: '35%', height: '12px', borderRadius: '4px' }} />
                  </div>
                </div>
              ))
            ) : fetchError ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                margin: '10px 0'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  fontSize: '20px'
                }}>
                  <FiAlertTriangle />
                </div>
                <div>
                  <div style={{ color: '#fca5a5', fontWeight: 800, fontSize: '14px' }}>
                    Failed to Load {currentSchema.label}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px', maxWidth: '240px', lineHeight: 1.4 }}>
                    {fetchError}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchTableData}
                  style={{
                    marginTop: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 212, 170, 0.15)',
                    border: '1px solid rgba(0, 212, 170, 0.4)',
                    color: '#00D4AA',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Retry Connection
                </button>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="um-empty-msg" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.04)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  fontSize: '20px',
                  marginBottom: '8px'
                }}>
                  <FiPackage />
                </div>
                <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: '14px' }}>
                  {searchQuery ? 'No matching entries found' : 'No entries registered yet'}
                </div>
                <div style={{ color: '#64748B', fontSize: '12.5px', marginTop: '4px' }}>
                  {searchQuery ? 'Try clearing your search query' : 'Click "+ Add New Entry" to create one.'}
                </div>
              </div>
            ) : (
              filteredData.map((row, idx) => {
                const isSelected = activeSelectedItem && activeSelectedItem.id === row.id;
                const valText = row[currentSchema.statusColumn];
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`um-user-row ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedItem(row)}
                    style={{ padding: '14px 16px', gap: '14px', flexShrink: 0, minHeight: '56px' }}
                  >
                    <div
                      className="um-avatar um-avatar-circle"
                      style={{
                        width: '40px',
                        height: '40px',
                        minWidth: '40px',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        fontFamily: "'Helvetica'",
                        background: 'rgba(0,212,170,0.15)',
                        color: '#00D4AA'
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="um-user-row-info">
                      <div className="um-user-row-top">
                        <div className="um-row-name" style={{ fontSize: '16.5px', fontWeight: 800, color: '#ffffff' }}>
                          {valText}
                        </div>
                        <span className="um-status-badge um-status-active" style={{ fontSize: '12px', padding: '4px 10px' }}>
                          <span className="um-dot" />TEXT
                        </span>
                      </div>
                      <div className="um-row-email" style={{ fontFamily: "'Helvetica'", fontSize: '13px', color: '#8CA0B8', marginTop: '3px' }}>
                        Column: {currentSchema.statusColumn}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side Details & Edit View */}
        <section className="um-edit-col">
          {isLoading ? (
            <div className="um-details-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '20px', borderBottom: '1px solid rgba(49, 151, 149, 0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="skeleton-box" style={{ width: '56px', height: '56px', borderRadius: '12px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton-box" style={{ width: '160px', height: '24px', borderRadius: '4px' }} />
                    <div className="skeleton-box" style={{ width: '100px', height: '18px', borderRadius: '12px' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="skeleton-box" style={{ width: '80px', height: '38px', borderRadius: '8px' }} />
                  <div className="skeleton-box" style={{ width: '80px', height: '38px', borderRadius: '8px' }} />
                </div>
              </div>

              <div className="um-detail-grid" style={{ gap: '14px' }}>
                <div className="um-detail-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton-box" style={{ width: '40%', height: '12px', borderRadius: '3px' }} />
                  <div className="skeleton-box" style={{ width: '60%', height: '20px', borderRadius: '4px' }} />
                </div>
                <div className="um-detail-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton-box" style={{ width: '40%', height: '12px', borderRadius: '3px' }} />
                  <div className="skeleton-box" style={{ width: '60%', height: '20px', borderRadius: '4px' }} />
                </div>
              </div>

              <div className="skeleton-box" style={{ width: '100%', height: '70px', borderRadius: '10px' }} />
            </div>
          ) : fetchError ? (
            <div className="um-empty-state" style={{ padding: '50px 24px', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <div className="um-empty-icon" style={{ width: '64px', height: '64px', fontSize: '28px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                <FiAlertTriangle />
              </div>
              <div className="um-empty-copy">
                <h3 className="um-empty-title" style={{ fontSize: '20px', color: '#fca5a5' }}>Master Service Unavailable</h3>
                <p className="um-empty-hint" style={{ fontSize: '14px', color: '#94a3b8' }}>
                  Unable to load master records from backend service.
                </p>
              </div>
              <button
                type="button"
                className="um-btn-primary"
                style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}
                onClick={fetchTableData}
              >
                Retry Connection
              </button>
            </div>
          ) : activeSelectedItem ? (
            <div className="um-details-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Item Header */}
              <div className="um-edit-user-header">
                <div className="um-edit-user-identity" style={{ gap: '16px' }}>
                  <div
                    className="um-avatar um-avatar-hero"
                    style={{
                      width: '56px',
                      height: '56px',
                      fontSize: '18px',
                      fontWeight: 800,
                      fontFamily: "'Helvetica'"
                    }}
                  >
                    #{activeSelectedItem.id}
                  </div>
                  <div>
                    <h3 className="um-edit-name" style={{ fontSize: '24px', fontWeight: 800, color: '#ffffff' }}>
                      {activeSelectedItem[currentSchema.statusColumn]}
                    </h3>
                    <div style={{ marginTop: '6px' }}>
                      <span style={{
                        fontSize: '12.5px', fontWeight: 800, padding: '4px 14px',
                        borderRadius: '999px', fontFamily: "'Inter', sans-serif",
                        color: '#00C6FF', background: 'rgba(0,198,255,0.1)', border: '1px solid rgba(0,198,255,0.22)'
                      }}>
                        {currentSchema.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="um-details-actions">
                  <button
                    type="button"
                    className="um-ghost-btn um-ghost-btn-edit"
                    style={{ height: '38px', padding: '0 16px', fontSize: '13.5px', fontWeight: 700 }}
                    onClick={() => {
                      setEditRow(activeSelectedItem);
                      setInputValue(activeSelectedItem[currentSchema.statusColumn]);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <FiEdit2 /><span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="um-ghost-btn um-ghost-btn-danger"
                    style={{ height: '38px', padding: '0 16px', fontSize: '13.5px', fontWeight: 700 }}
                    onClick={() => handleDelete(activeSelectedItem.id)}
                  >
                    <FiTrash2 /><span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Info Detail Grid */}
              <div className="um-detail-grid" style={{ gap: '14px' }}>

                {/* Record ID Card */}
                <div className="um-detail-card" style={{ padding: '16px 18px' }}>
                  <div className="um-detail-label" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em' }}>RECORD ID</div>
                  <div className="um-detail-value" style={{ fontFamily: "'Helvetica'", color: '#00D4AA', fontSize: '19.5px', fontWeight: 800, marginTop: '4px' }}>
                    #{activeSelectedItem.id}
                  </div>
                </div>

                {/* Category Card */}
                <div className="um-detail-card" style={{ padding: '16px 18px' }}>
                  <div className="um-detail-label" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em' }}>CATEGORY</div>
                  <div className="um-detail-value" style={{ color: '#00C6FF', fontSize: '18.5px', fontWeight: 800, marginTop: '4px' }}>
                    {currentSchema.label}
                  </div>
                </div>

              </div>

              {/* Clean Entry Value Card */}
              <div className="um-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 20px' }}>
                <div className="um-detail-label" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em' }}>ENTRY VALUE</div>
                <div style={{
                  fontSize: '19.5px', fontWeight: 800, color: '#ffffff',
                  fontFamily: "'Helvetica'", background: 'rgba(0, 212, 170, 0.05)',
                  padding: '16px 20px', borderRadius: '10px', border: '1px solid rgba(49, 151, 149, 0.22)'
                }}>
                  {activeSelectedItem[currentSchema.statusColumn]}
                </div>
              </div>

            </div>
          ) : (
            <div className="um-empty-state">
              <div className="um-empty-icon" style={{ width: '64px', height: '64px', fontSize: '28px' }}><FiPackage /></div>
              <div className="um-empty-copy">
                <h3 className="um-empty-title" style={{ fontSize: '20px' }}>No Item Selected</h3>
                <p className="um-empty-hint" style={{ fontSize: '14px' }}>
                  Select an entry from the list on the left to inspect, edit, or delete — or create a new entry.
                </p>
              </div>
              <button
                type="button"
                className="um-btn-primary"
                style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}
                onClick={() => {
                  setInputValue('');
                  setIsAddModalOpen(true);
                }}
              >
                <FiPlus /><span>Add New Entry</span>
              </button>
            </div>
          )}
        </section>

      </div>

      {/* CREATE MODAL matching User Management modal styling */}
      {isAddModalOpen && createPortal(
        <div className="um-modal-overlay">
          <div className="um-modal" style={{ maxWidth: '480px' }}>
            <div className="um-modal-header">
              <h3 className="um-modal-title" style={{ fontSize: '18px' }}>
                Add Entry to statustype.{currentSchema.tableName}
              </h3>
              <button
                type="button"
                className="um-modal-close"
                onClick={() => setIsAddModalOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleCreate} className="um-form" style={{ gap: '16px' }}>
              <div className="um-field">
                <label className="um-field-label" style={{ fontSize: '12px', fontWeight: 700 }}>Target Table</label>
                <input
                  disabled
                  value={`statustype.${currentSchema.tableName}`}
                  className="um-input"
                  style={{ opacity: 0.7, fontSize: '14px' }}
                />
              </div>

              <div className="um-field">
                <label className="um-field-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  {currentSchema.statusColumn} Value (TEXT NOT NULL) *
                </label>
                <input
                  required
                  placeholder={`Enter ${currentSchema.statusColumn} text...`}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  className="um-input"
                  style={{ fontSize: '14px', height: '44px' }}
                  autoFocus
                />
              </div>

              <div className="um-modal-actions">
                <button
                  type="button"
                  className="um-btn-muted"
                  style={{ height: '40px', fontSize: '13.5px' }}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="um-btn-primary" style={{ height: '40px', fontSize: '13.5px' }}>
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EDIT MODAL matching User Management modal styling */}
      {isEditModalOpen && editRow && createPortal(
        <div className="um-modal-overlay">
          <div className="um-modal" style={{ maxWidth: '480px' }}>
            <div className="um-modal-header">
              <h3 className="um-modal-title" style={{ fontSize: '18px' }}>
                Edit Entry #{editRow.id} in statustype.{currentSchema.tableName}
              </h3>
              <button
                type="button"
                className="um-modal-close"
                onClick={() => setIsEditModalOpen(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="um-form" style={{ gap: '16px' }}>
              <div className="um-field">
                <label className="um-field-label" style={{ fontSize: '12px', fontWeight: 700 }}>id (INTEGER PRIMARY KEY)</label>
                <input
                  disabled
                  value={`#${editRow.id}`}
                  className="um-input"
                  style={{ opacity: 0.7, fontSize: '14px' }}
                />
              </div>

              <div className="um-field">
                <label className="um-field-label" style={{ fontSize: '12px', fontWeight: 700 }}>
                  {currentSchema.statusColumn} Value (TEXT NOT NULL) *
                </label>
                <input
                  required
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  className="um-input"
                  style={{ fontSize: '14px', height: '44px' }}
                  autoFocus
                />
              </div>

              <div className="um-modal-actions">
                <button
                  type="button"
                  className="um-btn-muted"
                  style={{ height: '40px', fontSize: '13.5px' }}
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="um-btn-primary" style={{ height: '40px', fontSize: '13.5px' }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
