<script lang="ts">
  import { X } from '@lucide/svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { api } from '$lib/api.js';
  import { formatDate } from '$lib/utils.js';
  import type { Fund } from '$lib/types.js';

  let { fund, onclose, onsaved }: {
    fund: Fund;
    onclose: () => void;
    onsaved: (msg: string) => void;
  } = $props();

  let fields = $state({
    Source: String(fund.Source || ''),
    Amount: Number(fund.Amount) || 0,
    Recipient: String(fund.Recipient || ''),
    Notes: String(fund.Notes || ''),
    Type: String(fund.Type || 'Part Order'),
    Date: String(fund.Date || new Date().toISOString().split('T')[0]),
  });
  let saving = $state(false);
  let actionErr = $state('');

  async function save() {
    saving = true;
    actionErr = '';
    try {
      const result = await api.post({
        action: 'updateFunding',
        rowIndex: String(fund.rowIndex),
        Source: String(fields.Source),
        Amount: String(fields.Amount),
        Recipient: String(fields.Recipient),
        Notes: String(fields.Notes),
        Type: String(fields.Type),
        Date: formatDate(fields.Date),
      });
      if (result?.error) throw new Error(result.error || 'Update failed');

      dataService.funds = dataService.funds.map(f => f.id === fund.id ? { ...f, ...fields } : f);
      dataService.persist();
      dataService.load(true, true);
      onsaved('Funding entry updated!');
      onclose();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Update failed';
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
        <h2 style="margin:0">Edit Funding Entry</h2>
        <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">{fund.Source}</p>
      </div>
      <button class="modal-close" onclick={onclose} aria-label="Close"><X size={20} /></button>
    </div>

    {#if actionErr}<div class="error-bar">{actionErr}</div>{/if}

    <form onsubmit={(e) => { e.preventDefault(); save(); }}>
      <div class="modal-fields">
        <div class="form-group">
          <label for="fund-source">Source</label>
          <input id="fund-source" bind:value={fields.Source} />
        </div>
        <div class="form-group">
          <label for="fund-amount">Amount</label>
          <input id="fund-amount" type="number" step="0.01" bind:value={fields.Amount} />
        </div>
        <div class="form-group">
          <label for="fund-recipient">Recipient / Team</label>
          <input id="fund-recipient" bind:value={fields.Recipient} />
        </div>
        <div class="form-group">
          <label for="fund-date">Date</label>
          <input id="fund-date" type="date" bind:value={fields.Date} />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label for="fund-notes">Notes</label>
          <textarea id="fund-notes" bind:value={fields.Notes}></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
        <button type="button" class="btn btn-ghost" onclick={onclose}>Cancel</button>
      </div>
    </form>
  </div>
</div>
