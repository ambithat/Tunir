// src/components/dashboard/DashboardDrillDownDrawer.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FiX,
  FiArrowRight,
  FiSearch,
  FiPackage,
  FiUsers,
  FiBriefcase,
  FiEye,
  FiBarChart2,
  FiLayers,
  FiAward,
  FiChevronLeft,
  FiChevronRight,
  FiPaperclip,
  FiExternalLink,
  FiFileText,
  FiGlobe,
  FiUser
} from 'react-icons/fi';
import { getLeads } from '../../api/leadApi';
import { useAuth } from '../../context/AuthContext';
import { isExecutive } from '../../utils/authRoles';
import ReactDOM from 'react-dom';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function getProposalDocumentUrl(url) {
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
}

function handleOpenProposalDoc(url) {
  if (!url) return;
  const fullUrl = getProposalDocumentUrl(url);
  if (fullUrl) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
}

function getProposalFileName(url) {
  if (!url) return 'Document';
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const parts = cleanUrl.split('/');
    const last = parts[parts.length - 1];
    return last && last.length > 3 ? last : 'Document Link';
  } catch {
    return 'Document Link';
  }
}
function getProposalEntries(item, parentLead = null) {
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
        created_by: p.created_by || null
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
        created_by: p.created_by || null
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
}

