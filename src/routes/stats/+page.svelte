<script lang="ts">
  import { ChevronDown, DollarSign, ShoppingBag, Home, BarChart3 } from '@lucide/svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatCard from "$lib/components/StatCard.svelte";
  import PieChart from "$lib/components/PieChart.svelte";
  import LineChart from "$lib/components/LineChart.svelte";
  import BarChart from "$lib/components/BarChart.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import {
    CATEGORIES,
    STATUS_COLORS,
    TEAMS,
  } from "$lib/utils.js";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";
  import { perms } from "$lib/perms.js";
  import { createTeamView } from "$lib/derived.svelte.js";

  const TEAM_OPTIONS = perms.viewAllTeams ? TEAMS : [authStore.userTeam];
  let selectedTeam = $state(perms.viewAllTeams ? "FRC" : authStore.userTeam);

  let effectiveTeam = $derived(!perms.viewAllTeams && authStore.userTeam ? authStore.userTeam : selectedTeam);

  const view = createTeamView(() => effectiveTeam);

  let totalItems = $derived(view.financialOrders.length);
  let avgCost = $derived(view.financialOrders.length > 0 ? view.totalSpent / view.financialOrders.length : 0);

  let mostExpensive = $derived(
    view.financialOrders.length > 0
      ? [...view.financialOrders].sort((a, b) => (b.total || 0) - (a.total || 0))[0]
      : null,
  );

  let topVendor = $derived.by(() => {
    if (view.financialOrders.length === 0) return null;
    const map: Record<string, number> = {};
    view.financialOrders.forEach((e) => {
      const comp = e.company || "Unknown";
      map[comp] = (map[comp] || 0) + 1;
    });
    const top = Object.entries(map).sort(([, a], [, b]) => b - a)[0];
    if (!top) return null;
    return { company: top[0], count: top[1] };
  });

  let byCategory = $derived.by(() => {
    const map: Record<string, number> = {};
    CATEGORIES.forEach((c) => (map[c] = 0));
    view.financialOrders.forEach((e) => {
      const cat = (e.category || "miscellaneous").toLowerCase().trim();
      if (map[cat] !== undefined) map[cat] = (map[cat] || 0) + (e.total || 0);
      else map["miscellaneous"] = (map["miscellaneous"] || 0) + (e.total || 0);
    });
    return map;
  });

  let byVendorDollars = $derived.by(() => {
    const map: Record<string, number> = {};
    view.financialOrders.forEach((e) => {
      const vendor = e.company || "Unknown";
      map[vendor] = (map[vendor] || 0) + (e.total || 0);
    });
    return Object.fromEntries(Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8));
  });

  let statusDistribution = $derived.by(() => {
    const map: Record<string, number> = {};
    view.teamOrders.forEach((e) => {
      const status = e.status || "Unknown";
      map[status] = (map[status] || 0) + 1;
    });
    return map;
  });
</script>

<svelte:head>
  <title>Analytics | Westwood Finance</title>
</svelte:head>

<PageHeader title="Spending " titleAccent="Trends">
  {#snippet actions()}
    {#if perms.viewAllTeams}
    <div class="team-selector">
      <CustomDropdown options={TEAM_OPTIONS} bind:value={selectedTeam} />
    </div>
    {:else}
    <div class="team-preview-box">
      <span>{selectedTeam}</span>
      <ChevronDown size={12} style="opacity: 0.3;" />
    </div>
    {/if}
  {/snippet}
</PageHeader>

{#if dataService.loading && !dataService.orders.length}
  <LoadingIndicator text="Analyzing ledger data..." />
{:else if view.teamOrders.length > 0}
  <div class={!dataService.hasLoadedOnce ? "fade-in" : ""}>
    <div class="stat-grid" style="margin-bottom: 32px">
      <StatCard label="Total Spend" value={view.totalSpent.toString()} isCurrency={true} accentColor="var(--status-rejected)">
        {#snippet icon()}<DollarSign size={18} />{/snippet}
      </StatCard>
      <StatCard label="Request Count" value={totalItems.toString()} sub="Valid entries" accentColor="var(--status-ordered)">
        {#snippet icon()}<ShoppingBag size={18} />{/snippet}
      </StatCard>
      <StatCard label="Average Spend" value={avgCost.toString()} isCurrency={true} accentColor="var(--status-rejected)">
        {#snippet icon()}<DollarSign size={18} />{/snippet}
      </StatCard>
      <StatCard label="Most Common Vendor" value={topVendor ? topVendor.company : "—"} sub={topVendor ? `${topVendor.count} order${topVendor.count !== 1 ? "s" : ""}` : "No data"} accentColor="var(--primary)">
        {#snippet icon()}<Home size={18} />{/snippet}
      </StatCard>
    </div>

    <div class="charts-grid">
      <div class="card chart-card">
        <div class="card-header-group">
          <h3 class="chart-title">Category Distribution</h3>
        </div>
        <div class="chart-container">
          <PieChart data={byCategory} />
        </div>
      </div>

      <div class="card chart-card">
        <div class="card-header-group">
          <h3 class="chart-title">Request Overview</h3>
        </div>
        <div class="chart-container">
          <PieChart data={statusDistribution} colorMap={STATUS_COLORS} />
        </div>
      </div>
    </div>

    <div class="charts-grid" style="margin-top: 24px">
      <div class="card chart-card">
        <div class="card-header-group">
          <h3 class="chart-title">Spending over Time</h3>
        </div>
        {#if view.monthlyTrends.length > 0}
          <div class="chart-container">
            <LineChart data={view.monthlyTrends} />
          </div>
        {:else}
          <div class="empty-state" style="padding: 48px">
            No historical data recorded yet
          </div>
        {/if}
      </div>
    </div>

    {#if Object.keys(byVendorDollars).length > 0}
      <div class="card chart-card chart-card-wide" style="margin-top: 24px">
        <div class="card-header-group">
          <h3 class="chart-title">Top Vendors by Spend</h3>
        </div>
        <div class="chart-container chart-container-tall">
          <BarChart data={byVendorDollars} />
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="empty-state card fade-in">
    <div class="icon">
      <BarChart3 size={48} stroke-width={1} />
    </div>
    <h3>No analytical insights</h3>
    <p>History will populate once requests are recorded.</p>
  </div>
{/if}

<style>
  .team-selector {
    width: 180px;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 20px;
  }
  @media (max-width: 768px) {
    .stat-grid { margin-top: 12px; }
  }

  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  .chart-card {
    padding: 24px;
    display: flex;
    flex-direction: column;
  }

  .card-header-group {
    margin-bottom: 24px;
  }
  .chart-title {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text);
    margin-bottom: 4px;
  }

  .chart-container {
    height: 260px;
    width: 100%;
    position: relative;
  }

  .chart-container-tall {
    height: 320px;
  }

  .chart-card-wide {
    grid-column: 1 / -1;
  }

  @media (max-width: 1000px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 768px) {
    .team-selector { width: 175px; }
  }

  .team-preview-box {
    background: var(--surface-2);
    color: var(--text-muted);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid var(--border);
    cursor: not-allowed;
    opacity: 0.6;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-width: 180px;
    width: 180px;
  }
</style>
