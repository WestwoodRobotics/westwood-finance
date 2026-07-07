<script lang="ts">
  import { Receipt } from '@lucide/svelte';
  import { formatCurrency, formatDate } from '$lib/utils.js';
  import { createTeamView } from '$lib/derived.svelte.js';

  const TYPE_COLORS: Record<string, string> = {
    Fundraiser: 'var(--primary)', Grant: 'var(--color-grant)', Dues: 'var(--color-dues)', Sponsor: 'var(--color-sponsor)', Other: 'var(--color-fund-other)',
  };

  let { selectedBudgetTeam }: { selectedBudgetTeam: string } = $props();

  const view = createTeamView(() => selectedBudgetTeam);

  let sortCol = $state('Date');
  let sortDir = $state('desc');

  let sorted = $derived(
    view.teamFunds.slice().sort((a, b) => {
      let valA: string | number = (a as Record<string, unknown>)[sortCol] as string | number || '';
      let valB: string | number = (b as Record<string, unknown>)[sortCol] as string | number || '';
      if (sortCol === 'Amount') { valA = Number(valA) || 0; valB = Number(valB) || 0; }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    })
  );

  function toggleSort(col: string) {
    if (sortCol === col) { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; }
    else { sortCol = col; sortDir = col === 'Date' || col === 'Amount' ? 'desc' : 'asc'; }
  }
</script>

<div class="team-dashboard-content fade-in">
  <div class="section-title">{selectedBudgetTeam} History</div>
  <div class="card" style="padding:0; overflow:hidden">
    {#if sorted.length === 0}
      <div class="empty-state">
        <div class="icon"><Receipt size={48} stroke-width={1} /></div>
        <h3>No funding entries</h3>
        <p>No funding has been recorded for this team yet.</p>
      </div>
    {:else}
      <table style="font-size: 0.85rem;">
        <thead>
          <tr>
            <th class="sortable" onclick={() => toggleSort('Source')}>Source {sortCol === 'Source' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th class="sortable" onclick={() => toggleSort('Type')}>Type {sortCol === 'Type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th class="sortable" onclick={() => toggleSort('Date')}>Date {sortCol === 'Date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
            <th class="sortable text-right" onclick={() => toggleSort('Amount')}>Amount {sortCol === 'Amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
          </tr>
        </thead>
        <tbody>
          {#each sorted as f}
            <tr>
              <td style="font-weight:500">{f.Source || '—'}</td>
              <td>
                <span style="font-weight: 500; border-left: 3px solid {TYPE_COLORS[String(f.Type)] || 'var(--text-dim)'}; padding-left: 8px;">{f.Type}</span>
              </td>
              <td class="text-dim monospace">{f.Date ? formatDate(f.Date).split(' ')[0] : '—'}</td>
              <td class="text-right monospace amount-positive">{formatCurrency(f.Amount)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot class="total-row">
          <tr>
            <td colspan={3} class="total-label">Total Raised</td>
            <td class="text-right monospace total-amount">
              {formatCurrency(sorted.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    {/if}
  </div>
</div>

<style>
  .team-dashboard-content { margin-top: 0; }
  .section-title { margin-bottom: 20px; font-size: 1.1rem; color: var(--text-muted); }
  .amount-positive { color: var(--status-awarded); }
  .sortable { cursor: pointer; user-select: none; }
  .sortable:hover { background: var(--surface-2); }
</style>
