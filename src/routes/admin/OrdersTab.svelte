<script lang="ts">
  import { Package } from '@lucide/svelte';
  import OrderTable from '$lib/components/OrderTable.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import type { Order } from '$lib/types.js';

  let { syncing, onmanage, onlinkgroup, oneditgroup }: {
    syncing: boolean;
    onmanage: (order: Order) => void;
    onlinkgroup: (orders: Order[]) => void;
    oneditgroup: (orders: Order[]) => void;
  } = $props();

  let newTabOrders = $derived(
    dataService.orders.filter(o => !['received', 'void', 'denied', 'ordered'].includes((o.status || '').toLowerCase().trim()))
  );

  let groupedCompanyOrders = $derived.by(() => {
    const groups: Record<string, Order[]> = {};
    newTabOrders.slice()
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .forEach(o => {
        const comp = o.company?.trim() || 'General Items';
        if (!groups[comp]) groups[comp] = [];
        groups[comp].push(o);
      });
    return groups;
  });
</script>

<section class="fade-in">
  <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
    <span>Pending Orders by Vendor ({newTabOrders.length})</span>
  </div>
  {#if Object.keys(groupedCompanyOrders).length === 0}
    <div class="card empty-state fade-in" style="margin-bottom: 24px;">
      <div class="icon"><Package size={48} stroke-width={1.2} /></div>
      <h3>All caught up</h3>
      <p>There are no active orders to display.</p>
    </div>
  {:else}
    {#each Object.entries(groupedCompanyOrders) as [company, compOrders]}
      <div style="margin-bottom: 32px;" class="fade-in">
        <h3 style="margin-bottom: 12px; color: var(--primary); font-size: 1.25rem;">
          {company}
          <span class="badge badge-hardware" style="margin-left: 10px; padding: 4px 10px; font-weight: 600; vertical-align: middle;">Quantity: {compOrders.length}</span>
          {#if compOrders.length > 1}
            <button class="badge badge-hardware admin-action-tag" onclick={() => onlinkgroup(compOrders)} disabled={syncing}>Merge Group</button>
          {/if}
          <button class="badge badge-hardware admin-action-tag" onclick={() => oneditgroup(compOrders)} disabled={syncing}>Change All Status</button>
        </h3>
        <OrderTable orders={compOrders} hideCategoryColumn={true} hideCompanyColumn={true} onmanage={(o: Order) => onmanage(o)} />
      </div>
    {/each}
  {/if}
</section>
