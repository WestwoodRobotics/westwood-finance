<script lang="ts">
  import { X } from '@lucide/svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { api } from '$lib/api.js';
  import type { Order, OrderStatus } from '$lib/types.js';

  const ORDER_STATUSES = ['Pending Review', 'Approved', 'Ordered', 'Received', 'Denied', 'Cancelled', 'Void'];

  let { orders, onclose, onsaved }: {
    orders: Order[];
    onclose: () => void;
    onsaved: (msg: string, undofn: () => Promise<void>) => void;
  } = $props();

  let groupStatus: OrderStatus = $state('Ordered');
  let saving = $state(false);
  let actionErr = $state('');

  async function save() {
    const prevStates = orders.map(o => ({ id: o.id, rowIndex: o.rowIndex, status: o.status, orderUUID: o.orderUUID }));
    saving = true;
    actionErr = '';
    try {
      const results = await Promise.all(orders.map(o =>
        api.post({ action: 'updateOrderStatus', id: o.id, rowIndex: String(o.rowIndex), orderUUID: o.orderUUID || '', status: groupStatus })
      ));
      if (results.some((r: { error?: string }) => r.error)) throw new Error('Batch status update failed');

      orders.forEach(o => dataService.updateOrderOptimistic(o.id, { status: groupStatus }));
      const undofn = async () => {
        prevStates.forEach(prev => dataService.updateOrderOptimistic(prev.id, { status: prev.status }));
        await Promise.all(prevStates.map(prev =>
          api.post({ action: 'updateOrderStatus', id: prev.id, rowIndex: String(prev.rowIndex), orderUUID: prev.orderUUID || '', status: prev.status || '' })
        ));
        dataService.load(true, true);
      };
      dataService.load(true, true);
      onsaved(`Status updated to ${groupStatus}`, undofn);
      onclose();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Error updating group status';
    } finally {
      saving = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="button" tabindex="0">
  <div class="modal-card card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-header">
      <div>
        <h2 style="margin:0">Change Group Status</h2>
        <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">Update {orders.length} orders</p>
      </div>
      <button class="modal-close" onclick={onclose} aria-label="Close"><X size={20} /></button>
    </div>

    {#if actionErr}<div class="error-bar">{actionErr}</div>{/if}

    <form onsubmit={(e) => { e.preventDefault(); save(); }}>
      <div class="modal-fields" style="grid-template-columns: 1fr;">
        <div class="form-group">
          <label for="group-status">New Status</label>
          <CustomDropdown id="group-status" options={ORDER_STATUSES.map(s => ({ label: s, value: s }))} bind:value={groupStatus} />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
        <button type="submit" class="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Status'}</button>
      </div>
    </form>
  </div>
</div>
