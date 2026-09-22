import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import DashboardView from './components/dashboard/DashboardView';
import LeadRegisterView from './components/leads/LeadRegisterView';
import ContactsView from './components/contacts/ContactsView';
import UserManagementView from './components/admin/UserManagementView';
import ActivityView from './components/activities/ActivityView';
import AddLeadModal from './components/leads/AddLeadModal';
import AddContactModal from './components/contacts/AddContactModal';
import AddActivityModal from './components/activities/AddActivityModal';
import LeadDetailsDrawer from './components/leads/LeadDetailsDrawer';
import LoginView from './components/auth/LoginView';
import { useAuth } from './context/AuthContext';
import { useHeartbeat } from './hooks/useHeartbeat';
import { stopNotificationSse } from './api/notificationSse';
import { hasAdminAccess } from './utils/authRoles';
import {
  initNotificationSystem,
  _subscribe,
  _markOneRead,
  _markAllRead,
  clearNotifications
} from './components/notifications/NotificationDrawer';

function App() {
  const { isAuthenticated, user: currentUser, logout } = useAuth();
  useHeartbeat(isAuthenticated, currentUser);
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1024);
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' | 'leads' | 'activity' | 'contacts' | 'user_management'
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-collapse sidebar on smaller screens (Tablet / Mobile)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) {
        setSidebarCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [leads, setLeads] = useState([]);
  const [wonLeads, setWonLeads] = useState([]);
  const [activities, setActivities] = useState([]);
  const [contacts, setContacts] = useState([]);

  // Notifications State (Synced with singleton notification store)
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Filters
  const [selectedStageFilter, setSelectedStageFilter] = useState('all');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Modals & Drawers
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [selectedLeadDetails, setSelectedLeadDetails] = useState(null);

  // Apply theme to document root element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Reset activeView to 'dashboard' on logout/login or when non-admin user is on restricted view
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveView('dashboard');
    } else if (currentUser && !hasAdminAccess(currentUser) && activeView === 'user_management') {
      setActiveView('dashboard');
    }
  }, [isAuthenticated, currentUser, activeView]);

  // Manage Real-time SSE Connection & Notifications
  useEffect(() => {
    if (!isAuthenticated) {
      clearNotifications();
      stopNotificationSse();
      return;
    }

    initNotificationSystem();

    const unsub = _subscribe((list) => {
      setNotifications(list);
      setUnreadNotifCount(list.filter(n => n.unread || !n.is_viewed).length);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const updateAppBadge = async () => {
      const appTitle = 'TUNIR B2B Sales CRM - Star AI Theme';
      document.title = unreadNotifCount > 0 ? `(${unreadNotifCount}) ${appTitle}` : appTitle;

      if (!('setAppBadge' in navigator) || !('clearAppBadge' in navigator)) {
        return;
      }

      try {
        if (unreadNotifCount > 0) {
          await navigator.setAppBadge(unreadNotifCount);
        } else {
          await navigator.clearAppBadge();
        }
      } catch (error) {
        console.warn('[PWA] App badge update failed:', error);
      }
    };

    updateAppBadge();
  }, [unreadNotifCount]);

  const handleMarkAllNotificationsAsRead = () => {
    _markAllRead();
  };

  const handleMarkNotificationAsRead = (notificationId) => {
    _markOneRead(notificationId);
  };

  const [leadRefreshKey, setLeadRefreshKey] = useState(0);

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleNavigateToLeads = (options = {}) => {
    if (options.stage) setSelectedStageFilter(options.stage);
    if (options.owner) setSelectedOwnerFilter(options.owner);
    setLeadRefreshKey(prev => prev + 1);
    setActiveView('leads');
  };

  const handleNavigateToActivity = (options = {}) => {
    if (options.status) setSelectedStatusFilter(options.status);
    setActivityRefreshKey(prev => prev + 1);
    setActiveView('activity');
  };

  const handleViewChange = (viewId) => {
    if (viewId === 'user_management' && !hasAdminAccess(currentUser)) {
      setActiveView('dashboard');
      return;
    }
    setSelectedStageFilter('all');
    setSelectedOwnerFilter('all');
    setSelectedStatusFilter('all');
    setLastLeadAction(null);
    setLastActivityAction(null);
    setLastContactAction(null);
    if (viewId === 'leads') {
      setLeadRefreshKey(prev => prev + 1);
    } else if (viewId === 'contacts') {
      setContactRefreshKey(prev => prev + 1);
    } else if (viewId === 'activity') {
      setActivityRefreshKey(prev => prev + 1);
    }
    setActiveView(viewId);
  };

  useEffect(() => {
    const handleSwitch = (e) => {
      if (e.detail) {
        handleViewChange(e.detail);
      }
    };
    window.addEventListener('switch-view', handleSwitch);
    return () => window.removeEventListener('switch-view', handleSwitch);
  }, [currentUser]);

  const [lastLeadAction, setLastLeadAction] = useState(null);

  const handleAddLead = (newLead) => {
    setLeads(prev => [newLead, ...prev]);
    setLeadRefreshKey(prev => prev + 1);
    const company = newLead?.company || '';
    const leadId = newLead?.lead_id || 'New';
    setLastLeadAction({
      type: 'success',
      message: `Lead #${leadId}${company ? ` (${company})` : ''} created successfully!`,
      timestamp: Date.now()
    });
  };

  const [contactRefreshKey, setContactRefreshKey] = useState(0);
  const [lastContactAction, setLastContactAction] = useState(null);

  const handleAddContact = (newContact) => {
    setContacts(prev => [newContact, ...prev]);
    setContactRefreshKey(prev => prev + 1);
    const name = newContact?.contact_name || newContact?.company || '';
    const id = newContact?.contact_id || 'New';
    setLastContactAction({
      type: 'success',
      message: `Contact #${id}${name ? ` (${name})` : ''} created successfully!`,
      timestamp: Date.now()
    });
  };

  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [lastActivityAction, setLastActivityAction] = useState(null);

  const handleAddActivity = (newActivity) => {
    setActivities(prev => [newActivity, ...prev]);
    setActivityRefreshKey(prev => prev + 1);
    const id = newActivity?.activity_id || 'New';
    const summary = newActivity?.summary ? ` - ${newActivity.summary.slice(0, 30)}` : '';
    setLastActivityAction({
      type: 'success',
      message: `Activity #${id}${summary} created successfully!`,
      timestamp: Date.now()
    });
  };

  const handleUpdateLeadStage = (leadId, newStage, newStageKey, newProb) => {
    if (newStageKey === 'won') {
      const target = leads.find(l => l.id === leadId);
      if (target) {
        const updated = { ...target, stage: 'Won', stageKey: 'won', prob: '100%', probVal: 1.0, confidence: 'Won' };
        setLeads(prev => prev.filter(l => l.id !== leadId));
        setWonLeads(prev => [updated, ...prev]);
        setSelectedLeadDetails(updated);
        return;
      }
    }

    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          stage: newStage,
          stageKey: newStageKey,
          prob: newProb,
          probVal: parseFloat(newProb) / 100
        };
      }
      return l;
    }));

    if (selectedLeadDetails && selectedLeadDetails.id === leadId) {
      setSelectedLeadDetails(prev => ({
        ...prev,
        stage: newStage,
        stageKey: newStageKey,
        prob: newProb,
        probVal: parseFloat(newProb) / 100
      }));
    }
  };

  const handleUpdateLeadOwner = (leadId, newOwner) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) return { ...l, owner: newOwner };
      return l;
    }));
    if (selectedLeadDetails && selectedLeadDetails.id === leadId) {
      setSelectedLeadDetails(prev => ({ ...prev, owner: newOwner }));
    }
  };

  const handleToggleActivityComplete = (activityId) => {
    setActivities(prev => prev.map(act => {
      if (act.id === activityId) {
        const isComp = act.statusKey === 'completed';
        return {
          ...act,
          status: isComp ? 'Upcoming' : 'Completed',
          statusKey: isComp ? 'upcoming' : 'completed'
        };
      }
      return act;
    }));
  };

  const getScreenTitle = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'leads':
        return 'Lead Register';
      case 'activity':
        return ' Register Activities';
      case 'contacts':
        return 'Contacts Register';
      case 'user_management':
      case 'admin_settings':
      case 'admin':
        return 'Admin Settings';
      default:
        return 'Dashboard';
    }
  };

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="app-shell" data-theme={theme} style={{
      display: 'grid',
      gridTemplateColumns: sidebarCollapsed ? '64px 1fr' : 'clamp(185px, 14vw, 225px) 1fr',
      minHeight: '100vh',
      background: 'var(--t-bg)',
      color: 'var(--t-fg)',
      transition: 'grid-template-columns 260ms cubic-bezier(0.4, 0, 0.2, 1), background 200ms cubic-bezier(0.2,0.7,0.2,1)'
    }}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        openLeadsCount={leads.length}
        activitiesCount={activities.length}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        onLogout={logout}
        user={currentUser}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <Header
          screenTitle={getScreenTitle()}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          user={currentUser}
          onLogout={logout}
          notifications={notifications}
          unreadNotifCount={unreadNotifCount}
          onMarkAllNotificationsAsRead={handleMarkAllNotificationsAsRead}
          onMarkNotificationAsRead={handleMarkNotificationAsRead}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(prev => !prev)}
        />

        {/* Dynamic Views */}
        <div style={{ flex: 1, minWidth: 0, height: 'calc(100vh - 76px)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeView === 'dashboard' && (
            <DashboardView
              leads={leads}
              wonLeads={wonLeads}
              activities={activities}
              onNavigateToLeads={handleNavigateToLeads}
              onNavigateToActivity={handleNavigateToActivity}
              onOpenLeadDetails={(lead) => setSelectedLeadDetails(lead)}
            />
          )}

          {activeView === 'leads' && (
            <LeadRegisterView
              leads={leads}
              initialStageFilter={selectedStageFilter}
              initialOwnerFilter={selectedOwnerFilter}
              onOpenAddLead={() => setIsAddLeadOpen(true)}
              onOpenLeadDetails={(lead) => setSelectedLeadDetails(lead)}
              refreshKey={leadRefreshKey}
              lastAction={lastLeadAction}
            />
          )}

          {activeView === 'activity' && (
            <ActivityView
              initialStatusFilter={selectedStatusFilter}
              onOpenAddActivity={() => setIsAddActivityOpen(true)}
              onOpenLeadDetails={(lead) => setSelectedLeadDetails(lead)}
              refreshKey={activityRefreshKey}
              lastAction={lastActivityAction}
            />
          )}

          {activeView === 'contacts' && (
            <ContactsView
              contacts={contacts}
              onOpenAddContact={() => setIsAddContactOpen(true)}
              refreshKey={contactRefreshKey}
              lastAction={lastContactAction}
            />
          )}

          {activeView === 'user_management' && (
            <UserManagementView />
          )}
        </div>
      </main>

      {/* Add Lead Modal */}
      {isAddLeadOpen && (
        <AddLeadModal
          isOpen={isAddLeadOpen}
          onClose={() => setIsAddLeadOpen(false)}
          onAddLead={handleAddLead}
        />
      )}

      {/* Add Contact Modal */}
      {isAddContactOpen && (
        <AddContactModal
          isOpen={isAddContactOpen}
          onClose={() => setIsAddContactOpen(false)}
          onAddContact={handleAddContact}
        />
      )}

      {/* Add Activity Modal */}
      {isAddActivityOpen && (
        <AddActivityModal
          isOpen={isAddActivityOpen}
          onClose={() => setIsAddActivityOpen(false)}
          onAddActivity={handleAddActivity}
          leads={leads}
        />
      )}

      {/* Lead Details Slide-Over Drawer */}
      {Boolean(selectedLeadDetails) && (
        <LeadDetailsDrawer
          lead={selectedLeadDetails}
          isOpen={!!selectedLeadDetails}
          onClose={() => setSelectedLeadDetails(null)}
          onUpdateLeadStage={handleUpdateLeadStage}
          onUpdateLeadOwner={handleUpdateLeadOwner}
          onAddActivity={handleAddActivity}
        />
      )}
    </div>
  );
}

export default App;
