// src/utils/dateUtils.js

/**
 * Format Date object to YYYY-MM-DD string in local timezone.
 * @param {Date|string|number} date
 * @returns {string|null} YYYY-MM-DD or null
 */
export function formatDateISO(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date string in YYYY-MM-DD format (local timezone).
 */
export function getTodayISO() {
  return formatDateISO(new Date());
}

/**
 * Validates if a date string is valid YYYY-MM-DD.
 */
export function isValidDateStr(dateStr) {
  if (!dateStr) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Validates date filter range (from_date and to_date).
 * Triggers alert if invalid format or fromDate > toDate.
 * @param {string} fromDate 
 * @param {string} toDate 
 * @returns {boolean} true if valid range, false if invalid
 */
export function validateDateFilterRange(fromDate, toDate) {
  if (fromDate && !isValidDateStr(fromDate)) {
    alert("Wrong date format. Please select a valid 'From Date'.");
    return false;
  }
  if (toDate && !isValidDateStr(toDate)) {
    alert("Wrong date format. Please select a valid 'To Date'.");
    return false;
  }
  if (fromDate && toDate && fromDate > toDate) {
    alert("Invalid date range: 'From Date' cannot be later than 'To Date'. Please select a valid date range.");
    return false;
  }
  return true;
}

/**
 * Validates whether a given date string is in the past (backward date like yesterday).
 * @param {string} dateStr YYYY-MM-DD
 * @returns {boolean} true if past date
 */
export function isBackwardDate(dateStr) {
  if (!dateStr) return false;
  const today = getTodayISO();
  return dateStr < today;
}

/**
 * Checks if date1Str (YYYY-MM-DD) is strictly before date2Str (YYYY-MM-DD).
 * @param {string} date1Str
 * @param {string} date2Str
 * @returns {boolean} true if date1Str < date2Str
 */
export function isDateBefore(date1Str, date2Str) {
  if (!date1Str || !date2Str) return false;
  const d1 = String(date1Str).split('T')[0];
  const d2 = String(date2Str).split('T')[0];
  return d1 < d2;
}

/**
 * Validates activity creation date. Shows alert if backward date is chosen.
 * @param {string} dateStr YYYY-MM-DD
 * @param {string} label Name of field for alert message
 * @returns {boolean} true if valid (today or future), false if backward/invalid
 */
export function validateActivityDate(dateStr, label = 'Activity Date') {
  if (!dateStr) return true;
  if (!isValidDateStr(dateStr)) {
    alert(`Wrong date format for ${label}. Please select a valid date.`);
    return false;
  }
  if (isBackwardDate(dateStr)) {
    alert(`Invalid ${label}: Activity date cannot be in the past (backward date like yesterday). Please select today or a future date.`);
    return false;
  }
  return true;
}

/**
 * Computes from_date and to_date (YYYY-MM-DD) based on date preset filters.
 *
 * Presets:
 * - 'today': from_date = today, to_date = today
 * - 'yesterday': from_date = yesterday, to_date = yesterday
 * - 'last_7_days': from_date = 7 days ago, to_date = today
 * - 'last_30_days': from_date = 30 days ago, to_date = today
 * - 'this_month': from_date = 1st of month, to_date = today
 * - 'custom': from_date = customFrom, to_date = customTo
 *
 * @param {string} preset
 * @param {string} customFrom
 * @param {string} customTo
 * @returns {{ from_date: string|undefined, to_date: string|undefined }}
 */
export function getDateRangeParams(preset, customFrom = '', customTo = '') {
  const now = new Date();

  if (preset === 'today') {
    const todayStr = formatDateISO(now);
    return { from_date: todayStr, to_date: todayStr };
  }

  if (preset === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const yestStr = formatDateISO(yest);
    return { from_date: yestStr, to_date: yestStr };
  }

  if (preset === 'last_7_days') {
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 7);
    return { from_date: formatDateISO(past7), to_date: formatDateISO(now) };
  }

  if (preset === 'last_30_days') {
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    return { from_date: formatDateISO(past30), to_date: formatDateISO(now) };
  }

  if (preset === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from_date: formatDateISO(startOfMonth), to_date: formatDateISO(now) };
  }

  if (preset === 'custom') {
    if (customFrom && customTo) {
      if (!validateDateFilterRange(customFrom, customTo)) {
        return { from_date: undefined, to_date: undefined };
      }
      return {
        from_date: formatDateISO(customFrom),
        to_date: formatDateISO(customTo)
      };
    }
    return { from_date: undefined, to_date: undefined };
  }

  return { from_date: undefined, to_date: undefined };
}
