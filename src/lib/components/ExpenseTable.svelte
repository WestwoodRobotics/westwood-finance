<script lang="ts">
  import { formatCurrency, formatDate, truncate, capitalize, getTeamBadgeClass } from '../utils.js';
  import { Settings, Code2, Megaphone, UtensilsCrossed, Package, ClipboardList, Clipboard, Pencil } from '@lucide/svelte';
  import IOSBottomSheet from './IOSBottomSheet.svelte';

  let { expenses = [], limit = 0, hideTeam = false } = $props();

  let sortCol = $state("timestamp");
  let sortDir = $state("desc");

  function toggleSort(col) {
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

  const CAT_COLORS = {
    hardware: '#f97316',
    software: '#3b82f6',
    outreach: '#10b981',
    food: '#eab308',
    miscellaneous: '#8b5cf6',
  };

  const CAT_ICONS = {
    hardware: Settings,
    software: Code2,
    outreach: Megaphone,
    food: UtensilsCrossed,
    miscellaneous: Package,
  };

  const CAT_COLORS_MAP = CAT_COLORS;
  const CAT_ICONS_MAP = CAT_ICONS;

  function getCatColor(cat) {
    return CAT_COLORS_MAP[(cat || 'miscellaneous').toLowerCase()] || '#8b5cf6';
  }
  function getCatIcon(cat) {
    return CAT_ICONS_MAP[(cat || 'miscellaneous').toLowerCase()] || CAT_ICONS.miscellaneous;
  }

function openExternal(url) {
  if (!url) return;
  const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
  window.open(href, '_blank', 'noopener,noreferrer');
}

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
        <tr
          class="clickable-row"
          role="button"
          tabindex="0"
          onclick={() => selectedExpense = expense}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedExpense = expense)}
        >
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
                <ClipboardList size={48} stroke-width={1} />
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
    <div class="empty-state">
      <div class="icon">
        <Clipboard size={40} stroke-width={1} />
      </div>
      No expenses found
    </div>
  {:else}
    <div class="ios-list-group">
      {#each display as expense (expense.id)}
        {@const catColor = getCatColor(expense.category)}
        {@const catIcon = getCatIcon(expense.category)}
        {@const CatIcon = catIcon}
        <div
          class="ios-cell"
          role="button"
          tabindex="0"
          onclick={() => selectedExpense = expense}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (selectedExpense = expense)}
        >
          <div class="ios-cell-icon" style="background: {catColor}22; color: {catColor}; font-size: 18px;">
            <CatIcon size={18} />
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
          {@const CatIcon = catIcon}
          <div class="ios-receipt-card">
            <div class="ios-receipt-header">
              <div class="ios-receipt-avatar" style="background: {catColor}22; color: {catColor}; font-size: 18px;">
                <CatIcon size={18} />
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
                  <Pencil size={12} />
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

  .clickable-row { cursor: pointer; }
  @media (hover: hover) { .clickable-row:hover td { background: var(--surface-2); } }
  .clickable-row:focus-visible td { background: var(--surface-2); outline: none; }

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
