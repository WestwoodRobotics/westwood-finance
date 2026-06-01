<script>
  import {
    formatCurrency,
    truncate,
    capitalize,
    getTeamBadgeClass,
    CAT_COLORS,
    STATUS_PRIORITY,
    getCatColor,
  } from "../utils.js";
  import { Settings, Code2, Megaphone, UtensilsCrossed, Package, ChevronRight } from '@lucide/svelte';
  const PackageIcon = Package;
  import OrderStatusBadge from "./OrderStatusBadge.svelte";
  import OrderDetailSheet from "./OrderDetailSheet.svelte";

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

  const CAT_ICONS = {
    hardware: Settings,
    software: Code2,
    outreach: Megaphone,
    food: UtensilsCrossed,
    miscellaneous: Package,
  };

  function getCatIcon(/** @type {string|undefined} */ cat) {
    const key = /** @type {keyof typeof CAT_ICONS} */ ((cat || "miscellaneous").toLowerCase());
    return CAT_ICONS[key] || CAT_ICONS.miscellaneous;
  }

  /** @param {string} url */
  function openExternal(url) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  /** @type {any} */
  let selectedOrder = /** @type {any|null} */ ($state(null));
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
        <tr
          class="group-row clickable-row"
          style="--group-color: {getCatColor(order.category)}"
          role="button"
          tabindex="0"
          onclick={() => selectedOrder = order}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedOrder = order)}
        >
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
        {@const CatIcon = getCatIcon(order.category)}
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

<OrderDetailSheet
  order={selectedOrder}
  open={!!selectedOrder}
  onclose={() => (selectedOrder = null)}
  onmanage={onmanage}
/>

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

  .clickable-row {
    cursor: pointer;
  }

  @media (hover: hover) {
    .clickable-row:hover td {
      background: var(--surface-2);
    }
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
    font-weight: 600;
  }
</style>
