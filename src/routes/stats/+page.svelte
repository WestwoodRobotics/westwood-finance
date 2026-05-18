<script>
  import { onMount } from "svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import PieChart from "$lib/components/PieChart.svelte";
  import LineChart from "$lib/components/LineChart.svelte";
  import BarChart from "$lib/components/BarChart.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import {
    formatCurrency,
    formatDate,
    CATEGORIES,
    STATUS_COLORS,
    truncate,
  } from "$lib/utils.js";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";

  /** @typedef {import('$lib/dataService.svelte.js').Order} Order */

  let syncing = $state(false);

  const TEAM_OPTIONS = authStore.isAdmin
    ? ["FRC", "Slingshot", "Hunga Munga", "Atlatl", "Kunai", "Westwood Overall"]
    : [authStore.userTeam];
  let selectedTeam = $state(authStore.isAdmin ? "FRC" : authStore.userTeam);

  async function sync() {
    dataService.isManualRefreshing = true;
    try {
      await dataService.load(true);
    } finally {
      setTimeout(() => { dataService.isManualRefreshing = false; }, 800);
    }
  }

  onMount(() => {
    dataService.load();
  });

  // ── Stats Calculations ──────────────────────────────────────────────────────

  // Use all requested orders for analytics
  let teamOrders = $derived(
    selectedTeam === "Westwood Overall"
      ? dataService.orders
      : dataService.orders.filter((o) => {
          const t = (o.team || "").toLowerCase().trim();
          const s = selectedTeam.toLowerCase().trim();
          // For non-admins, always enforce their team regardless of selectedTeam
          const teamToMatch = (!authStore.isAdmin && authStore.userTeam)
            ? authStore.userTeam.toLowerCase().trim()
            : s;
          return (
            t === teamToMatch ||
            t.includes(teamToMatch) ||
            (teamToMatch === "frc" && (t.includes("frc") || /^\d+$/.test(t)))
          );
        }),
  );

  let analyticsOrders = $derived(
    teamOrders.map((/** @type {Order} */ o) => {
      const d = new Date(o.timestamp || "");
      const month = isNaN(d.getTime())
        ? ""
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        ...o,
        month,
      };
    }),
  );

  // Financial orders include only definitively spent items (Received/Ordered)
  let financialOrders = $derived(
    analyticsOrders.filter((o) => {
      const s = String(o.status || "")
        .toLowerCase()
        .trim();
      return s === "received" || s === "ordered";
    }),
  );

  // ── Stats Calculations (Split into individual runes for perfect reactivity) ──

  let totalSpent = $derived(
    financialOrders.reduce((sum, e) => sum + (e.total || 0), 0),
  );
  let totalItems = $derived(financialOrders.length);
  let avgCost = $derived(
    financialOrders.length > 0 ? totalSpent / financialOrders.length : 0,
  );

  let mostExpensive = $derived(
    financialOrders.length > 0
      ? [...financialOrders].sort((a, b) => (b.total || 0) - (a.total || 0))[0]
      : null,
  );

  let topVendor = $derived.by(() => {
    if (financialOrders.length === 0) return null;
    /** @type {Record<string, number>} */
    const map = {};
    financialOrders.forEach((e) => {
      const comp = e.company || "Unknown";
      map[comp] = (map[comp] || 0) + 1;
    });
    const top = Object.entries(map).sort(([, a], [, b]) => b - a)[0];
    if (!top) return null;
    return { company: top[0], count: top[1] };
  });

  let byCategory = $derived.by(() => {
    /** @type {Record<string, number>} */
    const map = {};
    // Ensure all standard categories exist even if 0
    CATEGORIES.forEach((c) => (map[c] = 0));

    financialOrders.forEach((e) => {
      const cat = (e.category || "miscellaneous").toLowerCase().trim();
      if (map[cat] !== undefined) {
        map[cat] = (map[cat] || 0) + (e.total || 0);
      } else {
        map["miscellaneous"] = (map["miscellaneous"] || 0) + (e.total || 0);
      }
    });
    return map;
  });

  let monthlyTrends = $derived.by(() => {
    /** @type {Record<string, number>} */
    const map = {};
    financialOrders.forEach((e) => {
      if (e.month) {
        map[e.month] = (map[e.month] || 0) + (e.total || 0);
      }
    });
    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });

  let byVendorDollars = $derived.by(() => {
    /** @type {Record<string, number>} */
    const map = {};
    financialOrders.forEach((e) => {
      const vendor = e.company || "Unknown";
      map[vendor] = (map[vendor] || 0) + (e.total || 0);
    });
    // Sort and take top 8 for clarity
    return Object.fromEntries(
      Object.entries(map)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8),
    );
  });

  let statusDistribution = $derived.by(() => {
    /** @type {Record<string, number>} */
    const map = {};
    analyticsOrders.forEach((e) => {
      const status = e.status || "Unknown";
      map[status] = (map[status] || 0) + 1;
    });
    return map;
  });
