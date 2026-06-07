<script lang="ts">
  import { X, TriangleAlert } from '@lucide/svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { api } from '$lib/api.js';
  import { formatCurrency, truncate, generateShortId } from '$lib/utils.js';
  import type { Order } from '$lib/types.js';

  const ORDER_STATUSES = ['Pending Review', 'Approved', 'Ordered', 'Received', 'Denied', 'Cancelled', 'Void'];

  let { order, onclose, onsaved }: {
    order: Order;
    onclose: () => void;
    onsaved: (msg: string, undofn: (() => Promise<void>) | null) => void;
  } = $props();

  let editStatus = $state(order.status || 'Pending Review');
  let editTracking = $state(order.tracking || '');
  let editUUID = $state(order.orderUUID || '');
  let editSaving = $state(false);
  let showDeleteConfirm = $state(false);
  let deleteSaving = $state(false);
  let actionErr = $state('');

  let groupingOptions = $derived.by(() => {
    const others = dataService.orders.filter(o => o.company === order.company && o.id !== order.id);
    if (others.length === 0) return [];
    const isGrouped = others.some(o => o.orderUUID && o.orderUUID === editUUID);
    const seenUUIDs = new Set<string>();
    const unique = others.filter(o => {
      if (!o.orderUUID || seenUUIDs.has(o.orderUUID)) return false;
      seenUUIDs.add(o.orderUUID);
      return true;
    });
    return [
      { label: 'Make separate order', value: isGrouped ? '__NEW__' : editUUID },
      ...unique.map(t => ({
        label: (t.orderUUID === editUUID ? 'Keep grouped with: ' : 'Group with: ') + truncate(t.item, 40) + ' (' + (t.team || 'Unknown Team') + ')',
        value: String(t.orderUUID),
      })),
    ];
  });

  async function saveEdit() {
    const prevStatus = order.status;
    const prevTracking = order.tracking;
    const prevUUID = order.orderUUID;
    const editId = order.id;
    const editRowIndex = order.rowIndex;
    editSaving = true;
    actionErr = '';
    try {
      const result = await api.post({ action: 'updateOrderStatus', id: order.id, rowIndex: order.rowIndex.toString(), status: editStatus, tracking: editTracking, orderUUID: editUUID });
      if (result?.error) throw new Error(result.error || 'Update failed');

      dataService.updateOrderOptimistic(order.id, { status: editStatus, tracking: editTracking, orderUUID: editUUID });
      const undofn = async () => {
        dataService.updateOrderOptimistic(editId, { status: prevStatus, tracking: prevTracking, orderUUID: prevUUID });
        await api.post({ action: 'updateOrderStatus', id: editId, rowIndex: String(editRowIndex), status: prevStatus || '', tracking: prevTracking || '', orderUUID: prevUUID || '' });
        dataService.load(true, true);
      };
      dataService.load(true, true);
      onsaved(`"${order.item}" updated!`, undofn);
      onclose();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Update failed';
    } finally {
      editSaving = false;
    }
  }

  async function deleteOrder() {
    deleteSaving = true;
    actionErr = '';
    try {
      const result = await api.post({ action: 'deleteOrder', uuid: order.orderUUID });
      if (result?.error) throw new Error(result.error || 'Delete failed');
      dataService.deleteOrderOptimistic(order.id);
      dataService.load(true, true);
      onsaved('Order deleted permanently.', null);
      onclose();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Delete failed';
    } finally {
      deleteSaving = false;
      showDeleteConfirm = false;
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" onclick={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} role="button" tabindex="0">
  <div class="modal-card card" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" tabindex="-1">
    <div class="modal-header">
      <div>
        <h2 style="margin:0">Edit Order</h2>
        <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">{order.item}</p>
      </div>
      <button class="modal-close" onclick={onclose} aria-label="Close"><X size={20} /></button>
    </div>

    {#if actionErr}
      <div class="error-bar" style="margin-bottom:16px">{actionErr}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
      <div class="modal-fields">
        <div class="form-group">
          <label>Status</label>
          <CustomDropdown options={ORDER_STATUSES} bind:value={editStatus} />
        </div>
        <div class="form-group">
          <label for="edit-uuid">Order UUID</label>
          <input id="edit-uuid" type="text" bind:value={editUUID} placeholder="ex. RFV2RF" />
        </div>
        {#if groupingOptions.length > 0}
          <div class="form-group" style="grid-column: 1 / -1; margin-top: 4px;">
            <div style="font-size: 0.85rem; padding: 10px 14px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
              <span class="text-dim" style="font-weight: 500; white-space: nowrap;">Order grouping</span>
              <div style="flex-grow: 1; max-width: 70%;">
                <CustomDropdown
                  options={groupingOptions}
                  bind:value={editUUID}
                  onchange={(e: { target: { value: string } }) => { if (e.target.value === '__NEW__') editUUID = generateShortId(); }}
                />
              </div>
            </div>
          </div>
        {/if}
        <div class="form-group" style="grid-column: 1 / -1">
          <label for="edit-tracking">Tracking Link</label>
          <input id="edit-tracking" type="text" bind:value={editTracking} placeholder="Please provide a LINK" />
        </div>
      </div>

      <div class="order-summary">
        <div class="summary-row"><span>Company</span><span>{order.company || '—'}</span></div>
        <div class="summary-row"><span>Team</span><span>{order.team || '—'}</span></div>
        <div class="summary-row"><span>Category</span><span>{order.category || '—'}</span></div>
        <div class="summary-row"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
      </div>

      <div class="modal-actions" style="justify-content: space-between;">
        <button type="button" class="btn btn-ghost" style="color: var(--status-rejected);" onclick={() => showDeleteConfirm = true} disabled={editSaving}>Delete Order</button>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-ghost" onclick={onclose} disabled={editSaving}>Cancel</button>
          <button type="submit" class="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </form>
  </div>
</div>

{#if showDeleteConfirm}
  <div class="modal-backdrop fade-in" style="z-index: 1100;">
    <div class="card modal-card" style="max-width: 360px; padding: 32px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2);">
      <div class="icon" style="margin-bottom: 20px;"><TriangleAlert size={48} style="color: var(--status-rejected);" /></div>
      <h3 style="margin-bottom: 12px;">Delete Order?</h3>
      <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 24px; line-height: 1.5;">
        Permanently delete <strong>{order.item}</strong>? This cannot be undone.
      </p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button class="btn" style="background: #ef4444; color: white; border: none;" onclick={deleteOrder} disabled={deleteSaving}>
          {#if deleteSaving}<span>Deleting<span class="dot-loading"></span></span>{:else}Yes, Delete Permanently{/if}
        </button>
        <button class="btn btn-ghost" onclick={() => showDeleteConfirm = false} disabled={deleteSaving}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .order-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin-bottom: 24px;
  }
  .summary-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.85rem;
  }
</style>
