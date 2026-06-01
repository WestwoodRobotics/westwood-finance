<script>
  import {
    formatCurrency,
    formatFullDate,
    truncate,
    capitalize,
    getTeamBadgeClass,
  } from "../utils.js";
  import { Settings, Code2, Megaphone, UtensilsCrossed, Package, Pencil, ChevronRight } from '@lucide/svelte';
  const PackageIcon = Package;
  import OrderStatusBadge from "./OrderStatusBadge.svelte";
  import IOSBottomSheet from "./IOSBottomSheet.svelte";

  /** @type {{ orders: any[], limit?: number, hideTeamColumn?: boolean, hideCategoryColumn?: boolean, hideCompanyColumn?: boolean, onmanage?: (order: any) => void }} */
  let {
    orders = [],
    limit = 0,
    hideTeamColumn = false,
    hideCategoryColumn = false,
    hideCompanyColumn = false,
    onmanage,
  } = $props();

  let sortCol = $state("status");
  let sortDir = $state("asc");

  function toggleSort(/** @type {string} */ col) {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir =
        col === "timestamp" || col === "total" || col === "price"
          ? "desc"
          : "asc";
    }
  }

  /** @type {Record<string, number>} */
  const STATUS_PRIORITY = {
    "pending review": 0,
    approved: 1,
    ordered: 2,
    received: 3,
    denied: 4,
    void: 5,
  };

  let sortedOrders = $derived(
    orders.slice().sort((a, b) => {
      if (sortCol === "status") {
        let pA = STATUS_PRIORITY[(a.status || "").toLowerCase().trim()] ?? 99;
        let pB = STATUS_PRIORITY[(b.status || "").toLowerCase().trim()] ?? 99;
        const diff = sortDir === "asc" ? pA - pB : pB - pA;
        if (diff !== 0) return diff;
        const uA = String(a.orderUUID || "").toLowerCase();
        const uB = String(b.orderUUID || "").toLowerCase();
        return uA.localeCompare(uB);
      }

      let valA = a[sortCol] || "";
      let valB = b[sortCol] || "";

      if (
        sortCol === "total" ||
        sortCol === "price" ||
        sortCol === "quantity"
      ) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    }),
  );

  let display = $derived(
    limit > 0 ? sortedOrders.slice(0, limit) : sortedOrders,
  );

  /** @type {Record<string, string>} */
  const colorCache = {};

  function getOrderColor(/** @type {string|undefined} */ uuid) {
    if (!uuid) return "transparent";
    if (colorCache[uuid]) return colorCache[uuid];
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(Math.floor(hash * 137.5) % 360);
    const color = `hsl(${h}, 70%, 40%)`;
    colorCache[uuid] = color;
    return color;
  }

  /** @type {Record<string, string>} */
  const CAT_COLORS = {
    hardware: "#f97316",
    software: "#3b82f6",
    outreach: "#10b981",
    food: "#eab308",
    miscellaneous: "#8b5cf6",
  };

  const CAT_ICONS = {
    hardware: Settings,
    software: Code2,
    outreach: Megaphone,
    food: UtensilsCrossed,
    miscellaneous: Package,
  };

  /** @type {Record<string,string>} */ const CAT_COLORS_MAP = CAT_COLORS;
  /** @type {Record<string,any>} */ const CAT_ICONS_MAP = CAT_ICONS;

  function getCatColor(/** @type {string|undefined} */ cat) {
    return CAT_COLORS_MAP[(cat || "miscellaneous").toLowerCase()] || "#8b5cf6";
  }
  function getCatIcon(/** @type {string|undefined} */ cat) {
    return CAT_ICONS_MAP[(cat || "miscellaneous").toLowerCase()] || CAT_ICONS.miscellaneous;
  }

  /** @param {string} url */
  function openExternal(url) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  /** @type {any} */
  let selectedOrder = /** @type {any|null} */ ($state(null));

  // Swipe gesture variables
  let touchStartY = 0;
  let touchCurrentY = 0;
  let isSwiping = $state(false);
  let swipeTranslateY = $state(0);

  function handleTouchStart(/** @type {TouchEvent} */ e) {
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
  }

  function handleTouchMove(/** @type {TouchEvent} */ e) {
    if (!isSwiping) return;
    touchCurrentY = e.touches[0].clientY;
    const delta = touchCurrentY - touchStartY;
    if (delta > 0) {
      swipeTranslateY = delta;
    }
  }

  function handleTouchEnd() {
    if (swipeTranslateY > 100) {
      selectedOrder = null;
    }
    isSwiping = false;
    swipeTranslateY = 0;
  }