</script>

<svelte:head>
  <title>Analytics | Westwood Finance</title>
</svelte:head>

<div class="page-header">
  <div class="header-left">
    <h1>Spending <span>Trends</span></h1>
  </div>

  <div
    class="header-right"
    style="display: flex; align-items: center; gap: 24px;"
  >
    {#if dataService.error}
      <span class="error-text" style="display:inline-flex;align-items:center;">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="margin-right:6px;"
          ><path
            d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
          /><path d="M12 9v4" /><path d="M12 17h.01" /></svg
        >
        {dataService.error}
      </span>
    {/if}

    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="btn btn-ghost btn-sm refresh-btn" onclick={sync} disabled={dataService.isManualRefreshing}>
        <span class:spinning={dataService.isManualRefreshing}>↻</span>
        <span class="hide-mobile">{dataService.isManualRefreshing ? "Syncing..." : "Refresh"}</span>
      </button>

      {#if authStore.isAdmin}
      <div class="team-selector" style="width: 180px;">
        <CustomDropdown options={TEAM_OPTIONS} bind:value={selectedTeam} />
      </div>
      {:else}
      <div class="team-preview-box">
        <span>{selectedTeam}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      {/if}
    </div>
  </div>
</div>

{#if dataService.loading && !dataService.orders.length}
  <LoadingIndicator text="Analyzing ledger data..." />
{:else if analyticsOrders.length > 0}
  <div class={!dataService.hasLoadedOnce ? "fade-in" : ""}>
    <div class="stat-grid" style="margin-bottom: 32px">
      <StatCard
        label="Total Spend"
        value={totalSpent.toString()}
        isCurrency={true}
        accentColor="var(--status-rejected)"
        icon='<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 2v20m-5-17h10a4 4 0 1 1 0 8H7a4 4 0 1 0 0 8h10"/></svg>'
      />
      <StatCard
        label="Request Count"
        value={totalItems.toString()}
        sub="Valid entries"
        accentColor="var(--status-ordered)"
        icon='<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
      />
      <StatCard
        label="Average Spend"
        value={avgCost.toString()}
        isCurrency={true}
        accentColor="var(--status-rejected)"
        icon='<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M12 2v20m-5-17h10a4 4 0 1 1 0 8H7a4 4 0 1 0 0 8h10"/></svg>'
      />
      <StatCard
        label="Most Common Vendor"
        value={topVendor ? topVendor.company : "—"}
        sub={topVendor
          ? `${topVendor.count} order${topVendor.count !== 1 ? "s" : ""}`
          : "No data"}
        accentColor="var(--primary)"
        icon='<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
      />
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
        {#if monthlyTrends.length > 0}
          <div class="chart-container">
            <LineChart data={monthlyTrends} />
          </div>
        {:else}
          <div class="empty-state" style="padding: 48px">
            No historical data recorded yet
          </div>
        {/if}
      </div>
    </div>
  </div>
{:else}
  <div class="empty-state card fade-in">
    <div class="icon">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><line x1="18" y1="20" x2="18" y2="10" /><line
          x1="12"
          y1="20"
          x2="12"
          y2="4"
        /><line x1="6" y1="20" x2="6" y2="14" /></svg
      >
    </div>
    <h3>No analytical insights</h3>
    <p>History will populate once requests are recorded.</p>
  </div>
{/if}

<style>
  .header-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .team-selector {
    width: 170px;
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
    color: #fff;
    margin-bottom: 4px;
  }


  .chart-container {
    height: 220px;
    width: 100%;
    position: relative;
  }


  .error-text {
    color: var(--status-rejected);
    font-size: 0.8rem;
    font-weight: 600;
    margin-right: 12px;
  }

  @media (max-width: 1000px) {
    .charts-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 768px) {
    .btn { height: 42px; line-height: 1; display: inline-flex; align-items: center; }
    .refresh-btn { width: 42px; padding: 0; justify-content: center; flex-shrink: 0; }
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
