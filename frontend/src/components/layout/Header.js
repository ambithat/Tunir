import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  FiSun,
  FiMoon,
  FiBell,
  FiUser,
  FiMail,
  FiLogOut,
  FiCheckCircle,
  FiMenu,
  FiX,
  FiDownload
} from 'react-icons/fi';
import NotificationDrawer from '../notifications/NotificationDrawer';

const getPwaFlagUrl = () => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('edg/')) {
    return 'edge://flags/#unsafely-treat-insecure-origin-as-secure';
  }

  if (userAgent.includes('chrome/') || userAgent.includes('crios/')) {
    return 'chrome://flags/#unsafely-treat-insecure-origin-as-secure';
  }

  return '';
};

const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('[PWA] Clipboard copy failed:', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch (error) {
    console.warn('[PWA] Clipboard fallback failed:', error);
    return false;
  }
};

export default function Header({
  screenTitle,
  query,
  onQueryChange,
  theme,
  onToggleTheme,
  user,
  onLogout,
  notifications = [],
  unreadNotifCount = 0,
  onMarkAllNotificationsAsRead,
  onMarkNotificationAsRead,
  sidebarCollapsed,
  onToggleSidebar
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pwaHelpOpen, setPwaHelpOpen] = useState(false);
  const [pwaHelpMessage, setPwaHelpMessage] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
      }
      setDeferredPrompt(null);
      return;
    }

    if (!window.isSecureContext) {
      setPwaHelpOpen(true);
      return;
    }

    alert('Chrome has not made the install prompt available yet. Reload once, then use the browser install icon or this button.');
  };

  const handleAddTrustedOrigin = async () => {
    const flagUrl = getPwaFlagUrl();

    if (!flagUrl) {
      setPwaHelpMessage('Firefox desktop cannot install this as a PWA from HTTP. Use HTTPS, or use Chrome/Edge for local PWA testing.');
      await copyText(window.location.origin);
      return;
    }

    const setupText = [
      `Open: ${flagUrl}`,
      `Add this origin: ${window.location.origin}`,
      'Enable the flag, relaunch the browser, then reopen the app and click Install App again.'
    ].join('\n');
    const copied = await copyText(setupText);

    try {
      window.open(flagUrl, '_blank', 'noopener,noreferrer');
      setPwaHelpMessage(
        copied
          ? 'Setup details copied. If Chrome blocks the flags page, open the shown flag URL manually, paste the origin, enable it, and relaunch Chrome.'
          : 'Open the shown flag URL manually, paste the origin, enable it, and relaunch Chrome.'
      );
    } catch (error) {
      console.warn('[PWA] Browser blocked opening flags page:', error);
      setPwaHelpMessage(
        copied
          ? 'Setup details copied. Open the shown flag URL manually, paste the origin, enable it, and relaunch Chrome.'
          : 'Open the shown flag URL manually, paste the origin, enable it, and relaunch Chrome.'
      );
    }
  };

  const userName = user?.full_name || user?.name || (`${user?.first_name || ''} ${user?.last_name || ''}`.trim()) || user?.user_id || 'User';
  const userEmail = user?.email || '';
  const userRole = user?.designation || user?.role || user?.permission || '';
  const userEmpId = user?.emp_id || user?.leader_id || user?.user_id || user?.id || '';
  const userInitial = (userName[0] || 'U').toUpperCase();

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !e.target.closest('[data-notification-drawer="true"]')
      ) {
        setProfileOpen(false);
        setNotifsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header style={{
      height: 'clamp(64px, 6.5vh, 76px)',
      flexShrink: 0,
      background: 'var(--t-surface-solid)',
      backdropFilter: 'blur(16px) saturate(180%)',
      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      borderBottom: '1px solid var(--t-border)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div className="app-header-container" style={{
        margin: '0 auto',
        height: '100%',
        padding: '0 clamp(12px, 1.2vw, 20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ minWidth: 0 }}>
          <div className="header-title" style={{
            fontFamily: "'Helvetica'",
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--t-fg)',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            letterSpacing: '0.5px',
            textOverflow: 'ellipsis'
          }}>
            {screenTitle === 'Dashboard' ? 'Sales Pipeline Dashboard' : screenTitle}
          </div>
          <div className="header-subtitle" style={{
            fontSize: '13px',
            color: 'var(--t-fg-muted)',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {(() => {
              switch (screenTitle?.trim()) {
                case 'Admin Settings':
                case 'User Management':
                  return 'Manage user access, leader directory, product masters, permission delegation & executive reports';
                case 'Lead Register':
                  return 'Manage and track all lead opportunities across the sales pipeline';
                case 'Register Activities':
                case 'Activity Register':
                  return 'Log and monitor customer interactions, meetings, tasks, and follow-ups';
                case 'Contacts Register':
                case 'Contact Register':
                  return 'Central directory of business contacts, decision makers, and client profiles';
                case 'Dashboard':
                case 'Sales Pipeline Dashboard':
                default:
                  return 'Real-time overview of your sales performance and key pipeline metrics';
              }
            })()}
          </div>
        </div>

        <div
          ref={containerRef}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, position: 'relative' }}
        >
          {/* Notification Bell Button */}
          <button
            onClick={() => {
              setProfileOpen(false);
              setNotifsOpen(true);
            }}
            style={{
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: notifsOpen ? '1px solid #00D4AA' : '1px solid var(--t-border)',
              background: notifsOpen ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)',
              color: notifsOpen ? '#00D4AA' : 'var(--t-fg-muted)',
              borderRadius: '9px',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 160ms ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--t-teal)';
              e.currentTarget.style.color = 'var(--t-fg)';
            }}
            onMouseLeave={e => {
              if (!notifsOpen) {
                e.currentTarget.style.borderColor = 'var(--t-border)';
                e.currentTarget.style.color = 'var(--t-fg-muted)';
              }
            }}
            title="Notifications"
          >
            <FiBell style={{ fontSize: '17px' }} />
            {unreadNotifCount > 0 ? (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                borderRadius: '9px',
                background: '#FF8800',
                color: '#FFFFFF',
                fontSize: '10.5px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 10px rgba(255, 136, 0, 0.6)',
                border: '2px solid var(--t-bg)',
                fontFamily: "'Helvetica'"
              }}>
                {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
              </span>
            ) : notifications.length > 0 ? (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#00D4AA',
                boxShadow: '0 0 6px #00D4AA'
              }} />
            ) : null}
          </button>

          {/* Slide-out Notifications Drawer */}
          <NotificationDrawer
            isOpen={notifsOpen}
            onClose={() => setNotifsOpen(false)}
          />

          {/* PWA App Install Button */}
          {/* {!isStandalone && (
            <button
              onClick={handleInstallPwa}
              style={{
                height: '38px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: deferredPrompt ? '1px solid rgba(0, 212, 170, 0.45)' : '1px solid var(--t-border)',
                background: deferredPrompt ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)',
                color: deferredPrompt ? '#00D4AA' : 'var(--t-fg-muted)',
                borderRadius: '9px',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700,
                transition: 'all 160ms ease'
              }}
              title={deferredPrompt ? 'Install TUNIR CRM PWA App' : 'Install becomes available on HTTPS, localhost, or a trusted local HTTP origin'}
              onMouseEnter={e => (e.currentTarget.style.background = deferredPrompt ? 'rgba(0, 212, 170, 0.22)' : 'var(--t-surface-solid)')}
              onMouseLeave={e => (e.currentTarget.style.background = deferredPrompt ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)')}
            >
              <FiDownload style={{ fontSize: '15px' }} />
              <span>Install App</span>
            </button>
          )} */}

          {/* Theme Toggle Button */}
          {/* <button
            onClick={onToggleTheme}
            style={{
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--t-border)',
              background: 'var(--t-surface-alt)',
              color: theme === 'dark' ? '#00D4AA' : '#FFAA00',
              borderRadius: '9px',
              cursor: 'pointer',
              transition: 'all 160ms ease'
            }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = theme === 'dark' ? '#00D4AA' : '#FFAA00';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--t-border)';
            }}
          >
            {theme === 'dark' ? <FiMoon style={{ fontSize: '17px' }} /> : <FiSun style={{ fontSize: '17px' }} />}
          </button> */}

          {/* User Profile Circular Avatar Icon Trigger Only */}
          <div
            onClick={() => {
              setNotifsOpen(false);
              setProfileOpen(!profileOpen);
            }}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00D4AA, #00C6FF)',
              color: '#070C12',
              fontWeight: 900,
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(0, 212, 170, 0.35)',
              border: '2px solid rgba(0, 212, 170, 0.5)',
              cursor: 'pointer',
              fontFamily: "'Helvetica'",
              transition: 'all 160ms ease',
              position: 'relative'
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 22px rgba(0, 212, 170, 0.6)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 14px rgba(0, 212, 170, 0.35)'}
            title={`${userName} Profile`}
          >
            {userInitial}
            <span style={{
              position: 'absolute',
              bottom: '0px',
              right: '0px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#00D4AA',
              border: '2px solid var(--t-bg)',
              boxShadow: '0 0 6px #00D4AA'
            }} />
          </div>

          {/* Profile Dropdown Detail Section */}
          {profileOpen && (
            <div style={{
              position: 'absolute',
              top: '52px',
              right: 0,
              width: '300px',
              background: '#090e15',
              border: '1px solid rgba(0, 212, 170, 0.35)',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 30px rgba(0, 212, 170, 0.15)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              padding: '18px',
              zIndex: 1001
            }}>
              {/* Profile Card Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  minWidth: '46px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00D4AA, #00C6FF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#070C12',
                  fontWeight: 900,
                  fontSize: '20px',
                  fontFamily: "'Helvetica'",
                  boxShadow: '0 0 18px rgba(0, 212, 170, 0.45)'
                }}>
                  {userInitial}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--t-fg, #FFFFFF)', fontFamily: "'Helvetica'", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userName}
                  </div>
                  {userRole && (
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '5px', background: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <FiCheckCircle style={{ fontSize: '11px' }} /> {userRole}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Elaborate Details Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                {userEmpId && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiUser style={{ color: '#00D4AA', fontSize: '13px' }} /> Employee ID
                    </span>
                    <span style={{ fontSize: '12px', color: '#00D4AA', fontWeight: 700, fontFamily: "'Helvetica'", background: 'rgba(0, 212, 170, 0.12)', padding: '2px 7px', borderRadius: '5px', border: '1px solid rgba(0, 212, 170, 0.25)' }}>
                      {userEmpId}
                    </span>
                  </div>
                )}

                {userEmail && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FiMail style={{ color: '#38BDF8', fontSize: '13px' }} /> Email Address
                    </span>
                    <span style={{ fontSize: '12.5px', color: '#F8FAFC', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {userEmail}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div>
                <div
                  onClick={() => {
                    setProfileOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 12px', borderRadius: '9px', background: 'rgba(255, 75, 43, 0.1)', cursor: 'pointer', color: '#FF4B2B', fontSize: '13px', fontWeight: 700, border: '1px solid rgba(255, 75, 43, 0.25)', transition: 'all 140ms ease' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 75, 43, 0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 75, 43, 0.1)'}
                >
                  <FiLogOut style={{ fontSize: '15px' }} /> logout
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {pwaHelpOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(4, 8, 14, 0.78)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '430px',
            background: 'var(--t-surface-solid, #0d131a)',
            border: '1px solid rgba(0, 212, 170, 0.35)',
            borderRadius: '14px',
            boxShadow: '0 28px 70px rgba(0, 0, 0, 0.65)',
            padding: '22px',
            color: 'var(--t-fg, #FFFFFF)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setPwaHelpOpen(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--t-border)',
                background: 'var(--t-surface-alt)',
                color: 'var(--t-fg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close"
            >
              <FiX />
            </button>

            <div style={{
              fontFamily: "'Helvetica'",
              fontSize: '18px',
              fontWeight: 800,
              marginBottom: '10px',
              paddingRight: '36px'
            }}>
              PWA install needs a trusted origin
            </div>

            <div style={{
              fontSize: '13px',
              lineHeight: 1.55,
              color: 'var(--t-fg-muted)',
              marginBottom: '14px'
            }}>
              Browser security will not let this app add itself automatically. Open the flag page manually, paste the origin below, enable it, relaunch Chrome, then install again.
            </div>

            {getPwaFlagUrl() && (
              <div style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 198, 255, 0.07)',
                border: '1px solid rgba(0, 198, 255, 0.22)',
                fontFamily: "'Helvetica'",
                fontSize: '11.5px',
                color: '#7DD3FC',
                wordBreak: 'break-all',
                marginBottom: '12px'
              }}>
                {getPwaFlagUrl()}
              </div>
            )}

            <div style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--t-border)',
              fontFamily: "'Helvetica'",
              fontSize: '12px',
              color: '#00D4AA',
              wordBreak: 'break-all',
              marginBottom: '16px'
            }}>
              {window.location.origin}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => copyText(window.location.origin)}
                style={{
                  height: '36px',
                  padding: '0 13px',
                  borderRadius: '8px',
                  border: '1px solid var(--t-border)',
                  background: 'var(--t-surface-alt)',
                  color: 'var(--t-fg)',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                Copy Origin
              </button>
              <button
                type="button"
                onClick={handleAddTrustedOrigin}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 212, 170, 0.45)',
                  background: 'rgba(0, 212, 170, 0.14)',
                  color: '#00D4AA',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 800
                }}
              >
                Add Now
              </button>
            </div>

            {pwaHelpMessage && (
              <div style={{
                marginTop: '12px',
                fontSize: '12px',
                lineHeight: 1.45,
                color: '#FBBF24'
              }}>
                {pwaHelpMessage}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}



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
                  if (onLogout) onLogout();
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
    </header>
  );
}
