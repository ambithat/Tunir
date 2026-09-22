import React, { useState, useEffect } from 'react';
import { createContact } from '../../api/contactApi';
import CountrySelect from '../common/CountrySelect';
import { getPhoneRulesForCountry, validatePhoneNumber } from '../../utils/countryData';
import {
  FiX,
  FiUserPlus,
  FiBuilding,
  FiUser,
  FiBriefcase,
  FiPhone,
  FiMail,
  FiGlobe,
  FiMapPin,
  FiCheckCircle,
  FiSave,
  FiAlertCircle
} from 'react-icons/fi';

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

export default function AddContactModal({ isOpen, onClose, onAddContact }) {
  const [form, setForm] = useState({
    company: '',
    contact_name: '',
    designation: '',
    phone_no_1: '',
    phone_no_2: '',
    email: '',
    country: 'India',
    region: 'South Asia',
    is_active: true
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm({
        company: '',
        contact_name: '',
        designation: '',
        phone_no_1: '',
        phone_no_2: '',
        email: '',
        country: 'India',
        region: '',
        is_active: true
      });
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!form.company.trim()) {
      setErrorMsg('Company name is required.');
      return;
    }
    if (!form.contact_name.trim()) {
      setErrorMsg('Contact person name is required.');
      return;
    }
    if (!form.phone_no_1.trim()) {
      setErrorMsg('Primary phone number is required.');
      return;
    }

    const p1Err = validatePhoneNumber(form.phone_no_1, form.country || 'India', 'Primary phone number');
    if (p1Err) {
      setErrorMsg(p1Err);
      return;
    }

    const p2Err = validatePhoneNumber(form.phone_no_2, form.country || 'India', 'Secondary phone number');
    if (p2Err) {
      setErrorMsg(p2Err);
      return;
    }
    if (!form.email.trim()) {
      setErrorMsg('Email address is required.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      company: form.company.trim(),
      contact_name: form.contact_name.trim(),
      designation: form.designation.trim() || null,
      phone_no_1: form.phone_no_1.trim(),
      phone_no_2: form.phone_no_2.trim() || null,
      email: form.email.trim(),
      country: form.country.trim() || null,
      region: form.region.trim() || null,
      is_active: Boolean(form.is_active)
    };

    try {
      const res = await createContact(payload);
      const createdContact = res?.data || res || {
        contact_id: `CNT-${Date.now().toString().slice(-4)}`,
        created_at: new Date().toISOString(),
        ...payload
      };

      if (onAddContact) onAddContact(createdContact);
      onClose();
    } catch (err) {
      console.error('[AddContactModal] Create contact failed:', err);
      setErrorMsg(formatApiError(err, 'Failed to create contact. Please verify all fields.'));
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
        maxWidth: '700px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
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
          background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.45))',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div>
            <div style={{ fontSize: '11.5px', letterSpacing: '0.15em', color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', fontWeight: 800 }}>
              Contacts Directory
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', marginTop: '2px' }}>
              Create New Contact
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><FiBriefcase /> Company *</label>
              <input
                required
                value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                placeholder="e.g. TUNIR Technologies"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}><FiUser /> Contact Name *</label>
              <input
                required
                value={form.contact_name}
                onChange={e => setForm({ ...form, contact_name: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}><FiMail /> Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="e.g. rahul@example.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Designation / Role</label>
              <input
                value={form.designation}
                onChange={e => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. IT Manager / CTO"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <label style={labelStyle}><FiPhone /> Secondary Phone (Optional)</label>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
              <input
                value={form.region}
                onChange={e => setForm({ ...form, region: e.target.value })}
                placeholder="e.g. South Asia, APAC, EMEA"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Actions */}
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
                padding: '11px 26px',
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
              <FiCheckCircle /> {isSubmitting ? 'Saving...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
