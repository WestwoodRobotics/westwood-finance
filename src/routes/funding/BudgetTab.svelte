<script lang="ts">
  import { BarChart3 } from '@lucide/svelte';
  import PieChart from '$lib/components/PieChart.svelte';
  import OrderTable from '$lib/components/OrderTable.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { formatCurrency, CATEGORIES } from '$lib/utils.js';
  import { createTeamView } from '$lib/derived.svelte.js';

  const CATEGORY_LABELS: Record<string, string> = {
    hardware: 'Hardware', software: 'Software', outreach: 'Outreach', food: 'Food', miscellaneous: 'Misc',
  };

  let { selectedBudgetTeam }: { selectedBudgetTeam: string } = $props();

  const view = createTeamView(() => selectedBudgetTeam);

  let pendingExpenses = $derived(
    view.teamOrders
      .filter(o => { const s = (o.status || '').toLowerCase().trim(); return s === 'pending review' || s === 'approved'; })
      .reduce((sum, o) => sum + (o.total || 0), 0)
  );

  let budgetTeams = $derived(
    dataService.budget
      ? Object.entries(dataService.budget)
          .filter(([key]) => key !== 'Total')
          .sort(([a], [b]) => a === 'FRC' ? -1 : b === 'FRC' ? 1 : a.localeCompare(b))
      : []
  );

  let budgetTotal = $derived(dataService.budget?.['Total'] || null);

  let allFundsRaised = $derived(dataService.funds.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0));

  let spentByCategory = $derived.by(() => {
    const map: Record<string, number> = {};
    CATEGORIES.forEach(c => (map[c] = 0));
    view.financialOrders.forEach(e => {
      const cat = (e.category || 'miscellaneous').toLowerCase().trim();
      map[cat] = (map[cat] || 0) + (e.total || 0);
    });
    return map;
  });
</script>

