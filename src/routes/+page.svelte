<script lang="ts">
  import { DollarSign, TrendingUp, ShoppingCart, BarChart3 } from '@lucide/svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import ExpenseTable from '$lib/components/ExpenseTable.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import RecentOrdersList from '$lib/components/RecentOrdersList.svelte';
  import OrderDetailSheet from '$lib/components/OrderDetailSheet.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { formatCurrency, TEAMS } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';
  import { authStore } from '$lib/authStore.svelte.js';
  import { perms } from '$lib/perms.js';
  import { createTeamView } from '$lib/derived.svelte.js';
  import appInfo from '$lib/app-info.json';
  import type { Order } from '$lib/types.js';

  const TEAM_OPTIONS = perms.viewAllTeams ? TEAMS : [authStore.userTeam];
  let selectedTeam = $state(perms.viewAllTeams ? 'Westwood Overall' : authStore.userTeam);

  const view = createTeamView(() => selectedTeam);

  const currentYear = new Date().getFullYear().toString();

  let yearFinancialOrders = $derived(
    view.financialOrders.filter(o => (o.timestamp || '').includes(currentYear))
  );
  let yearFunds = $derived(
    view.teamFunds.filter(f => String(f.Date || '').includes(currentYear))
  );
  let yearRaised = $derived(yearFunds.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0));
  let yearSpent = $derived(yearFinancialOrders.reduce((sum, o) => sum + (o.total || 0), 0));
  let yearNetBalance = $derived(yearRaised - yearSpent);

  let recentExpenses = $derived(view.financialOrders.slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 5));
  let recentOrders = $derived(view.teamOrders.slice().sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 5));

  let budgetTotalValue = $derived.by(() => {
    const budgetKey = selectedTeam === 'Westwood Overall' ? 'Total' : selectedTeam;
    const teamBudget = (dataService.budget?.[budgetKey] as Record<string, number> | undefined);
    const totalClub = teamBudget?.['Club Funds'] || 0;
    const totalPersonal = teamBudget?.['Personal Funds'] || 0;
    return totalClub + totalPersonal + view.totalRaised;
  });

  let selectedOrder = $state<Order | null>(null);
</script>

<svelte:head>
  <title>Dashboard | Westwood Finance</title>
</svelte:head>

<PageHeader title="Dashboard">
  {#snippet actions()}
    {#if perms.viewAllTeams}
      <div class="team-selector">
        <CustomDropdown options={TEAM_OPTIONS} bind:value={selectedTeam} />
      </div>
    {/if}
  {/snippet}
</PageHeader>

{#if dataService.loading && !dataService.orders.length && !dataService.funds.length}
  <LoadingIndicator text="Initializing workspace..." />
{:else}
  {#if dataService.hasLoadedOnce && yearFinancialOrders.length === 0 && yearFunds.length === 0}
    <div class="empty-year-notice fade-in">
      No financial activity recorded for {currentYear} yet.
    </div>
  {/if}

  <div class="stat-grid fade-in">
    <StatCard label="Net Balance" value={yearNetBalance.toString()} isCurrency={true} sub={`${currentYear} Raised − Spent`} accentColor={yearNetBalance >= 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}>
      {#snippet icon()}<DollarSign size={18} />{/snippet}
    </StatCard>
    <div class="total-raised-card">
      <StatCard label="Total Raised" value={yearRaised.toString()} isCurrency={true} sub={`${yearFunds.length} contributions in ${currentYear}`} accentColor="var(--status-awarded)">
        {#snippet icon()}<TrendingUp size={18} />{/snippet}
      </StatCard>
    </div>
    <StatCard label="Total Spent" value={yearSpent.toString()} isCurrency={true} sub={`${yearFinancialOrders.length} expenses in ${currentYear}`} accentColor="var(--status-rejected)">
      {#snippet icon()}<ShoppingCart size={18} />{/snippet}
    </StatCard>
    <StatCard
      label="Budget Progress"
      value={budgetTotalValue > 0 ? ((yearSpent / budgetTotalValue) * 100).toFixed(2) + '%' : '0%'}
      progress={budgetTotalValue > 0 ? (yearSpent / budgetTotalValue) * 100 : 0}
      sub={budgetTotalValue > 0 ? `${formatCurrency(yearSpent)} of ${formatCurrency(budgetTotalValue)}` : 'No active budget'}
      accentColor="var(--cat-miscellaneous)"
    >
      {#snippet icon()}<BarChart3 size={18} />{/snippet}
    </StatCard>
  </div>

  <div class="dashboard-content fade-in">
    <div class="main-column">
      <section class="card">
        <div class="section-header">
          <div class="section-title-group"><h2>Recent Expenses</h2></div>
          <a href="/orders" class="btn btn-ghost btn-xs">View History</a>
        </div>
        <div class="table-container">
          <ExpenseTable expenses={recentExpenses} limit={5} hideTeam={selectedTeam !== 'Westwood Overall'} />
        </div>
      </section>
    </div>

    <aside class="side-column">
      <section class="card">
        <div class="section-header">
          <div class="section-title-group"><h2>Recent Orders</h2></div>
          <a href="/orders" class="btn btn-ghost btn-xs">Track</a>
        </div>
        <RecentOrdersList orders={recentOrders} onselect={(o) => (selectedOrder = o)} />
      </section>
    </aside>
  </div>

  {#if view.monthlyTrends.length > 1}
    <div class="card trend-card fade-in">
      <div class="section-header" style="margin-bottom: 20px;">
        <div class="section-title-group"><h2>Spending Trend</h2></div>
        <a href="/stats" class="btn btn-ghost btn-xs">Full Analytics</a>
      </div>
      <div class="trend-chart-container">
        <LineChart data={view.monthlyTrends} />
      </div>
    </div>
  {/if}
{/if}

<OrderDetailSheet order={selectedOrder} open={!!selectedOrder} onclose={() => (selectedOrder = null)} />

<div class="mobile-version-footer">
  <span class="v-tag">v{appInfo.version}</span>
  <span class="v-sep">·</span>
  <span class="v-time">Last Deployed {appInfo.deployedAt}</span>
</div>

<style>
  .team-selector { width: 180px; }
  @media (max-width: 768px) { .team-selector { width: 175px; } }
  @media (max-width: 400px) { .team-selector { width: 165px; } }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    margin-bottom: 40px;
  }
  @media (max-width: 768px) { .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
  @media (max-width: 390px) { .stat-grid { grid-template-columns: 1fr; } }

  .total-raised-card { display: flex; flex-direction: column; }
  .total-raised-card > :global(*) { flex: 1; width: 100%; }

  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
    align-items: start;
    min-width: 0;
  }
  @media (max-width: 1100px) { .dashboard-content { grid-template-columns: 1fr; } }

  .main-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; overflow: hidden; }
  .side-column { display: flex; flex-direction: column; gap: 24px; min-width: 0; overflow: hidden; }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .section-title-group h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 2px;
  }

  .trend-card { margin-top: 24px; padding: 24px; }
  .trend-chart-container { height: 220px; width: 100%; position: relative; }

  .empty-year-notice {
    text-align: center;
    padding: 12px 20px;
    margin-bottom: 24px;
    font-size: 0.85rem;
    color: var(--text-dim);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .mobile-version-footer {
    display: none;
    text-align: center;
    padding: 32px 0 20px;
    opacity: 0.4;
    font-size: 0.65rem;
    font-weight: 500;
    color: var(--text-dim);
    letter-spacing: 0.02em;
  }
  .v-sep { margin: 0 4px; }
  @media (max-width: 768px) { .mobile-version-footer { display: block; } }
</style>
