// src/components/admin/WeeklyReportsTab.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  FiFileText,
  FiDownload,
  FiExternalLink,
  FiSearch,
  FiRefreshCw,
  FiCalendar,
  FiHardDrive,
  FiLock,
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiMaximize2,
  FiEye,
  FiFilter
} from 'react-icons/fi';
import { getWeeklyPdfs, getPdfFullUrl, formatBytes } from '../../api/weeklyPdfApi';
import { useAuth } from '../../context/AuthContext';
import { isSuperAdmin } from '../../utils/authRoles';
import { isValidDateStr } from '../../utils/dateUtils';

const tdStyle = {
  padding: '12px 16px',
  verticalAlign: 'middle'
};

export default function WeeklyReportsTab() {
  const { user } = useAuth();
  const superAdminAccess = isSuperAdmin(user);

  // Data & Pagination States
  const [pdfs, setPdfs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Date Range Filter States
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'this_week' | 'this_month' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination parameters (Limit & Cursor)
  const [limit, setLimit] = useState(50);
  const [cursorHistory, setCursorHistory] = useState([null]); // History stack of cursors
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Inline PDF Viewer Modal state
  const [previewPdf, setPreviewPdf] = useState(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  // Fetch PDFs with cursor & limit
  const fetchPdfs = useCallback(async (currentCursor = null) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await getWeeklyPdfs({ limit, cursor: currentCursor });
      setPdfs(res.items || []);
      setNextCursor(res.cursor || null);
      setHasMore(Boolean(res.has_more));
      if (res.total_count) {
        setTotalCount(res.total_count);
      }
    } catch (err) {
      console.error('[WeeklyReportsTab] Fetch error:', err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to fetch weekly PDF reports.';
      setError(msg);
      setPdfs([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Initial & Pagination Change Load
  useEffect(() => {
    if (superAdminAccess) {
      const currentCursor = cursorHistory[pageIndex] || null;
      fetchPdfs(currentCursor);
    }
  }, [superAdminAccess, pageIndex, cursorHistory, limit, fetchPdfs]);

  // Apply Date Preset (All, This Week, This Month)
  const applyDatePreset = (presetKey) => {
    setDatePreset(presetKey);
    const now = new Date();

    if (presetKey === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (presetKey === 'this_week') {
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diffToMon));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setStartDate(mon.toISOString().split('T')[0]);
      setEndDate(sun.toISOString().split('T')[0]);
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    }
  };

  // Shift Date Range by 7 days or 30 days
  const shiftDateRange = (days) => {
    if (!startDate && !endDate) {
      const now = new Date();
      const start = new Date(now);
      start.setDate(now.getDate() + days);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
      setDatePreset('custom');
      return;
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date();

    start.setDate(start.getDate() + days);
    end.setDate(end.getDate() + days);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setDatePreset('custom');
  };

  // Reset Date Filter
  const clearDateFilter = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
  };

  // Handle Limit Dropdown Change
  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setCursorHistory([null]);
    setPageIndex(0);
  };

  // Next Page Handler
  const handleNextPage = () => {
    if (!nextCursor) return;
    const nextHistory = [...cursorHistory.slice(0, pageIndex + 1), nextCursor];
    setCursorHistory(nextHistory);
    setPageIndex(pageIndex + 1);
  };

  // Previous Page Handler
  const handlePrevPage = () => {
    if (pageIndex <= 0) return;
    setPageIndex(pageIndex - 1);
  };

  // Refresh current view
  const handleRefresh = () => {
    const currentCursor = cursorHistory[pageIndex] || null;
    fetchPdfs(currentCursor);
  };

  // Filtered PDFs (Search query + Date range)
  const filteredPdfs = useMemo(() => {
    let result = pdfs;

    // 1. Search Query Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        const idStr = String(item.weekly_pdf_id || '').toLowerCase();
        const filenameStr = String(item.filename || '').toLowerCase();
        const dateStr = String(item.report_date || '').toLowerCase();
        return idStr.includes(query) || filenameStr.includes(query) || dateStr.includes(query);
      });
    }

    // 2. Date Range Filter
    if (startDate) {
      result = result.filter(item => {
        const itemDate = item.report_date || (item.created_at ? item.created_at.split('T')[0] : '');
        return itemDate >= startDate;
      });
    }
    if (endDate) {
      result = result.filter(item => {
        const itemDate = item.report_date || (item.created_at ? item.created_at.split('T')[0] : '');
        return itemDate <= endDate;
      });
    }

    return result;
  }, [pdfs, searchQuery, startDate, endDate]);

  // Compute analytics & total pages
  const totalPagesCount = useMemo(() => {
    if (totalCount && limit) {
      return Math.max(1, Math.ceil(totalCount / limit));
    }
    return Math.max(1, cursorHistory.length + (hasMore ? 1 : 0));
  }, [totalCount, limit, cursorHistory, hasMore]);

  const totalStorageBytes = useMemo(() => {
    return pdfs.reduce((acc, curr) => acc + Number(curr.file_size_bytes || 0), 0);
  }, [pdfs]);

  const latestDate = useMemo(() => {
    if (pdfs.length === 0) return '—';
    const dates = pdfs.map(p => p.report_date).filter(Boolean).sort().reverse();
    if (dates.length === 0) return '—';
    try {
      const d = new Date(dates[0]);
      if (isNaN(d.getTime())) return dates[0];
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dates[0];
    }
  }, [pdfs]);

  // Open Inline PDF Viewer Modal (On same page)
  const handleOpenPdfPreview = (pdfItem) => {
    setPreviewPdf(pdfItem);
    setIsIframeLoading(true);
  };

  // Close Inline PDF Viewer Modal
  const handleClosePdfPreview = () => {
    setPreviewPdf(null);
  };

  // Open PDF in new tab if requested explicitly
  const handleOpenNewTab = (rawUrl) => {
    const fullUrl = getPdfFullUrl(rawUrl);
    if (fullUrl) {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Download PDF file directly
  const handleDownloadPdf = async (pdfItem) => {
    const fullUrl = getPdfFullUrl(pdfItem.pdf_url);
    if (!fullUrl) return;

    setDownloadingId(pdfItem.weekly_pdf_id);
    try {
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = pdfItem.filename || 'Weekly_Executive_Report.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (_) {
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = pdfItem.filename || 'Weekly_Executive_Report.pdf';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingId(null);
    }
  };

  // Keyboard shortcut listener for closing modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewPdf) {
        handleClosePdfPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPdf]);

  // Format date string
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  // Format timestamp with time
  const formatTimestamp = (tsStr) => {
    if (!tsStr) return '—';
    try {
      const d = new Date(tsStr);
      if (isNaN(d.getTime())) return String(tsStr);
      return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return String(tsStr);
    }
  };

  // Non-Super Admin Banner
  if (!superAdminAccess) {
    return (
      <div style={{
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        borderRadius: '12px',
        padding: '30px 20px',
        textAlign: 'center',
        color: '#EF4444',
        margin: '20px 0'
      }}>
        <FiLock style={{ fontSize: '32px', marginBottom: '10px' }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800 }}>Restricted Access</h3>
        <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--t-fg-muted)' }}>
          Weekly Executive Reports are restricted exclusively to Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="wp-container">
      {/* Custom CSS for sleek theme, scrollbars, responsive tablet font sizes and button hover states */}
      <style>{`
        .wp-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px 24px;
          height: 100%;
          min-height: 0;
          flex: 1;
          box-sizing: border-box;
          justify-content: space-between;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .wp-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .wp-kpi-card {
          background: var(--t-surface-alt, #0D141F);
          border: 1px solid var(--t-border, rgba(49, 151, 149, 0.22));
          border-radius: 12px;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          transition: all 0.2s ease;
        }
        .wp-kpi-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: rgba(0, 212, 170, 0.12);
          border: 1px solid rgba(0, 212, 170, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00D4AA;
          font-size: 24px;
          flex-shrink: 0;
          box-shadow: 0 0 16px rgba(0, 212, 170, 0.15);
        }
        .wp-kpi-title {
          font-size: 12.5px;
          color: #94A3B8;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .wp-kpi-val {
          font-size: 20px;
          font-weight: 800;
          color: #F8FAFC;
          margin-top: 4px;
          letter-spacing: -0.02em;
        }
        .wp-filter-bar {
          background: var(--t-surface-alt, #0D141F);
          border: 1px solid var(--t-border, rgba(49, 151, 149, 0.22));
          border-radius: 12px;
          padding: 16px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .wp-table-th {
          padding: 14px 18px;
          font-size: 12.5px;
          font-weight: 800;
          letter-spacing: 0.05em;
        }
        .wp-table-td {
          padding: 12px 18px;
          vertical-align: middle;
        }
        .wp-footer-bar {
          padding: 14px 24px;
          border-top: 1px solid var(--t-border);
          background: var(--t-surface-alt);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: auto;
        }
        .weekly-pdf-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .weekly-pdf-scrollbar::-webkit-scrollbar-track {
          background: rgba(5, 8, 14, 0.6);
          border-radius: 4px;
        }
        .weekly-pdf-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 170, 0.35);
          border-radius: 4px;
        }
        .weekly-pdf-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 170, 0.7);
        }
        .wp-btn-view-pdf {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 36px;
          padding: 0 clamp(8px, 0.8vw + 2px, 16px);
          border-radius: 8px;
          background: rgba(0, 212, 170, 0.1);
          border: 1px solid rgba(0, 212, 170, 0.35);
          color: #00D4AA;
          font-size: clamp(11px, 0.75vw + 2px, 13px);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
          line-height: 1;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .wp-btn-view-pdf:hover {
          background: rgba(0, 212, 170, 0.22);
          border-color: rgba(0, 212, 170, 0.55);
          box-shadow: 0 0 12px rgba(0, 212, 170, 0.25);
        }
        .wp-btn-download {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 36px;
          padding: 0 clamp(8px, 0.8vw + 2px, 16px);
          border-radius: 8px;
          background: linear-gradient(135deg, #009B82, #00D4AA);
          border: 1px solid transparent;
          color: #070C12;
          font-size: clamp(11px, 0.75vw + 2px, 13px);
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 3px 12px rgba(0, 212, 170, 0.3);
          box-sizing: border-box;
          line-height: 1;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .wp-btn-download:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 5px 16px rgba(0, 212, 170, 0.45);
        }
        .wp-btn-download:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .wp-date-preset-btn {
          padding: 7px 15px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .wp-date-preset-btn.active {
          background: rgba(0, 212, 170, 0.15);
          border: 1px solid rgba(0, 212, 170, 0.45);
          color: #00D4AA;
          box-shadow: 0 0 10px rgba(0, 212, 170, 0.2);
        }
        .wp-date-preset-btn.inactive {
          background: rgba(5, 8, 14, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94A3B8;
        }
        .wp-date-preset-btn.inactive:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #E2E8F0;
          border-color: rgba(255, 255, 255, 0.16);
        }
        .wp-page-btn {
          height: 34px;
          padding: 0 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.18s ease;
        }
        .wp-page-pill {
          min-width: 34px;
          height: 34px;
          padding: 0 9px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s ease;
        }

        /* Responsive tablet scaling & height-constrained viewports (e.g., iPad Air landscape / windowed mode) */
        @media (max-width: 1280px), (max-height: 900px) {
          .wp-container {
            padding: 10px 14px !important;
            gap: 10px !important;
          }
          .wp-kpi-grid {
            gap: 10px !important;
          }
          .wp-kpi-card {
            padding: 10px 14px !important;
            gap: 10px !important;
          }
          .wp-kpi-icon {
            width: 38px !important;
            height: 38px !important;
            font-size: 18px !important;
            border-radius: 8px !important;
          }
          .wp-kpi-title {
            font-size: 10.5px !important;
          }
          .wp-kpi-val {
            font-size: 16px !important;
            margin-top: 2px !important;
          }
          .wp-filter-bar {
            padding: 8px 14px !important;
            gap: 8px !important;
          }
          .wp-date-preset-btn {
            padding: 4px 10px !important;
            font-size: 11px !important;
          }
          .wp-table-th {
            padding: 8px 10px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
          }
          .wp-table-td {
            padding: 6px 10px !important;
            font-size: 11.5px !important;
          }
          .wp-btn-view-pdf {
            height: 32px !important;
            padding: 0 10px !important;
            font-size: 11.5px !important;
            gap: 4px !important;
            box-sizing: border-box !important;
            border: 1px solid rgba(0, 212, 170, 0.35) !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .wp-btn-download {
            height: 32px !important;
            padding: 0 10px !important;
            font-size: 11.5px !important;
            gap: 4px !important;
            box-sizing: border-box !important;
            border: 1px solid transparent !important;
            white-space: nowrap !important;
            flex-shrink: 0 !important;
          }
          .wp-footer-bar {
            padding: 8px 14px !important;
            font-size: 12px !important;
          }
          .wp-page-btn {
            height: 30px !important;
            padding: 0 10px !important;
            font-size: 11.5px !important;
          }
          .wp-page-pill {
            min-width: 30px !important;
            height: 30px !important;
            padding: 0 6px !important;
            font-size: 11.5px !important;
          }
        }
      `}</style>

      {/* ── KPI Summary Cards ────────────────────────────────────────────── */}
      <div className="wp-kpi-grid">
        {/* Total Executive Reports */}
        <div className="wp-kpi-card">
          <div className="wp-kpi-icon">
            <FiFileText />
          </div>
          <div>
            <div className="wp-kpi-title">
              Total Executive Reports
            </div>
            <div className="wp-kpi-val">
              {isLoading ? '...' : (totalCount || pdfs.length)} <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#94A3B8' }}>{(totalCount || pdfs.length) === 1 ? 'Report' : 'Reports'}</span>
            </div>
          </div>
        </div>

        {/* Latest Report Date */}
        <div className="wp-kpi-card">
          <div className="wp-kpi-icon">
            <FiCalendar />
          </div>
          <div>
            <div className="wp-kpi-title">
              Latest Report Date
            </div>
            <div className="wp-kpi-val" style={{ color: '#00D4AA' }}>
              {isLoading ? '...' : latestDate}
            </div>
          </div>
        </div>
      </div>

      {/* ── Date Range Filter Bar (Styled matching app visual language) ─ */}
      <div className="wp-filter-bar">

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Preset Tabs (All Time, This Week, This Month, Custom) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: '#94A3B8', fontWeight: 700, marginRight: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiFilter style={{ color: '#00D4AA', fontSize: '14px' }} /> Date Range:
            </span>
            {[
              { key: 'all', label: 'All Time' },
              { key: 'this_week', label: 'This Week' },
              { key: 'this_month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' }
            ].map(p => {
              const isActive = datePreset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyDatePreset(p.key)}
                  className={`wp-date-preset-btn ${isActive ? 'active' : 'inactive'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Date Navigator Strip (Matching `< 📅 Date Range >`) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(5, 8, 14, 0.75)',
              border: '1px solid rgba(49, 151, 149, 0.28)',
              borderRadius: '8px',
              padding: '3px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => shiftDateRange(-7)}
                title="Shift 7 days back"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '14px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#00D4AA'}
                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
              >
                <FiChevronLeft />
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#00D4AA'
              }}>
                <FiCalendar style={{ fontSize: '14px', color: '#00D4AA' }} />
                <span>
                  {startDate && endDate
                    ? `${formatDate(startDate)} — ${formatDate(endDate)}`
                    : (startDate ? `From ${formatDate(startDate)}` : (endDate ? `Until ${formatDate(endDate)}` : 'All Available Dates'))}
                </span>
              </div>

              <button
                type="button"
                onClick={() => shiftDateRange(7)}
                title="Shift 7 days forward"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '14px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#00D4AA'}
                onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
              >
                <FiChevronRight />
              </button>
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={clearDateFilter}
                title="Clear date filter"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <FiX /> Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Custom Start / End Date Picker Row (when custom preset or dates selected) */}
        {(datePreset === 'custom' || startDate || endDate) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(49, 151, 149, 0.16)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !isValidDateStr(val)) {
                    alert("Wrong date format. Please select a valid Start Date.");
                    return;
                  }
                  if (val && endDate && val > endDate) {
                    alert("Invalid date range: 'Start Date' cannot be later than 'End Date'. Please select a valid date range.");
                    return;
                  }
                  setStartDate(val);
                  setDatePreset('custom');
                }}
                onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) {} }}
                style={{
                  background: 'rgba(5, 8, 14, 0.85)',
                  color: '#F8FAFC',
                  border: '1px solid rgba(49, 151, 149, 0.28)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12.5px',
                  colorScheme: 'dark',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !isValidDateStr(val)) {
                    alert("Wrong date format. Please select a valid End Date.");
                    return;
                  }
                  if (val && startDate && val < startDate) {
                    alert("Invalid date range: 'End Date' cannot be earlier than 'Start Date'. Please select a valid date range.");
                    return;
                  }
                  setEndDate(val);
                  setDatePreset('custom');
                }}
                onClick={(e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) {} }}
                style={{
                  background: 'rgba(5, 8, 14, 0.85)',
                  color: '#F8FAFC',
                  border: '1px solid rgba(49, 151, 149, 0.28)',
                  borderRadius: '8px',
                  padding: '5px 12px',
                  fontSize: '12.5px',
                  colorScheme: 'dark',
                  outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#EF4444',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FiAlertCircle style={{ fontSize: '16px', flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Reports List Table Container (Matching page panel aesthetics) ─ */}
      <div style={{
        background: 'var(--t-surface-alt, #080D14)',
        border: '1px solid rgba(49, 151, 149, 0.22)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0
      }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>
            <FiRefreshCw className="spin" style={{ fontSize: '24px', color: '#00D4AA', marginBottom: '10px' }} />
            <div>Loading Executive PDF Reports (Limit: {limit})...</div>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <FiFileText style={{ fontSize: '32px', color: '#64748B', marginBottom: '10px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#F8FAFC' }}>No Reports Found</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
              {searchQuery || startDate || endDate ? 'No weekly PDFs matched your search or date filter criteria.' : 'No weekly PDF executive reports available for this page.'}
            </p>
          </div>
        ) : (
          /* Table Scroll Container with Sticky Header & Dark Scrollbar */
          <div
            className="weekly-pdf-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'relative'
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  background: 'var(--t-surface-solid, #0F172A)',
                  borderBottom: '1px solid var(--t-border)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                  color: 'var(--t-fg-muted)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <th className="wp-table-th" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Report Date & ID</th>
                  <th className="wp-table-th" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Executive PDF File</th>
                  <th className="wp-table-th" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>File Size</th>
                  <th className="wp-table-th" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Generated At</th>
                  <th className="wp-table-th" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ height: (filteredPdfs.length === 0) ? '100%' : 'auto' }}>
                {filteredPdfs.map((pdf, idx) => {
                  const isDownloading = downloadingId === pdf.weekly_pdf_id;
                  const isActive = pdf.is_active !== undefined ? Boolean(pdf.is_active) : true;

                  return (
                    <tr
                      key={pdf.weekly_pdf_id || idx}
                      style={{
                        borderBottom: '1px solid var(--t-border, rgba(255, 255, 255, 0.08))',
                        transition: 'background 140ms ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--t-row-hover, rgba(0, 212, 170, 0.04))'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Report Date & ID */}
                      <td className="wp-table-td" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--t-teal, #00D4AA)', fontSize: 'clamp(11px, 0.65vw + 2px, 12.5px)', whiteSpace: 'nowrap' }}>
                            {formatDate(pdf.report_date)}
                          </span>
                          <span style={{
                            fontFamily: "'Helvetica'",
                            fontWeight: 800,
                            fontSize: 'clamp(9.5px, 0.5vw + 2px, 10.5px)',
                            color: 'var(--t-fg-muted, #94A3B8)',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            width: 'fit-content',
                            whiteSpace: 'nowrap'
                          }}>
                            {pdf.weekly_pdf_id}
                          </span>
                        </div>
                      </td>

                      {/* PDF File Name */}
                      <td className="wp-table-td" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'clamp(6px, 0.5vw + 4px, 12px)' }}>
                          <div style={{
                            width: 'clamp(26px, 1.6vw + 8px, 36px)',
                            height: 'clamp(26px, 1.6vw + 8px, 36px)',
                            borderRadius: '7px',
                            background: 'rgba(239, 68, 68, 0.14)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#EF4444',
                            fontSize: 'clamp(13px, 0.9vw + 4px, 18px)',
                            flexShrink: 0
                          }}>
                            <FiFileText />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, overflow: 'hidden' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                color: 'var(--t-fg, #F8FAFC)',
                                fontSize: 'clamp(12px, 0.75vw + 2px, 13px)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 'clamp(280px, 45vw, 650px)'
                              }}
                              title={pdf.filename || 'Weekly_Executive_Report.pdf'}
                            >
                              {pdf.filename || 'Weekly_Executive_Report.pdf'}
                            </span>
                            <span style={{
                              fontSize: 'clamp(10px, 0.65vw + 2px, 11.5px)',
                              color: 'var(--t-fg-muted, #64748B)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '280px'
                            }} title={pdf.pdf_url}>
                              {pdf.pdf_url}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="wp-table-td" style={{ textAlign: 'center' }}>
                        <span style={{
                          fontFamily: "'Helvetica'",
                          fontWeight: 700,
                          color: 'var(--t-fg, #E2E8F0)',
                          fontSize: 'clamp(11px, 0.65vw + 2px, 12.5px)',
                          whiteSpace: 'nowrap'
                        }}>
                          {formatBytes(pdf.file_size_bytes)}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="wp-table-td" style={{ textAlign: 'center', fontWeight: 600, color: 'var(--t-fg-muted)', fontSize: 'clamp(10.5px, 0.6vw + 2px, 12px)', whiteSpace: 'nowrap' }}>
                        {formatTimestamp(pdf.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="wp-table-td" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          {/* INLINE VIEW PDF */}
                          <button
                            type="button"
                            onClick={() => handleOpenPdfPreview(pdf)}
                            title="View PDF content on this page"
                            className="wp-btn-view-pdf"
                          >
                            <FiEye />
                            <span>View PDF</span>
                          </button>

                          {/* Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(pdf)}
                            disabled={isDownloading}
                            title="Download PDF report file"
                            className="wp-btn-download"
                          >
                            <FiDownload className={isDownloading ? 'spin' : ''} />
                            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer Bar (Matching ContactsView.js 100%) ── */}
        <div className="wp-footer-bar">
          {/* Left: Total Count & Current Page Info */}
          <div style={{ fontSize: '13px', color: 'var(--t-fg-muted)', fontWeight: 600 }}>
            Showing page <strong style={{ color: 'var(--t-fg)', fontWeight: 800 }}>{pageIndex + 1}</strong> of{' '}
            <strong style={{ color: 'var(--t-teal)', fontWeight: 800 }}>{totalPagesCount}</strong> pages{' '}
            <span style={{ color: 'var(--t-fg-subtle)', fontWeight: 500, marginLeft: '4px' }}>
              ({totalCount || filteredPdfs.length} Total Reports)
            </span>
          </div>

          {/* Right: Page Size & Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Per Page Limit Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--t-fg-subtle)', fontWeight: 600 }}>Per Page:</span>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(Number(e.target.value))}
                style={{
                  padding: '4px 22px 4px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 212, 170, 0.35)',
                  background: `var(--t-surface-alt, #0d141f) url("data:image/svg+xml;utf8,<svg fill='%2300D4AA' height='16' viewBox='0 0 24 24' width='16' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>") no-repeat right 6px center`,
                  color: '#FFFFFF',
                  fontSize: '12.5px',
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
                <option value={10} style={{ background: '#0D141F', color: '#FFFFFF' }}>10</option>
                <option value={25} style={{ background: '#0D141F', color: '#FFFFFF' }}>25</option>
                <option value={50} style={{ background: '#0D141F', color: '#FFFFFF' }}>50</option>
                <option value={100} style={{ background: '#0D141F', color: '#FFFFFF' }}>100</option>
              </select>
            </div>

            {/* Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="wp-page-btn"
                disabled={pageIndex <= 0 || isLoading}
                onClick={handlePrevPage}
                style={{
                  border: '1px solid var(--t-border)',
                  background: pageIndex <= 0 ? 'rgba(255, 255, 255, 0.02)' : 'var(--t-surface-solid)',
                  color: pageIndex <= 0 ? '#475569' : 'var(--t-fg)',
                  cursor: pageIndex <= 0 || isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                <FiChevronLeft /> Prev
              </button>

              {Array.from({ length: totalPagesCount }, (_, i) => i).map((pIdx) => {
                const isCurrent = pIdx === pageIndex;
                return (
                  <button
                    key={pIdx}
                    type="button"
                    className="wp-page-pill"
                    disabled={isLoading}
                    onClick={() => {
                      if (pIdx < cursorHistory.length) {
                        setPageIndex(pIdx);
                      } else if (pIdx === pageIndex + 1 && nextCursor) {
                        handleNextPage();
                      }
                    }}
                    style={{
                      border: isCurrent ? '1px solid #00D4AA' : '1px solid var(--t-border)',
                      background: isCurrent ? 'linear-gradient(135deg, #009B82, #00D4AA)' : 'var(--t-surface-solid)',
                      color: isCurrent ? '#070C12' : 'var(--t-fg-muted)',
                      boxShadow: isCurrent ? '0 0 12px rgba(0, 212, 170, 0.35)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {pIdx + 1}
                  </button>
                );
              })}

              <button
                type="button"
                className="wp-page-btn"
                disabled={!nextCursor || isLoading}
                onClick={handleNextPage}
                style={{
                  border: '1px solid var(--t-border)',
                  background: !nextCursor ? 'rgba(255, 255, 255, 0.02)' : 'var(--t-surface-solid)',
                  color: !nextCursor ? '#475569' : 'var(--t-fg)',
                  cursor: !nextCursor || isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Next <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* ── INLINE PDF VIEWER MODAL OVERLAY ─────────────────────────────── */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {previewPdf && ReactDOM.createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(3, 7, 13, 0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '94vw',
            maxWidth: '1280px',
            height: '90vh',
            background: '#090E17',
            border: '1px solid rgba(0, 212, 170, 0.35)',
            borderRadius: '14px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 212, 170, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Top Header Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              padding: '14px 20px',
              background: '#080D14',
              borderBottom: '1px solid rgba(49, 151, 149, 0.22)',
              flexWrap: 'wrap',
              gap: '12px',
              boxSizing: 'border-box'
            }}>
              {/* Title & Meta Tags */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 300px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444',
                  fontSize: '20px',
                  flexShrink: 0
                }}>
                  <FiFileText />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontSize: '15px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={previewPdf.filename || 'Weekly_Executive_Report.pdf'}>
                    {previewPdf.filename || 'Weekly_Executive_Report.pdf'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                    {previewPdf.report_date && (
                      <span style={{ fontSize: '12px', color: '#00D4AA', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Report Date: {formatDate(previewPdf.report_date)}
                      </span>
                    )}
                    {previewPdf.report_date && previewPdf.weekly_pdf_id && (
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                    )}
                    {previewPdf.weekly_pdf_id && (
                      <span style={{
                        fontFamily: 'Inter, monospace',
                        fontSize: '11px',
                        color: '#94A3B8',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap'
                      }}>
                        {previewPdf.weekly_pdf_id}
                      </span>
                    )}
                    {previewPdf.file_size_bytes && (
                      <>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                        <span style={{ fontSize: '11.5px', color: '#00D4AA', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatBytes(previewPdf.file_size_bytes)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons & Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: 'auto' }}>
                {/* Download Button */}
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(previewPdf)}
                  className="wp-btn-download"
                >
                  <FiDownload />
                  <span>Download</span>
                </button>

                {/* Open in New Tab Button */}
                <button
                  type="button"
                  onClick={() => handleOpenNewTab(previewPdf.pdf_url)}
                  title="Open PDF in new browser tab"
                  className="wp-btn-view-pdf"
                >
                  <FiExternalLink />
                  <span>New Tab</span>
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={handleClosePdfPreview}
                  title="Close PDF Preview (Esc)"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#FFFFFF',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                >
                  <FiX />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF Iframe Viewer */}
            <div style={{
              flex: 1,
              position: 'relative',
              background: '#070C14',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {isIframeLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#070C14',
                  zIndex: 2,
                  color: '#00D4AA',
                  fontSize: '14px',
                  gap: '10px'
                }}>
                  <FiRefreshCw className="spin" style={{ fontSize: '24px' }} />
                  <span>Loading PDF Document Preview...</span>
                </div>
              )}

              <iframe
                src={getPdfFullUrl(previewPdf.pdf_url)}
                title={previewPdf.filename || 'Executive PDF Report'}
                onLoad={() => setIsIframeLoading(false)}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#070C14'
                }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