{#if dataService.loading && !dataService.budget}
  <LoadingIndicator text="Loading budgets..." />
{:else if !dataService.budget}
  <div class="empty-state card">
    <div class="icon"><BarChart3 size={48} stroke-width={1.2} /></div>
    No budget data available.
  </div>
{:else if selectedBudgetTeam === 'Westwood Overall'}
  <div class="overall-summary fade-in">
    <div class="card" style="padding: 0; overflow-x: auto; overflow-y: visible;">
      <table class="overall-table">
        <thead>
          <tr>
            <th>Team</th>
            <th class="text-right">Budget</th>
            <th class="text-right">Raised</th>
            <th class="text-right">Expenses</th>
            <th class="text-right">Balance</th>
            <th style="width: 120px; padding-left: 0;"></th>
          </tr>
        </thead>
        <tbody>
          {#each budgetTeams as [team, data]}
            {@const teamFundsRaised = dataService.funds.reduce((sum, f) => {
              const r = String(f.Recipient || '').toLowerCase().trim();
              const s = team.toLowerCase().trim();
              return (r === s || r.includes(s) || r === 'all' || r === 'westwood overall') ? sum + (Number(f.Amount) || 0) : sum;
            }, 0)}
            {@const clubFunds = (data as Record<string, number>)['Club Funds'] ?? 0}
            {@const personalFunds = (data as Record<string, number>)['Personal Funds'] ?? 0}
            {@const teamRealExpenses = dataService.orders.filter(o => {
              const t = (o.team || '').toLowerCase().trim();
              const s = team.toLowerCase().trim();
              const teamMatches = t === s || t.includes(s) || (s === 'frc' && (t.includes('frc') || /^\d+$/.test(t)));
              if (!teamMatches) return false;
              const st = (o.status || '').toLowerCase().trim();
              return st === 'received' || st === 'ordered';
            }).reduce((sum, o) => sum + (o.total || 0), 0)}
            {@const final = clubFunds + personalFunds + teamFundsRaised - teamRealExpenses}
            {@const pct = budgetTotal && ((budgetTotal as Record<string, number>)['Club Funds'] + allFundsRaised) > 0
              ? Math.min(100, (Math.max(0, final) / ((budgetTotal as Record<string, number>)['Club Funds'] + allFundsRaised)) * 100)
              : 0}
            <tr class="overall-row">
              <td><span class="overall-team-name">{team}</span></td>
              <td class="text-right monospace">{formatCurrency(clubFunds)}</td>
              <td class="text-right monospace amount-positive">+{formatCurrency(teamFundsRaised)}</td>
              <td class="text-right monospace amount-negative">{formatCurrency(Math.abs(teamRealExpenses))}</td>
              <td class="text-right monospace overall-balance" style="color:{final >= 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">{formatCurrency(final)}</td>
              <td style="padding-left: 8px; padding-right: 20px;">
                <div class="overall-bar-track"><div class="overall-bar-fill" style="width:{pct}%"></div></div>
              </td>
            </tr>
          {/each}
        </tbody>
        {#if budgetTotal}
          {@const totalClub = (budgetTotal as Record<string, number>)['Club Funds'] || 0}
          {@const totalPersonal = (budgetTotal as Record<string, number>)['Personal Funds'] || 0}
          {@const totalRealExpenses = dataService.orders.filter(o => { const st = (o.status || '').toLowerCase().trim(); return st === 'received' || st === 'ordered'; }).reduce((sum, o) => sum + (o.total || 0), 0)}
          {@const totalFinal = totalClub + totalPersonal + allFundsRaised - totalRealExpenses}
          <tfoot>
            <tr class="total-row">
              <td class="total-label" style="text-align:left; padding-left:20px;">Westwood Total</td>
              <td class="text-right monospace total-amount" style="font-size:0.9rem">{formatCurrency(totalClub)}</td>
              <td class="text-right monospace total-amount amount-positive" style="font-size:0.9rem">+{formatCurrency(allFundsRaised)}</td>
              <td class="text-right monospace total-amount amount-negative" style="font-size:0.9rem">{formatCurrency(Math.abs(totalRealExpenses))}</td>
              <td class="text-right monospace total-amount" style="color:{totalFinal >= 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">{formatCurrency(totalFinal)}</td>
              <td></td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>
  </div>
{:else}
  {@const teamEntry = budgetTeams.find(([t]) => t === selectedBudgetTeam)}
  {#if teamEntry}
    {@const [team, data] = teamEntry}
    {@const teamFundsRaised = dataService.funds.reduce((sum, f) => {
      const r = String(f.Recipient || '').toLowerCase().trim();
      const s = team.toLowerCase().trim();
      return (r === s || r.includes(s) || r === 'all' || r === 'westwood overall') ? sum + (Number(f.Amount) || 0) : sum;
    }, 0)}
    {@const clubFunds = (data as Record<string, number>)['Club Funds'] ?? 0}
    {@const personal = (data as Record<string, number>)['Personal Funds'] ?? 0}
    {@const teamBudgetOnly = teamFundsRaised + personal}
    {@const final = clubFunds + personal + teamFundsRaised - view.totalSpent}
    {@const usagePct = teamBudgetOnly > 0 ? (view.totalSpent / teamBudgetOnly) * 100 : 0}
    {@const pctColor = usagePct > 90 ? 'var(--status-rejected)' : (usagePct > 60 ? '#f97316' : 'var(--status-awarded)')}
    {@const pctBg = usagePct > 90 ? 'rgba(239,68,68,0.1)' : (usagePct > 60 ? 'rgba(249,115,22,0.1)' : 'rgba(16,185,129,0.1)')}

    <div class="budget-overview-container is-single fade-in">
      <div class="budget-single-view">
        <div class="budget-card card selected" style="position:relative;">
          <div class="budget-team-name">{team}</div>
          <div class="budget-final" style="color:{final >= 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">
            {formatCurrency(final)} <span class="budget-final-denom">/ {formatCurrency(teamFundsRaised + personal)}</span>
          </div>
          <div class="budget-balance-note">committed balance · excl. pending</div>
          {#if usagePct > 0}
            <div class="budget-usage-badge">
              <div class="budget-usage-badge-inner" style="color:{pctColor}; background:{pctBg}">{usagePct.toFixed(1)}% Used</div>
            </div>
          {/if}
          <div class="budget-details">
            <div class="budget-detail-row"><span class="text-muted">Raised</span><span class="monospace amount-positive">+{formatCurrency(teamFundsRaised)}</span></div>
            <div class="budget-detail-row"><span class="text-muted">Personal</span><span class="monospace" style="color:#4e9af1">{formatCurrency(personal)}</span></div>
            <div class="budget-detail-row"><span class="text-muted">Expenses</span><span class="monospace amount-negative">{formatCurrency(Math.abs(view.totalSpent))}</span></div>
            <div class="budget-detail-row"><span class="text-muted">Pending Expenses</span><span class="monospace text-muted">{formatCurrency(pendingExpenses)}</span></div>
          </div>
          <div class="budget-bar-track"><div class="budget-bar-fill"></div></div>
        </div>
      </div>
      <div class="breakdown-card fade-in">
        <PieChart data={spentByCategory} hideLegend={true} />
      </div>
    </div>
  {/if}

  <div class="team-dashboard-content fade-in">
    <div class="section-title">{selectedBudgetTeam} Orders</div>
    <OrderTable orders={view.teamOrders} hideTeamColumn={true} />
  </div>
{/if}

<style>
  .amount-positive { color: var(--status-awarded); }
  .amount-negative { color: var(--status-rejected); }

  .team-dashboard-content { margin-top: 40px; }

  .section-title {
    margin-bottom: 20px;
    font-size: 1.1rem;
    color: var(--text-muted);
  }

  .overall-summary { width: 100%; margin-bottom: 8px; }
  .overall-table { font-size: 0.875rem; }
  .overall-row td { padding: 14px 16px; vertical-align: middle; }
  .overall-team-name { font-weight: 700; color: var(--primary); font-size: 0.9rem; }
  .overall-balance { font-weight: 700; font-size: 0.95rem; }
  .overall-bar-track { height: 5px; background: var(--surface-2); border-radius: 99px; overflow: hidden; min-width: 60px; }
  .overall-bar-fill { height: 100%; background: var(--primary); border-radius: 99px; transition: width 0.5s ease; }

  .budget-overview-container.is-single {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 32px;
    max-width: 1100px;
    margin: 0 auto;
  }

  .budget-single-view {
    display: flex;
    justify-content: center;
    width: auto;
    min-width: 0;
  }

  .budget-card {
    padding: 26px 30px;
    width: 450px;
    max-width: none;
    height: auto;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--border-bright);
    box-shadow: var(--shadow-md);
  }

  .budget-team-name { font-size: 1.3rem; font-weight: 700; color: var(--primary); margin-bottom: 4px; }
  .budget-final { font-size: 2rem; font-weight: 700; margin-bottom: 4px; }
  .budget-balance-note { font-size: 0.7rem; color: var(--text-dim); letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 12px; opacity: 0.6; }
  .budget-final-denom { font-size: 1.1rem; color: var(--text-muted); font-weight: 500; }
  .budget-usage-badge { position: absolute; top: 22px; right: 22px; }
  .budget-usage-badge-inner { font-size: 0.85rem; font-weight: 700; padding: 4px 10px; border-radius: 6px; }
  .budget-details { display: flex; flex-direction: column; gap: 11px; margin-top: 18px; }
  .budget-detail-row { display: flex; justify-content: space-between; font-size: 0.95rem; }
  .budget-bar-track { margin-top: 22px; height: 8px; background: var(--surface-2); border-radius: 99px; overflow: hidden; }
  .budget-bar-fill { height: 100%; background: var(--primary); width: 100%; transition: width 0.6s ease; }

  .breakdown-card {
    flex: none;
    height: auto;
    min-height: 240px;
    width: 295px;
    flex-shrink: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    position: relative;
  }

  @media (max-width: 950px) {
    .budget-overview-container.is-single { flex-direction: column; gap: 32px; align-items: stretch; }
    .budget-card { width: 100% !important; max-width: none !important; }
    .breakdown-card { width: 100% !important; height: 225px !important; }
  }

  @media (max-width: 768px) {
    .budget-overview-container.is-single { gap: 20px; }
    .budget-card { min-height: unset !important; }
    .breakdown-card { height: 190px !important; }
  }
</style>
