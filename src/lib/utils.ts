import type { Order } from "./types.js";

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n ?? 0);
}

export function formatDate(ts: string | number | Date): string {
  if (!ts) return "—";

  let cleanTs: string | number | Date = ts;
  if (typeof ts === "string") {
    cleanTs = ts
      .replace(/T00:00:00\.000Z$/, "")
      .replace(/ 00:00:00\.000Z$/, "");
  }

  const d = new Date(cleanTs);
  if (isNaN(d.getTime())) return String(ts);

  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const YYYY = d.getFullYear();

  let HH = d.getHours();
  const ampm = HH >= 12 ? "PM" : "AM";
  HH = HH % 12;
  HH = HH ? HH : 12;
  const min = String(d.getMinutes()).padStart(2, "0");

  return `${MM}/${DD}/${YYYY} ${HH}:${min} ${ampm}`;
}

export function formatFullDate(ts: string | number | Date): string {
  return formatDate(ts);
}

export function formatMonth(key: string): string {
  if (!key) return "";
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, max = 40): string {
  if (!str) return "—";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// Single source of truth for category colors (matches the badge tokens in app.css).
export const CATEGORY_COLORS: Record<string, string> = {
  hardware: "#f97316",
  software: "#3b82f6",
  outreach: "#10b981",
  food: "#eab308",
  miscellaneous: "#8b5cf6",
};

// Order status colors — kept in sync with OrderStatusBadge.svelte.
export const STATUS_COLORS: Record<string, string> = {
  "Pending Review": "#3b82f6",
  Approved: "#06b6d4",
  Ordered: "#f97316",
  Received: "#10b981",
  Denied: "#ef4444",
  Cancelled: "#f59e0b",
  Void: "#71717a",
};

export const CATEGORIES = [
  "hardware",
  "software",
  "outreach",
  "food",
  "miscellaneous",
] as const;
export const TEAMS = [
  "FRC",
  "Westwood Overall",
  "Slingshot",
  "Atlatl",
  "Kunai",
  "Hunga Munga",
] as const;

export function getTeamBadgeClass(team: string): string {
  if (!team || team === "All" || team === "Westwood Overall") return "";
  return `badge-${team.toString().toLowerCase().trim().replace(/\s+/g, "-")}`;
}

export const CONTRIBUTION_TYPES = ["money", "parts", "services"] as const;
export const GRANT_STATUSES = [
  "Applied",
  "Pending",
  "Awarded",
  "Rejected",
] as const;

export const CAT_COLORS: Record<string, string> = {
  hardware: "#f97316",
  software: "#3b82f6",
  outreach: "#10b981",
  food: "#eab308",
  miscellaneous: "#8b5cf6",
};

export function getCatColor(cat: string | undefined): string {
  const key = (cat || "miscellaneous").toLowerCase();
  return CAT_COLORS[key] ?? CAT_COLORS["miscellaneous"];
}

export const STATUS_PRIORITY: Record<string, number> = {
  "pending review": 0,
  approved: 1,
  ordered: 2,
  received: 3,
  denied: 4,
  cancelled: 5,
  void: 6,
};

export function getOrderColor(uuid: string | undefined): string {
  if (!uuid) return "transparent";
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(Math.floor(hash * 137.5) % 360);
  return `hsl(${h}, 70%, 40%)`;
}

const _orderColorCache: Record<string, string> = {};

export function getOrderColorCached(uuid: string | undefined): string {
  if (!uuid) return "transparent";
  if (_orderColorCache[uuid]) return _orderColorCache[uuid];
  const c = getOrderColor(uuid);
  _orderColorCache[uuid] = c;
  return c;
}

export function matchesTeam(
  order: Pick<Order, "team">,
  selectedTeam: string,
): boolean {
  if (selectedTeam === "Westwood Overall") return true;
  const t = String(order.team || "")
    .toLowerCase()
    .trim();
  const s = selectedTeam.toLowerCase().trim();
  return (
    t === s ||
    t.includes(s) ||
    (s === "frc" && (t.includes("frc") || /^\d+$/.test(t)))
  );
}

export function generateShortId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
