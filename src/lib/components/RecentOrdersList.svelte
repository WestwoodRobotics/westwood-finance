<script lang="ts">
  import { Package } from '@lucide/svelte';
  import OrderStatusBadge from './OrderStatusBadge.svelte';
  import { formatCurrency, formatDate, getCatColor } from '$lib/utils.js';
  import type { Order } from '$lib/types.js';

  let { orders, onselect }: { orders: Order[]; onselect: (order: Order) => void } = $props();
</script>

<div class="recent-list">
  {#each orders as order (order.id)}
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      class="recent-item group-row"
      style="--group-color: {getCatColor(order.category)};"
      role="button"
      tabindex="0"
      onclick={() => onselect(order)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onselect(order)}
    >
      <div class="item-info">
        <div class="item-name">{order.item}</div>
        <div class="item-meta">
          <span class="company">{order.company}</span>
          <span class="dot"></span>
          <span class="date">{formatDate(order.timestamp)}</span>
        </div>
      </div>
      <div class="item-status"><OrderStatusBadge status={order.status} /></div>
      <div class="item-amount monospace">{formatCurrency(order.total)}</div>
    </div>
  {:else}
    <div class="empty-state" style="padding: 32px 20px;">
      <div class="icon"><Package size={36} stroke-width={1} /></div>
      <h3 style="font-size: 0.9rem; margin-top: 10px;">No active orders</h3>
    </div>
  {/each}
</div>

<style>
  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .recent-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    padding: 12px 14px 12px 18px;
    background: var(--surface);
    transition: all 0.2s;
    position: relative;
    min-width: 0;
    cursor: pointer;
  }

  .recent-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--group-color);
    border-radius: 99px;
    opacity: 0.8;
  }

  .recent-item:hover { background: var(--surface-2); }

  .item-info { min-width: 0; overflow: hidden; }

  .item-name {
    font-weight: 600;
    font-size: 0.85rem;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-dim);
    font-weight: 500;
    overflow: hidden;
  }

  .item-meta .company,
  .item-meta .date {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dot {
    width: 3px;
    height: 3px;
    background: var(--text-dim);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .item-status { flex-shrink: 0; }

  .item-amount {
    flex-shrink: 0;
    white-space: nowrap;
    text-align: right;
    font-weight: 700;
    color: #fff;
    font-size: 0.85rem;
  }
</style>
