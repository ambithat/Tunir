// src/components/contacts/ContactsView.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FiSearch,
  FiFilter,
  FiDownload,
  FiPlus,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiUser,
  FiBriefcase,
  FiPhone,
  FiMail,
  FiGlobe,
  FiEdit2,
  FiEye,
  FiTrash2,
  FiCheck,
  FiX,
  FiColumns,
  FiAlertTriangle,
  FiSave,
  FiMapPin,
  FiCalendar,
  FiAlertCircle,
  FiRotateCcw,
  FiCheckCircle
} from 'react-icons/fi';
import {
  getContacts,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  deleteAllContacts
} from '../../api/contactApi';
import { COUNTRY_OPTIONS, formatCountryDisplay, getPhoneRulesForCountry, validatePhoneNumber } from '../../utils/countryData';
import CountrySelect from '../common/CountrySelect';
import { useAuth } from '../../context/AuthContext';
import { isExecutive, isSuperAdmin, hasAdminAccess } from '../../utils/authRoles';
import { getDateRangeParams } from '../../utils/dateUtils';

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

const ALL_COLUMNS = [
  { key: 'contact_id', label: 'Contact ID', defaultVisible: true },
  { key: 'contact_name', label: 'Contact Person', defaultVisible: true },
  { key: 'company', label: 'Company', defaultVisible: true },
  { key: 'designation', label: 'Designation', defaultVisible: true },
  { key: 'phone_no_1', label: 'Primary Phone', defaultVisible: true },
  { key: 'phone_no_2', label: 'Secondary Phone', defaultVisible: false },
  { key: 'email', label: 'Email Address', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: true },
  { key: 'region', label: 'Region', defaultVisible: false },
  { key: 'is_active', label: 'Status', defaultVisible: true },
  { key: 'created_at', label: 'Created Date', defaultVisible: true }
];

