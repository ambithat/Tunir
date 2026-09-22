import { useEffect, useRef } from 'react';
import tokenStore from '../api/tokenStore';
import axiosInstance from '../api/axiosInstance';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 Seconds
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 Minutes

/**
 * Star AI Sales - Presence & Screen Time Tracker Hook
 * 
 * - Sends periodic heartbeat ping { user_id, active_seconds: 30, session_id, action: null } every 30s
 * - Pauses heartbeat when tab is hidden or window loses focus (blur)
 * - Pauses heartbeat when user is idle for 2 minutes (no mouse/keyboard activity)
 * - Resumes immediately and pings on user return / focus
 * - Sends tab_closed signal with Bearer token on tab/window close (pagehide)
 * 
 * @param {boolean} isLoggedIn
 * @param {object} currentUser
 */
export const useHeartbeat = (isLoggedIn, currentUser = null) => {
  const heartbeatIntervalRef = useRef(null);
  const idleTimerRef = useRef(null);
  const isIdleRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || tokenStore.isLoggedOut()) return;

    // Ensure session_id exists in sessionStorage (uses RFC4122 UUID v4 for zero collision risk)
    let sessionId = sessionStorage.getItem('app_session_id');
    if (!sessionId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        sessionId = 'sess_' + crypto.randomUUID();
      } else {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      }
      sessionStorage.setItem('app_session_id', sessionId);
    }

    // Helper to get current userId
    const getCurrentUserId = () => {
      if (currentUser?.id) return currentUser.id;
      if (currentUser?.user_id) return currentUser.user_id;
      if (currentUser?.emp_id) return currentUser.emp_id;
      try {
        const stored = localStorage.getItem('user_data');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.id) return parsed.id;
          if (parsed?.user_id) return parsed.user_id;
          if (parsed?.emp_id) return parsed.emp_id;
        }
      } catch (_) {}
      return null;
    };

    // 1. Send Heartbeat API Call
    const sendHeartbeatPing = async (action = null) => {
      const token = tokenStore.getToken();
      if (!token || tokenStore.isLoggedOut()) return;

      const currentUserId = getCurrentUserId();
      const currentSessionId = sessionStorage.getItem('app_session_id') || sessionId;

      const payload = {
        user_id: currentUserId,
        active_seconds: action ? 0 : 30,
        session_id: currentSessionId,
        action: action
      };

      if (action === 'tab_closed') {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
     const backendUrl = process.env.REACT_APP_BACKEND_URL;

fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/auth/heartbeat`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(payload),
          keepalive: true
        }).catch((err) => console.warn('[useHeartbeat] Tab close ping failed:', err));
        return;
      }

      try {
        await axiosInstance.post('/auth/heartbeat', payload, { skipCache: true });
      } catch (err) {
        console.warn('[useHeartbeat] Ping failed:', err);
      }
    };

    // 2. Timer Controls
    const startHeartbeatTimer = () => {
      if (!heartbeatIntervalRef.current && !isIdleRef.current && !document.hidden && document.hasFocus()) {
        sendHeartbeatPing(); // Ping immediately on resume
        heartbeatIntervalRef.current = setInterval(() => {
          if (!document.hidden && document.hasFocus() && !isIdleRef.current) {
            sendHeartbeatPing();
          }
        }, HEARTBEAT_INTERVAL_MS);
      }
    };

    const stopHeartbeatTimer = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };

    // 3. User Activity & Idle Detection
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      if (isIdleRef.current) {
        isIdleRef.current = false;
        startHeartbeatTimer(); // User returned to desk
      }

      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        stopHeartbeatTimer(); // User away from desk for 2 mins -> Freeze heartbeat!
      }, IDLE_TIMEOUT_MS);
    };

    // 4. Register DOM Event Listeners
    const activityEvents = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];
    const handleUserActivity = () => {
      resetIdleTimer();
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // 5. Register Tab Visibility & Focus Listeners
    const handleVisibilityChange = () => {
      if (document.hidden) stopHeartbeatTimer(); // Switched tab / minimized -> Pause!
      else startHeartbeatTimer(); // Switched back -> Resume!
    };

    const handleBlur = () => stopHeartbeatTimer(); // Left browser window -> Pause!
    const handleFocus = () => startHeartbeatTimer(); // Returned to browser -> Resume!

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // 6. Tab Close Listener
    const handlePageHide = () => sendHeartbeatPing('tab_closed');
    window.addEventListener('pagehide', handlePageHide);

    // Start on App Mount
    startHeartbeatTimer();
    resetIdleTimer();

    // Cleanup
    return () => {
      stopHeartbeatTimer();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isLoggedIn, currentUser]);
};
