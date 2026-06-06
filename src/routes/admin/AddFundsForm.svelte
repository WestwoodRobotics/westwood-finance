<script lang="ts">
  import { Check, Info } from '@lucide/svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { api } from '$lib/api.js';

  const TYPE_COLORS: Record<string, string> = {
    Fundraiser: 'var(--primary)',
    Grant: '#b97cf3',
    Dues: '#4e9af1',
    Sponsor: '#6bcb77',
    Other: '#f1a94e',
  };
  const typeOptions = [
    { label: 'Fundraiser', value: 'Fundraiser' },
    { label: 'Grant', value: 'Grant' },
    { label: 'Dues', value: 'Dues' },
    { label: 'Sponsor', value: 'Sponsor' },
    { label: 'Other', value: 'Other' },
  ];
  const recipientOptions = [
    { label: 'Slingshot', value: 'Slingshot' },
    { label: 'Atlatl', value: 'Atlatl' },
    { label: 'Kunai', value: 'Kunai' },
    { label: 'Hunga Munga', value: 'Hunga Munga' },
    { label: 'FRC', value: 'FRC' },
    { label: 'Westwood Overall', value: 'Westwood Overall' },
  ];

  let form = $state({ type: 'Fundraiser', source: '', amount: '', date: '', notes: '', recipient: 'Westwood Overall' });
  let submitting = $state(false);
  let actionMsg = $state('');
  let actionErr = $state('');

  async function submit() {
    actionErr = '';
    actionMsg = '';
    if (!form.source.trim()) { actionErr = 'Source is required.'; return; }
    if (!form.amount || isNaN(Number(form.amount))) { actionErr = 'A valid amount is required.'; return; }
    if (!form.date) { actionErr = 'Date is required.'; return; }

    submitting = true;
    try {
      const result = await api.post({ action: 'addFundraising', type: form.type, source: form.source, amount: form.amount, date: form.date, notes: form.notes, recipient: form.recipient });
      if (result?.error) throw new Error(result.error || 'Request failed');

      actionMsg = 'Funding entry added!';
      dataService.addFundOptimistic({ Type: form.type, Source: form.source, Amount: Number(form.amount) || 0, Date: form.date, Notes: form.notes, Recipient: form.recipient });
      form = { type: 'Fundraiser', source: '', amount: '', date: '', notes: '', recipient: 'Westwood Overall' };
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Update failed';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="add-layout fade-in">
  <div class="card add-card">
    <h3 style="margin-bottom:20px; color: var(--primary);">Add Funding Entry</h3>

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
        <div class="form-group">
          <label>History Type *</label>
          <CustomDropdown options={typeOptions} bind:value={form.type} />
        </div>
        <div class="form-group">
          <label>Destination Team *</label>
          <CustomDropdown options={recipientOptions} bind:value={form.recipient} />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label for="f-source">Source / Description *</label>
          <input id="f-source" type="text" bind:value={form.source} placeholder="ex. Member Dues" required />
        </div>
        <div class="form-group">
          <label for="f-amount">Amount ($) *</label>
          <input id="f-amount" type="number" bind:value={form.amount} min="0" step="0.01" placeholder="0.00" required />
        </div>
        <div class="form-group">
          <label for="f-date">Date</label>
          <input id="f-date" type="date" bind:value={form.date} />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label for="f-notes">Notes</label>
          <textarea id="f-notes" bind:value={form.notes} rows={3} placeholder="Any additional context…"></textarea>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:24px; width: 100%; justify-content: center;" disabled={submitting}>
        {submitting ? 'Saving…' : '+ Add Entry'}
      </button>
    </form>
  </div>

  <aside class="tips-card card hide-mobile" style="padding: 24px;">
    <div class="card-title" style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Entry Tips</div>
    <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;">
      <li style="color: var(--text-dim); line-height: 1.4;">Use <strong>All</strong> for income distributed equally.</li>
      <li style="color: var(--text-dim); line-height: 1.4;"><strong>Grants</strong> and <strong>Sponsors</strong> go to specific teams.</li>
      <li style="color: var(--text-dim); line-height: 1.4;">Date is optional but recommended.</li>
    </ul>
    <div style="margin-top:24px">
      <div class="card-title" style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Fund Types</div>
      <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px">
        {#each typeOptions as t}
          <span class="type-tag" style="font-size: 0.75rem; padding: 4px 8px; background: var(--surface-2); border-left: 3px solid {TYPE_COLORS[t.value] || '#8a8a8a'};">{t.label}</span>
        {/each}
      </div>
    </div>
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
    .add-card { padding: 16px; border-radius: 0; border-left: none; border-right: none; }
  }
</style>
