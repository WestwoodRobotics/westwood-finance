<script>
  import { formatCurrency, formatDate, truncate, capitalize, getTeamBadgeClass } from '../utils.js';
  import IOSBottomSheet from './IOSBottomSheet.svelte';

  /** @type {{ expenses?: any[], limit?: number, hideTeam?: boolean }} */
  let { expenses = [], limit = 0, hideTeam = false } = $props();

  let sortCol = $state("timestamp");
  let sortDir = $state("desc");

  function toggleSort(/** @type {string} */ col) {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir = col === "timestamp" || col === "total" || col === "price" ? "desc" : "asc";
    }
  }

  let sortedExpenses = $derived(
    expenses.slice().sort((a, b) => {
      let valA = a[sortCol] || "";
      let valB = b[sortCol] || "";
      
      if (sortCol === 'total' || sortCol === 'price' || sortCol === 'quantity') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    })
  );

  let display = $derived(limit > 0 ? sortedExpenses.slice(0, limit) : sortedExpenses);

  /** @type {Record<string, string>} */
  const CAT_COLORS = {
    hardware: '#f97316',
    software: '#3b82f6',
    outreach: '#10b981',
    food: '#eab308',
    miscellaneous: '#8b5cf6',
  };

  /** @type {Record<string, string>} */
  const CAT_ICONS = {
    hardware: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    software: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    outreach: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    food: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    miscellaneous: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
  };

  function getCatColor(/** @type {string|undefined} */ cat) {
    return CAT_COLORS[(cat || 'miscellaneous').toLowerCase()] || '#8b5cf6';
  }
  function getCatIcon(/** @type {string|undefined} */ cat) {
    return CAT_ICONS[(cat || 'miscellaneous').toLowerCase()] || CAT_ICONS.miscellaneous;
  }

