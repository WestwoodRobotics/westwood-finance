<script>
  import { DollarSign, TrendingUp, ShoppingCart, BarChart3 } from '@lucide/svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatCard from "$lib/components/StatCard.svelte";
  import ExpenseTable from "$lib/components/ExpenseTable.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import OrderStatusBadge from "$lib/components/OrderStatusBadge.svelte";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import OrderDetailSheet from "$lib/components/OrderDetailSheet.svelte";
  import LineChart from "$lib/components/LineChart.svelte";
  import {
    formatCurrency,
    formatDate,
    getCatColor,
    matchesTeam,
    TEAMS,
  } from "$lib/utils.js";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";
  import { perms } from "$lib/perms.js";
  import appInfo from "$lib/app-info.json";

  /** @typedef {import('$lib/dataService.svelte.js').Order} Order */

  const TEAM_OPTIONS = perms.viewAllTeams ? TEAMS : [authStore.userTeam];
  let selectedTeam = $state(perms.viewAllTeams ? "Westwood Overall" : authStore.userTeam);

  // ── Derived View Based on Team ─────────────────────────────────────────────
  let teamOrders = $derived(
    dataService.orders.filter((o) => matchesTeam(o, selectedTeam)),
  );

  let teamFunds = $derived(
    selectedTeam === "Westwood Overall"
      ? dataService.funds
      : dataService.funds.filter((f) => {
          const r = String(f.Recipient || "")
            .toLowerCase()
            .trim();
          const s = selectedTeam.toLowerCase().trim();
          return r === s || r.includes(s) || r === "all";
        }),
  );

  // ── Derived Stats ───────────────────────────────────────────────────────────
  // All orders for the full year expense count (regardless of status)
  let allYearExpenses = $derived(
    teamOrders.filter((/** @type {Order} */ o) => {
      const ts = o.timestamp || "";
      const year = new Date().getFullYear().toString();
      return ts.includes(year);
    }),
  );

  // "Expenses" are orders that have been received or ordered
  let expenses = $derived(
    teamOrders.filter((/** @type {Order} */ o) => {
      const s = (o.status || "").toLowerCase().trim();
      return s === "received" || s === "ordered";
    }),
  );

  let totalRaised = $derived(
    teamFunds.reduce(
      (/** @type {number} */ sum, /** @type {any} */ f) =>
        sum + (Number(f.Amount) || 0),
      0,
    ),
  );

  let totalSpent = $derived(
    expenses.reduce(
      (/** @type {number} */ s, /** @type {Order} */ e) => s + (e.total || 0),
      0,
    ),
  );
  let netBalance = $derived(totalRaised - totalSpent);

  let monthlyTrends = $derived.by(() => {
    /** @type {Record<string, number>} */
    const map = {};
    expenses.forEach((/** @type {Order} */ e) => {
      const d = new Date(e.timestamp || "");
      if (isNaN(d.getTime())) return;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[month] = (map[month] || 0) + (e.total || 0);
    });
    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });

  let recentExpenses = $derived(expenses.slice(-5).reverse());
  let recentOrders = $derived(teamOrders.slice(-5).reverse());

  let budgetTotalValue = $derived.by(() => {
    const totalClub = dataService.budget?.Total?.["Club Funds"] || 0;
    const totalPersonal = dataService.budget?.Total?.["Personal Funds"] || 0;
    const totalRealExpenses = dataService.orders
      .filter((o) => {
        const st = (o.status || "").toLowerCase().trim();
        return st === "received" || st === "ordered";
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
    return totalClub + totalPersonal + totalRaised - totalRealExpenses;
  });

  /** @type {any} */
  let selectedOrder = $state(null);
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
  <div class="stat-grid fade-in">
    <StatCard
      label="Net Balance"
      value={netBalance.toString()}
      isCurrency={true}
      sub="Total Raised - Total Spent"
      accentColor={netBalance >= 0 ? "var(--status-awarded)" : "var(--status-rejected)"}
    >
      {#snippet icon()}<DollarSign size={18} />{/snippet}
    </StatCard>
    <div class="total-raised-card">
      <StatCard
        label="Total Raised"
        value={totalRaised.toString()}
        isCurrency={true}
        sub={`${dataService.funds.length} contributions`}
        accentColor="var(--status-awarded)"
      >
        {#snippet icon()}<TrendingUp size={18} />{/snippet}
      </StatCard>
    </div>
    <StatCard
      label="Total Spent"
      value={totalSpent.toString()}
      isCurrency={true}
      sub={`${allYearExpenses.length} expenses this year`}
      accentColor="var(--status-rejected)"
    >
      {#snippet icon()}<ShoppingCart size={18} />{/snippet}
    </StatCard>
    <StatCard
      label="Budget Progress"
      value={budgetTotalValue > 0 ? ((totalSpent / budgetTotalValue) * 100).toFixed(2) + "%" : "0%"}
      progress={budgetTotalValue > 0 ? (totalSpent / budgetTotalValue) * 100 : 0}
      sub={budgetTotalValue > 0 ? `${formatCurrency(totalSpent)} of ${formatCurrency(budgetTotalValue)}` : "No active budget"}
      accentColor="var(--cat-miscellaneous)"
    >
      {#snippet icon()}<BarChart3 size={18} />{/snippet}
    </StatCard>
  </div>

  <div class="dashboard-content fade-in">
    <div class="main-column">
      <section class="card">
        <div class="section-header">
          <div class="section-title-group">
            <h2>Recent Expenses</h2>
          </div>
          <a href="/orders" class="btn btn-ghost btn-xs">View History</a>
        </div>
        <div class="table-container">
          <ExpenseTable
            expenses={recentExpenses}
            limit={5}
            hideTeam={selectedTeam !== "Westwood Overall"}
          />
        </div>
      </section>
    </div>

    <aside class="side-column">
      <section class="card">
        <div class="section-header">
          <div class="section-title-group">
            <h2>Recent Orders</h2>
          </div>
          <a href="/orders" class="btn btn-ghost btn-xs">Track</a>
        </div>
        <div class="recent-list">
          {#each recentOrders as order (order.id)}
            <div
              class="recent-item group-row"
              style="--group-color: {getCatColor(order.category)}; cursor: pointer;"
              role="button"
              tabindex="0"
              onclick={() => (selectedOrder = order)}
              onkeydown={(e) =>
                (e.key === "Enter" || e.key === " ") && (selectedOrder = order)}
            >
              <div class="item-info">
                <div class="item-name" style="font-size: 0.85rem;">
                  {order.item}
                </div>
                <div class="item-meta">
                  <span class="company">{order.company}</span>
                  <span class="dot"></span>
                  <span class="date">{formatDate(order.timestamp)}</span>
                </div>
              </div>
              <div class="item-status">
                <OrderStatusBadge status={order.status} />
              </div>
              <div
                class="item-amount monospace amount"
                style="font-size: 0.85rem;"
              >
                {formatCurrency(order.total)}
              </div>
            </div>
          {:else}
            <div class="empty-state">No active orders</div>
          {/each}
        </div>
      </section>
    </aside>
  </div>

  {#if monthlyTrends.length > 1}
    <div class="card trend-card fade-in">
      <div class="section-header" style="margin-bottom: 20px;">
        <div class="section-title-group">
          <h2>Spending Trend</h2>
        </div>
        <a href="/stats" class="btn btn-ghost btn-xs">Full Analytics</a>
      </div>
      <div class="trend-chart-container">
        <LineChart data={monthlyTrends} />
      </div>
    </div>
  {/if}
{/if}

<OrderDetailSheet
  order={selectedOrder}
  open={!!selectedOrder}
  onclose={() => (selectedOrder = null)}
/>

<!-- Mobile Version Info Footer -->
<div class="mobile-version-footer">
  <span class="v-tag">v{appInfo.version}</span>
  <span class="v-sep">·</span>
  <span class="v-time">Last Deployed {appInfo.deployedAt}</span>
</div>

<style>
  .team-selector {
    width: 180px;
  }
  @media (max-width: 768px) {
    .team-selector {
      width: 175px;
    }
  }
  @media (max-width: 400px) {
    .team-selector {
      width: 165px;
    }
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    margin-bottom: 40px;
  }

  @media (max-width: 900px) {
    .stat-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 480px) {
    .stat-grid {
      grid-template-columns: 1fr;
    }
  }

  .total-raised-card {
    display: flex;
    flex-direction: column;
  }

  .total-raised-card > :global(*) {
    flex: 1;
    width: 100%;
  }

  .dashboard-content {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 24px;
    align-items: start;
    min-width: 0;
  }

  @media (max-width: 1100px) {
    .dashboard-content {
      grid-template-columns: 1fr;
    }
  }

  .main-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
    overflow: hidden;
  }

  .side-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0;
    overflow: hidden;
  }

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

  /* Recent Orders List */
  .recent-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .recent-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
    padding: 12px 14px 12px 18px;
    background: var(--surface);
    transition: all 0.2s;
    position: relative;
    min-width: 0;
  }

  .recent-item::before {
    content: "";
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    background: var(--group-color);
    border-radius: 99px;
    opacity: 0.8;
  }

  .recent-item:hover {
    background: var(--surface-2);
  }

  .item-info {
    min-width: 0;
    overflow: hidden;
  }

  .item-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-dim);
    font-weight: 500;
    overflow: hidden;
  }
  .item-meta .company,
  .item-meta .date {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .item-meta .dot {
    width: 3px;
    height: 3px;
    background: var(--text-dim);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .item-status {
    flex-shrink: 0;
  }
  .item-amount {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .amount {
    text-align: right;
    font-weight: 700;
    color: #fff;
    font-size: 0.95rem;
  }

  .btn-xs {
    font-size: 0.7rem;
    padding: 4px 10px;
  }

  .trend-card {
    margin-top: 24px;
    padding: 24px;
  }

  .trend-chart-container {
    height: 220px;
    width: 100%;
    position: relative;
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
  .v-sep {
    margin: 0 4px;
  }

  @media (max-width: 768px) {
    .mobile-version-footer {
      display: block;
    }
  }
</style>
