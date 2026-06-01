/** 
 * format a number as USD 
 * @param {number} n 
 */
export function formatCurrency(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);
}

/** 
 * format a timestamp to "MM/DD/YYYY"
 * @param {string | number | Date} ts 
 */
export function formatDate(ts) {
  if (!ts) return '—';
  
  let cleanTs = ts;
  if (typeof ts === 'string') {
    cleanTs = ts.replace(/T00:00:00\.000Z$/, '').replace(/ 00:00:00\.000Z$/, '');
  }
  
  const d = new Date(cleanTs);
  if (isNaN(d.getTime())) return String(ts);
  
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const YYYY = d.getFullYear();
  
  // 12-hour formatting 
  let HH = d.getHours();
  const ampm = HH >= 12 ? 'PM' : 'AM';
  HH = HH % 12;
  HH = HH ? HH : 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return `${MM}/${DD}/${YYYY} ${HH}:${min} ${ampm}`;
}

export function formatFullDate(ts) {
  return formatDate(ts);
}

/** 
 * "2025-04" -> "Apr 2025" 
 * @param {string} key 
 */
export function formatMonth(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** 
 * caps first letter 
 * @param {string} str 
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** 
 * safe truncate 
 * @param {string} str 
 * @param {number} max 
 */
export function truncate(str, max = 40) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export const CATEGORY_COLORS = {
  hardware:      '#e07b30',
  software:      '#4e9af1',
  outreach:      '#6bcb77',
  food:          '#f1a94e',
  miscellaneous: '#b97cf3',
};

export const STATUS_COLORS = {
  'Pending Review':  '#4e9af1',
  'Approved':        '#4eeaf1',
  'Ordered':         '#f19a4e',
  'Received':        '#6bcb77',
  'Denied':          '#f16a4e',
  'Cancelled':       '#f59e0b',
  'Void':            '#8a8a8a',
};

export const CATEGORIES = ['hardware', 'software', 'outreach', 'food', 'miscellaneous'];
export const TEAMS = ['FRC', 'Westwood Overall', 'Slingshot', 'Atlatl', 'Kunai', 'Hunga Munga'];

/** 
 * team badge css helper 
 * @param {string} team 
 */
export function getTeamBadgeClass(team) {
  if (!team || team === 'All' || team === 'Westwood Overall') return '';
  return `badge-${team.toString().toLowerCase().trim().replace(/\s+/g, '-')}`;
}

export const CONTRIBUTION_TYPES = ['money', 'parts', 'services'];
export const GRANT_STATUSES = ['Applied', 'Pending', 'Awarded', 'Rejected'];
export const CAT_COLORS = {
  hardware:      '#f97316',
  software:      '#3b82f6',
  outreach:      '#10b981',
  food:          '#eab308',
  miscellaneous: '#8b5cf6',
};
export const STATUS_PRIORITY = {
  'pending review': 0,
  approved:         1,
  ordered:          2,
  received:         3,
  denied:           4,
  cancelled:        5,
  void:             6,
};

/**
 * stable color from an order UUID 
 * @param {string|undefined} uuid
 */
export function getOrderColor(uuid) {
  if (!uuid) return 'transparent';
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(Math.floor(hash * 137.5) % 360);
  return `hsl(${h}, 70%, 40%)`;
}

/** cache wrapper so getOrderColor is O(1) on repeated calls */
const _orderColorCache = /** @type {Record<string, string>} */ ({});
/**
 * @param {string|undefined} uuid
 */
export function getOrderColorCached(uuid) {
  if (!uuid) return 'transparent';
  if (_orderColorCache[uuid]) return _orderColorCache[uuid];
  const c = getOrderColor(uuid);
  _orderColorCache[uuid] = c;
  return c;
}

/**
 * ret true if an order belongs to the given team selection.
 * @param {{ team?: string }} order
 * @param {string} selectedTeam
 */
export function matchesTeam(order, selectedTeam) {
  if (selectedTeam === 'Westwood Overall') return true;
  const t = String(order.team || '').toLowerCase().trim();
  const s = selectedTeam.toLowerCase().trim();
  return t === s || t.includes(s) || (s === 'frc' && (t.includes('frc') || /^\d+$/.test(t)));
}

/**
 * gen a short 6-character alphanum ID
 */
export function generateShortId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}