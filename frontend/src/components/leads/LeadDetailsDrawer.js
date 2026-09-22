import React, { useState, useEffect } from 'react';
import {
  FiX,
  FiUser,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiGlobe,
  FiPackage,
  FiCalendar,
  FiCheckCircle,
  FiActivity,
  FiPlus,
  FiFileText,
  FiPaperclip,
  FiExternalLink,
  FiAlertCircle
} from 'react-icons/fi';
import { getLeadersDropdown } from '../../api/leaderApi';
import { updateLead } from '../../api/leadApi';
import { formatCountryDisplay } from '../../utils/countryData';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/authRoles';

const isLostStage = (stageName) => {
  if (!stageName) return false;
  const s = String(stageName).toLowerCase();
  return s.includes('lost') || s.includes('drop');
};

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
    } catch (_) {}
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

const handleOpenProposalDoc = (url) => {
  if (!url) return;
  const fullUrl = getProposalDocumentUrl(url);
  if (fullUrl) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
};

const parseProposalUrls = (urlStr) => {
  if (!urlStr) return [];
  return String(urlStr)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

const getProposalEntries = (item, parentLead = null) => {
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

const getProposalFileName = (url) => {
  if (!url) return 'Proposal Document';
  const parts = String(url).split('/');
  return parts[parts.length - 1] || 'Proposal Document';
};

export default function LeadDetailsDrawer({
  lead,
  isOpen,
  onClose,
  onUpdateLeadStage,
  onUpdateLeadOwner,
  onAddActivity,
  onLeadUpdated
}) {
  const { user } = useAuth();
  const isAdminOrSuperAdmin = isAdmin(user);
  const [newActivityType, setNewActivityType] = useState('Follow up call');
  const [newActivityNotes, setNewActivityNotes] = useState('');
  const [leaders, setLeaders] = useState([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [localIsActive, setLocalIsActive] = useState(lead?.is_active !== false);

  useEffect(() => {
    setLocalIsActive(lead?.is_active !== false);
  }, [lead]);

  const handleToggleActiveStatus = async () => {
    if (!lead || isUpdatingStatus) return;
    const targetLeadId = lead.lead_id || lead.id;
    const nextStatus = !localIsActive;
    setIsUpdatingStatus(true);
    try {
      await updateLead(targetLeadId, { is_active: nextStatus });
      setLocalIsActive(nextStatus);
      if (lead) lead.is_active = nextStatus;
      if (onLeadUpdated) onLeadUpdated(targetLeadId, nextStatus);
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to update lead active status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !lead) return;
    getLeadersDropdown(false).then(res => {
      const raw = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setLeaders(raw.filter(l => l.is_active !== false));
    }).catch(() => { });
  }, [isOpen, lead]);

  useEffect(() => {
    setNewActivityNotes('');
  }, [lead]);

  if (!isOpen || !lead) return null;

  // Normalized getters
  const leadId = lead.lead_id || lead.id || 'Lead';
  const companyName = lead.company || lead.account || 'Account';
  const ownerName = lead.lead_owner_name || lead.owner || 'Unassigned';
  const contactPerson = lead.contact_name || lead.contact || '—';
  const designation = lead.designation || '';
  const email = lead.email || '—';
  const phone = lead.phone_no || lead.phone || '—';
  const country = lead.country || '—';
  const source = lead.lead_source || '—';
  const products = Array.isArray(lead.products) ? lead.products : [];

  // Metrics
  const totalProjectValue = products.length > 0
    ? products.reduce((acc, p) => acc + (Number(p.project_value) || 0), 0)
    : (Number(lead.value) || Number(lead.project_value) || 0);

  const totalWonRevenue = products.length > 0
    ? products.reduce((acc, p) => acc + (Number(p.won) || 0), 0)
    : (Number(lead.won) || 0);



  const cardStyle = {
    background: 'var(--t-surface-alt)',
    border: '1px solid var(--t-border)',
    borderRadius: '12px',
    padding: '16px'
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <style>{`
        .lead-details-drawer-panel {
          width: 440px;
          max-width: 100vw;
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .lead-details-drawer-panel {
            width: min(480px, 85vw) !important;
          }
        }
        @media (max-width: 640px) {
          .lead-details-drawer-panel {
            width: 100vw !important;
          }
        }
      `}</style>
      <div className="lead-details-drawer-panel" style={{
        height: '100vh',
        background: 'var(--t-surface-solid, #070C12)',
        borderLeft: '1px solid var(--t-border)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-20px 0 50px rgba(0,0,0,0.85)',
        overflowY: 'auto'
      }}>

        {/* Header */}
        <div style={{
          padding: '22px 26px',
          borderBottom: '1px solid var(--t-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--t-surface-alt, rgba(13, 20, 31, 0.95))',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Helvetica'", fontSize: '13px', color: 'var(--t-teal)', fontWeight: 800 }}>
                #{leadId}
              </span>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                background: localIsActive ? 'rgba(0, 212, 170, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: localIsActive ? '#00D4AA' : '#EF4444',
                border: `1px solid ${localIsActive ? 'rgba(0, 212, 170, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {localIsActive ? 'ACTIVE LEAD' : 'INACTIVE'}
              </span>
              {isAdminOrSuperAdmin && (
                <button
                  type="button"
                  onClick={handleToggleActiveStatus}
                  disabled={isUpdatingStatus}
                  title={localIsActive ? "Deactivate Lead" : "Make Lead Active"}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '5px',
                    background: localIsActive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 212, 170, 0.18)',
                    border: localIsActive ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(0, 212, 170, 0.4)',
                    color: localIsActive ? '#F87171' : '#00D4AA',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                    marginLeft: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FiCheckCircle style={{ fontSize: '12px' }} />
                  <span>{isUpdatingStatus ? 'Updating...' : (localIsActive ? 'Deactivate' : 'Activate Lead')}</span>
                </button>
              )}
            </div>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '22px', fontWeight: 800, color: 'var(--t-fg)', marginTop: '4px' }}>
              {companyName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--t-fg-muted)',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--t-fg-muted)'}
          >
            <FiX />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>

          {/* Core Info KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={cardStyle}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--t-fg-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Total Project Value
              </div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '24px', fontWeight: 800, color: 'var(--t-fg)', marginTop: '6px' }}>
                ₹{totalProjectValue.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#00D4AA', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                Won Revenue
              </div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '24px', fontWeight: 800, color: totalWonRevenue > 0 ? '#00D4AA' : 'var(--t-fg-muted)', marginTop: '6px' }}>
                ₹{totalWonRevenue.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Details Table Card */}
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--t-border)', fontWeight: 800, fontSize: '13px', color: 'var(--t-fg)' }}>
              Lead Information
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 700 }}>Lead Owner:</span>
              <span style={{ fontWeight: 700, color: 'var(--t-fg)' }}>{ownerName}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 700 }}>Lead Source:</span>
              <span style={{ color: 'var(--t-fg)' }}>{source}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 700 }}>Contact Person:</span>
              <span style={{ fontWeight: 700, color: 'var(--t-fg)' }}>
                {contactPerson} {designation ? `(${designation})` : ''}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 700 }}>Email / Phone:</span>
              <span style={{ color: 'var(--t-cyan)', fontFamily: "'Helvetica'", fontSize: '12.5px' }}>
                {email} {phone && phone !== '—' ? `· ${phone}` : ''}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 700 }}>Country:</span>
              <span style={{ color: 'var(--t-fg)' }}>{formatCountryDisplay(country)}</span>
            </div>

            {(lead.proposals?.length > 0 || lead.proposal_document_url || lead.proposal_url || lead.proposal_link || lead.quotation_link || lead.quotation_url || products.some(p => (p.stage_name || p.status_name || '').toLowerCase().includes('proposal') || p.proposal_document_url || p.proposal_url || p.proposal_link || (p.proposals && p.proposals.length > 0))) && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '12px 18px', fontSize: '13.5px', background: 'rgba(0, 198, 255, 0.04)', borderBottom: '1px solid var(--t-border)' }}>
                <span style={{ color: '#00C6FF', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px' }}>
                  <FiFileText /> Proposals:
                </span>
                <div>
                  {(() => {
                    const leadProposals = getProposalEntries(lead).length > 0 ? getProposalEntries(lead) : (products.length > 0 ? products.flatMap(p => getProposalEntries(p)) : []);
                    if (leadProposals.length > 0) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {leadProposals.map((pEntry, uIdx) => (
                            <div key={uIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', background: 'rgba(0, 198, 255, 0.06)', border: '1px solid rgba(0, 198, 255, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FiFileText style={{ color: '#00C6FF', fontSize: '13px' }} />
                                <span style={{ fontWeight: 700, color: '#00C6FF', fontSize: '12px' }}>{pEntry.proposal_type || 'Proposal Sent'}</span>
                                {pEntry.proposal_sent_id && <span style={{ fontSize: '10.5px', color: '#94A3B8', fontFamily: "'Helvetica'" }}>({pEntry.proposal_sent_id})</span>}
                              </div>
                              {pEntry.proposal_document_url ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '5px',
                                    background: 'rgba(0, 212, 170, 0.18)',
                                    border: '1px solid rgba(0, 212, 170, 0.4)',
                                    color: '#00D4AA',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <FiPaperclip /> View ({getProposalFileName(pEntry.proposal_document_url)}) <FiExternalLink style={{ fontSize: '11px' }} />
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>No document</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return <span style={{ color: '#00C6FF', fontWeight: 700, fontSize: '12px' }}>Proposal Sent (No link attached)</span>;
                  })()}
                </div>
              </div>
            )}

            {/* Assigned Products Register List */}
            <div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--t-fg-muted)', marginBottom: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiPackage style={{ color: '#00D4AA' }} /> Assigned Products Register
              </div>

              {products.length === 0 ? (
                <div style={{ ...cardStyle, textAlign: 'center', color: 'var(--t-fg-muted)', fontSize: '13px', padding: '24px' }}>
                  No products registered for this lead.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {products.map((p, pIdx) => {
                    const prodDocUrl = p.proposal_document_url || p.proposal_url || p.proposal_link || p.quotation_link || p.quotation_url || p.document_url || p.file_url || p.link || lead.proposal_document_url || lead.proposal_url || lead.proposal_link || lead.quotation_link || lead.quotation_url;
                    const isProposalStage = (p.stage_name || p.status_name || '').toLowerCase().includes('proposal') || Boolean(p.proposal_type) || Boolean(prodDocUrl);

                    return (
                      <div
                        key={p.product_register_id || pIdx}
                        style={{
                          ...cardStyle,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          padding: '14px 16px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: "'Helvetica'", fontSize: '11.5px', color: '#00D4AA', fontWeight: 800 }}>
                              {p.product_register_id || `#${pIdx + 1}`}
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>
                              {p.product_name || `Product #${p.product_id}`}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)', fontWeight: 600 }}>
                              ×{p.quantity || 1}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: "'Helvetica'", fontSize: '15px', fontWeight: 800, color: 'var(--t-fg)' }}>
                              ₹{Number(p.project_value || 0).toLocaleString('en-IN')}
                            </div>
                            {Number(p.won) > 0 ? (
                              <div style={{ fontSize: '11px', color: '#00D4AA', fontWeight: 800, marginTop: '2px' }}>
                                Won: ₹{Number(p.won).toLocaleString('en-IN')}
                              </div>
                            ) : (
                              <div style={{ fontSize: '11px', color: 'var(--t-fg-muted)', marginTop: '2px' }}>
                                {p.risk_matrix || 'Open'}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px', marginTop: '6px', fontSize: '12px', color: 'var(--t-fg-muted)' }}>
                          <span>Stage: <strong style={{ color: '#FFFFFF' }}>{p.stage_name || `Stage #${p.stage_id || '—'}`}</strong></span>
                          <span>•</span>
                          <span>Status: <strong style={{ color: '#FFFFFF' }}>{p.status_name || `Status #${p.status_id || '—'}`}</strong></span>
                          {(() => {
                            const closureVal = p.expected_closure || lead?.expected_closure || lead?.expectedClosure || lead?.expected_closure_date;
                            if (!closureVal) return null;
                            const formatted = String(closureVal).split('T')[0];
                            return (
                              <>
                                <span>•</span>
                                <span>Closure: <strong style={{ color: '#00C6FF' }}>{formatted}</strong></span>
                              </>
                            );
                          })()}
                        </div>

                        {(isProposalStage || prodDocUrl || p.proposal_type || (lead?.proposals && lead.proposals.length > 0)) && (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            marginTop: '8px',
                            padding: '8px 10px',
                            background: 'rgba(0, 198, 255, 0.08)',
                            border: '1px solid rgba(0, 198, 255, 0.28)',
                            borderRadius: '6px'
                          }}>
                            {getProposalEntries(p, lead).map((pEntry, pIdx) => (
                              <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <FiFileText style={{ color: '#00C6FF', fontSize: '13px' }} />
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#00C6FF' }}>
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
                                      padding: '4px 9px',
                                      borderRadius: '5px',
                                      background: 'rgba(0, 212, 170, 0.18)',
                                      border: '1px solid rgba(0, 212, 170, 0.4)',
                                      color: '#00D4AA',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      maxWidth: '100%',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    <FiPaperclip style={{ flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', display: 'inline-block' }}>
                                      View Proposal ({getProposalFileName(pEntry.proposal_document_url)})
                                    </span>
                                    <FiExternalLink style={{ fontSize: '11px', flexShrink: 0 }} />
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>
                                    (No document link attached)
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {(isLostStage(p.stage_name) || p.lost_reason) && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: '8px',
                            padding: '4px 8px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '6px',
                            width: 'fit-content'
                          }}>
                            <FiAlertCircle style={{ color: '#EF4444', fontSize: '12px' }} />
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#F87171' }}>
                              Lost Reason: {p.lost_reason || 'Lost'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
