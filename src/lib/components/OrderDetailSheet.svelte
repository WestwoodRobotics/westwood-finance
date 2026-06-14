<script lang="ts">
  import { Settings, Code2, Megaphone, UtensilsCrossed, Package, Pencil } from '@lucide/svelte';
  import IOSBottomSheet from './IOSBottomSheet.svelte';
  import OrderStatusBadge from './OrderStatusBadge.svelte';
  import { formatCurrency, formatFullDate, capitalize, getCatColor } from '../utils.js';

  let { order, open, onclose, onmanage } = $props();

  const CAT_ICONS = {
    hardware: Settings,
    software: Code2,
    outreach: Megaphone,
    food: UtensilsCrossed,
    miscellaneous: Package,
  };

  function getCatIcon(cat) {
    const key = ((cat || 'miscellaneous').toLowerCase());
    return CAT_ICONS[key] || CAT_ICONS.miscellaneous;
  }

  function openExternal(url) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }
</script>

<IOSBottomSheet {open} {onclose} title="Order Details">
  {#snippet children()}
    {#if order}
      {@const catColor = getCatColor(order.category)}
      {@const CatIcon = getCatIcon(order.category)}
      <div class="receipt-card">
        <div class="receipt-header">
          <div class="receipt-avatar" style="background: {catColor}22; color: {catColor};">
            <CatIcon size={22} />
          </div>
          <div class="receipt-amount">{formatCurrency(order.total)}</div>
          <div class="receipt-title">{order.item}</div>
          <div class="receipt-subtitle">{order.company || '—'}</div>
        </div>

        <hr class="receipt-divider" />

        <div class="receipt-grid">
          <div class="receipt-row">
            <span class="receipt-label">Status</span>
            <span class="receipt-val"><OrderStatusBadge status={order.status} /></span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Date</span>
            <span class="receipt-val monospace">{formatFullDate(order.timestamp)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Team</span>
            <span class="receipt-val">{order.team || order.user || '—'}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Category</span>
            <span class="receipt-val">{capitalize(order.category)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Unit Price</span>
            <span class="receipt-val monospace">{formatCurrency(order.price)}</span>
          </div>
          <div class="receipt-row">
            <span class="receipt-label">Quantity</span>
            <span class="receipt-val monospace">×{order.quantity}</span>
          </div>
          {#if order.tracking}
            <div class="receipt-row">
              <span class="receipt-label">Tracking</span>
              <span class="receipt-val monospace">
                <button type="button" class="link-btn" onclick={() => openExternal(order.tracking)}>
                  {order.tracking} ↗
                </button>
              </span>
            </div>
          {/if}
        </div>

        {#if order.notes}
          <div class="receipt-notes-card">
            <div class="receipt-notes-title">
              <Pencil size={12} />
              Notes
            </div>
            <div class="receipt-notes-body">{order.notes}</div>
          </div>
        {/if}

        <div class="receipt-actions">
          {#if order.link}
            <button
              type="button"
              class="btn btn-ghost btn-block"
              onclick={() => openExternal(order.link)}
            >
              Open Vendor Link ↗
            </button>
          {/if}
          {#if onmanage}
            <button
              class="btn btn-primary btn-block"
              onclick={() => { onmanage(order); onclose(); }}
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
  .receipt-card {
    padding: 0 20px 24px;
  }

  .receipt-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 0 20px;
    gap: 6px;
  }

  .receipt-avatar {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .receipt-amount {
    font-size: 28px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .receipt-title {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .receipt-subtitle {
    font-size: 13px;
    color: var(--text-muted);
  }

  .receipt-divider {
    border: none;
    border-top: 0.5px solid rgba(255, 255, 255, 0.08);
    margin: 0 0 16px;
  }

  .receipt-grid {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .receipt-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 11px 0;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.05);
    gap: 12px;
  }

  .receipt-row:last-child {
    border-bottom: none;
  }

  .receipt-label {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 500;
    flex-shrink: 0;
  }

  .receipt-val {
    font-size: 14px;
    color: #fff;
    font-weight: 600;
    text-align: right;
  }

  .receipt-notes-card {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    padding: 12px 14px;
    margin-top: 16px;
  }

  .receipt-notes-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .receipt-notes-body {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.5;
  }

  .receipt-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }

  .btn-block {
    width: 100%;
    justify-content: center;
    height: 48px;
    border-radius: 12px;
    font-weight: 700;
  }

  .link-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: var(--primary);
    text-align: right;
  }
</style>
