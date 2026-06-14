<script lang="ts">
  import { Package } from '@lucide/svelte';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import { formatCurrency, formatFullDate, capitalize, getOrderColorCached } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';
  import type { Order } from '$lib/types.js';

  let { syncing, onmanage }: { syncing: boolean; onmanage: (order: Order) => void } = $props();

  const STATUS_PRIORITY: Record<string, number> = { 'pending review': 0, approved: 1, ordered: 2, received: 3, denied: 4, cancelled: 5, void: 6 };

  let adminSortCol = $state('status');
  let adminSortDir = $state('asc');

  let sortedAdminOrders = $derived.by(() =>
    dataService.orders.slice().sort((a, b) => {
      if (adminSortCol === 'status') {
        const pA = STATUS_PRIORITY[(a.status || '').toLowerCase().trim()] ?? 99;
        const pB = STATUS_PRIORITY[(b.status || '').toLowerCase().trim()] ?? 99;
        const diff = adminSortDir === 'asc' ? pA - pB : pB - pA;
        if (diff !== 0) return diff;
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      }
      if (adminSortCol === 'timestamp') {
        const tA = new Date(a.timestamp || 0).getTime();
        const tB = new Date(b.timestamp || 0).getTime();
        return adminSortDir === 'asc' ? tA - tB : tB - tA;
      }
      if (adminSortCol === 'total') {
        return adminSortDir === 'asc' ? (a.total || 0) - (b.total || 0) : (b.total || 0) - (a.total || 0);
      }
      const valA = String((a as unknown as Record<string, unknown>)[adminSortCol] || '').toLowerCase();
      const valB = String((b as unknown as Record<string, unknown>)[adminSortCol] || '').toLowerCase();
      return adminSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    })
  );

  function toggleAdminSort(col: string) {
    if (adminSortCol === col) { adminSortDir = adminSortDir === 'asc' ? 'desc' : 'asc'; }
    else { adminSortCol = col; adminSortDir = col === 'timestamp' || col === 'total' ? 'desc' : 'asc'; }
  }

  function openExternal(url: string) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }
</script>

<section class="fade-in">
  <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
    <span>Order History ({dataService.orders.length})</span>
  </div>
  <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">Manage order statuses, UUIDs, and tracking links. Updates sync directly to Google Sheets.</p>
  <div class="card card-flush orders-card">
    {#if dataService.loading && !dataService.orders.length}
      <LoadingIndicator text="Loading admin backlog..." />
    {:else if dataService.orders.length === 0}
      <div class="empty-state fade-in">
        <div class="icon"><Package size={48} stroke-width={1} /></div>
        <h3>No requests on file</h3>
        <p>New requests will appear here for admin action.</p>
      </div>
    {:else}
      <div class="table-wrap" style="border: none; border-radius: 0;">
        <table>
          <thead>
            <tr>
              <th class="sortable" style="padding-left: 24px;" onclick={() => toggleAdminSort('item')}>
                <div class="th-content">Provision/Item {adminSortCol === 'item' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="sortable" onclick={() => toggleAdminSort('category')}>
                <div class="th-content">Category {adminSortCol === 'category' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="sortable" onclick={() => toggleAdminSort('team')}>
                <div class="th-content">Team {adminSortCol === 'team' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="sortable" onclick={() => toggleAdminSort('timestamp')}>
                <div class="th-content">Date {adminSortCol === 'timestamp' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="sortable text-right" onclick={() => toggleAdminSort('total')}>
                <div class="th-content text-right">Investment {adminSortCol === 'total' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="sortable" onclick={() => toggleAdminSort('status')}>
                <div class="th-content">Status {adminSortCol === 'status' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
              </th>
              <th class="text-right" style="padding-right: 24px;"></th>
            </tr>
          </thead>
          <tbody>
            {#each sortedAdminOrders as order (order.id)}
              <tr class="fade-in group-row" style="--group-color: {getOrderColorCached(order.orderUUID)}">
                <td style="padding-left: 24px;">
                  <div class="item-primary">
                    {#if order.link}
                      <button type="button" class="admin-link-btn" onclick={() => openExternal(order.link)}>
                        {order.item} ↗
                      </button>
                    {:else}
                      {order.item}
                    {/if}
                  </div>
                  {#if order.company || order.notes}
                    <div class="item-secondary">{order.company || ''}{order.notes ? ` · ${order.notes}` : ''}</div>
                  {/if}
                </td>
                <td><span class="badge badge-{(order.category || '').toLowerCase()}">{capitalize(order.category) || '—'}</span></td>
                <td>{order.team || '—'}</td>
                <td class="text-dim">{formatFullDate(order.timestamp)}</td>
                <td class="text-right monospace amount">{formatCurrency(order.total)}</td>
                <td><OrderStatusBadge status={order.status} /></td>
                <td class="text-right" style="padding-right: 24px;">
                  <button class="btn btn-primary btn-sm" onclick={() => onmanage(order)}>Manage</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>

<style>
  .item-primary { font-weight: 700; color: #fff; font-size: 0.9rem; }
  .item-secondary { font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; }
  .amount { font-weight: 700; color: #fff; }

  .admin-link-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    text-align: left;
    color: var(--primary);
    transition: color 0.2s;
  }

  @media (hover: hover) {
    .admin-link-btn:hover {
      color: #fff;
      text-decoration: underline;
    }
    
    .group-row:hover td {
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

  .text-dim {
    color: var(--text-dim);
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
  }

  .sortable {
    cursor: pointer;
  }
</style>
