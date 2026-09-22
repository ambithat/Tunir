// src/api/weeklyPdfApi.js
import axiosInstance from './axiosInstance';

/**
 * Fetch weekly executive report PDFs from /api/v1/weekly-pdfs with limit & cursor pagination
 * @param {Object} options
 * @param {number} [options.limit=50] - Number of items to fetch (min 1, max 100)
 * @param {string|null} [options.cursor=null] - Cursor string for next page
 * @returns {Promise<{items: Array, cursor: string|null, has_more: boolean, total_count: number}>}
 */
export async function getWeeklyPdfs({ limit = 50, cursor = null } = {}) {
  try {
    const params = {
      limit: Math.min(Math.max(Number(limit) || 50, 1), 100)
    };
    if (cursor) {
      params.cursor = String(cursor);
    }

    const response = await axiosInstance.get('/weekly-pdfs', { params, skipCache: true });
    const data = response?.data;

    let items = [];
    let nextCursor = null;
    let hasMore = false;
    let totalCount = 0;

    if (Array.isArray(data)) {
      items = data;
      totalCount = data.length;
    } else if (data && typeof data === 'object') {
      items = Array.isArray(data.items)
        ? data.items
        : (Array.isArray(data.data)
          ? data.data
          : (Array.isArray(data.weekly_pdfs) ? data.weekly_pdfs : []));

      nextCursor = data.next_cursor || data.cursor || data.nextCursor || null;
      hasMore = Boolean(data.has_more ?? data.has_next ?? data.hasMore ?? Boolean(nextCursor));
      totalCount = Number(data.total_count ?? data.total ?? data.count ?? items.length);
    }

    return {
      items,
      cursor: nextCursor,
      has_more: hasMore,
      total_count: totalCount,
      raw: data
    };
  } catch (error) {
    console.error('[weeklyPdfApi] Failed to fetch weekly PDFs:', error);
    throw error;
  }
}

/**
 * Helper to convert relative pdf_url to full HTTP URL
 * @param {string} rawUrl - relative or absolute PDF path
 * @returns {string} Absolute URL for previewing or downloading
 */
export function getPdfFullUrl(rawUrl) {
  if (!rawUrl) return '';
  let cleanUrl = String(rawUrl).trim();
  if (!cleanUrl) return '';

  const bucketBase = process.env.REACT_APP_BUCKET_BASE_URL || 'http://starai.local:8888/buckets';
  const envBase = bucketBase.trim().replace(/\/+$/, '');
  const bucketOrigin = envBase.endsWith('/buckets')
    ? envBase.replace(/\/buckets$/, '')
    : envBase.replace(/\/[^/]*$/, '');

  // 1. If absolute URL, check if it points to backend API (port :8000 or contains bucket/proposal/startai path)
  if (/^https?:\/\//i.test(cleanUrl)) {
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.port === '8000' || /\/(startai|proposal_sent|buckets)\//i.test(parsed.pathname)) {
        cleanUrl = parsed.pathname + parsed.search + parsed.hash;
      } else {
        return cleanUrl;
      }
    } catch (_) {}
  }

  // 2. Clean leading slashes
  const cleanPath = cleanUrl.replace(/^\/+/, '');

  // 3. If path already starts with "buckets/", attach to bucketOrigin
  if (cleanPath.startsWith('buckets/')) {
    return `${bucketOrigin}/${cleanPath}`;
  }

  // 4. Attach relative path (e.g. "startai/proposal_sent/...") to envBase (which includes /buckets)
  return `${envBase}/${cleanPath}`;
}

/**
 * Format bytes into human-readable size string (e.g. 599248 -> 585.2 KB)
 * @param {number} bytes 
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}