</script>

<!-- ── Desktop Table ─────────────────────────────────────────────────────── -->
<div class="table-wrap fade-in desktop-table">
  <table>
    <thead>
      <tr>
        <th class="sortable" onclick={() => toggleSort("item")}>
          <div class="th-content">
            Item {sortCol === "item" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        {#if !hideCompanyColumn}
          <th class="sortable" onclick={() => toggleSort("company")}>
            <div class="th-content">
              Vendor {sortCol === "company"
                ? sortDir === "asc"
                  ? "↑"
                  : "↓"
                : ""}
            </div>
          </th>
        {/if}
        {#if !hideCategoryColumn}
          <th class="sortable" onclick={() => toggleSort("category")}>
            <div class="th-content">
              Category {sortCol === "category"
                ? sortDir === "asc"
                  ? "↑"
                  : "↓"
                : ""}
            </div>
          </th>
        {/if}
        {#if !hideTeamColumn}
          <th class="sortable" onclick={() => toggleSort("team")}>
            <div class="th-content">
              Team {sortCol === "team" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </div>
          </th>
        {/if}
        <th class="sortable" onclick={() => toggleSort("status")}>
          <div class="th-content">
            Status {sortCol === "status" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        <th class="sortable" onclick={() => toggleSort("timestamp")}>
          <div class="th-content">
            Date {sortCol === "timestamp"
              ? sortDir === "asc"
                ? "↑"
                : "↓"
              : ""}
          </div>
        </th>
        <th class="text-right sortable" onclick={() => toggleSort("total")}>
          <div class="th-content text-right">
            Total {sortCol === "total" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        {#if onmanage}
          <th class="text-right" style="padding-right: 24px;"></th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each display as order (order.id)}
        {@const orderColor = getOrderColor(order.orderUUID)}
        <tr class="group-row" style="--group-color: {orderColor}">
          <td>
            <div class="item-name">
              {#if order.link}
                <button
                  type="button"
                  class="item-link link-btn"
                  onclick={() => openExternal(order.link)}
                >
                  {truncate(order.item, 40)} ↗
                </button>
              {:else}
                <span class="item-text">{truncate(order.item, 40)}</span>
              {/if}
            </div>
            {#if order.notes}
              <div class="item-notes">{truncate(order.notes, 50)}</div>
            {/if}
            {#if order.tracking}
              <div class="tracking-info">
                <button
                  type="button"
                  class="tracking-link link-btn"
                  onclick={() => openExternal(order.tracking)}
                >Tracking ↗</button>
              </div>
            {/if}
          </td>
          {#if !hideCompanyColumn}
            <td><span class="company-name">{order.company || "—"}</span></td>
          {/if}
          {#if !hideCategoryColumn}
            <td>
              <span class="badge badge-{order.category}">
                {capitalize(order.category)}
              </span>
            </td>
          {/if}
          {#if !hideTeamColumn}
            <td class="text-muted font-medium">
              {order.team || order.user || "—"}
            </td>
          {/if}
          <td>
            <OrderStatusBadge status={order.status} />
          </td>
          <td class="text-dim monospace" style="color: var(--text-dim);"
            >{formatFullDate(order.timestamp)}</td
          >
          <td class="text-right monospace amount">
            {formatCurrency(order.total)}
          </td>
          {#if onmanage}
            <td class="text-right" style="padding-right: 24px;">
              <button
                class="btn btn-primary btn-sm"
                onclick={() => onmanage(order)}
              >
                Manage
              </button>
            </td>
          {/if}
        </tr>
      {/each}
      {#if orders.length === 0}
        {@const emptyCols =
          7 -
          (hideTeamColumn ? 1 : 0) -
          (hideCategoryColumn ? 1 : 0) -
          (hideCompanyColumn ? 1 : 0) +
          (onmanage ? 1 : 0)}
        <tr>
          <td colspan={emptyCols}>
            <div class="empty-state">
              <div class="icon">
                <PackageIcon size={32} stroke-width={1.5} />
              </div>
              No orders found
            </div>
          </td>
        </tr>
      {/if}
    </tbody>
    {#if display.length > 0}
      {@const footCols =
        6 -
        (hideTeamColumn ? 1 : 0) -
        (hideCategoryColumn ? 1 : 0) -
        (hideCompanyColumn ? 1 : 0) +
        (onmanage ? 1 : 0) -
        (onmanage ? 1 : 0)}
      <tfoot>
        <tr class="total-row">
          <td colspan={footCols} class="total-label">Subtotal</td>
          <td class="text-right monospace total-amount">
            {formatCurrency(
              display.reduce((sum, o) => sum + (o.total || 0), 0),
            )}
          </td>
          {#if onmanage}
            <td></td>
          {/if}
        </tr>
      </tfoot>
    {/if}
  </table>
</div>

<!-- ── iOS Mobile List ───────────────────────────────────────────────────── -->
<div class="ios-list-wrap fade-in mobile-list">
  {#if orders.length === 0}
    <div class="empty-state" style="padding: 40px 16px; border-radius: 14px;">
      <div class="icon">
        <PackageIcon size={32} stroke-width={1.5} />
      </div>
      No orders found
    </div>
  {:else}
    <div class="ios-list-group">
      {#each display as order (order.id)}
        {@const catColor = getCatColor(order.category)}
        {@const catIcon = getCatIcon(order.category)}
        {@const CatIcon = catIcon}
        <div
          class="ios-cell"
          role="button"
          tabindex="0"
          aria-label="View order details for {order.item}"
          onclick={() => selectedOrder = order}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedOrder = order)}
        >
          <!-- Category icon -->
          <div
            class="ios-cell-icon"
            style="background: {catColor}22; color: {catColor}; font-size: 18px;"
          >
            <CatIcon size={18} />
          </div>

          <!-- Item info -->
          <div class="ios-cell-body">
            <div class="ios-cell-title">
              {truncate(order.item, 32)}
            </div>
            <div class="ios-cell-subtitle">
              {order.company || "—"}{!hideTeamColumn && order.team
                ? ` · ${order.team}`
                : ""}
            </div>
          </div>

          <!-- Status + Amount -->
          <div class="ios-cell-trailing">
            <span class="ios-cell-amount">{formatCurrency(order.total)}</span>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <OrderStatusBadge status={order.status} />
              <span class="ios-cell-qty">×{order.quantity}</span>
            </div>
          </div>

          {#if onmanage}
            <ChevronRight class="ios-chevron" size={14} />
          {/if}
        </div>
      {/each}
    </div>

    <!-- Total row -->
    {#if display.length > 0}
      <div class="ios-total-row">
        <span class="ios-total-label">Subtotal</span>
        <span class="ios-total-amount"
          >{formatCurrency(
            display.reduce((sum, o) => sum + (o.total || 0), 0),
          )}</span
        >
      </div>
    {/if}
  {/if}
</div>

<IOSBottomSheet open={!!selectedOrder} onclose={() => selectedOrder = null} title="Order Details">
  {#snippet children()}
    {#if selectedOrder}
      {@const catColor = getCatColor(selectedOrder.category)}
      {@const catIcon = getCatIcon(selectedOrder.category)}
      {@const CatIcon = catIcon}
      <div class="ios-receipt-card">
        <div class="ios-receipt-header">
          <div class="ios-receipt-avatar" style="background: {catColor}22; color: {catColor}; font-size: 18px;">
            <CatIcon size={18} />
          </div>
          <div class="ios-receipt-amount">{formatCurrency(selectedOrder.total)}</div>
          <div class="ios-receipt-title">{selectedOrder.item}</div>
          <div class="ios-receipt-subtitle">{selectedOrder.company || '—'}</div>
        </div>

        <hr class="ios-receipt-divider" />

        <div class="ios-receipt-grid">
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Status</span>
            <span class="ios-receipt-val"><OrderStatusBadge status={selectedOrder.status} /></span>
          </div>
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Date</span>
            <span class="ios-receipt-val monospace">{formatFullDate(selectedOrder.timestamp)}</span>
          </div>
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Team</span>
            <span class="ios-receipt-val">{selectedOrder.team || selectedOrder.user || "—"}</span>
          </div>
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Category</span>
            <span class="ios-receipt-val">{capitalize(selectedOrder.category)}</span>
          </div>
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Unit Price</span>
            <span class="ios-receipt-val monospace">{formatCurrency(selectedOrder.price)}</span>
          </div>
          <div class="ios-receipt-row">
            <span class="ios-receipt-label">Quantity</span>
            <span class="ios-receipt-val monospace">×{selectedOrder.quantity}</span>
          </div>
          {#if selectedOrder.tracking}
            <div class="ios-receipt-row">
              <span class="ios-receipt-label">Tracking</span>
              <span class="ios-receipt-val monospace">
                <button type="button" class="link-btn" onclick={() => openExternal(selectedOrder.tracking)}>
                  {selectedOrder.tracking} ↗
                </button>
              </span>
            </div>
          {/if}
        </div>

        {#if selectedOrder.notes}
          <div class="ios-receipt-notes-card">
            <div class="ios-receipt-notes-title">
              <Pencil size={12} />
              Notes
            </div>
            <div class="ios-receipt-notes-body">{selectedOrder.notes}</div>
          </div>
        {/if}

        <div style="display: flex; flex-direction: column; gap: 10px;">
          {#if selectedOrder.link}
            <button
              type="button"
              class="btn btn-ghost btn-block"
              style="height: 48px; border-radius: 12px; font-weight: 700;"
              onclick={() => openExternal(selectedOrder.link)}
            >
              Open Vendor Link ↗
            </button>
          {/if}

          {#if onmanage}
            <button
              class="btn btn-primary btn-block"
              onclick={() => {
                onmanage(selectedOrder);
                selectedOrder = null;
              }}
            >
              Manage Order
            </button>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}
</IOSBottomSheet>

<style>
  /* ── Desktop: show table, hide list ─────────────────────────── */
  .desktop-table {
    display: block;
  }
  .mobile-list {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-table {
      display: none;
    }
    .mobile-list {
      display: block;
    }
  }

  /* ── Desktop Table Styles ────────────────────────────────────── */
  .table-wrap {
    box-shadow: var(--shadow-sm);
    margin-bottom: 2rem;
  }

  table {
    min-width: 900px;
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .item-name {
    font-weight: 600;
    color: var(--text);
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .item-link {
    color: var(--primary);
    transition: color 0.2s;
  }

  @media (hover: hover) {
    .item-link:hover {
      color: var(--primary-dark);
      text-decoration: underline;
    }
  }

  .item-notes {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin-top: 1px;
    font-weight: 400;
  }

  .company-name {
    font-size: 0.82rem;
    color: var(--text-muted);
  }

  .amount {
    font-weight: 700;
    color: #fff;
    font-size: 0.95rem;
  }

  .text-dim {
    color: var(--text-dim);
  }
  .font-medium {
    font-weight: 500;
  }

  .group-row td:first-child {
    position: relative;
    padding-left: 20px !important;
  }

  .group-row td:first-child::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--group-color, var(--primary));
    opacity: 0.9;
  }

  .tracking-info {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .tracking-link {
    color: var(--primary);
    text-decoration: none;
    transition: all 0.2s;
    border-bottom: 1px solid rgba(249, 115, 22, 0.3);
  }

  @media (hover: hover) {
    .tracking-link:hover {
      color: #fff;
      border-bottom-color: currentColor;
    }
  }

  /* ── iOS List Styles ─────────────────────────────────────────── */
  .ios-list-wrap {
    margin-bottom: 1.5rem;
  }

  .ios-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    margin-top: 8px;
  }

  .ios-total-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: -apple-system, "SF Pro Text", sans-serif;
  }

  .ios-total-amount {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-variant-numeric: tabular-nums;
  }

  .ios-cell-qty {
    font-size: 11px;
    color: var(--text-muted);
    font-family: -apple-system, "SF Pro Text", sans-serif;
    font-weight: 600;
  }
</style>
