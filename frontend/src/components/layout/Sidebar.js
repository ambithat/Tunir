import React from 'react';
import ReactDOM from 'react-dom';
import {
  FiGrid,
  FiZap,
  FiFileText,
  FiUsers,
  FiUserCheck,
  FiLogOut,
  FiChevronsLeft,
  FiChevronsRight
} from 'react-icons/fi';
import Logo from "../Images/Logo.png";
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../utils/authRoles';

export default function Sidebar({
  activeView,
  onViewChange,
  openLeadsCount,
  activitiesCount,
  collapsed,
  onToggleCollapse,
  user,
  onLogout
}) {
  let authContext = {};
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authContext = useAuth();
  } catch (_) {
    authContext = {};
  }

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const activeUser = user || authContext.user;
  const handleLogout = onLogout || authContext.logout;
  const canAccessAdmin = hasAdminAccess(activeUser);

  const displayName = activeUser?.full_name || activeUser?.fullName || activeUser?.name ||
    (activeUser?.first_name ? `${activeUser.first_name} ${activeUser.last_name || ''}`.trim() : '') ||
    activeUser?.email?.split('@')[0] || 'User';

  const designation = activeUser?.designation || activeUser?.role || 'Sales Lead Manager';

  // Compute initials (e.g. "Neel Kamat" -> "NK", "John" -> "J", "admin@tardid.com" -> "AD")
  const getInitials = (nameStr) => {
    if (!nameStr) return 'U';
    const parts = nameStr.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const userInitials = getInitials(displayName);
  const mainNav = [
    { id: 'dashboard', label: 'Dashboard', icon: FiGrid, count: null },
    { id: 'leads', label: 'Lead Register', icon: FiFileText, count: null },
    { id: 'activity', label: 'Register Activities', icon: FiZap, count: null },
    { id: 'contacts', label: 'Contacts', icon: FiUsers, count: null },
  ];

  const systemNav = canAccessAdmin
    ? [{ id: 'user_management', label: 'Admin Settings', icon: FiUserCheck, count: null }]
    : [];

  const renderNavItem = (item) => {
    const isActive = activeView === item.id;
    const IconComponent = item.icon;
    return (
      <div
        key={item.id}
        onClick={() => onViewChange(item.id)}
        title={collapsed ? item.label : undefined}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : '10px',
          height: 'clamp(38px, 4.2vh, 46px)',
          width: collapsed ? '46px' : 'auto',
          margin: collapsed ? '0 auto' : '0',
          padding: collapsed ? '0' : '0 10px',
          justifyContent: 'center',
          borderRadius: '10px',
          cursor: 'pointer',
          background: isActive ? 'var(--t-teal-tint)' : 'transparent',
          color: isActive ? 'var(--t-teal)' : 'var(--t-fg-mid)',
          border: `1px solid ${isActive ? 'var(--t-teal-deep)' : 'transparent'}`,
          boxShadow: isActive ? '0 0 16px rgba(0, 212, 170, 0.15)' : 'none',
          backdropFilter: 'blur(12px)',
          transition: 'all 160ms cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden'
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--t-row-hover)';
            e.currentTarget.style.color = 'var(--t-fg)';
            e.currentTarget.style.borderColor = 'var(--t-border)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--t-fg-mid)';
            e.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        {isActive && !collapsed && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: '6px',
            bottom: '6px',
            width: '4px',
            borderRadius: '0 4px 4px 0',
            background: 'linear-gradient(180deg, #00D4AA, #00C6FF)',
            boxShadow: '0 0 12px #00D4AA'
          }} />
        )}
        <IconComponent
          style={{
            fontSize: 'clamp(17px, 1.3vw, 20px)',
            flexShrink: 0,
            color: isActive ? 'var(--t-teal)' : 'var(--t-fg-muted)',
            filter: isActive ? 'drop-shadow(0 0 6px rgba(0, 212, 170, 0.6))' : 'none',
            transition: 'all 160ms ease'
          }}
        />
        {/* Label & Badge — hidden when collapsed */}
        {!collapsed && (
          <span style={{
            fontFamily: "Helvetica",
            fontSize: 'clamp(12px, 1.05vw, 14.5px)',
            fontWeight: isActive ? 700 : 600,
            color: isActive ? 'var(--t-teal)' : 'var(--t-fg-mid)',
            whiteSpace: 'nowrap',
            letterSpacing: '0.01em',
            marginRight: 'auto'
          }}>
            {item.label}
          </span>
        )}
        {item.count !== null && !collapsed && (
          <span style={{
            fontFamily: "'Helvetica'",
            fontSize: 'clamp(10px, 0.85vw, 11.5px)',
            fontWeight: 800,
            padding: '2px 7px',
            borderRadius: '999px',
            background: isActive ? 'var(--t-teal-tint)' : 'var(--t-surface-alt)',
            color: isActive ? 'var(--t-teal)' : 'var(--t-fg-muted)',
            border: `1px solid ${isActive ? 'var(--t-teal)' : 'var(--t-border)'}`,
            flexShrink: 0
          }}>
            {item.count}
          </span>
        )}
      </div>
    );
  };

  return (
    <aside style={{
      width: collapsed ? '64px' : 'clamp(185px, 14vw, 225px)',
      flexShrink: 0,
      background: 'var(--t-surface-solid)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRight: '1px solid var(--t-border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      userSelect: 'none',
      zIndex: 20,
      transition: 'width 260ms cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden'
    }}>

      {/* Brand Header - Clicking Logo or Brand Text navigates to Dashboard */}
      <div className="sidebar-brand-header"
        onClick={() => onViewChange && onViewChange('dashboard')}
        title="Go to Dashboard Home"
        style={{
          height: 'clamp(64px, 6.5vh, 76px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 16px',
          gap: collapsed ? '0' : '8px',
          borderBottom: '1px solid var(--t-border)',
          flexShrink: 0,
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {/* Centered Logo Shield Container */}
        <div
          style={{
            width: '48px',
            height: '48px',
            minWidth: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '3px',
            flexShrink: 0,
            cursor: 'pointer',
            margin: collapsed ? '0 auto' : '0',
            boxSizing: 'border-box'
          }}
        >
          <img
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
            src={Logo}
            alt="TUNIR Logo"
          />
        </div>

        {/* Brand Text */}
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{
              fontFamily: "Helvetica",
              fontSize: 'clamp(22px, 2.2vw, 27px)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              background: 'linear-gradient(135deg, #FFFFFF 30%, #00D4AA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              TUNIR
            </div>

            {/* Sharp Separator Line */}
            {/* <div style={{
              height: '1px',
              width: '90%',
              marginTop: '4px',
              marginBottom: '4px',
              background: 'linear-gradient(90deg, #00D4AA 0%, #00C6FF 75%, transparent 100%)',
              opacity: 0.95
            }} /> */}

            {/* <div style={{
              fontFamily: "'Inter', 'Helvetica', sans-serif",
              fontSize: 'clamp(8.5px, 0.7vw, 9.5px)',
              color: 'var(--t-teal)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              marginTop: '1px',
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              SALES CRM
            </div> */}
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <nav style={{
        flex: 1,
        padding: collapsed ? '16px 0' : '16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>

        {/* Core Group */}
        <div>
          {!collapsed && (
            <div style={{
              fontFamily: "'Helvetica'",
              fontSize: 'clamp(9.5px, 0.8vw, 11px)',
              fontWeight: 800,
              letterSpacing: '0.16em',
              color: 'var(--t-fg-subtle)',
              textTransform: 'uppercase',
              padding: '0 10px 10px'
            }}>
              Core Workspace
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {mainNav.map(renderNavItem)}
          </div>
        </div>

        {/* System Group (Restricted to Admin only) */}
        {canAccessAdmin && systemNav.length > 0 && (
          <>
            <div style={{
              height: '1px',
              background: 'var(--t-border)',
              margin: collapsed ? '0 12px' : '0 6px'
            }} />

            <div>
              {!collapsed && (
                <div style={{
                  fontFamily: "'Helvetica'",
                  fontSize: 'clamp(9.5px, 0.8vw, 11px)',
                  fontWeight: 800,
                  letterSpacing: '0.16em',
                  color: 'var(--t-fg-subtle)',
                  textTransform: 'uppercase',
                  padding: '0 10px 10px'
                }}>
                  System
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {systemNav.map(renderNavItem)}
              </div>
            </div>
          </>
        )}

      </nav>

      {/* User Profile Card */}
      <div style={{
        margin: collapsed ? '12px auto' : '12px 10px',
        padding: collapsed ? '0' : '8px 10px',
        width: collapsed ? '46px' : 'auto',
        height: collapsed ? '46px' : 'auto',
        borderRadius: '12px',
        background: 'var(--t-surface-alt)',
        border: '1px solid var(--t-border)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: collapsed ? 0 : '10px',
        overflow: 'hidden',
        transition: 'all 260ms cubic-bezier(0.4, 0, 0.2, 1)',
        flexShrink: 0
      }}>
        <div
          onClick={onToggleCollapse}
          style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title={collapsed ? "Click to expand sidebar" : "Click to collapse sidebar"}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #00D4AA, #00C6FF)',
            color: '#070C12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Helvetica'",
            fontSize: '13px',
            fontWeight: 800,
            boxShadow: '0 0 14px rgba(0, 212, 170, 0.35)',
            userSelect: 'none'
          }}>
            {userInitials}
          </div>
          <span style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '8px',
            height: '8px',
            borderRadius: '999px',
            background: '#00D4AA',
            border: '2px solid var(--t-bg)',
            boxShadow: '0 0 6px #00D4AA'
          }} />
        </div>

        {/* Name / role — hidden when collapsed */}
        {!collapsed && (
          <div style={{
            minWidth: 0,
            flex: 1,
            whiteSpace: 'nowrap'
          }}>
            <div style={{
              fontSize: 'clamp(11.5px, 0.95vw, 13.5px)',
              fontWeight: 700,
              color: 'var(--t-fg)',
              letterSpacing: '0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={displayName}>
              {displayName}
            </div>
            <div style={{
              fontFamily: "'Helvetica'",
              fontSize: 'clamp(9px, 0.75vw, 10.5px)',
              color: 'var(--t-fg-muted)',
              marginTop: '1px',
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={designation}>
              {designation}
            </div>
          </div>
        )}

        {/* Collapse toggle icon button inside User Profile Card */}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            style={{
              background: 'var(--t-teal-tint)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-teal)',
              fontSize: '14px',
              cursor: 'pointer',
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 160ms ease',
              flexShrink: 0
            }}
            title="Collapse sidebar"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--t-teal)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(0, 212, 170, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--t-border)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <FiChevronsLeft />
          </button>
        )}
      </div>

      {/* Confirm Logout Popup */}
      {showLogoutConfirm && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(4, 8, 14, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--t-surface-solid, #0d131a)',
            border: '1px solid rgba(0, 212, 170, 0.35)',
            borderRadius: '20px',
            maxWidth: '400px',
            width: '100%',
            padding: '28px 24px 24px',
            boxShadow: 'var(--t-card-shadow, 0 30px 70px rgba(0, 0, 0, 0.95))',
            position: 'relative',
            overflow: 'hidden',
            textAlign: 'center'
          }}>
            {/* Centered Logout Icon Circle */}
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(0, 212, 170, 0.12)',
              border: '1px solid rgba(0, 212, 170, 0.3)',
              color: '#00D4AA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              margin: '0 auto 16px'
            }}>
              <FiLogOut />
            </div>

            {/* Title */}
            <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', letterSpacing: '-0.01em', textAlign: 'center' }}>
              Confirm Logout
            </h3>

            {/* Subtitle / Description */}
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--t-fg-muted, #94A3B8)', lineHeight: 1.55, textAlign: 'center' }}>
              Are you sure you want to log out of your session?
            </p>

            {/* 50/50 Equal Width Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '9px',
                  background: 'rgba(255, 255, 255, 0.05)',
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
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (handleLogout) handleLogout();
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #00D4AA, #00C6FF)',
                  border: 'none',
                  color: '#070C12',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 14px rgba(0, 212, 170, 0.35)'
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </aside>
  );
}