/** @param {string} url */
function openExternal(url) {
  if (!url) return;
  const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  window.open(href, '_blank', 'noopener,noreferrer');
}

  /** @type {any} */
  let selectedExpense = $state(null);
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
        <th class="sortable" onclick={() => toggleSort("company")}>
          <div class="th-content">
            Company {sortCol === "company" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        <th class="sortable" onclick={() => toggleSort("category")}>
          <div class="th-content">
            Category {sortCol === "category" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        {#if !hideTeam}
          <th class="sortable" onclick={() => toggleSort("team")}>
            <div class="th-content">
              Team {sortCol === "team" ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </div>
          </th>
        {/if}
        <th class="sortable" onclick={() => toggleSort("timestamp")}>
          <div class="th-content">
            Date {sortCol === "timestamp" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        <th class="text-right sortable" onclick={() => toggleSort("price")}>
          <div class="th-content text-right">
            Price {sortCol === "price" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        <th class="text-right sortable" onclick={() => toggleSort("quantity")}>
          <div class="th-content text-right">
            Qty {sortCol === "quantity" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
        <th class="text-right sortable" onclick={() => toggleSort("total")}>
          <div class="th-content text-right">
            Total {sortCol === "total" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      {#each display as expense (expense.id)}
        <tr>
          <td>
            <div class="item-name">
              {#if expense.link}
                <button type="button" class="item-link link-btn" onclick={() => openExternal(expense.link)}>
                  {truncate(expense.item, 40)} ↗
                </button>
              {:else}
                <span class="item-text">{truncate(expense.item, 40)}</span>
              {/if}
            </div>
            {#if expense.notes}
              <div class="item-notes">{truncate(expense.notes, 50)}</div>
            {/if}
          </td>
          <td><span class="company-name">{expense.company || '—'}</span></td>
          <td>
            <span class="badge badge-{expense.category}">
              {capitalize(expense.category)}
            </span>
          </td>
          {#if !hideTeam}
            <td class="text-muted font-medium">{expense.team || expense.user || '—'}</td>
          {/if}
          <td class="text-dim monospace" style="color: var(--text-dim);">{formatDate(expense.timestamp)}</td>
          <td class="text-right monospace">{formatCurrency(expense.price)}</td>
          <td class="text-right font-medium">{expense.quantity}</td>
          <td class="text-right monospace amount">
            {formatCurrency(expense.total)}
          </td>
        </tr>
      {/each}
      {#if expenses.length === 0}
        <tr>
          <td colspan="8">
            <div class="empty-state" style="padding: 40px 0;">
              <div class="icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h8"/><path d="M8 16h8"/><path d="M8 6h8"/></svg>
              </div>
              No expenses found
            </div>
          </td>
        </tr>
      {/if}
    </tbody>
    {#if display.length > 0}
      <tfoot>
        <tr class="total-row">
          <td colspan={hideTeam ? 6 : 7} class="total-label text-right" style="padding-right: 16px;">Subtotal</td>
          <td class="text-right monospace total-amount">
            {formatCurrency(display.reduce((sum, e) => sum + (e.total || 0), 0))}
          </td>
        </tr>
      </tfoot>
    {/if}
  </table>
</div>

<!-- ── iOS Mobile List ───────────────────────────────────────────────────── -->
<div class="ios-list-wrap fade-in mobile-list">
  {#if expenses.length === 0}
    <div class="empty-state" style="padding: 40px 16px; border-radius: 14px;">
      <div class="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
      </div>
      No expenses found
    </div>
  {:else}
    <div class="ios-list-group">
      {#each display as expense (expense.id)}
        {@const catColor = getCatColor(expense.category)}
        {@const catIcon = getCatIcon(expense.category)}
        <div 
          class="ios-cell" 
          role="button" 
          tabindex="0"
          onclick={() => selectedExpense = expense}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedExpense = expense)}
        >
          <div class="ios-cell-icon" style="background: {catColor}22; color: {catColor}; font-size: 18px;">
            {@html catIcon}
          </div>
          <div class="ios-cell-body">
            <div class="ios-cell-title">{truncate(expense.item, 28)}</div>
            <div class="ios-cell-subtitle">
              {expense.company || '—'}{!hideTeam && expense.team ? ` · ${expense.team}` : ''} · {formatDate(expense.timestamp)}
            </div>
          </div>
          <div class="ios-cell-trailing">
            <span class="ios-cell-amount">{formatCurrency(expense.total)}</span>
            <span class="ios-cell-qty">×{expense.quantity}</span>
          </div>
        </div>
      {/each}
    </div>

    <IOSBottomSheet open={!!selectedExpense} onclose={() => selectedExpense = null} title="Expense Details">
      {#snippet children()}
        {#if selectedExpense}
          {@const catColor = getCatColor(selectedExpense.category)}
          {@const catIcon = getCatIcon(selectedExpense.category)}
          <div class="ios-receipt-card">
            <div class="ios-receipt-header">
              <div class="ios-receipt-avatar" style="background: {catColor}22; color: {catColor}; font-size: 18px;">
                {@html catIcon}
              </div>
              <div class="ios-receipt-amount">{formatCurrency(selectedExpense.total)}</div>
              <div class="ios-receipt-title">{selectedExpense.item}</div>
              <div class="ios-receipt-subtitle">{selectedExpense.company || '—'}</div>
            </div>

            <hr class="ios-receipt-divider" />

            <div class="ios-receipt-grid">
              <div class="ios-receipt-row">
                <span class="ios-receipt-label">Date</span>
                <span class="ios-receipt-val monospace">{formatDate(selectedExpense.timestamp)}</span>
              </div>
              <div class="ios-receipt-row">
                <span class="ios-receipt-label">Team</span>
                <span class="ios-receipt-val">{selectedExpense.team || "—"}</span>
              </div>
              <div class="ios-receipt-row">
                <span class="ios-receipt-label">Category</span>
                <span class="ios-receipt-val">{capitalize(selectedExpense.category)}</span>
              </div>
              <div class="ios-receipt-row">
                <span class="ios-receipt-label">Unit Price</span>
                <span class="ios-receipt-val monospace">{formatCurrency(selectedExpense.price)}</span>
              </div>
              <div class="ios-receipt-row">
                <span class="ios-receipt-label">Quantity</span>
                <span class="ios-receipt-val monospace">×{selectedExpense.quantity}</span>
              </div>
            </div>

            {#if selectedExpense.notes}
              <div class="ios-receipt-notes-card">
                <div class="ios-receipt-notes-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                  Notes
                </div>
                <div class="ios-receipt-notes-body">{selectedExpense.notes}</div>
              </div>
            {/if}

            {#if selectedExpense.link}
              <button
                type="button"
                onclick={() => openExternal(selectedExpense.link)}
                class="btn btn-primary btn-block"
              >
                Open Vendor Link ↗
              </button>
            {/if}
          </div>
        {/if}
      {/snippet}
    </IOSBottomSheet>

    {#if display.length > 0}
      <div class="ios-total-row">
        <span class="ios-total-label">Subtotal</span>
        <span class="ios-total-amount">{formatCurrency(display.reduce((sum, e) => sum + (e.total || 0), 0))}</span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .desktop-table { display: block; }
  .mobile-list   { display: none; }

  @media (max-width: 768px) {
    .desktop-table { display: none; }
    .mobile-list   { display: block; }
  }

  .table-wrap { box-shadow: var(--shadow-sm); }

  .th-content {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }

  .item-name { font-weight: 600; color: var(--text); }
  .item-link { color: var(--primary); transition: color 0.2s; }
  
  @media (hover: hover) {
    .item-link:hover { color: var(--primary-dark); text-decoration: underline; }
  }

  .item-notes { font-size: 0.72rem; color: var(--text-muted); margin-top: 1px; font-weight: 400; }
  .company-name { font-size: 0.82rem; color: var(--text-muted); }
  .amount { font-weight: 700; color: #fff; font-size: 0.95rem; }
  .text-dim { color: var(--text-dim); }
  .font-medium { font-weight: 500; }

  /* iOS list extras */
  .ios-list-wrap { margin-bottom: 1.5rem; }

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
    font-family: -apple-system, 'SF Pro Text', sans-serif;
  }

  .ios-total-amount {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    font-family: 'SF Mono', 'JetBrains Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  .ios-cell-qty {
    font-size: 12px;
    color: var(--text-muted);
    font-family: -apple-system, 'SF Pro Text', sans-serif;
  }



  .stat-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
</style>