export default function DashboardDrillDownDrawer({
  isOpen,
  kpi,
  onClose,
  onNavigateToLeads,
  dashboardSummary,
  allLeads = [],
  wonLeads = []
}) {
  const { user: currentUser } = useAuth();
  const isExecUser = isExecutive(currentUser);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState('records'); // 'records' | 'products' | 'leaders'
  const [execScope, setExecScope] = useState('all'); // 'all' | 'my'
  const [liveLeads, setLiveLeads] = useState([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [selectedDetailLead, setSelectedDetailLead] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [cursorHistory, setCursorHistory] = useState([null]);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // In-memory request cache to prevent duplicate API calls
  const pageCacheRef = useRef({});

  // 1. Debounce Search Input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
      setCursorHistory([null]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Reset on Drawer Open or KPI Change
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setDebouncedSearch('');
      setCurrentPage(1);
      setCursorHistory([null]);
      setActiveTab('records');
      setSelectedDetailLead(null);
      setExecScope('all');
      pageCacheRef.current = {};
    }
  }, [isOpen, kpi?.label, kpi?.status_id, kpi?.stage_id]);

  // Listen for global data invalidation (e.g. register edit/update)
  useEffect(() => {
    const handleInvalidate = () => {
      pageCacheRef.current = {};
    };
    window.addEventListener('app_data_invalidated', handleInvalidate);
    return () => window.removeEventListener('app_data_invalidated', handleInvalidate);
  }, []);

  // 3. Keyset Pagination & Filtered Fetching from API
  useEffect(() => {
    if (!isOpen || !kpi) return;

    const statusId = kpi.status_id !== undefined ? kpi.status_id : null;
    const stageId = kpi.stage_id !== undefined ? kpi.stage_id : null;

    // Resolve logged in user ID for 'my' scope
    const myOwnerId = currentUser?.leader_id || currentUser?.emp_id || currentUser?.id || dashboardSummary?.lead_owner_id || dashboardSummary?.leader_id || dashboardSummary?.id || null;

    // When non-exec OR when exec toggles to 'my', pass lead_owner_id in API request
    const targetOwnerId = (!isExecUser || execScope === 'my') ? myOwnerId : null;
    const isActive = true;
    const currentCursor = cursorHistory[currentPage - 1] || null;

    const cacheKey = `kpi_${kpi.label}_st_${statusId}_sg_${stageId}_ldr_${targetOwnerId}_act_${isActive}_q_${debouncedSearch.trim()}_c_${currentCursor || 'root'}_p_${currentPage}`;

    // Return from cache if already fetched (avoids multiple network calls)
    if (pageCacheRef.current[cacheKey]) {
      const cached = pageCacheRef.current[cacheKey];
      setLiveLeads(cached.items);
      setHasMore(cached.hasMore);
      setTotalCount(cached.totalCount);
      setIsLoadingLeads(false);
      return;
    }

    setIsLoadingLeads(true);

    const params = {
      limit: 100,
      cursor: currentCursor,
      search: debouncedSearch.trim() || null,
      status_id: statusId,
      stage_id: stageId,
      lead_owner_id: targetOwnerId || null,
      is_active: true
    };

    getLeads(params)
      .then(res => {
        let list = [];
        if (Array.isArray(res?.data)) list = res.data;
        else if (Array.isArray(res?.leads)) list = res.leads;
        else if (Array.isArray(res)) list = res;

        const nextCursor = res?.next_cursor || res?.cursor || null;
        const total = res?.total_count || res?.total || (res?.count !== undefined ? res.count : list.length);
        const moreAvailable = Boolean(res?.has_more) || (list.length === pageSize && Boolean(nextCursor));

        pageCacheRef.current[cacheKey] = {
          items: list,
          hasMore: moreAvailable,
          nextCursor,
          totalCount: total
        };

        setLiveLeads(list);
        setHasMore(moreAvailable);
        setTotalCount(total);
      })
      .catch(err => {
        console.warn('[DashboardDrillDownDrawer] API fetch error:', err);
        setLiveLeads(allLeads);
      })
      .finally(() => {
        setIsLoadingLeads(false);
      });
  }, [isOpen, kpi?.label, kpi?.status_id, kpi?.stage_id, kpi?.is_active, debouncedSearch, currentPage, pageSize, cursorHistory, allLeads, kpi, execScope, isExecUser, currentUser]);

  // Handle scope toggle switch for executive users (resets pagination to page 1)
  const handleExecScopeToggle = (newScope) => {
    if (execScope === newScope) return;
    setExecScope(newScope);
    setCurrentPage(1);
    setCursorHistory([null]);
    setSelectedDetailLead(null);
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedDetailLead) {
          setSelectedDetailLead(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedDetailLead]);

  // Combine and filter lead records (Executive users can toggle 'all' vs 'my'; non-executives see ONLY their data)
  const poolOfLeads = useMemo(() => {
    let source = liveLeads.length > 0 ? liveLeads : allLeads;

    const isUserScoped = !isExecUser || execScope === 'my';

    if (isUserScoped) {
      const targetOwnerId = currentUser?.leader_id || currentUser?.emp_id || currentUser?.id || dashboardSummary?.lead_owner_id || dashboardSummary?.leader_id || dashboardSummary?.id;
      const tId = (targetOwnerId || '').toString();
      const tEmail = (currentUser?.email || dashboardSummary?.lead_owner_email || dashboardSummary?.email || '').toLowerCase().trim();
      const tName = (currentUser?.name || `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}` || dashboardSummary?.lead_owner_name || dashboardSummary?.name || '').toLowerCase().trim();

      source = source.filter(lead => {
        const lId = (lead.lead_owner_id || lead.leader_id || lead.owner_id || '').toString();
        const lEmail = (lead.lead_owner_email || lead.email || '').toLowerCase().trim();
        const lName = (lead.lead_owner_name || lead.owner || '').toLowerCase().trim();

        if (tId && lId && lId === tId) return true;
        if (tEmail && lEmail && lEmail === tEmail) return true;
        if (tName && lName && (lName.includes(tName) || tName.includes(lName))) return true;

        return false;
      });
    }

    return source.map(lead => {
      const prods = Array.isArray(lead.products) ? lead.products : [];
      const totalVal = prods.length > 0
        ? prods.reduce((sum, p) => sum + (Number(p.project_value) || 0), 0)
        : (Number(lead.project_value) || Number(lead.value) || 0);

      const totalPipelineVal = prods.length > 0
        ? prods.reduce((sum, p) => sum + (p.pipeline !== undefined && p.pipeline !== null ? Number(p.pipeline) : 0), 0)
        : (lead.pipeline !== undefined && lead.pipeline !== null ? Number(lead.pipeline) : 0);

      const totalWonVal = prods.length > 0
        ? prods.reduce((sum, p) => sum + (Number(p.won) || 0), 0)
        : (Number(lead.won) || 0);

      const primaryStage = (prods[0]?.stage_name || lead.stage_name || lead.stage || '').toLowerCase();
      const primaryStatus = (prods[0]?.status_name || lead.status_name || lead.status || '').toLowerCase();

      return {
        ...lead,
        calculatedValue: totalVal,
        calculatedPipeline: totalPipelineVal,
        calculatedWon: totalWonVal,
        primaryStage,
        primaryStatus,
        productsList: prods
      };
    });
  }, [liveLeads, allLeads, dashboardSummary, currentUser, isExecUser, execScope]);

  // Filter leads matching this specific KPI category
  const matchingLeads = useMemo(() => {
    if (!kpi) return [];

    const label = (kpi.label || '').toLowerCase();
    const filterStage = (kpi.filter?.stage || '').toLowerCase();

    const checkIsLost = (lead) => {
      if (lead.primaryStage.includes('lost') || lead.primaryStatus.includes('lost')) return true;
      if (lead.productsList && lead.productsList.length > 0 && lead.productsList.every(p => (p.stage_name || p.status_name || '').toLowerCase().includes('lost'))) return true;
      return false;
    };

    // If liveLeads was fetched directly from the API for this KPI:
    if (liveLeads && liveLeads.length > 0) {
      if (label.includes('weighted')) {
        return poolOfLeads.filter(lead => !checkIsLost(lead));
      }
      return poolOfLeads;
    }

    return poolOfLeads.filter(lead => {
      if (label.includes('total lead')) {
        return true;
      }

      if (label.includes('contacted')) {
        return lead.primaryStatus.includes('contact') ||
          lead.primaryStage.includes('contact') ||
          lead.productsList.some(p => (p.status_name || '').toLowerCase().includes('contact') || (p.stage_name || '').toLowerCase().includes('contact'));
      }

      if (label.includes('qualified')) {
        return lead.primaryStage.includes('qualified') ||
          lead.primaryStatus.includes('qualified') ||
          lead.productsList.some(p => (p.status_name || '').toLowerCase().includes('qualified') || (p.stage_name || '').toLowerCase().includes('qualified'));
      }

      if (label.includes('proposal')) {
        return lead.primaryStatus.includes('proposal') ||
          lead.primaryStage.includes('proposal') ||
          lead.productsList.some(p => (p.status_name || '').toLowerCase().includes('proposal') || (p.stage_name || '').toLowerCase().includes('proposal'));
      }

      if (label.includes('negotiation')) {
        return lead.primaryStage.includes('negotiation') ||
          lead.primaryStatus.includes('negotiation') ||
          lead.confidence === 'Negotiation' ||
          lead.productsList.some(p => (p.stage_name || '').toLowerCase().includes('negotiation') || (p.status_name || '').toLowerCase().includes('negotiation'));
      }

      if (label.includes('lost')) {
        return checkIsLost(lead) ||
          lead.productsList.some(p => (p.stage_name || '').toLowerCase().includes('lost') || (p.status_name || '').toLowerCase().includes('lost') || (p.risk_matrix || '').toLowerCase().includes('lost'));
      }

      if (label.includes('won')) {
        return lead.calculatedWon > 0 ||
          lead.primaryStage.includes('won') ||
          lead.primaryStatus.includes('won') ||
          lead.productsList.some(p => Number(p.won) > 0 || (p.stage_name || '').toLowerCase().includes('won') || (p.status_name || '').toLowerCase().includes('won'));
      }

      if (label.includes('weighted')) {
        return !checkIsLost(lead);
      }

      return true;
    });
  }, [kpi, poolOfLeads, liveLeads]);

  // Search filtered records within drawer
  const searchedLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchingLeads;

    return matchingLeads.filter(lead => {
      const id = String(lead.lead_id || lead.id || '').toLowerCase();
      const comp = String(lead.company || lead.account || '').toLowerCase();
      const owner = String(lead.lead_owner_name || lead.owner || '').toLowerCase();
      const contact = String(lead.contact_name || lead.contact || '').toLowerCase();
      const prods = lead.productsList.map(p => String(p.product_name || p.product || '').toLowerCase()).join(' ');

      return id.includes(q) || comp.includes(q) || owner.includes(q) || contact.includes(q) || prods.includes(q);
    });
  }, [matchingLeads, searchQuery]);

  // Drawer Pagination Calculation
  const totalRecords = searchedLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedLeads = searchedLeads.slice(startIndex, startIndex + pageSize);
  const startItem = totalRecords === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + pageSize, totalRecords);

  // Aggregate Category Metrics
  const metrics = useMemo(() => {
    const displayTotalCount = totalCount > 0
      ? totalCount
      : (kpi?.value !== undefined && !isNaN(Number(kpi.value))
        ? Number(kpi.value)
        : matchingLeads.length);

    const totalValue = matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0);
    const totalWonRevenue = matchingLeads.reduce((sum, l) => sum + (l.calculatedWon || 0), 0);
    const avgDealValue = displayTotalCount > 0 ? Math.round(totalValue / displayTotalCount) : 0;

    // Product breakdown
    const productMap = {};
    matchingLeads.forEach(lead => {
      lead.productsList.forEach(p => {
        const name = p.product_name || p.product || `Product #${p.product_id || 1}`;
        if (!productMap[name]) {
          productMap[name] = { name, count: 0, totalVal: 0, wonVal: 0 };
        }
        productMap[name].count += (Number(p.quantity) || 1);
        productMap[name].totalVal += (Number(p.project_value) || 0);
        productMap[name].wonVal += (Number(p.won) || 0);
      });
    });
    const productStats = Object.values(productMap).sort((a, b) => b.totalVal - a.totalVal);

    // Leader breakdown
    const leaderMap = {};
    matchingLeads.forEach(lead => {
      const name = lead.lead_owner_name || lead.owner || 'Unassigned';
      if (!leaderMap[name]) {
        leaderMap[name] = { name, count: 0, totalVal: 0, wonVal: 0 };
      }
      leaderMap[name].count += 1;
      leaderMap[name].totalVal += lead.calculatedValue;
      leaderMap[name].wonVal += lead.calculatedWon;
    });
    const leaderStats = Object.values(leaderMap).sort((a, b) => b.totalVal - a.totalVal);

    return {
      totalCount: displayTotalCount,
      totalValue,
      totalWonRevenue,
      avgDealValue,
      productStats,
      leaderStats
    };
  }, [matchingLeads, totalCount, kpi?.value]);

  // Dynamic header summary cards tailored to the clicked KPI card using exact SSE summary metrics
  const headerCards = useMemo(() => {
    const label = (kpi?.label || '').toLowerCase();
    const ds = dashboardSummary || {};
    const isMyScope = isExecUser && execScope === 'my';

    // Safely extract summary metrics supporting both activeLeaderRecord schema and global summary schema
    const totalProjVal = isMyScope
      ? matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0)
      : Number(ds.total_project_value ?? metrics.totalValue ?? 0);

    const totalPipeVal = isMyScope
      ? matchingLeads.reduce((sum, l) => sum + (l.calculatedPipeline || 0), 0)
      : Number(ds.total_pipeline_amount ?? metrics.totalValue ?? 0);

    const totalLeadsCount = isMyScope
      ? matchingLeads.length
      : Number(ds.total_leads ?? metrics.totalCount ?? 0);

    const formattedTotalProjVal = `₹${totalProjVal.toLocaleString('en-IN')}`;

    if (label.includes('lost')) {
      const lostProjVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0)
        : Number(ds.lost_project_value ?? 0);
      const lostCount = isMyScope
        ? matchingLeads.length
        : Number(ds.lost ?? ds.lost_projects ?? metrics.totalCount ?? 0);

      return [
        { label: 'TOTAL PROJECT VALUE', value: `₹${Math.round(totalProjVal).toLocaleString('en-IN')}` },
        { label: 'LOST PROJECT VALUE', value: `₹${Math.round(lostProjVal).toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'LOST PROJECTS', value: String(lostCount) }
      ];
    }

    if (label.includes('negotiation')) {
      const negoProjVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0)
        : Number(ds.negotiation_project_value ?? 0);
      const negoPipeVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedPipeline || 0), 0)
        : Number(ds.negotiation_pipeline_amount ?? 0);
      const negoCount = isMyScope
        ? matchingLeads.length
        : Number(ds.negotiation ?? ds.total_leads_in_negotiations ?? metrics.totalCount ?? 0);

      return [
        { label: 'PROJECT VALUE', value: `₹${negoProjVal.toLocaleString('en-IN')}` },
        { label: 'PIPELINE VALUE', value: `₹${negoPipeVal.toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'NEGOTIATION LEADS', value: String(negoCount) }
      ];
    }

    if (label.includes('proposal')) {
      const propProjVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0)
        : Number(ds.proposal_sent_project_value ?? 0);
      const propPipeVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedPipeline || 0), 0)
        : Number(ds.proposal_sent_pipeline_amount ?? 0);
      const propCount = isMyScope
        ? matchingLeads.length
        : Number(ds.proposal_sent ?? ds.total_proposals_sent ?? metrics.totalCount ?? 0);

      return [
        { label: 'PROJECT VALUE', value: `₹${propProjVal.toLocaleString('en-IN')}` },
        { label: 'PIPELINE VALUE', value: `₹${propPipeVal.toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'PROPOSALS SENT', value: String(propCount) }
      ];
    }

    if (label.includes('won')) {
      const wonRev = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedWon || 0), 0)
        : Number(ds.total_won_revenue ?? ds.won_project_value ?? metrics.totalWonRevenue ?? 0);
      const wonCount = isMyScope
        ? matchingLeads.length
        : Number(ds.won ?? metrics.totalCount ?? 0);

      return [
        { label: 'PROJECT VALUE', value: formattedTotalProjVal },
        { label: 'WON REVENUE', value: `₹${wonRev.toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'WON LEADS', value: String(wonCount) }
      ];
    }

    if (label.includes('qualified') || label.includes('qualification')) {
      const qualProjVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedValue || 0), 0)
        : Number(ds.qualified_project_value ?? 0);
      const qualPipeVal = isMyScope
        ? matchingLeads.reduce((sum, l) => sum + (l.calculatedPipeline || 0), 0)
        : Number(ds.qualified_pipeline_amount ?? 0);
      const qualCount = isMyScope
        ? matchingLeads.length
        : Number(ds.qualified ?? ds.total_qualified ?? metrics.totalCount ?? 0);

      return [
        { label: 'PROJECT VALUE', value: `₹${qualProjVal.toLocaleString('en-IN')}` },
        { label: 'PIPELINE VALUE', value: `₹${qualPipeVal.toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'QUALIFIED LEADS', value: String(qualCount) }
      ];
    }

    if (label.includes('weighted')) {
      const weightedProjVal = matchingLeads.reduce((sum, lead) => sum + (lead.calculatedValue || 0), 0);
      const weightedPipeVal = isMyScope
        ? matchingLeads.reduce((sum, lead) => sum + (lead.calculatedPipeline || 0), 0)
        : Number(ds.total_pipeline_amount ?? matchingLeads.reduce((sum, lead) => sum + (lead.calculatedPipeline || 0), 0));
      return [
        { label: 'PROJECT VALUE', value: `₹${weightedProjVal.toLocaleString('en-IN')}` },
        { label: 'PIPELINE VALUE', value: `₹${weightedPipeVal.toLocaleString('en-IN')}`, isHighlight: true },
        { label: 'TOTAL LEADS', value: String(matchingLeads.length) }
      ];
    }

    // Default for TOTAL LEADS
    return [
      { label: 'PROJECT VALUE', value: formattedTotalProjVal },
      { label: 'PIPELINE VALUE', value: `₹${totalPipeVal.toLocaleString('en-IN')}`, isHighlight: true },
      { label: 'TOTAL LEADS', value: String(totalLeadsCount) }
    ];
  }, [kpi?.label, metrics, dashboardSummary, matchingLeads, isExecUser, execScope]);



  // Helper for Product Stage Badges
  const getProdStageStyle = (stageName) => {
    const st = (stageName || '').toLowerCase();
    if (st.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.3)' };
    if (st.includes('won')) return { bg: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.3)' };
    if (st.includes('negotiation')) return { bg: 'rgba(129, 140, 248, 0.15)', color: '#818CF8', border: '1px solid rgba(129, 140, 248, 0.3)' };
    if (st.includes('proposal')) return { bg: 'rgba(0, 198, 255, 0.15)', color: '#00C6FF', border: '1px solid rgba(0, 198, 255, 0.3)' };
    return { bg: 'rgba(255, 255, 255, 0.06)', color: '#CBD5E1', border: '1px solid rgba(255, 255, 255, 0.1)' };
  };

  // Helper for Product Risk Matrix Badges
  const getProdRiskStyle = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r.includes('lost')) return { bg: 'rgba(239, 68, 68, 0.2)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.4)' };
    if (r.includes('high')) return { bg: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.4)' };
    if (r.includes('med')) return { bg: 'rgba(234, 179, 8, 0.2)', color: '#EAB308', border: '1px solid rgba(234, 179, 8, 0.4)' };
    return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.3)' };
  };

  // Respected metric calculations for Detail Inspector panel
  const detailMetricInfo = useMemo(() => {
    if (!selectedDetailLead || !kpi) return { label: 'WON REVENUE', value: '₹0', color: '#64748B' };

    const lbl = (kpi.label || '').toLowerCase();
    const val = selectedDetailLead.calculatedValue || 0;
    const won = selectedDetailLead.calculatedWon > 0 ? selectedDetailLead.calculatedWon : val;

    if (lbl.includes('negotiation')) {
      return {
        label: 'EXPECTED WON VALUE',
        value: `₹${won.toLocaleString('en-IN')}`,
        color: '#00D4AA'
      };
    }
    if (lbl.includes('lost')) {
      return {
        label: 'LOST VALUE',
        value: `₹${val.toLocaleString('en-IN')}`,
        color: '#EF4444'
      };
    }
    if (lbl.includes('proposal')) {
      return {
        label: 'EXPECTED WON VALUE',
        value: `₹${won.toLocaleString('en-IN')}`,
        color: '#00C6FF'
      };
    }
    if (lbl.includes('won')) {
      return {
        label: 'WON REVENUE',
        value: `₹${won.toLocaleString('en-IN')}`,
        color: '#00D4AA'
      };
    }
    if (lbl.includes('qualified') || lbl.includes('qualification')) {
      return {
        label: 'QUALIFIED VALUE',
        value: `₹${val.toLocaleString('en-IN')}`,
        color: '#00D4AA'
      };
    }
    return {
      label: 'WON REVENUE',
      value: `₹${(selectedDetailLead.calculatedWon || 0).toLocaleString('en-IN')}`,
      color: selectedDetailLead.calculatedWon > 0 ? '#00D4AA' : '#64748B'
    };
  }, [selectedDetailLead, kpi]);

  const getEmptyStateDetails = (kpiLabel) => {
    const lbl = (kpiLabel || '').toLowerCase();
    if (lbl.includes('negotiation')) {
      return {
        title: 'No Deals in Negotiations',
        subtitle: 'There are currently 0 opportunities in negotiation.',
        description: 'Leads move into the negotiation stage after proposals have been reviewed and terms are being finalized.',
        tip: 'Tip: Send proposals to qualify leads and advance deals into negotiations.'
      };
    }
    if (lbl.includes('proposal')) {
      return {
        title: 'No Proposals Pending',
        subtitle: 'There are currently 0 leads in the proposal submission stage.',
        description: 'This stage tracks deals where commercial quotations or proposals have been dispatched.',
        tip: 'Tip: Send product quotations for qualified leads to advance them into this stage.'
      };
    }
    if (lbl.includes('qualified')) {
      return {
        title: 'No Qualified Leads',
        subtitle: 'No leads currently meet the qualification criteria.',
        description: 'Qualified leads represent accounts ready for product presentations.',
        tip: 'Tip: Review incoming leads from the Lead Register and qualify them.'
      };
    }
    if (lbl.includes('lost')) {
      return {
        title: 'Zero Lost Projects',
        subtitle: '0 deals marked as lost in the current pipeline.',
        description: 'Projects marked as lost will be archived here along with reason analysis.',
        tip: 'Win rate remains healthy with zero recorded losses.'
      };
    }
    if (lbl.includes('won')) {
      return {
        title: 'No Won Revenue Recorded Yet',
        subtitle: '0 closed-won deals recorded in this view.',
        description: 'When deals are successfully closed, their realized revenue is tracked here.',
        tip: 'Tip: Close open negotiations to record closed-won revenue.'
      };
    }
    if (lbl.includes('weighted')) {
      return {
        title: 'No Weighted Pipeline Available',
        subtitle: 'No probability-weighted revenue opportunities found.',
        description: 'Weighted pipeline calculates expected conversion values based on deal probability.',
        tip: 'Tip: Assign product values and probabilities in the Lead Register.'
      };
    }
    return {
      title: `No ${kpiLabel || 'Category'} Data Available`,
      subtitle: `There are currently 0 records associated with ${kpiLabel || 'this category'}.`,
      description: `As new leads are registered and updated across pipeline stages, matching records will appear here.`,
      tip: 'Tip: Use the Lead Register to add or update your sales opportunities.'
    };
  };

  if (!isOpen || !kpi) return null;

  const emptyInfo = getEmptyStateDetails(kpi?.label);
  const hasZeroData = !isLoadingLeads && matchingLeads.length === 0;

  const drawerContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 100005,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideInDetailPanel {
          from { transform: translateX(30px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .dd-main-panel {
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
          width: 440px;
          max-width: 100vw;
        }
        .dd-detail-panel {
          animation: slideInDetailPanel 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
          right: 440px;
          width: 450px;
          max-width: calc(100vw - 440px);
        }

        .dd-lead-info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 16px;
          border-bottom: 1px solid var(--t-border);
          font-size: 13.5px;
        }

        .dd-summary-metrics-container {
          padding: 12px 18px;
          background: var(--t-surface-solid);
          border-bottom: 1px solid var(--t-border);
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
        }

        .dd-summary-card-item {
          background: var(--t-surface-alt);
          border: 1px solid var(--t-border);
          border-radius: 8px;
          padding: 8px 10px;
          min-width: 0;
          box-sizing: border-box;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .dd-stat-card-label {
          font-size: 10.5px;
          color: var(--t-fg-muted);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dd-stat-card-val {
          font-size: 16px;
          font-weight: 700;
          color: var(--t-fg);
          font-family: 'Helvetica', sans-serif;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dd-view-btn {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.12s ease;
        }
        .dd-view-btn:hover {
          border-color: #00D4AA !important;
          color: #00D4AA !important;
        }

        /* Laptops & Medium Screens (max-width 1366px or height <= 900px) */
        @media (max-width: 1366px), (max-height: 900px) {
          .dd-view-btn {
            padding: 3px 8px !important;
            font-size: 11px !important;
            gap: 3px !important;
          }
          .dd-main-panel {
            width: min(350px, 31vw) !important;
          }
          .dd-detail-panel {
            right: min(350px, 31vw) !important;
            width: min(400px, 42vw) !important;
            max-width: calc(100vw - min(350px, 31vw)) !important;
          }
          .dd-summary-metrics-container {
            padding: 8px 10px !important;
            gap: 5px !important;
          }
          .dd-summary-card-item {
            padding: 6px 7px !important;
          }
          .dd-lead-info-row {
            padding: 8px 12px !important;
            font-size: 12.5px !important;
          }
          .dd-stat-card-label {
            font-size: 9px !important;
            letter-spacing: 0 !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .dd-stat-card-val {
            font-size: 13px !important;
            margin-top: 1px !important;
          }
          .dd-drawer-header {
            height: 60px !important;
            padding: 0 12px !important;
            gap: 8px !important;
          }
          .dd-drawer-header h2, .dd-drawer-header h3 {
            font-size: 14.5px !important;
          }
          .dd-detail-panel div[style*="font-size: 20px"] {
            font-size: 15px !important;
          }
          .dd-detail-panel div[style*="font-size: 14px"] {
            font-size: 12px !important;
          }
          .dd-detail-panel div[style*="font-size: 13.5px"] {
            font-size: 12.5px !important;
          }
          .dd-detail-panel div[style*="padding: 20px 24px"] {
            padding: 12px 14px !important;
            gap: 10px !important;
          }
          .dd-detail-panel div[style*="padding: 14px 16px"] {
            padding: 8px 10px !important;
          }
          .dd-detail-panel div[style*="padding: 12px 16px"] {
            padding: 7px 10px !important;
          }
          .dd-main-panel div[style*="font-size: 18px"] {
            font-size: 14px !important;
          }
          .dd-main-panel div[style*="font-size: 16px"] {
            font-size: 12.5px !important;
          }
          .dd-main-panel div[style*="font-size: 14px"] {
            font-size: 12px !important;
          }
          .dd-main-panel div[style*="font-size: 13.5px"] {
            font-size: 12.5px !important;
          }
          .dd-main-panel div[style*="padding: 12px"] {
            padding: 7px 9px !important;
          }
        }

        /* Small Laptops & Medium Tablets (max-width 1080px) */
        @media (max-width: 1080px) {
          .dd-main-panel {
            width: min(340px, 33vw) !important;
          }
          .dd-detail-panel {
            right: 0 !important;
            width: min(400px, 100vw) !important;
            max-width: 100vw !important;
            z-index: 100008 !important;
            box-shadow: -15px 0 50px rgba(0,0,0,0.6) !important;
          }
        }

        /* Mobile & Small Tablets (< 768px) */
        @media (max-width: 768px) {
          .dd-main-panel {
            width: 100vw !important;
          }
          .dd-detail-panel {
            right: 0 !important;
            width: 100vw !important;
            max-width: 100vw !important;
            z-index: 100008 !important;
          }
        }
      `}</style>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── DETAIL INSPECTOR PANEL (Appears on clicking "View Details") ─── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {selectedDetailLead && (
        <div
          className="dd-detail-panel"
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0,
            height: '100vh',
            background: 'var(--t-surface-solid)',
            borderLeft: '1px solid var(--t-border)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 100006,
            boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.4)'
          }}
        >
          {/* Detail Inspector Header */}
          <div
            className="dd-drawer-header"
            style={{
              height: '74px',
              boxSizing: 'border-box',
              padding: '0 20px',
              borderBottom: '1px solid var(--t-border)',
              background: 'var(--t-surface-alt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexShrink: 0
            }}
          >
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily: "'Helvetica'", fontSize: '12px', color: '#00D4AA', fontWeight: 700, letterSpacing: '0.04em' }}>
                  #{selectedDetailLead.lead_id || selectedDetailLead.id}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: selectedDetailLead.is_active !== false ? 'rgba(0, 212, 170, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedDetailLead.is_active !== false ? '#00D4AA' : '#EF4444',
                    border: `1px solid ${selectedDetailLead.is_active !== false ? 'rgba(0, 212, 170, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                  }}
                >
                  {selectedDetailLead.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <h3 style={{ margin: '1px 0 0', fontSize: '18px', fontWeight: 700, color: 'var(--t-fg)', fontFamily: "'Helvetica'", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedDetailLead.company || selectedDetailLead.account || 'Account'}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDetailLead(null)}
              title="Close details view"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--t-surface-solid)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-fg-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--t-fg)';
                e.currentTarget.style.borderColor = '#00D4AA';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--t-fg-muted)';
                e.currentTarget.style.borderColor = 'var(--t-border)';
              }}
            >
              <FiX />
            </button>
          </div>

          {/* Detail Inspector Body */}
          <div className="custom-filter-dropdown-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(0, 212, 170, 0.4) rgba(0, 0, 0, 0.2)' }}>

            {/* Financial Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  PROJECT VALUE
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--t-fg)', fontFamily: "'Helvetica'", marginTop: '4px' }}>
                  ₹{selectedDetailLead.calculatedValue.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t-fg-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {detailMetricInfo.label}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: detailMetricInfo.color, fontFamily: "'Helvetica'", marginTop: '4px' }}>
                  {detailMetricInfo.value}
                </div>
              </div>
            </div>

            {/* Lead Information Card */}
            <div style={{ background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', borderRadius: '10px' }}>
              <div style={{ padding: '12px 16px', background: 'var(--t-surface-solid)', borderBottom: '1px solid var(--t-border)', borderTopLeftRadius: '9px', borderTopRightRadius: '9px', fontWeight: 700, fontSize: '14px', color: 'var(--t-fg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiUsers style={{ color: '#00D4AA', fontSize: '16px' }} />
                <span>Lead Information</span>
              </div>

              <div className="dd-lead-info-row">
                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Owner:</span>
                <span style={{ color: 'var(--t-fg)', fontWeight: 700, fontSize: '14px', textAlign: 'right', marginLeft: 'auto' }}>{selectedDetailLead.lead_owner_name || 'Unassigned'}</span>
              </div>

              <div className="dd-lead-info-row">
                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Contact:</span>
                <span style={{ color: 'var(--t-fg)', fontWeight: 700, fontSize: '14px', textAlign: 'right', marginLeft: 'auto' }}>
                  {selectedDetailLead.contact_name || '—'} {selectedDetailLead.designation ? `(${selectedDetailLead.designation})` : ''}
                </span>
              </div>

              <div className="dd-lead-info-row">
                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Email:</span>
                <span style={{ color: '#00D4AA', fontFamily: "'Helvetica'", fontSize: '13.5px', fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}>
                  {selectedDetailLead.email || '—'}
                </span>
              </div>

              <div className="dd-lead-info-row">
                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Phone:</span>
                <span style={{ color: 'var(--t-fg)', fontFamily: "'Helvetica'", fontSize: '13.5px', fontWeight: 700, textAlign: 'right', marginLeft: 'auto' }}>
                  {selectedDetailLead.phone_no || '—'}
                </span>
              </div>

              <div className="dd-lead-info-row" style={{ borderBottom: 'none', borderBottomLeftRadius: '9px', borderBottomRightRadius: '9px' }}>
                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Country / Source:</span>
                <span style={{ color: 'var(--t-fg)', fontWeight: 700, fontSize: '13.5px', textAlign: 'right', marginLeft: 'auto' }}>{selectedDetailLead.country || 'India'} • {selectedDetailLead.lead_source || 'Direct'}</span>
              </div>
            </div>

            {/* Assigned Products (Structured Key-Value Cards) */}
            <div style={{ background: 'var(--t-surface-alt)', border: '1px solid var(--t-border)', borderRadius: '10px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '220px' }}>
              <div style={{ padding: '12px 16px', background: 'var(--t-surface-solid)', borderBottom: '1px solid var(--t-border)', fontWeight: 700, fontSize: '14px', color: 'var(--t-fg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FiPackage style={{ color: '#00D4AA', fontSize: '16px' }} />
                  <span>Assigned Products Details</span>
                </span>
                <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)', fontWeight: 700 }}>
                  {selectedDetailLead.productsList.length} {selectedDetailLead.productsList.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {selectedDetailLead.productsList.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', color: 'var(--t-fg-muted)', fontSize: '13px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No individual products registered under this lead.
                </div>
              ) : (
                <div
                  className="custom-filter-dropdown-scroll"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    padding: '14px',
                    flex: 1,
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(0, 212, 170, 0.7) rgba(0, 0, 0, 0.3)'
                  }}
                >
                  {selectedDetailLead.productsList.map((prod, pIdx) => {
                    const pName = prod.product_name || prod.product || `Product #${pIdx + 1}`;
                    const pQty = prod.quantity || 1;
                    const pProjVal = Number(prod.project_value || 0);
                    const pPipelineVal = prod.pipeline !== undefined && prod.pipeline !== null ? Number(prod.pipeline) : 0;
                    const pStatus = prod.status_name || prod.status || '—';
                    const pStage = prod.stage_name || prod.stage || '—';
                    const pProb = prod.probability !== undefined && prod.probability !== null ? `${prod.probability}%` : (prod.probability_percentage !== undefined ? `${prod.probability_percentage}%` : '0%');
                    const pRisk = prod.risk_matrix || prod.risk_level || prod.risk || 'Low Risk';

                    const stageStyle = getProdStageStyle(pStage);
                    const riskStyle = getProdRiskStyle(pRisk);

                    return (
                      <div
                        key={pIdx}
                        style={{
                          background: 'var(--t-bg)',
                          border: '1px solid var(--t-border)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          maxHeight: '340px'
                        }}
                      >
                        {/* Product Header Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '8px 12px',
                          padding: '11px 16px',
                          background: 'rgba(0, 212, 170, 0.08)',
                          borderBottom: '1px solid var(--t-border)',
                          flexShrink: 0
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--t-fg)' }}>{pName}</span>
                            <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)', fontWeight: 700, background: 'var(--t-surface-solid)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                              Qty: {pQty}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '4px', background: 'rgba(0, 198, 255, 0.12)', color: '#00C6FF', border: '1px solid rgba(0, 198, 255, 0.25)', fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {pStatus}
                            </span>
                            <span style={{ padding: '3px 9px', borderRadius: '4px', background: stageStyle.bg, color: stageStyle.color, border: stageStyle.border, fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {pStage}
                            </span>
                          </div>
                        </div>

                        {/* Scrollable Product Card Body Content */}
                        <div
                          className="custom-filter-dropdown-scroll"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            minHeight: 0,
                            overflowY: 'auto',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(0, 212, 170, 0.7) rgba(0, 0, 0, 0.3)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '10px 16px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
                            <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Project Value:</span>
                            <span style={{ color: 'var(--t-fg)', fontWeight: 700, fontFamily: "'Helvetica'", fontSize: '14px' }}>
                              ₹{pProjVal.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '10px 16px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
                            <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Pipeline Value:</span>
                            <span style={{ color: pPipelineVal > 0 ? '#00C6FF' : 'var(--t-fg-muted)', fontWeight: 700, fontFamily: "'Helvetica'", fontSize: '14px' }}>
                              ₹{pPipelineVal.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '10px 16px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
                            <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Probability / Risk:</span>
                            <span style={{ color: 'var(--t-fg)', fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ fontFamily: "'Helvetica'", fontWeight: 700, fontSize: '14px' }}>{pProb}</span>
                              <span style={{ color: 'var(--t-fg-muted)' }}>•</span>
                              <span style={{ padding: '2px 7px', borderRadius: '4px', background: riskStyle.bg, color: riskStyle.color, border: riskStyle.border, fontSize: '11px', fontWeight: 700 }}>
                                {pRisk.toUpperCase()}
                              </span>
                            </span>
                          </div>

                          {(() => {
                            const expClosure = prod.expected_closure || selectedDetailLead?.expected_closure || selectedDetailLead?.expectedClosure || selectedDetailLead?.expected_closure_date;
                            return (
                              <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '10px 16px', borderBottom: '1px solid var(--t-border)', fontSize: '13.5px' }}>
                                <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Expected Closure:</span>
                                <span style={{ color: expClosure ? 'var(--t-fg)' : 'var(--t-fg-muted)', fontFamily: "'Helvetica'", fontWeight: 700, fontSize: '14px' }}>
                                  {expClosure ? formatDate(expClosure) : '—'}
                                </span>
                              </div>
                            );
                          })()}

                          {(() => {
                            const proposalEntries = getProposalEntries(prod, selectedDetailLead);
                            const isProposalStage = (pStage || pStatus || '').toLowerCase().includes('proposal') || proposalEntries.length > 0;

                            if (isProposalStage || proposalEntries.length > 0) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', borderBottom: '1px solid var(--t-border)', background: 'rgba(0, 198, 255, 0.04)' }}>
                                  <div style={{ color: '#00C6FF', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FiFileText style={{ fontSize: '14px' }} /> Proposal Documents ({proposalEntries.length}):
                                  </div>
                                  {proposalEntries.length > 0 ? (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                      }}
                                    >
                                      {proposalEntries.map((pEntry, pIdx) => (
                                        <div key={pIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 12px', padding: '8px 12px', background: 'rgba(5, 12, 22, 0.6)', border: '1px solid rgba(0, 198, 255, 0.2)', borderRadius: '6px', maxWidth: '100%', boxSizing: 'border-box' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
                                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t-fg-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>#{pIdx + 1}</span>
                                            <span style={{ color: '#00C6FF', fontWeight: 700, fontSize: '13px' }}>{pEntry.proposal_type || 'Proposal Sent'}</span>
                                          </div>
                                          {pEntry.proposal_document_url ? (
                                            <button
                                              type="button"
                                              onClick={() => handleOpenProposalDoc(pEntry.proposal_document_url)}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '5px 12px',
                                                borderRadius: '6px',
                                                background: 'rgba(0, 212, 170, 0.18)',
                                                border: '1px solid rgba(0, 212, 170, 0.4)',
                                                color: '#00D4AA',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box'
                                              }}
                                            >
                                              <FiPaperclip style={{ flexShrink: 0 }} />
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px', display: 'inline-block' }}>
                                                View Proposal ({getProposalFileName(pEntry.proposal_document_url)})
                                              </span>
                                              <FiExternalLink style={{ fontSize: '11px', flexShrink: 0 }} />
                                            </button>
                                          ) : (
                                            <span style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                                              (No document link attached)
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '12.5px', color: '#00C6FF', fontWeight: 600 }}>
                                      Proposal Sent (No documents attached)
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {prod.lost_reason && (
                            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 12px', padding: '10px 16px', fontSize: '13.5px' }}>
                              <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600, flexShrink: 0 }}>Lost Reason:</span>
                              <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '14px' }}>{prod.lost_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── DRILL-DOWN PANEL — always fixed at right:0, never moves ──────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      <div
        className="dd-main-panel"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          background: 'var(--t-surface-solid)',
          borderLeft: '1px solid var(--t-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-20px 0 50px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          zIndex: 100006
        }}
      >
        {/* ── 1. Header ── */}
        <div
          className="dd-drawer-header"
          style={{
            height: '74px',
            boxSizing: 'border-box',
            padding: '0 20px',
            borderBottom: '1px solid var(--t-border)',
            background: 'var(--t-surface-alt)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(0, 212, 170, 0.08)',
                border: '1px solid var(--t-border)',
                color: '#00D4AA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              {kpi.icon || <FiBarChart2 />}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--t-fg)', fontFamily: "'Helvetica'", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {kpi.label}
              </h2>
            </div>
          </div>

          {/* Right Controls: Executive Scope Toggle + Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexShrink: 0 }}>
            {isExecUser && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--t-surface-solid, rgba(0,0,0,0.4))',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid var(--t-border, rgba(255,255,255,0.12))'
              }}>
                <button
                  type="button"
                  onClick={() => handleExecScopeToggle('all')}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: execScope === 'all' ? '#00D4AA' : 'transparent',
                    color: execScope === 'all' ? '#070C12' : 'var(--t-fg-muted)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FiGlobe style={{ fontSize: '12px' }} />
                  <span>All Leads</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecScopeToggle('my')}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: execScope === 'my' ? '#00D4AA' : 'transparent',
                    color: execScope === 'my' ? '#070C12' : 'var(--t-fg-muted)',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <FiUser style={{ fontSize: '12px' }} />
                  <span>My Leads</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              title="Close drawer"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'var(--t-surface-solid)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-fg-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '17px',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--t-fg)';
                e.currentTarget.style.borderColor = '#00D4AA';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'var(--t-fg-muted)';
                e.currentTarget.style.borderColor = 'var(--t-border)';
              }}
            >
              <FiX />
            </button>
          </div>
        </div>

        {/* ── 2. Content Area (Empty State vs Loaded Records) ── */}
        {hasZeroData ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: 'var(--t-surface-alt)',
                border: '1px solid var(--t-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00D4AA',
                fontSize: '26px',
                marginBottom: '16px'
              }}
            >
              {kpi.icon || <FiBriefcase />}
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--t-fg)', margin: '0 0 6px', fontFamily: "'Helvetica'" }}>
              {emptyInfo.title}
            </h3>

            <div style={{ fontSize: '13px', color: '#00D4AA', fontWeight: 600, marginBottom: '10px' }}>
              {emptyInfo.subtitle}
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--t-fg-muted)', maxWidth: '360px', lineHeight: 1.5, margin: '0 0 18px' }}>
              {emptyInfo.description}
            </p>

            <div style={{
              background: 'var(--t-surface-alt)',
              border: '1px solid var(--t-border)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12px',
              color: 'var(--t-fg)',
              maxWidth: '360px',
              lineHeight: 1.4,
              marginBottom: '22px'
            }}>
              💡 {emptyInfo.tip}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '7px',
                  background: 'var(--t-surface-alt)',
                  border: '1px solid var(--t-border)',
                  color: 'var(--t-fg-muted)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToLeads) onNavigateToLeads({ stage: 'all' });
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '7px',
                  background: '#00D4AA',
                  color: '#070C12',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                View All Leads in Register <FiArrowRight />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Summary Metrics Highlights ── */}
            <div className="dd-summary-metrics-container">
              {headerCards.map((card, idx) => (
                <div key={idx} className="dd-summary-card-item">
                  <div className="dd-stat-card-label" title={card.label}>{card.label}</div>
                  <div
                    className="dd-stat-card-val"
                    style={{
                      color: card.isHighlight ? '#00D4AA' : 'var(--t-fg)'
                    }}
                  >
                    {card.value}
                  </div>
                  {card.badge && (
                    <div style={{ fontSize: '10.5px', color: card.isHighlight ? '#00D4AA' : 'var(--t-cyan, #00C6FF)', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.badge}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tabs Switcher ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 18px',
                borderBottom: '1px solid var(--t-border)',
                flexShrink: 0,
                background: 'var(--t-surface-solid)'
              }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {[
                  { id: 'records', label: `Leads (${matchingLeads.length})`, icon: <FiLayers /> }
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '6px',
                        border: `1px solid ${isActive ? 'rgba(0, 212, 170, 0.3)' : 'transparent'}`,
                        background: isActive ? 'rgba(0, 212, 170, 0.12)' : 'transparent',
                        color: isActive ? '#00D4AA' : 'var(--t-fg-muted)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Main List Area (Scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* TAB 1: LEAD RECORDS */}
              {activeTab === 'records' && (
                <>
                  <div style={{ position: 'relative', marginBottom: '2px' }}>
                    <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t-fg-muted)', fontSize: '14px' }} />
                    <input
                      type="text"
                      placeholder="Search account, ID, owner..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 12px 0 34px',
                        borderRadius: '8px',
                        border: '1px solid var(--t-border)',
                        background: 'var(--t-bg)',
                        color: 'var(--t-fg)',
                        fontSize: '13px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {isLoadingLeads ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--t-fg-muted)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Loading leads...</div>
                    </div>
                  ) : searchedLeads.length === 0 ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--t-fg-muted)', background: 'var(--t-surface-alt)', borderRadius: '10px', border: '1px solid var(--t-border)' }}>
                      <FiBriefcase style={{ fontSize: '26px', marginBottom: '6px', opacity: 0.5 }} />
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--t-fg-muted)' }}>No leads matching search</div>
                    </div>
                  ) : (
                    paginatedLeads.map((lead, idx) => {
                      const leadId = lead.lead_id || lead.id || `LD-${startIndex + idx + 1}`;
                      const company = lead.company || lead.account || 'Account';
                      const owner = lead.lead_owner_name || lead.owner || 'Unassigned';

                      const isSelected = Boolean(
                        selectedDetailLead &&
                        ((lead.lead_id && selectedDetailLead.lead_id === lead.lead_id) ||
                          (lead.id && selectedDetailLead.id === lead.id))
                      );

                      return (
                        <div
                          key={leadId}
                          onClick={() => setSelectedDetailLead(lead)}
                          style={{
                            background: isSelected ? 'rgba(0, 212, 170, 0.12)' : 'var(--t-surface-alt)',
                            border: isSelected ? '1px solid #00D4AA' : '1px solid var(--t-border)',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = '#00D4AA';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.borderColor = 'var(--t-border)';
                            }
                          }}
                        >
                          {/* Top row: ID, Company, Action */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontFamily: "'Helvetica'", fontSize: '12.5px', color: isSelected ? '#00D4AA' : 'var(--t-fg-muted)', fontWeight: 600 }}>
                                  #{leadId}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)' }}>•</span>
                                <span style={{ fontSize: '12.5px', color: 'var(--t-fg-muted)', fontWeight: 600 }}>
                                  {owner}
                                </span>
                              </div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t-fg)', marginTop: '2px', fontFamily: "'Helvetica'" }}>
                                {company}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="dd-view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDetailLead(isSelected ? null : lead);
                              }}
                              style={{
                                background: isSelected ? 'rgba(0, 212, 170, 0.16)' : 'var(--t-surface-solid)',
                                border: `1px solid ${isSelected ? 'rgba(0, 212, 170, 0.4)' : 'var(--t-border)'}`,
                                color: isSelected ? '#00D4AA' : 'var(--t-fg-muted)'
                              }}
                            >
                              <FiEye style={{ fontSize: '12px' }} /> {isSelected ? 'Viewing' : 'Details'}
                            </button>
                          </div>

                          {/* Products List & Stage badges */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {lead.productsList.length === 0 ? (
                              <span style={{ fontSize: '12px', color: 'var(--t-fg-muted)' }}>No products registered</span>
                            ) : (
                              lead.productsList.map((prod, pIdx) => (
                                <span
                                  key={pIdx}
                                  style={{
                                    fontSize: '11.5px',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    background: 'var(--t-bg)',
                                    border: '1px solid var(--t-border)',
                                    color: 'var(--t-fg)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <FiPackage style={{ color: '#00D4AA', fontSize: '12px' }} />
                                  <strong>{prod.product_name || prod.product || 'Product'}</strong> (×{prod.quantity || 1})
                                  <span style={{ color: '#00D4AA', fontWeight: 600 }}>• {prod.stage_name || 'Stage'}</span>
                                </span>
                              ))
                            )}
                          </div>

                          {/* Value Breakdown Footer */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--t-border)', fontSize: '13px' }}>
                            <span style={{ color: 'var(--t-fg-muted)', fontWeight: 600 }}>
                              Value: <strong style={{ color: 'var(--t-fg)', fontFamily: "'Helvetica'", fontSize: '14.5px' }}>₹{lead.calculatedValue.toLocaleString('en-IN')}</strong>
                            </span>

                            {lead.calculatedWon > 0 && (
                              <span style={{ color: '#00D4AA', fontWeight: 600, fontSize: '13.5px' }}>
                                Won: ₹{lead.calculatedWon.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>

            {/* ── 3. Stitched Bottom Footer (Pagination Controls) ── */}
            {!hasZeroData && totalRecords > 0 && (
              <div
                style={{
                  padding: '12px 18px',
                  background: 'var(--t-surface-alt, #0D141F)',
                  borderTop: '1px solid var(--t-border, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                  fontSize: '12.5px',
                  color: '#94A3B8'
                }}
              >
                <div>
                  Showing <strong style={{ color: '#00D4AA' }}>{startItem}–{endItem}</strong> of <strong style={{ color: '#F8FAFC' }}>{totalRecords}</strong> records
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1 || isLoadingLeads}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 13px',
                      borderRadius: '6px',
                      background: safeCurrentPage <= 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: safeCurrentPage <= 1 ? '#475569' : '#CBD5E1',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: safeCurrentPage <= 1 ? 0.5 : 1,
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <FiChevronLeft /> Prev
                  </button>

                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages || isLoadingLeads}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 13px',
                      borderRadius: '6px',
                      background: safeCurrentPage >= totalPages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 212, 170, 0.12)',
                      border: `1px solid ${safeCurrentPage >= totalPages ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 212, 170, 0.3)'}`,
                      color: safeCurrentPage >= totalPages ? '#475569' : '#00D4AA',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                      opacity: safeCurrentPage >= totalPages ? 0.5 : 1,
                      transition: 'all 0.12s ease'
                    }}
                  >
                    Next <FiChevronRight />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(drawerContent, document.body)
    : drawerContent;
}
