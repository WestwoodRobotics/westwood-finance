<script lang="ts">
  import { DollarSign } from '@lucide/svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import { formatCurrency, formatFullDate } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';
  import type { Fund } from '$lib/types.js';

  let { syncing, oneditfund }: { syncing: boolean; oneditfund: (fund: Fund) => void } = $props();

  const TYPE_COLORS: Record<string, string> = { Fundraiser: 'var(--primary)', Grant: '#b97cf3', Dues: '#4e9af1', Sponsor: '#6bcb77', Other: '#f1a94e' };
</script>

<section class="fade-in">
  <div class="section-title" style="margin-bottom:12px">Manage Funding & Grants ({dataService.funds.length})</div>
  <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">Edit funding sources, amounts, and recipients. These changes sync to the Fundraising sheet.</p>
  <div class="card" style="padding:0;overflow:hidden">
    {#if dataService.loading && !dataService.funds.length}
      <LoadingIndicator text="Loading funds..." />
    {:else if dataService.funds.length === 0}
      <div class="empty-state"><div class="icon"><DollarSign size={48} stroke-width={1} /></div>No funding entries found.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th><th>Source</th><th>Team</th><th>Date</th><th class="text-right">Amount</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            {#each dataService.funds as fund (fund.id)}
              <tr class="fade-in">
                <td><span class="type-tag" style="border-left: 2px solid {TYPE_COLORS[String(fund.Type)] || '#ccc'}; padding-left: 8px;">{fund.Type || '—'}</span></td>
                <td style="font-weight:500">{fund.Source || '—'}</td>
                <td>{fund.Recipient || '—'}</td>
                <td class="text-dim" style="font-size:0.875rem">{formatFullDate(String(fund.Date))}</td>
                <td class="text-right monospace" style="font-weight:600;color:#6bcb77">{formatCurrency(fund.Amount)}</td>
                <td class="text-muted" style="font-size:0.8rem">{fund.Notes || '—'}</td>
                <td><button class="btn btn-primary btn-sm" onclick={() => oneditfund(fund)}>Manage</button></td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid var(--border);">
              <td colspan={4} style="font-weight:700; text-align:right; color:var(--text-muted); text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; padding:12px 16px;">Total Funding</td>
              <td class="text-right monospace" style="color:#6bcb77; font-weight:700; font-size:1rem; padding:12px 16px;">
                {formatCurrency(dataService.funds.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0))}
              </td>
              <td colspan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</section>
