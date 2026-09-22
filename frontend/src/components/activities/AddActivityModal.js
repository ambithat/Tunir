import React, { useState, useEffect, useMemo } from 'react';
import {
  FiX,
  FiPlus,
  FiCalendar,
  FiClock,
  FiUser,
  FiBriefcase,
  FiActivity,
  FiCheckCircle,
  FiFileText,
  FiArrowRight,
  FiAlertCircle
} from 'react-icons/fi';
import { createLeadActivity } from '../../api/activityApi';
import {
  getActivityTypeDropdown,
  getActivityOutcomeDropdown,
  getActivityStatusDropdown
} from '../../api/statusTypeApi';
import { getLeadsDropdown } from '../../api/leadApi';
import { getLeadersDropdown } from '../../api/leaderApi';
import { getTodayISO, validateActivityDate, isBackwardDate, isDateBefore } from '../../utils/dateUtils';

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

export default function AddActivityModal({ isOpen, onClose, onAddActivity }) {
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [leadOwnerId, setLeadOwnerId] = useState('');
  const [activityDate, setActivityDate] = useState(getTodayISO());
  const [activityTypeId, setActivityTypeId] = useState('');
  const [meetingPlan, setMeetingPlan] = useState('');
  const [meetingActionRemarks, setMeetingActionRemarks] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextMeetingPlan, setNextMeetingPlan] = useState('');
  const [outcomeId, setOutcomeId] = useState('');
  const [actionStatusId, setActionStatusId] = useState('');
  const [isStatusChanged, setIsStatusChanged] = useState(false);

  // Dropdown lists
  const [leadsList, setLeadsList] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [outcomeOptions, setOutcomeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [leadersList, setLeadersList] = useState([]);

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

  // Fetch dropdown data on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setIsStatusChanged(false);
    setNextAction('');
    setNextActionDate('');
    setIsLoadingDropdowns(true);

    Promise.allSettled([
      getLeadsDropdown(),
      getActivityTypeDropdown(),
      getActivityOutcomeDropdown(),
      getActivityStatusDropdown(),
      getLeadersDropdown()
    ]).then(([leadsRes, typesRes, outcomesRes, statusesRes, leadersRes]) => {
      // 1. Leads
      if (leadsRes.status === 'fulfilled' && leadsRes.value) {
        const raw = Array.isArray(leadsRes.value.data) ? leadsRes.value.data : (Array.isArray(leadsRes.value) ? leadsRes.value : []);
        setLeadsList(raw);
        if (raw.length > 0) {
          let currentLead = null;
          if (selectedLeadId) {
            currentLead = raw.find(l => String(l.lead_id) === String(selectedLeadId));
          }
          if (!currentLead) {
            currentLead = raw[0];
            setSelectedLeadId(currentLead.lead_id);
          }
        }
      }

      // 2. Activity Types (from statustype/activity-type/dropdown)
      if (typesRes.status === 'fulfilled' && typesRes.value) {
        const raw = Array.isArray(typesRes.value.data) ? typesRes.value.data : (Array.isArray(typesRes.value) ? typesRes.value : []);
        const opts = raw.map(t => ({
          value: String(t.id || t.activity_type_id || t.activity_type),
          label: t.activity_type || t.activity_type_name || t.name || t.label || String(t.id)
        }));
        setTypeOptions(opts);
        if (opts.length > 0 && !activityTypeId) setActivityTypeId(opts[0].value);
      }

      // 3. Outcomes (from statustype/daily-activity-outcome/dropdown)
      if (outcomesRes.status === 'fulfilled' && outcomesRes.value) {
        const raw = Array.isArray(outcomesRes.value.data) ? outcomesRes.value.data : (Array.isArray(outcomesRes.value) ? outcomesRes.value : []);
        const opts = raw.map(o => ({
          value: String(o.id || o.outcome_id || o.outcome),
          label: o.outcome || o.outcome_name || o.name || o.label || String(o.id)
        }));
        setOutcomeOptions(opts);
      }

      // 4. Action Statuses (from statustype/daily-activity-status/dropdown)
      if (statusesRes.status === 'fulfilled' && statusesRes.value) {
        const raw = Array.isArray(statusesRes.value.data) ? statusesRes.value.data : (Array.isArray(statusesRes.value) ? statusesRes.value : []);
        const opts = raw
          .map(s => ({
            value: String(s.id || s.action_status_id || s.action_status),
            label: s.action_status || s.action_status_name || s.status || s.status_name || s.name || s.label || String(s.id)
          }))
          .filter(o => !String(o.label).toLowerCase().includes('overdue'));
        setStatusOptions(opts);
        if (opts.length > 0) {
          const pendingOpt = opts.find(o => String(o.label).toLowerCase().includes('pending'));
          setActionStatusId(pendingOpt ? pendingOpt.value : opts[0].value);
        }
      }

      // 5. Leaders (from /api/v1/leaders/dropdown)
      if (leadersRes.status === 'fulfilled' && leadersRes.value) {
        const raw = Array.isArray(leadersRes.value.data) ? leadersRes.value.data : (Array.isArray(leadersRes.value) ? leadersRes.value : []);
        const activeLeaders = raw.filter(l => l.is_active !== false);
        setLeadersList(activeLeaders);

        const myId = String(currentUserObj?.leader_id || currentUserObj?.user_id || currentUserObj?.emp_id || currentUserObj?.id || '').trim().toLowerCase();
        const myEmail = String(currentUserObj?.email || '').trim().toLowerCase();
        const myFirstName = String(currentUserObj?.first_name || currentUserObj?.name || '').trim().toLowerCase();
        const myLastName = String(currentUserObj?.last_name || '').trim().toLowerCase();
        const myFullName = `${myFirstName} ${myLastName}`.trim().toLowerCase();

        const myLeader = activeLeaders.find(l => {
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

        const defaultId = myLeader ? String(myLeader.leader_id || myLeader.emp_id || myLeader.id) : (loggedInUserId || String(activeLeaders[0]?.leader_id || activeLeaders[0]?.emp_id || ''));
        setLeadOwnerId(defaultId);
      }
    }).finally(() => {
      setIsLoadingDropdowns(false);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setErrorMsg('Please select a Target Lead.');
      return;
    }
    if (!activityDate) {
      setErrorMsg('Please select an Activity Date.');
      return;
    }
    if (!meetingPlan || !meetingPlan.trim()) {
      setErrorMsg('Meeting Plan is mandatory. Please enter a meeting plan.');
      return;
    }
    if (!validateActivityDate(activityDate, 'Activity Date')) {
      setErrorMsg('Activity date cannot be in the past (backward date like yesterday).');
      return;
    }
    if (nextActionDate && !validateActivityDate(nextActionDate, 'Next Action Date')) {
      setErrorMsg('Next action date cannot be in the past (backward date like yesterday).');
      return;
    }
    if (nextActionDate && activityDate && isDateBefore(nextActionDate, activityDate)) {
      setErrorMsg(`Next Action Date cannot be before Activity Date (${activityDate}). Please select a date on or after Activity Date.`);
      return;
    }

    const selectedOutcomeObj = outcomeOptions.find(o => String(o.value) === String(outcomeId));
    const selectedOutcomeName = String(selectedOutcomeObj?.label || selectedOutcomeObj?.value || '').toLowerCase();
    const isOutcomeWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

    if (isStatusChanged) {
      if (!meetingActionRemarks || !meetingActionRemarks.trim()) {
        setErrorMsg('Meeting Action Remarks are mandatory when status is updated.');
        return;
      }
      if (!outcomeId) {
        setErrorMsg('Outcome is mandatory when status is updated.');
        return;
      }
      if (!isOutcomeWonOrLost) {
        if (!nextAction) {
          setErrorMsg('Next Action is mandatory for ongoing activities.');
          return;
        }
        if (!nextActionDate) {
          setErrorMsg('Next Action Date is mandatory for ongoing activities.');
          return;
        }
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        activity_date: activityDate,
        lead_owner_id: leadOwnerId ? leadOwnerId : null,
        activity_type_id: activityTypeId ? Number(activityTypeId) : null,
        meeting_plan: meetingPlan.trim() || null,
        meeting_action_remarks: meetingActionRemarks.trim() || null,
        next_action_type_id: (!isOutcomeWonOrLost && nextAction) ? Number(nextAction) : null,
        next_action_date: (!isOutcomeWonOrLost && nextActionDate) ? nextActionDate : null,
        next_meeting_plan: (!isOutcomeWonOrLost && nextMeetingPlan.trim()) ? nextMeetingPlan.trim() : null,
        outcome_id: outcomeId ? Number(outcomeId) : null,
        action_status_id: actionStatusId ? Number(actionStatusId) : null
      };

      const result = await createLeadActivity(selectedLeadId, payload);
      if (onAddActivity) onAddActivity(result);
      onClose();

      // Reset form
      setMeetingPlan('');
      setMeetingActionRemarks('');
      setNextAction('');
      setNextActionDate('');
      setNextMeetingPlan('');
    } catch (err) {
      console.error('[AddActivityModal] ❌ Failed to create activity:', err);
      setErrorMsg(formatApiError(err, 'Failed to log activity. Please verify input.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: '42px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid var(--t-border, rgba(49, 151, 149, 0.3))',
    background: 'var(--t-surface-solid, rgba(4, 8, 14, 0.8))',
    color: 'var(--t-fg, #FFFFFF)',
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
    fontSize: '12.5px',
    fontWeight: 700,
    color: 'var(--t-fg-muted, #94A3B8)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em'
  };

  const isAddFormValid = (() => {
    if (!selectedLeadId) return false;
    if (!activityDate) return false;
    if (isStatusChanged) {
      if (!meetingActionRemarks || !meetingActionRemarks.trim()) return false;
      if (!outcomeId) return false;

      const selectedOutcomeObj = outcomeOptions.find(o => String(o.value) === String(outcomeId));
      const selectedOutcomeName = String(selectedOutcomeObj?.label || selectedOutcomeObj?.value || '').toLowerCase();
      const isOutcomeWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

      if (!isOutcomeWonOrLost) {
        if (!nextAction) return false;
        if (!nextActionDate) return false;
        if (activityDate && isDateBefore(nextActionDate, activityDate)) return false;
      }
    }
    return true;
  })();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--t-scrim, rgba(4, 8, 14, 0.75))',
      backdropFilter: 'blur(10px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--t-surface-solid, #0D141F)',
        border: '1px solid var(--t-border, rgba(0, 212, 170, 0.3))',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--t-card-shadow, 0 25px 60px rgba(0, 0, 0, 0.7))',
        color: 'var(--t-fg, #FFFFFF)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 26px',
          borderBottom: '1px solid var(--t-border, rgba(49, 151, 149, 0.22))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--t-surface-solid, rgba(0, 0, 0, 0.45))'
        }}>
          <div>
            {/* <div style={{ fontSize: '11px', letterSpacing: '0.15em', color: 'var(--t-teal, #00D4AA)', textTransform: 'uppercase', fontWeight: 800 }}>
              Lead Activities Log
            </div> */}
            <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px', color: 'var(--t-fg, #FFFFFF)' }}>
              Log New Activity
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#8CA0B8',
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#fca5a5', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          {/* Target Lead & Activity Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelStyle}><FiBriefcase /> Select Target Lead *</label>
              <select
                required
                value={selectedLeadId}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedLeadId(val);
                }}
                style={selectStyle}
              >
                <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                  {isLoadingDropdowns ? 'Loading leads...' : '-- Select Target Lead --'}
                </option>
                {leadsList.map(l => (
                  <option key={l.lead_id} value={l.lead_id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                    {l.lead_id} - {l.company || l.contact_name || 'Lead'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}><FiCalendar /> Activity Date *</label>
              <input
                type="date"
                required
                min={getTodayISO()}
                value={activityDate}
                onChange={e => {
                  const val = e.target.value;
                  if (val && isBackwardDate(val)) {
                    alert("Invalid Activity Date: Activity date cannot be in the past (backward date like yesterday). Please select today or a future date.");
                    setActivityDate(getTodayISO());
                    return;
                  }
                  if (val && nextActionDate && isDateBefore(nextActionDate, val)) {
                    alert(`Invalid Activity Date: Next action date (${nextActionDate}) cannot be before Activity Date (${val}). Clearing Next Action Date.`);
                    setNextActionDate('');
                  }
                  setActivityDate(val);
                }}
                onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                style={{ ...inputStyle, cursor: 'pointer' }}
              />
            </div>
          </div>

          {/* Activity Type & Lead Owner */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
            <div>
              <label style={labelStyle}><FiActivity /> Activity Type</label>
              <select
                value={activityTypeId}
                onChange={e => setActivityTypeId(e.target.value)}
                style={selectStyle}
              >
                <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                  {isLoadingDropdowns ? 'Loading types...' : '-- Select Activity Type --'}
                </option>
                {typeOptions.map(t => (
                  <option key={t.value} value={t.value} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}><FiUser /> Lead Owner</label>
               
               {/* dont touch it - it's for future use*/}
               
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
                value={leadOwnerId}
                onChange={e => setLeadOwnerId(e.target.value)}
                disabled={!isAssigningForSomeone}
                style={{
                  ...selectStyle,
                  opacity: isAssigningForSomeone ? 1 : 0.7,
                  cursor: isAssigningForSomeone ? 'pointer' : 'not-allowed',
                  borderColor: !isAssigningForSomeone ? 'rgba(255, 255, 255, 0.1)' : selectStyle.borderColor
                }}
              >
                <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                  -- Select Owner --
                </option>
                {leadersList.map(l => {
                  const id = l.leader_id || l.emp_id;
                  const name = l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim();
                  return (
                    <option key={id} value={id} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                      {name} ({id})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Action Status */}
          <div>
            <label style={labelStyle}><FiClock /> Action Status</label>
            <select
              value={actionStatusId}
              onChange={e => {
                setActionStatusId(e.target.value);
                setIsStatusChanged(true);
              }}
              style={selectStyle}
            >
              <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                {isLoadingDropdowns ? 'Loading statuses...' : '-- Select Action Status --'}
              </option>
              {statusOptions.map(s => (
                <option key={s.value} value={s.value} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Meeting Plan */}
          <div>
            <label style={labelStyle}><FiFileText /> Meeting Plan *</label>
            <textarea
              required
              value={meetingPlan}
              onChange={e => setMeetingPlan(e.target.value)}
              placeholder="Enter meeting plan..."
              rows={3}
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
                resize: 'vertical'
              }}
            />
          </div>

          {/* Outcome, Meeting Action Remarks, Next Action & Next Action Date (Only shown after changing Action Status) */}
          {isStatusChanged && (() => {
            const selectedOutcomeObj = outcomeOptions.find(o => String(o.value) === String(outcomeId));
            const selectedOutcomeName = String(selectedOutcomeObj?.label || selectedOutcomeObj?.value || '').toLowerCase();
            const isOutcomeWonOrLost = selectedOutcomeName.includes('won') || selectedOutcomeName.includes('lost') || selectedOutcomeName.includes('closed');

            return (
              <>
                <div>
                  <label style={labelStyle}><FiFileText /> Meeting Action Remarks <span style={{ color: '#EF4444' }}>*</span></label>
                  <textarea
                    value={meetingActionRemarks}
                    onChange={e => setMeetingActionRemarks(e.target.value)}
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
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}><FiCheckCircle /> Outcome <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    value={outcomeId}
                    onChange={e => setOutcomeId(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                      {isLoadingDropdowns ? 'Loading outcomes...' : '-- Select Outcome --'}
                    </option>
                    {outcomeOptions.map(o => (
                      <option key={o.value} value={o.value} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {!isOutcomeWonOrLost ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                      <div>
                        <label style={labelStyle}><FiArrowRight /> Next Action <span style={{ color: '#EF4444' }}>*</span></label>
                        <select
                          value={nextAction}
                          onChange={e => setNextAction(e.target.value)}
                          style={selectStyle}
                        >
                          <option value="" style={{ background: '#0D141F', color: '#64748B' }}>
                            {isLoadingDropdowns ? 'Loading options...' : '-- Select Next Action --'}
                          </option>
                          {nextAction && !typeOptions.some(t => String(t.value) === String(nextAction)) && (
                            <option value={nextAction} style={{ background: '#0D141F', color: '#00D4AA' }}>
                              {nextAction}
                            </option>
                          )}
                          {typeOptions.map(t => (
                            <option key={t.value} value={t.value} style={{ background: '#0D141F', color: '#FFFFFF' }}>
                              {t.label || t.value}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}><FiClock /> Next Action Date <span style={{ color: '#EF4444' }}>*</span></label>
                        <input
                          type="date"
                          min={activityDate ? String(activityDate).split('T')[0] : getTodayISO()}
                          value={nextActionDate}
                          onChange={e => {
                            const val = e.target.value;
                            if (val && isBackwardDate(val)) {
                              alert("Invalid Next Action Date: Next action date cannot be in the past (backward date like yesterday). Please select today or a future date.");
                              setNextActionDate('');
                              return;
                            }
                            if (val && activityDate && isDateBefore(val, activityDate)) {
                              alert(`Invalid Next Action Date: Next action date cannot be before Activity Date (${activityDate}). Please select a date on or after Activity Date.`);
                              setNextActionDate('');
                              return;
                            }
                            setNextActionDate(val);
                          }}
                          onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) { } }}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}><FiFileText /> Next Meeting Plan</label>
                      <textarea
                        value={nextMeetingPlan}
                        onChange={e => setNextMeetingPlan(e.target.value)}
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
                          resize: 'vertical'
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

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#94A3B8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isAddFormValid}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                background: !isSubmitting && isAddFormValid ? 'linear-gradient(135deg, #009B82, #00D4AA)' : 'rgba(255, 255, 255, 0.1)',
                color: !isSubmitting && isAddFormValid ? '#070C12' : '#64748B',
                border: 'none',
                fontSize: '13px',
                fontWeight: 800,
                cursor: !isSubmitting && isAddFormValid ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: !isSubmitting && isAddFormValid ? '0 2px 14px rgba(0, 212, 170, 0.35)' : 'none',
                opacity: !isSubmitting && isAddFormValid ? 1 : 0.6
              }}
            >
              <FiPlus style={{ strokeWidth: 3 }} /> {isSubmitting ? 'Logging...' : 'Save Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