// ── Edit Contact Modal (PATCH /api/v1/contacts/{contact_id} with diff) ───────
function EditContactModal({ isOpen, contact, initialEditMode = true, onClose, onUpdated }) {
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [form, setForm] = useState({
    company: '',
    contact_name: '',
    designation: '',
    phone_no_1: '',
    phone_no_2: '',
    email: '',
    country: '',
    region: '',
    is_active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && contact) {
      setIsEditMode(initialEditMode);
      setForm({
        company: contact.company || '',
        contact_name: contact.contact_name || contact.contactName || '',
        designation: contact.designation || '',
        phone_no_1: contact.phone_no_1 || contact.phone1 || '',
        phone_no_2: contact.phone_no_2 || contact.phone2 || '',
        email: contact.email || '',
        country: contact.country || '',
        region: contact.region || '',
        is_active: contact.is_active !== undefined ? Boolean(contact.is_active) : true
      });
      setErrorMsg('');
    }
  }, [isOpen, contact, initialEditMode]);

  const hasChanges = useMemo(() => {
    if (!contact) return false;
    return (
      String(form.company || '').trim() !== String(contact.company || '').trim() ||
      String(form.contact_name || '').trim() !== String(contact.contact_name || contact.contactName || '').trim() ||
      String(form.designation || '').trim() !== String(contact.designation || '').trim() ||
      String(form.phone_no_1 || '').trim() !== String(contact.phone_no_1 || contact.phone1 || '').trim() ||
      String(form.phone_no_2 || '').trim() !== String(contact.phone_no_2 || contact.phone2 || '').trim() ||
      String(form.email || '').trim() !== String(contact.email || '').trim() ||
      String(form.country || '').trim() !== String(contact.country || 'India').trim() ||
      String(form.region || '').trim() !== String(contact.region || '').trim() ||
      Boolean(form.is_active) !== (contact.is_active !== undefined ? Boolean(contact.is_active) : true)
    );
  }, [form, contact]);

  if (!isOpen || !contact) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.company.trim()) return setErrorMsg('Company name is required.');
    if (!form.contact_name.trim()) return setErrorMsg('Contact person name is required.');
    if (!form.phone_no_1.trim()) return setErrorMsg('Primary phone number is required.');

    const p1Err = validatePhoneNumber(form.phone_no_1, form.country || 'India', 'Primary phone number');
    if (p1Err) return setErrorMsg(p1Err);

    const p2Err = validatePhoneNumber(form.phone_no_2, form.country || 'India', 'Secondary phone number');
    if (p2Err) return setErrorMsg(p2Err);

    if (!form.email.trim()) return setErrorMsg('Email is required.');

    setIsSubmitting(true);

    const diff = {};
    if (form.company.trim() !== (contact.company || '')) diff.company = form.company.trim();
    if (form.contact_name.trim() !== (contact.contact_name || contact.contactName || '')) diff.contact_name = form.contact_name.trim();
    if (form.designation.trim() !== (contact.designation || '')) diff.designation = form.designation.trim() || null;
    if (form.phone_no_1.trim() !== (contact.phone_no_1 || contact.phone1 || '')) diff.phone_no_1 = form.phone_no_1.trim();
    if (form.phone_no_2.trim() !== (contact.phone_no_2 || contact.phone2 || '')) diff.phone_no_2 = form.phone_no_2.trim() || null;
    if (form.email.trim() !== (contact.email || '')) diff.email = form.email.trim();
    if (form.country.trim() !== (contact.country || '')) diff.country = form.country.trim() || null;
    if (form.region.trim() !== (contact.region || '')) diff.region = form.region.trim() || null;
    if (form.is_active !== (contact.is_active !== undefined ? Boolean(contact.is_active) : true)) diff.is_active = form.is_active;

    const contactId = contact.contact_id || contact.id;

    try {
      if (Object.keys(diff).length > 0) {
        await updateContact(contactId, diff);
      }
      onUpdated({ ...contact, ...form });
      onClose();
    } catch (err) {
      console.error('[EditContactModal] Failed to patch contact:', err);
      setErrorMsg(formatApiError(err, 'Failed to update contact. Please check your inputs.'));
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
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11.5px',
    fontWeight: 800,
    color: 'var(--t-fg-muted, #94A3B8)',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--t-scrim, rgba(0, 0, 0, 0.75))', backdropFilter: 'blur(10px)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--t-surface-solid, #090e15)', border: '1px solid var(--t-border, rgba(0, 212, 170, 0.35))', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--t-card-shadow, 0 24px 60px rgba(0, 0, 0, 0.95))', color: 'var(--t-fg, #FFFFFF)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--t-border, rgba(49, 151, 149, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.45))', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', fontWeight: 800 }}>
              Contact #{contact.contact_id || contact.id}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px', color: 'var(--t-fg, #FFFFFF)' }}>
              {isEditMode ? 'Edit Contact Details' : 'Contact Details'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                title="Edit Contact"
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
                <FiEdit2 /> Edit Contact
              </button>
            ) : (
              <span style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
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

        {isEditMode ? (
          <form onSubmit={handleSubmit} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
            {errorMsg && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}><FiBriefcase /> Company *</label>
                <input required value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}><FiUser /> Contact Name *</label>
                <input required value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}><FiMail /> Email Address *</label>
                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Designation</label>
                <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}><FiPhone /> Primary Phone *</label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  maxLength={getPhoneRulesForCountry(form.country || 'India').maxDigits}
                  value={form.phone_no_1}
                  onChange={e => setForm({ ...form, phone_no_1: e.target.value.replace(/\D/g, '').slice(0, getPhoneRulesForCountry(form.country || 'India').maxDigits) })}
                  placeholder={`e.g. Mobile number (${getPhoneRulesForCountry(form.country || 'India').label})`}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}><FiPhone /> Secondary Phone</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={getPhoneRulesForCountry(form.country || 'India').maxDigits}
                  value={form.phone_no_2}
                  onChange={e => setForm({ ...form, phone_no_2: e.target.value.replace(/\D/g, '').slice(0, getPhoneRulesForCountry(form.country || 'India').maxDigits) })}
                  placeholder={`e.g. Secondary number (${getPhoneRulesForCountry(form.country || 'India').label})`}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Country</label>
                <CountrySelect
                  value={form.country || 'India'}
                  onChange={val => setForm({ ...form, country: val })}
                  height="42px"
                />
              </div>
              <div>
                <label style={labelStyle}><FiMapPin /> Region</label>
                <input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
              <input
                type="checkbox"
                id="is_active_check"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#00D4AA', cursor: 'pointer' }}
              />
              <label htmlFor="is_active_check" style={{ fontSize: '13px', color: 'var(--t-fg, #E2E8F0)', cursor: 'pointer', fontWeight: 600 }}>
                Active Contact Status
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
              <button type="button" onClick={() => setIsEditMode(false)} style={{ padding: '9px 22px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#FFFFFF', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer' }}>Cancel Edit</button>
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
                <FiSave /> {isSubmitting ? 'Saving...' : 'Update Contact'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Company</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '4px' }}>{form.company || '—'}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Contact Person</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '4px' }}>{form.contact_name || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Designation</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t-fg, #E2E8F0)', marginTop: '4px' }}>{form.designation || '—'}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Email Address</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t-teal, #00D4AA)', marginTop: '4px' }}>{form.email || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Primary Phone</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '4px', fontFamily: "'Helvetica'" }}>{form.phone_no_1 || '—'}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Secondary Phone</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t-fg, #E2E8F0)', marginTop: '4px', fontFamily: "'Helvetica'" }}>{form.phone_no_2 || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Country</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t-fg, #FFFFFF)', marginTop: '4px' }}>{formatCountryDisplay(form.country || 'India')}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Region</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t-fg, #E2E8F0)', marginTop: '4px' }}>{form.region || '—'}</div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.03))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted, #94A3B8)', fontWeight: 800, textTransform: 'uppercase' }}>Status</div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: form.is_active ? 'rgba(0, 212, 170, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: form.is_active ? '#00D4AA' : '#ef4444',
                    border: form.is_active ? '1px solid rgba(0, 212, 170, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--t-surface-alt, rgba(255, 255, 255, 0.05))', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))', color: 'var(--t-fg-muted, #94a3b8)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Confirmation Dialog ───────────────────────────────────────────────
function ConfirmDeleteDialog({ isOpen, title, message, onClose, onConfirm, isDeleting }) {
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100002, background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--t-surface-solid, #0d131a)', border: '1px solid var(--t-red, rgba(239, 68, 68, 0.35))', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '28px 24px 24px', boxShadow: 'var(--t-card-shadow, 0 24px 60px rgba(0, 0, 0, 0.95))', textAlign: 'center' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 16px' }}>
          <FiAlertTriangle />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', textAlign: 'center' }}>{title || 'Delete Confirmation'}</h3>
        <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--t-fg-muted, #94a3b8)', lineHeight: 1.5, textAlign: 'center' }}>
          {message}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px', width: '100%' }}>
          <button type="button" onClick={onClose} style={{ width: '100%', height: '42px', borderRadius: '9px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--t-border, rgba(255, 255, 255, 0.12))', color: 'var(--t-fg-muted, #94a3b8)', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cancel</button>
          <button type="button" disabled={isDeleting} onClick={onConfirm} style={{ width: '100%', height: '42px', borderRadius: '9px', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', color: '#FFFFFF', border: 'none', fontSize: '13.5px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 14px rgba(239, 68, 68, 0.4)' }}>
            <FiTrash2 /> {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      const val = opt.value !== undefined ? opt.value : (opt.id !== undefined ? opt.id : '');
      const lbl = opt.label || String(val);
      return {
        value: val,
        label: lbl,
        sublabel: opt.sublabel || '',
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
            <div style={{ padding: '8px', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 10px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(0, 212, 170, 0.3)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div className="custom-filter-dropdown-scroll" style={{ maxHeight: '170px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 212, 170, 0.4) rgba(0, 0, 0, 0.2)' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                No options found
              </div>
            ) : (
              filteredOptions.map((opt, i) => {
                const isSel = String(opt.value) === String(value);
                return (
                  <div
                    key={i}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    style={{
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      background: isSel ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                      color: isSel ? '#00D4AA' : '#E2E8F0',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease'
                    }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                      {opt.color && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                      )}
                      <span style={{ fontWeight: isSel ? 700 : 400, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                          ({opt.sublabel})
                        </span>
                      )}
                    </div>
                    {isSel && <FiCheck style={{ color: '#00D4AA', fontSize: '14px', flexShrink: 0 }} />}
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

// ── Main ContactsView Component with Page-Caching & has_more Driven Pagination ──
export default function ContactsView({ onOpenAddContact, refreshKey, lastAction }) {
  const { user } = useAuth();
  const isExecutiveUser = isExecutive(user);
  const isUserSuperAdmin = isSuperAdmin(user);

  const [contactsData, setContactsData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');    // debounced — drives filtering & server calls
  const [searchInput, setSearchInput] = useState('');     // raw typed value — bound to <input>
  const [isSearchingServer, setIsSearchingServer] = useState(false); // server search in-flight

  // Unified Filters state
  const [statusFilter, setStatusFilter] = useState('Active');
  const [countryFilter, setCountryFilter] = useState('All Countries');
  const [createdDateFilter, setCreatedDateFilter] = useState('all');
  const [createdFromDate, setCreatedFromDate] = useState('');
  const [createdToDate, setCreatedToDate] = useState('');
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

  // In-Memory Page Cache (Ref): Holds fetched pages so navigating forward/back NEVER refetches
  const pageCacheRef = useRef({});

  // Dynamic Column Visibility State
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

  // Modals state
  const [editModalState, setEditModalState] = useState({ isOpen: false, contact: null, initialEditMode: true });
  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    isDeleting: false,
    onConfirm: null
  });

  // Persistent cursor map per page number: { 1: null, 2: 'CNT-0071', 3: 'CNT-0120', ... }
  const pageCursorMapRef = useRef({ 1: null });

  // Fetch paginated contacts with In-Memory Page Caching & has_more tracking
  const loadContacts = useCallback(async (page = 1, forceRefresh = false, searchOverride = undefined) => {
    const activeSearch = searchOverride !== undefined ? searchOverride : searchQuery;
    const activeFilterKey = statusFilter || 'All';
    const cacheKey = `p_${page}_sz_${pageSize}_st_${activeFilterKey}_ct_${countryFilter}_dt_${createdDateFilter}__${createdFromDate}_${createdToDate}_q_${activeSearch.trim()}`;

    // 1. Check if this page data already exists in our client cache
    if (!forceRefresh && pageCacheRef.current[cacheKey]) {
      const cached = pageCacheRef.current[cacheKey];
      setContactsData(cached.data);
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
      const prevPageKey = `p_${page - 1}_sz_${pageSize}_st_${activeFilterKey}_ct_${countryFilter}_dt_${createdDateFilter}_${createdFromDate}_${createdToDate}_q_${activeSearch.trim()}`;
      const prevCached = pageCacheRef.current[prevPageKey];
      const cursor = page > 1 ? (pageCursorMapRef.current[page] || prevCached?.next_cursor || null) : null;

      const isActiveParam = statusFilter === 'All' ? null : (statusFilter === 'Active' ? true : false);

      const dateParams = getDateRangeParams(createdDateFilter, createdFromDate, createdToDate);

      const params = {
        limit: pageSize,
        cursor: cursor,
        is_active: isActiveParam,
        search: activeSearch.trim() || null,
        country: countryFilter !== 'All Countries' ? countryFilter : null,
        from_date: dateParams.from_date,
        to_date: dateParams.to_date
      };

      const res = await getContacts(params);
      const items = res.data || res.items || [];
      const has_more = res.has_more !== undefined ? res.has_more : (items.length >= pageSize);
      const total = res.total !== undefined ? res.total : items.length;

      if (res.next_cursor) {
        pageCursorMapRef.current[page + 1] = res.next_cursor;
      }

      pageCacheRef.current[cacheKey] = {
        data: items,
        has_more: has_more,
        total: total,
        next_cursor: res.next_cursor || null
      };

      setContactsData(items);
      setTotalCount(total);
      setHasMore(Boolean(has_more));
      setCurrentPage(page);
      setFetchError(null);
    } catch (err) {
      console.error('[ContactsView] Load contacts error:', err);
      setFetchError(formatApiError(err, 'Failed to fetch contacts directory.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, isExecutiveUser, statusFilter, pageSize, countryFilter, createdDateFilter, createdFromDate, createdToDate]);

  // Initial Data Loading Hook
  useEffect(() => {
    loadContacts(1);
  }, [loadContacts]);

  // Debounced search trigger (resets page back to 1 and clears pageCache)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        pageCacheRef.current = {};
        pageCursorMapRef.current = { 1: null };
        loadContacts(1, true);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, loadContacts]);

  // Search Clear Hook
  const prevSearchRef = useRef(searchQuery);
  useEffect(() => {
    const prev = prevSearchRef.current;
    prevSearchRef.current = searchQuery;
    if (prev.trim() !== '' && !searchQuery.trim()) {
      pageCacheRef.current = {};
      pageCursorMapRef.current = { 1: null };
      loadContacts(1, true, '');
    }
  }, [searchQuery, loadContacts]);

  // Handle manual explicit refresh
  const handleExplicitRefresh = () => {
    pageCacheRef.current = {};
    pageCursorMapRef.current = { 1: null };
    loadContacts(1, true);
  };

  // Single Contact Delete Handler
  const handleDeleteContact = (contact) => {
    const contactId = contact.contact_id || contact.id;
    setDeleteDialogState({
      isOpen: true,
      title: 'Delete Contact Entry',
      message: `Are you sure you want to permanently delete contact #${contactId} (${contact.contact_name || contact.company || ''})? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await deleteContact(contactId);
          pageCacheRef.current = {};
          await loadContacts(currentPage, true);
          showToast('success', `Contact #${contactId} deleted successfully.`);
        } catch (err) {
          console.error('[ContactsView] Delete contact error:', err);
          showToast('error', formatApiError(err, `Failed to delete contact #${contactId}.`));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Toggle / Activate Contact Handler for Admins
  const handleToggleActivateContact = async (contact) => {
    const contactId = contact.contact_id || contact.id;
    try {
      await updateContact(contactId, { is_active: true });
      pageCacheRef.current = {};
      await loadContacts(currentPage, true);
      showToast('success', `Contact #${contactId} is now active.`);
    } catch (err) {
      console.error('[ContactsView] Activate contact error:', err);
      showToast('error', formatApiError(err, `Failed to activate contact #${contactId}.`));
    }
  };

  // Bulk Contact Selection States
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [isSelectAllPages, setIsSelectAllPages] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setIsSelectAllPages(true);
      setSelectedContactIds((filtered || []).map(c => c.contact_id || c.id));
    } else {
      setIsSelectAllPages(false);
      setSelectedContactIds([]);
    }
  };

  const handleToggleIndividualContact = (contactId, checked) => {
    setIsSelectAllPages(false);
    if (checked) {
      setSelectedContactIds(prev => [...prev, contactId]);
    } else {
      setSelectedContactIds(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleBulkDeleteContacts = () => {
    const totalCntNum = totalCount || (filtered ? filtered.length : 0);
    const isDeletingEntireData = isSelectAllPages || (selectedContactIds.length >= totalCntNum);
    const deleteCount = isDeletingEntireData ? totalCntNum : selectedContactIds.length;

    setDeleteDialogState({
      isOpen: true,
      title: isDeletingEntireData ? '⚠️ PERMANENTLY DELETE ALL CONTACTS' : 'Bulk Delete Selected Contacts',
      message: isDeletingEntireData
        ? `CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE ALL ${deleteCount} CONTACTS in the system? This action CANNOT BE UNDONE!`
        : `Are you sure you want to permanently delete ${deleteCount} selected contact(s)? This action cannot be undone.`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          if (isDeletingEntireData) {
            await deleteAllContacts();
            showToast('success', `All ${deleteCount} contacts have been permanently deleted.`);
          } else {
            await bulkDeleteContacts({ ids: selectedContactIds });
            showToast('success', `Successfully deleted ${selectedContactIds.length} contact(s).`);
          }
          setSelectedContactIds([]);
          setIsSelectAllPages(false);
          setIsDeleteMode(false);
          pageCacheRef.current = {};
          await loadContacts(1, true);
        } catch (err) {
          console.error('[ContactsView] Bulk delete contacts error:', err);
          showToast('error', formatApiError(err, 'Failed to delete contacts.'));
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  const handleDeleteAllContacts = () => {
    const totalCntNum = totalCount || (filtered ? filtered.length : 0);
    setDeleteDialogState({
      isOpen: true,
      title: '⚠️ PERMANENTLY DELETE ALL CONTACTS',
      message: `CRITICAL WARNING: Are you sure you want to PERMANENTLY DELETE ALL ${totalCntNum} CONTACTS in the system? This action CANNOT BE UNDONE!`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteDialogState(prev => ({ ...prev, isDeleting: true }));
        try {
          await deleteAllContacts();
          setSelectedContactIds([]);
          setIsSelectAllPages(false);
          setIsDeleteMode(false);
          pageCacheRef.current = {};
          await loadContacts(1, true);
        } finally {
          setDeleteDialogState(prev => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      }
    });
  };

  // Unique countries list
  const uniqueCountries = useMemo(() => {
    const set = new Set();
    contactsData.forEach(c => {
      if (c.country) set.add(c.country);
    });
    return ['All Countries', ...Array.from(set)];
  }, [contactsData]);

  // Country filter options for CustomSelect (entire list of world countries)
  const countryFilterOptions = useMemo(() => {
    return [
      { value: 'All Countries', label: 'All Countries' },
      ...COUNTRY_OPTIONS.map(c => ({
        value: c.name,
        label: c.label || c.name
      }))
    ];
  }, []);

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
    { value: 'Active', label: 'Active Contacts' },
    { value: 'Inactive', label: 'Inactive Contacts' }
  ], []);

  // Compute number of active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (countryFilter && countryFilter !== 'All Countries') count++;
    if (createdDateFilter === 'custom') {
      if (createdFromDate && createdToDate) count++;
    } else if (createdDateFilter && createdDateFilter !== 'all') {
      count++;
    }
    if (isExecutiveUser && statusFilter && statusFilter !== 'All') count++;
    return count;
  }, [countryFilter, createdDateFilter, isExecutiveUser, statusFilter]);

  const handleResetFilters = useCallback(() => {
    setCountryFilter('All Countries');
    setCreatedDateFilter('all');
    setCreatedFromDate('');
    setCreatedToDate('');
    if (isExecutiveUser) setStatusFilter('All');
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

  // Filtered contacts based on search & filters
  const filtered = useMemo(() => {
    return contactsData.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        (c.designation && c.designation.toLowerCase().includes(q)) ||
        (c.phone_no && String(c.phone_no).toLowerCase().includes(q)) ||
        (c.phone_no_1 && String(c.phone_no_1).toLowerCase().includes(q)) ||
        (c.phone_no_2 && String(c.phone_no_2).toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.contact_id && String(c.contact_id).toLowerCase().includes(q));

      const matchCountry = countryFilter === 'All Countries' || c.country === countryFilter;
      const matchActive = statusFilter === 'All' ||
        (statusFilter === 'Active' ? Boolean(c.is_active !== false) : !c.is_active);

      const matchDate = (() => {
        if (createdDateFilter === 'all') return true;
        const dateStr = c.created_at || c.created_date;
        if (!dateStr) return false;
        const cDate = new Date(dateStr);
        if (isNaN(cDate.getTime())) return true;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (createdDateFilter === 'today') {
          return cDate >= startOfToday;
        }
        if (createdDateFilter === 'yesterday') {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          return cDate >= startOfYesterday && cDate < startOfToday;
        }
        if (createdDateFilter === 'last_7_days') {
          const past7 = new Date(startOfToday);
          past7.setDate(past7.getDate() - 7);
          return cDate >= past7;
        }
        if (createdDateFilter === 'last_30_days') {
          const past30 = new Date(startOfToday);
          past30.setDate(past30.getDate() - 30);
          return cDate >= past30;
        }
        if (createdDateFilter === 'this_month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return cDate >= startOfMonth;
        }
        if (createdDateFilter === 'custom') {
          if (createdFromDate) {
            const from = new Date(createdFromDate);
            from.setHours(0, 0, 0, 0);
            if (cDate < from) return false;
          }
          if (createdToDate) {
            const to = new Date(createdToDate);
            to.setHours(23, 59, 59, 999);
            if (cDate > to) return false;
          }
          return true;
        }
        return true;
      })();

      return matchSearch && matchCountry && matchActive && matchDate;
    });
  }, [contactsData, searchQuery, countryFilter, statusFilter, isExecutiveUser, createdDateFilter, createdFromDate, createdToDate]);

  const displayTotalContacts = totalCount || (filtered ? filtered.length : 0);

  // Next Page cache check
  const activeFilterKey = statusFilter || 'All';
  const nextPageKey = `p_${currentPage + 1}_sz_${pageSize}_st_${activeFilterKey}_ct_${countryFilter}`;
  const canGoNext = hasMore || Boolean(pageCacheRef.current[nextPageKey]);
  const canGoPrev = currentPage > 1;

  // Should pagination controls be displayed?
  // Only display if has_more is true OR user has navigated beyond page 1 OR multiple pages exist
  const showPagination = hasMore || currentPage > 1 || (totalCount > pageSize);

  // Navigate to next page (retrieves from cache if available, otherwise fetches)
  const handleNextPage = () => {
    if (!canGoNext) return;
    loadContacts(currentPage + 1);
  };

  // Navigate to prev page (always retrieved instantly from cache without network call!)
  const handlePrevPage = () => {
    if (!canGoPrev) return;
    loadContacts(currentPage - 1);
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

  const glassCard = {
    background: 'var(--t-surface-solid)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--t-border)',
    borderRadius: '12px',
    boxShadow: 'var(--t-card-shadow)'
  };

  return (
    <div className="contacts-main-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 'clamp(12px, 1.2vw, 20px)', gap: '10px' }}>

      {/* Top Action Bar */}
      <div style={{ ...glassCard, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 40, overflow: 'visible' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', width: '100%' }}>

        {/* Search & Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: '320px' }}>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
            {isSearchingServer
              ? <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px', animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
              : <FiSearch style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-teal)', fontSize: '15px' }} />
            }
            <input
              type="text"
              placeholder="Search company, contact name, email, phone, country..."
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
                  width: '320px',
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
                      Filter Contacts
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

                {/* Filter 1: Country */}
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Country
                  </label>
                  <CustomSelect
                    value={countryFilter}
                    onChange={val => {
                      setCountryFilter(val);
                      setCurrentPage(1);
                    }}
                    options={countryFilterOptions}
                    placeholder="All Countries"
                    height="38px"
                    searchable={true}
                  />
                </div>

                {/* Filter 2: Created At Date (Commented out as requested) */}
                {/*
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
                  {createdDateFilter === 'custom' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginBottom: '3px' }}>From:</div>
                        <input
                          type="date"
                          value={createdFromDate}
                          onChange={e => {
                            setCreatedFromDate(e.target.value);
                            setCurrentPage(1);
                          }}
                          onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) {} }}
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
                          value={createdToDate}
                          onChange={e => {
                            setCreatedToDate(e.target.value);
                            setCurrentPage(1);
                          }}
                          onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) {} }}
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
                */}

                {/* Filter 3: Executive Active Status Filter (Admin Only) */}
                {isExecutiveUser && (
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                      Active Status
                    </label>
                    <CustomSelect
                      value={statusFilter}
                      onChange={val => {
                        setStatusFilter(val);
                        setCurrentPage(1);
                      }}
                      options={activeStatusFilterOptions}
                      placeholder="All Status"
                      icon={FiCheckCircle}
                      height="38px"
                    />
                  </div>
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

          {/* Dynamic Columns Customizer Popover */}
          <div ref={columnPickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setColumnPickerOpen(!columnPickerOpen)}
              title="Configure Dynamic Columns"
              style={{
                height: '42px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                border: '1px solid var(--t-border)',
                borderRadius: '8px',
                background: 'var(--t-surface-alt)',
                color: 'var(--t-fg)',
                fontFamily: "'Helvetica'",
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <FiColumns style={{ color: '#00D4AA', fontSize: '14px' }} /> Columns
              <FiChevronDown style={{ fontSize: '13px', transform: columnPickerOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {columnPickerOpen && (
              <div style={{
                position: 'absolute',
                top: '48px',
                left: 0,
                zIndex: 100050,
                background: '#0c131d',
                border: '1px solid rgba(0, 212, 170, 0.35)',
                borderRadius: '10px',
                padding: '12px 14px',
                minWidth: '220px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.95), 0 0 25px rgba(0, 212, 170, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11px', color: '#8CA0B8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  Dynamic Columns
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
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[col.key]}
                      onChange={e => setVisibleColumns({ ...visibleColumns, [col.key]: e.target.checked })}
                      style={{ accentColor: '#00D4AA', cursor: 'pointer' }}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Export CSV button commented out */}
            {/* <button
              onClick={() => {
                if (!filtered.length) return alert('No contacts to export.');
                const activeCols = ALL_COLUMNS.filter(c => visibleColumns[c.key]);
                const headers = activeCols.map(c => c.label);
                const rows = filtered.map(c => activeCols.map(col => {
                  if (col.key === 'created_at') return formatDate(c.created_at);
                  if (col.key === 'is_active') return c.is_active ? 'Active' : 'Inactive';
                  return c[col.key] || c[col.key === 'contact_name' ? 'contactName' : col.key] || '';
                }));
                const csv = [headers.join(','), ...rows.map(r => r.map(k => `"${String(k).replace(/"/g, '""')}"`).join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Contacts_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              }}
              style={{
                height: '42px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid var(--t-border)',
                borderRadius: '8px',
                background: 'var(--t-surface-alt)',
                fontFamily: "'Helvetica'",
                fontSize: '13.5px',
                fontWeight: 700,
                color: 'var(--t-fg)',
                cursor: 'pointer'
              }}
            >
              <FiDownload style={{ fontSize: '15px' }} /> Export
            </button> */}

            {isUserSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsDeleteMode(prev => {
                    const next = !prev;
                    if (!next) {
                      setSelectedContactIds([]);
                      setIsSelectAllPages(false);
                    }
                    return next;
                  });
                }}
                title={isDeleteMode ? 'Close selection mode' : 'Select & Delete Contacts'}
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
                    ? ((selectedContactIds.length > 0 || isSelectAllPages) ? `Delete Selected (${isSelectAllPages ? displayTotalContacts : selectedContactIds.length})` : 'Cancel Delete')
                    : 'Delete'}
                </span>
              </button>
            )}

            <button
              onClick={onOpenAddContact}
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
                fontSize: '14px',
                fontWeight: 800,
                color: '#070C12',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(0, 212, 170, 0.4)'
              }}
            >
              <FiPlus style={{ fontSize: '16px', strokeWidth: 3 }} /> New Contact
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

            {countryFilter !== 'All Countries' && (
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
                Country: {countryFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setCountryFilter('All Countries'); setCurrentPage(1); }} />
              </span>
            )}

            {createdDateFilter !== 'all' && (
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
                Created: {getCreatedDateLabel(createdDateFilter, createdFromDate, createdToDate)}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setCreatedDateFilter('all'); setCreatedFromDate(''); setCreatedToDate(''); setCurrentPage(1); }} />
              </span>
            )}

            {isExecutiveUser && statusFilter !== 'All' && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 9px',
                borderRadius: '6px',
                background: statusFilter === 'Active' ? 'rgba(0, 212, 170, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: statusFilter === 'Active' ? '1px solid rgba(0, 212, 170, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                color: statusFilter === 'Active' ? '#00D4AA' : '#ef4444',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Status: {statusFilter}
                <FiX style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => { setStatusFilter('All'); setCurrentPage(1); }} />
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
                checked={isSelectAllPages || (filtered.length > 0 && selectedContactIds.length === filtered.length)}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: '#EF4444', width: '16px', height: '16px' }}
              />
              <span>Select All ({displayTotalContacts} Contacts)</span>
            </label>

            {/* Right-aligned Actions: Delete Selected + Close X Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={handleBulkDeleteContacts}
                disabled={selectedContactIds.length === 0 && !isSelectAllPages}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  borderRadius: '6px',
                  background: (selectedContactIds.length > 0 || isSelectAllPages) ? 'linear-gradient(135deg, #b91c1c, #ef4444)' : 'rgba(239, 68, 68, 0.2)',
                  color: (selectedContactIds.length > 0 || isSelectAllPages) ? '#FFFFFF' : '#FCA5A5',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: (selectedContactIds.length > 0 || isSelectAllPages) ? 'pointer' : 'not-allowed',
                  opacity: (selectedContactIds.length > 0 || isSelectAllPages) ? 1 : 0.6,
                  boxShadow: (selectedContactIds.length > 0 || isSelectAllPages) ? '0 2px 10px rgba(239, 68, 68, 0.4)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiTrash2 />
                <span>Delete Selected ({isSelectAllPages ? displayTotalContacts : selectedContactIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDeleteMode(false);
                  setSelectedContactIds([]);
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

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: '360px' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '1400px' }}>
            <thead>
              <tr>
                {isUserSuperAdmin && isDeleteMode && (
                  <th style={{ ...thStyle, textAlign: 'center', width: '40px', minWidth: '40px' }} />
                )}
                {visibleColumns.contact_id && <th style={thStyle}>Contact ID</th>}
                {visibleColumns.contact_name && <th style={thStyle}>Contact Person</th>}
                {visibleColumns.company && <th style={thStyle}>Company</th>}
                {visibleColumns.designation && <th style={thStyle}>Designation</th>}
                {visibleColumns.phone_no_1 && <th style={thStyle}>Primary Phone</th>}
                {visibleColumns.phone_no_2 && <th style={thStyle}>Secondary Phone</th>}
                {visibleColumns.email && <th style={thStyle}>Email Address</th>}
                {visibleColumns.country && <th style={thStyle}>Country</th>}
                {visibleColumns.region && <th style={thStyle}>Region</th>}
                {visibleColumns.is_active && <th style={thStyle}>Status</th>}
                {visibleColumns.created_at && <th style={thStyle}>Created Date</th>}
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
            <tbody style={{ height: (filtered.length === 0 || fetchError) ? '100%' : 'auto' }}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--t-border)' }}>
                    <td colSpan={12} style={{ padding: '18px 24px' }}>
                      <div className="skeleton-box" style={{ height: '36px', borderRadius: '6px' }} />
                    </td>
                  </tr>
                ))
              ) : fetchError ? (
                <tr style={{ height: '100%' }}>
                  <td colSpan={12} style={{ padding: '60px 20px', textAlign: 'center', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '24px', marginBottom: '12px' }}>
                        <FiAlertCircle />
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#fca5a5' }}>Failed to Load Contacts from Server</div>
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
                  <td colSpan={12} style={{ padding: '70px 0', textAlign: 'center', color: 'var(--t-fg-muted)', verticalAlign: 'middle', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', height: '100%' }}>
                      <FiUser style={{ fontSize: '42px', opacity: 0.4, marginBottom: '12px' }} />
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-fg)' }}>No Contacts Available</div>
                      <div style={{ fontSize: '13px', color: 'var(--t-fg-muted)', marginTop: '4px' }}>No contact records exist on the server. Click "+ Add Contact" to create one.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((contact, idx) => {
                  const id = contact.contact_id || contact.id || `CNT-${idx + 1}`;
                  const name = contact.contact_name || contact.contactName || '—';
                  const phone1 = contact.phone_no_1 || contact.phone1 || '—';
                  const phone2 = contact.phone_no_2 || contact.phone2 || '—';
                  const isActive = contact.is_active !== undefined ? Boolean(contact.is_active) : true;

                  const isCntSelected = isSelectAllPages || selectedContactIds.includes(id);

                  return (
                    <tr
                      key={id}
                      style={{
                        borderBottom: '1px solid var(--t-border)',
                        background: isCntSelected ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        transition: 'background 140ms ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { if (!isCntSelected) e.currentTarget.style.background = 'var(--t-row-hover)'; }}
                      onMouseLeave={(e) => { if (!isCntSelected) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => setEditModalState({ isOpen: true, contact, initialEditMode: false })}
                    >
                      {/* Checkbox */}
                      {isUserSuperAdmin && isDeleteMode && (
                        <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isCntSelected}
                            onChange={(e) => handleToggleIndividualContact(id, e.target.checked)}
                            style={{ cursor: 'pointer', accentColor: '#EF4444', width: '15px', height: '15px' }}
                          />
                        </td>
                      )}
                      {/* Contact ID */}
                      {visibleColumns.contact_id && (
                        <td style={{ ...tdStyle, fontFamily: "'Helvetica'", fontWeight: 600, color: 'var(--t-teal)' }}>
                          #{id}
                        </td>
                      )}

                      {/* Contact Person */}
                      {visibleColumns.contact_name && (
                        <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--t-fg)' }}>
                          <span>{name}</span>
                        </td>
                      )}

                      {/* Company */}
                      {visibleColumns.company && (
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          {contact.company || '—'}
                        </td>
                      )}

                      {/* Designation */}
                      {visibleColumns.designation && (
                        <td style={{ ...tdStyle,   fontWeight: 600, color: 'var(--t-fg-muted)' }}>
                          {contact.designation || '—'}
                        </td>
                      )}

                      {/* Primary Phone */}
                      {visibleColumns.phone_no_1 && (
                        <td style={{ ...tdStyle,   fontWeight: 600, fontFamily: "'Helvetica'" }}>
                          {phone1}
                        </td>
                      )}

                      {/* Secondary Phone */}
                      {visibleColumns.phone_no_2 && (
                        <td style={{ ...tdStyle, fontFamily: "'Helvetica'",   fontWeight: 600, color: 'var(--t-fg-muted)' }}>
                          {phone2}
                        </td>
                      )}

                      {/* Email */}
                      {visibleColumns.email && (
                        <td style={tdStyle}>
                          <span style={{ color: 'var(--t-cyan)' }}>{contact.email || '—'}</span>
                        </td>
                      )}

                      {/* Country */}
                      {visibleColumns.country && (
                        <td style={tdStyle}>
                          <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', fontSize: '12.5px', fontWeight: 600 }}>
                            {formatCountryDisplay(contact.country || 'India')}
                          </span>
                        </td>
                      )}

                      {/* Region */}
                      {visibleColumns.region && (
                        <td style={{ ...tdStyle, color: 'var(--t-fg-muted)' }}>
                          {contact.region || '—'}
                        </td>
                      )}

                      {/* Status Badge */}
                      {visibleColumns.is_active && (
                        <td style={tdStyle}>
                          {isActive ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '85px',
                              padding: '4px 0',
                              borderRadius: '6px',
                              background: 'rgba(0, 212, 170, 0.15)',
                              color: '#00D4AA',
                              border: '1px solid rgba(0, 212, 170, 0.35)',
                              fontSize: '12px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              Active
                            </span>
                          ) : (isUserSuperAdmin || hasAdminAccess(user)) ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActivateContact(contact);
                              }}
                              title="Make Contact Active"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'rgba(0, 212, 170, 0.18)',
                                border: '1px solid rgba(0, 212, 170, 0.4)',
                                color: '#00D4AA',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textAlign: 'center',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <FiCheckCircle style={{ fontSize: '12px' }} />
                              <span>Activate</span>
                            </button>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '85px',
                              padding: '4px 0',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              fontSize: '12px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              textAlign: 'center',
                              whiteSpace: 'nowrap'
                            }}>
                              Inactive
                            </span>
                          )}
                        </td>
                      )}

                      {/* Created Date */}
                      {visibleColumns.created_at && (
                        <td style={{ ...tdStyle,   fontWeight: 600, color: 'var(--t-fg-muted)' }}>
                          {formatDate(contact.created_at)}
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
                          {(isUserSuperAdmin || hasAdminAccess(user)) && !isActive && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleActivateContact(contact);
                              }}
                              title="Make Contact Active"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                background: 'rgba(0, 212, 170, 0.18)',
                                border: '1px solid rgba(0, 212, 170, 0.4)',
                                color: '#00D4AA',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0
                              }}
                            >
                              <FiCheckCircle style={{ fontSize: '12px' }} />
                              <span>Activate</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditModalState({ isOpen: true, contact, initialEditMode: true })}
                            title="Edit Contact"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              flexShrink: 0
                            }}
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(contact)}
                            title="Delete Contact"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              flexShrink: 0
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
            gap: '16px'
          }}>
            {/* Left: Total Count & Current Page Info */}
            <div style={{ fontSize: '13.5px', color: 'var(--t-fg-muted)', fontWeight: 600 }}>
              Showing page <strong style={{ color: 'var(--t-fg)', fontWeight: 800 }}>{currentPage}</strong> of{' '}
              <strong style={{ color: 'var(--t-teal)', fontWeight: 800 }}>
                {displayTotalContacts ? Math.ceil(displayTotalContacts / pageSize) : '1+'}
              </strong> pages
              {displayTotalContacts ? ` (${displayTotalContacts} Total Contacts)` : ''}
            </div>

            {/* Right: Page Size & Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Page Limit Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--t-fg-subtle)', fontWeight: 600 }}>Per Page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value, 10);
                    setPageSize(newSize);
                    setCurrentPage(1);
                    pageCacheRef.current = {};
                    pageCursorMapRef.current = { 1: null };
                  }}
                  style={{
                    padding: '5px 24px 5px 10px',
                    borderRadius: '6px',
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

      {/* Edit Contact Modal */}
      <EditContactModal
        isOpen={editModalState.isOpen}
        contact={editModalState.contact}
        initialEditMode={editModalState.initialEditMode !== undefined ? editModalState.initialEditMode : true}
        onClose={() => setEditModalState({ isOpen: false, contact: null, initialEditMode: true })}
        onUpdated={async (updatedContact) => {
          const targetId = updatedContact.contact_id || updatedContact.id;
          pageCacheRef.current = {};
          await loadContacts(currentPage, true);
          showToast('success', `Contact #${targetId}${updatedContact.contact_name ? ` (${updatedContact.contact_name})` : ''} updated successfully!`);
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

const filterScrollStyles = `
  .custom-filter-dropdown-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
  .custom-filter-dropdown-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
  .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb { background: rgba(0, 212, 170, 0.4); border-radius: 4px; }
  .custom-filter-dropdown-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0, 212, 170, 0.7); }
`;
if (typeof document !== 'undefined' && !document.getElementById('custom-filter-scroll-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'custom-filter-scroll-styles';
  styleEl.innerHTML = filterScrollStyles;
  document.head.appendChild(styleEl);
}
