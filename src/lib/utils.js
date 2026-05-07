// ─── Shared Utility Functions ─────────────────────────────────────────────────

/** 
 * Format a number as USD currency 
 * @param {number} n 
 */
export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

/** 
 * Format a timestamp to "MM/DD/YYYY"
 * @param {string | number | Date} ts 
 */
export function formatDate(ts) {
  if (!ts) return '—';
  
  // Clean up raw ISO metadata if present as a string
  let cleanTs = ts;
  if (typeof ts === 'string') {
    cleanTs = ts.replace(/T00:00:00\.000Z$/, '').replace(/ 00:00:00\.000Z$/, '');
  }
  
  const d = new Date(cleanTs);
  if (isNaN(d.getTime())) return String(ts);
  
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const YYYY = d.getFullYear();
  
  // 12-hour formatting with AM/PM
  let HH = d.getHours();
  const ampm = HH >= 12 ? 'PM' : 'AM';
  HH = HH % 12;
  HH = HH ? HH : 12; // the hour '0' should be '12'
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return `${MM}/${DD}/${YYYY} ${HH}:${min} ${ampm}`;
}

/**
 * Format timestamp to "MM/DD/YYYY" (Standardized across site)
 * @param {string | number | Date} ts 
 */
export function formatFullDate(ts) {
  return formatDate(ts);
}

/** 
 * Turn "2025-04" into "Apr 2025" 
 * @param {string} key 
 */
export function formatMonth(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** 
 * Capitalize first letter 
 * @param {string} str 
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** 
 * Safe truncate 
 * @param {string} str 
 * @param {number} max 
 */
export function truncate(str, max = 40) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/** Category color map (CSS var names) */
export const CATEGORY_COLORS = {
  hardware:      '#e07b30',
  software:      '#4e9af1',
  outreach:      '#6bcb77',
  food:          '#f1a94e',
  miscellaneous: '#b97cf3',
};

/** Status color map for charts */
export const STATUS_COLORS = {
  'Pending Review':  '#4e9af1',
  'Approved':        '#4eeaf1',
  'Ordered':         '#f19a4e',
  'Received':        '#6bcb77',
  'Denied':          '#f16a4e',
  'Cancelled':       '#f59e0b',
  'Void':            '#8a8a8a',
};

/** Valid categories (mirrors backend config) */
export const CATEGORIES = ['hardware', 'software', 'outreach', 'food', 'miscellaneous'];

/** Valid teams */
export const TEAMS = ['FRC', 'Westwood Overall', 'Slingshot', 'Atlatl', 'Kunai', 'Hunga Munga'];

/** 
 * Helper for team badge CSS classes 
 * @param {string} team 
 */
export function getTeamBadgeClass(team) {
  if (!team || team === 'All' || team === 'Westwood Overall') return '';
  return `badge-${team.toString().toLowerCase().trim().replace(/\s+/g, '-')}`;
}

/** Contribution types for sponsors */
export const CONTRIBUTION_TYPES = ['money', 'parts', 'services'];

/** Grant statuses */
export const GRANT_STATUSES = ['Applied', 'Pending', 'Awarded', 'Rejected'];

/**
 * Generate a short 6-character alphanumeric ID
 */
export function generateShortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}