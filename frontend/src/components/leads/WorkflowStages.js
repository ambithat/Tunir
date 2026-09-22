


import React from 'react';

export default function WorkflowStages() {
  return (
    <div style={{
      background: '#04080D',
      border: '1px solid #162636',
      borderRadius: '12px',
      padding: '24px 28px',
      marginTop: '24px',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)'
    }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px'
      }}>
        <div style={{
          fontFamily: "'Helvetica'",
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#FFFFFF',
          textTransform: 'uppercase'
        }}>
          WORKFLOW STAGES
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#081017',
          border: '1px solid #162636',
          borderRadius: '6px',
          padding: '6px 14px',
          width: '200px'
        }}>
          <span style={{ color: '#00F5A0', fontSize: '13px' }}>🔍</span>
          <input
            placeholder="Select Indent ID..."
            readOnly
            value="IND-2026-981"
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12px',
              color: '#94A3B8',
              fontFamily: "'Helvetica'",
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Main Flow Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
        alignItems: 'center',
        position: 'relative'
      }}>
        
        {/* Step 1: MANAGER */}
        <div className="neon-card-green" style={{
          padding: '20px',
          textAlign: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div className="step-avatar-circle" data-step="1" style={{
            background: 'rgba(0, 245, 160, 0.12)',
            border: '2px solid #00F5A0',
            color: '#00F5A0',
            boxShadow: '0 0 16px rgba(0, 245, 160, 0.5)',
            marginBottom: '16px'
          }}>
            👤
          </div>
          <div style={{ fontFamily: "'Helvetica'", fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.04em' }}>
            MANAGER
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11.5px', fontWeight: 600, color: '#00F5A0', marginTop: '2px' }}>
            Requester
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Raise request
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="status-pill-approved">
              <span style={{ fontSize: '10px' }}>●</span> APPROVED
            </span>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', width: '100%' }}>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '10px', color: '#64748B' }}>
              12 May 2025 | 10:15 AM
            </div>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '12px', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
              Rohit Kumar
            </div>
          </div>
        </div>

        {/* Connector 1 */}
        <div style={{
          width: '60px',
          height: '2px',
          background: 'repeating-linear-gradient(90deg, #00F5A0, #00F5A0 4px, transparent 4px, transparent 8px)',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', right: '-4px', top: '-5px', color: '#00F5A0', fontSize: '10px' }}>►</span>
        </div>

        {/* Step 2: PRODUCT HEAD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div className="neon-card-cyan" style={{
            padding: '20px',
            textAlign: 'center',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}>
            <div className="step-avatar-circle" data-step="2" style={{
              background: 'rgba(0, 224, 255, 0.12)',
              border: '2px solid #00E0FF',
              color: '#00E0FF',
              boxShadow: '0 0 16px rgba(0, 224, 255, 0.5)',
              marginBottom: '16px'
            }}>
              👤
            </div>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.04em' }}>
              PRODUCT HEAD
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11.5px', fontWeight: 600, color: '#00E0FF', marginTop: '2px' }}>
              Reviewer
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              Review + vendor list
            </div>

            <div style={{ marginTop: '14px' }}>
              <span className="status-pill-progress">
                <span style={{ fontSize: '10px' }}>●</span> IN PROGRESS
              </span>
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', width: '100%' }}>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '10px', color: '#64748B' }}>
                12 May 2025 | 11:05 AM
              </div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '12px', fontWeight: 700, color: '#FFFFFF', marginTop: '2px' }}>
                Dept Head
              </div>
            </div>
          </div>

          {/* Vertical Link to Purchase Manager */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '2px', height: '16px', background: '#00E0FF' }} />
            <div style={{ color: '#00E0FF', fontSize: '10px' }}>▼</div>

            <div style={{
              background: '#081017',
              border: '1px dashed #162636',
              borderRadius: '8px',
              padding: '12px 16px',
              textAlign: 'center',
              width: '100%'
            }}>
              <div style={{ fontSize: '14px' }}>🛒</div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '11.5px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
                PURCHASE MANAGER
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#64748B' }}>
                Vendor list
              </div>
              <div style={{ marginTop: '8px' }}>
                <span className="status-pill-pending">
                  <span>○</span> NOT STARTED
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Connector 2 */}
        <div style={{
          width: '60px',
          height: '2px',
          background: 'repeating-linear-gradient(90deg, #64748B, #64748B 4px, transparent 4px, transparent 8px)',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', right: '-4px', top: '-5px', color: '#64748B', fontSize: '10px' }}>►</span>
        </div>

        {/* Step 3: Executive Review */}
        <div className="neon-card-purple" style={{
          padding: '20px',
          textAlign: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div className="step-avatar-circle" data-step="3" style={{
            background: 'rgba(192, 132, 252, 0.12)',
            border: '2px solid #C084FC',
            color: '#C084FC',
            boxShadow: '0 0 16px rgba(192, 132, 252, 0.5)',
            marginBottom: '16px'
          }}>
            🛡️
          </div>
          <div style={{ fontFamily: "'Helvetica'", fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.04em' }}>
            Executive Review
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11.5px', fontWeight: 600, color: '#00F5A0', marginTop: '2px' }}>
            Approver
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            Review + approval
          </div>

          <div style={{ marginTop: '14px' }}>
            <span className="status-pill-pending">
              <span>○</span> NOT STARTED
            </span>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', width: '100%', opacity: 0.4 }}>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '10px', color: '#64748B' }}>
              Pending...
            </div>
          </div>
        </div>

        {/* Connector 3 */}
        <div style={{
          width: '60px',
          height: '2px',
          background: 'repeating-linear-gradient(90deg, #64748B, #64748B 4px, transparent 4px, transparent 8px)',
          position: 'relative'
        }}>
          <span style={{ position: 'absolute', right: '-4px', top: '-5px', color: '#64748B', fontSize: '10px' }}>►</span>
        </div>

        {/* Step 4: Finance Approval */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div className="neon-card-orange" style={{
            padding: '20px',
            textAlign: 'center',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%'
          }}>
            <div className="step-avatar-circle" data-step="4" style={{
              background: 'rgba(255, 149, 0, 0.12)',
              border: '2px solid #FF9500',
              color: '#FF9500',
              boxShadow: '0 0 16px rgba(255, 149, 0, 0.5)',
              marginBottom: '16px'
            }}>
              ₹
            </div>
            <div style={{ fontFamily: "'Helvetica'", fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.04em' }}>
              Finance Approval
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11.5px', fontWeight: 600, color: '#00F5A0', marginTop: '2px' }}>
              Financial Approval
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              Review and select
            </div>

            <div style={{ marginTop: '14px' }}>
              <span className="status-pill-pending">
                <span>○</span> NOT STARTED
              </span>
            </div>
          </div>

          {/* Vertical Link to Finance */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '2px', height: '16px', background: '#00F5A0' }} />
            <div style={{ color: '#00F5A0', fontSize: '10px' }}>▼</div>

            <div style={{
              background: '#081017',
              border: '1px dashed #162636',
              borderRadius: '8px',
              padding: '12px 16px',
              textAlign: 'center',
              width: '100%'
            }}>
              <div style={{ fontSize: '14px' }}>📄</div>
              <div style={{ fontFamily: "'Helvetica'", fontSize: '11.5px', fontWeight: 700, color: '#FFFFFF', marginTop: '4px' }}>
                FINANCE
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#64748B' }}>
                Create PO
              </div>
              <div style={{ marginTop: '8px' }}>
                <span className="status-pill-pending">
                  <span>○</span> NOT STARTED
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
