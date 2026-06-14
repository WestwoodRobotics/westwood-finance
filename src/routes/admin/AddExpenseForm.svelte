<script lang="ts">
  import { Check, Info } from '@lucide/svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { api } from '$lib/api.js';
  import { formatDate } from '$lib/utils.js';

  const ORDER_STATUSES = ['Pending Review', 'Approved', 'Ordered', 'Received', 'Denied', 'Cancelled', 'Void'];
  const recipientOptions = [
    { label: 'Slingshot', value: 'Slingshot' },
    { label: 'Atlatl', value: 'Atlatl' },
    { label: 'Kunai', value: 'Kunai' },
    { label: 'Hunga Munga', value: 'Hunga Munga' },
    { label: 'FRC', value: 'FRC' },
    { label: 'Westwood Overall', value: 'Westwood Overall' },
  ];

  const presetVendors = [
    { label: 'Select Vendor...', value: '' },
    { label: 'GoBilda', value: 'GoBilda' },
    { label: 'REV', value: 'REV' },
    { label: 'Andymark', value: 'Andymark' },
    { label: 'Axon', value: 'Axon' },
    { label: 'Polymaker', value: 'Polymaker' },
    { label: 'Other', value: 'Other' },
  ];
  let vendorSelect = $state('');
  let form = $state({ item: '', company: '', link: '', price: '', quantity: '1', notes: '', team: 'FRC', category: 'hardware', status: 'Received' });
  let submitting = $state(false);
  let actionMsg = $state('');
  let actionErr = $state('');

  $effect(() => {
    if (vendorSelect && vendorSelect !== 'Other') {
      form.company = vendorSelect;
    } else if (vendorSelect === 'Other' && presetVendors.some(v => v.value === form.company)) {
      form.company = '';
    }
  });

  async function submit() {
    actionErr = '';
    actionMsg = '';
    if (!form.item.trim()) { actionErr = 'Item name is required.'; return; }
    if (!form.company.trim()) { actionErr = 'Vendor / Company is required.'; return; }
    if (!form.price || isNaN(Number(form.price))) { actionErr = 'Valid price is required.'; return; }
    if (!form.notes.trim()) { actionErr = 'Team Notes (Reason for order) is required.'; return; }

    submitting = true;
    try {
      let finalLink = form.link.trim();
      if (finalLink && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

      const result = await api.post({ action: 'addOrder', item: form.item, company: form.company, link: finalLink, price: String(form.price), quantity: String(form.quantity), notes: form.notes, category: form.category, team: form.team, status: form.status, timestamp: formatDate(new Date()) });
      if (result?.error) throw new Error(result.error || 'Request failed');

      actionMsg = 'Order recorded successfully!';
      dataService.addOrderOptimistic({ item: form.item, company: form.company, link: finalLink, price: Number(form.price) || 0, quantity: Number(form.quantity) || 1, notes: form.notes, category: form.category, team: form.team, status: form.status, timestamp: new Date().toISOString() });
      form = { item: '', company: '', link: '', price: '', quantity: '1', notes: '', team: 'FRC', category: 'hardware', status: 'Received' };
      vendorSelect = '';
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Request failed';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="add-layout fade-in">
  <div class="card add-card">
    <h3 style="margin-bottom:20px; color: var(--primary);">Record Manual Expense</h3>

    {#if actionMsg}
      <div class="message-bar success-bar" style="margin-bottom: 20px;">
        <Check size={16} />{actionMsg}
      </div>
    {/if}
    {#if actionErr}
      <div class="message-bar error-bar" style="margin-bottom: 20px;">
        <Info size={16} />{actionErr}
      </div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
      <div class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1">
          <label for="ae-item">Item Name *</label>
          <input id="ae-item" type="text" bind:value={form.item} placeholder="ex. Pit Banner" required />
        </div>
        <div class="form-group">
          <label for="ae-company">Vendor / Company *</label>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <CustomDropdown options={presetVendors} bind:value={vendorSelect} placeholder="Quick pick…" />
            {#if vendorSelect === 'Other'}
              <input id="ae-company" type="text" bind:value={form.company} placeholder="type custom vendor name" required />
            {/if}
          </div>
        </div>
        <div class="form-group">
          <label for="ae-team">Team *</label>
          <CustomDropdown id="ae-team" options={recipientOptions} bind:value={form.team} />
        </div>
        <div class="form-group">
          <label for="ae-price">Unit Price ($) *</label>
          <input id="ae-price" type="number" step="0.01" bind:value={form.price} placeholder="0.00" required />
        </div>
        <div class="form-group">
          <label for="ae-qty">Quantity *</label>
          <input id="ae-qty" type="number" bind:value={form.quantity} min="1" required />
        </div>
        <div class="form-group">
          <label for="ae-category">Category *</label>
          <CustomDropdown id="ae-category"
            options={[{ label: 'Hardware', value: 'hardware' }, { label: 'Software', value: 'software' }, { label: 'Outreach', value: 'outreach' }, { label: 'Miscellaneous', value: 'miscellaneous' }]}
            bind:value={form.category}
          />
        </div>
        <div class="form-group">
          <label for="ae-status">Initial Status</label>
          <CustomDropdown id="ae-status" options={ORDER_STATUSES.map(s => ({ label: s, value: s }))} bind:value={form.status} />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label for="ae-link">Link</label>
          <input id="ae-link" type="text" bind:value={form.link} placeholder="https://..." />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label for="ae-notes">Team Notes *</label>
          <textarea id="ae-notes" rows={3} bind:value={form.notes} placeholder="Reason for ordering this item..." required></textarea>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:24px; width: 100%; justify-content: center;" disabled={submitting}>
        {submitting ? 'Recording...' : 'Confirm Expense Entry'}
      </button>
    </form>
  </div>

  <aside class="tips-card card hide-mobile" style="padding: 24px;">
    <div class="card-title">Expense Control</div>
    <p class="text-muted" style="font-size: 0.85rem; line-height: 1.5;">
      This form bypasses the standard request flow and records an expense immediately with its final status.
    </p>
    <ul style="margin: 16px 0 0 16px; padding: 0; font-size: 0.8rem; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px;">
      <li>Use Received for items already bought and in-hand.</li>
      <li>Use Ordered for items paid for but still in transit.</li>
      <li>Setting status to Approved puts it in the pending orders list.</li>
    </ul>
  </aside>
</div>

<style>
  .add-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
    align-items: start;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  @media (max-width: 768px) {
    .add-layout { grid-template-columns: 1fr; gap: 16px; }
    .form-grid { grid-template-columns: 1fr; gap: 16px; }
    .add-card { padding: 16px; }
  }
</style>
