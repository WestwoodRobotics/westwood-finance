<script lang="ts">
  import { formatCurrency } from '$lib/utils.js';
  import { createTeamView } from '$lib/derived.svelte.js';

  const TYPE_COLORS: Record<string, string> = {
    Fundraiser: 'var(--primary)', Grant: '#b97cf3', Dues: '#4e9af1', Sponsor: '#6bcb77', Other: '#f1a94e',
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
      <div class="empty-state" style="padding: 40px;">No funding entries for this team.</div>
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
                <span style="font-size: 1.05rem; font-weight: 500; border-left: 2px solid {TYPE_COLORS[String(f.Type)] || '#ccc'}; padding-left: 8px;">{f.Type}</span>
              </td>
              <td class="text-dim monospace">{f.Date || '—'}</td>
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
