<script>
  import { onMount } from "svelte";
  import { TriangleAlert, Download, Plus, Package } from '@lucide/svelte';
  import { browser } from "$app/environment";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import OrderTable from "$lib/components/OrderTable.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";

  /** @typedef {import('$lib/dataService.svelte.js').Order} Order */

  let syncing = $state(false);

  let filters = $state({
    search: "",
    category: "",
    company: "",
    team: authStore.isAdmin ? "" : authStore.userTeam,
    status: "",
    dateFrom: "",
    dateTo: "",
  });

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
    if (browser) {
      const q = new URLSearchParams(window.location.search);
      if (q.has("search")) filters.search = q.get("search") || "";
      if (q.has("category")) filters.category = q.get("category") || "";
      if (q.has("company")) filters.company = q.get("company") || "";
      // Only allow team filter override for admins
      if (q.has("team") && authStore.isAdmin) filters.team = q.get("team") || "";
      if (q.has("status")) filters.status = q.get("status") || "";
    }
  });

  $effect(() => {
    if (!browser) return;
    
    const currentFilters = { ...filters };

    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      Object.entries(currentFilters).forEach(([k, v]) => {
        if (
          v &&
          v !== "All Categories" &&
          v !== "All Statuses" &&
          v !== "All Teams"
        ) {
          url.searchParams.set(k, v);
        } else {
          url.searchParams.delete(k);
        }
      });
      window.history.replaceState(null, "", url.toString());
    }, 300);

    return () => clearTimeout(t);
  });

  /**
   * @param {Order} exp
   * @param {string} s
   */
  function matchSearch(exp, s) {
    if (!s) return true;
    s = s.toLowerCase();
    return (
      (exp.item || "").toLowerCase().includes(s) ||
      (exp.notes || "").toLowerCase().includes(s) ||
      (exp.company || "").toLowerCase().includes(s)
    );
  }

  function exportCSV() {
    if (!filtered || !filtered.length) return;
    const headers = [
      "Item",
      "Company",
      "Price",
      "Quantity",
      "Total",
      "Category",
      "Team",
      "Status",
      "Date",
      "UUID",
      "Tracking/Link",
      "Notes",
    ];

    const csvRows = [];
    csvRows.push(headers.join(","));
    for (const row of filtered) {
      const values = [
        row.item,
        row.company,
        row.price,
        row.quantity,
        row.total,
        row.category,
        row.team,
        row.status,
        (row.timestamp || "").slice(0, 10),
        row.orderUUID,
        row.tracking || row.link || "",
        row.notes,
      ].map((val) => {
        let str = String(val || "").replace(/"/g, '""');
        return `"${str}"`;
      });
      csvRows.push(values.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute(
      "download",
      `westwood_orders_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  let filtered = $derived.by(() => {
    return dataService.orders
      .filter((/** @type {Order} */ e) => {
        // HARD GUARD: Non-admin members can ONLY see their own team's data
        if (!authStore.isAdmin && authStore.userTeam) {
          const orderTeam = (e.team || '').toLowerCase().trim();
          const myTeam = authStore.userTeam.toLowerCase().trim();
          if (orderTeam !== myTeam && !orderTeam.includes(myTeam)) return false;
        }
        if (filters.category && e.category !== filters.category) return false;
        if (
          filters.company &&
          !e.company?.toLowerCase().includes(filters.company.toLowerCase())
        )
          return false;
        if (
          filters.team &&
          !e.team?.toLowerCase().includes(filters.team.toLowerCase())
        )
          return false;
        if (filters.dateFrom && e.timestamp < filters.dateFrom) return false;
        if (filters.dateTo && e.timestamp?.slice(0, 10) > filters.dateTo)
          return false;
        if (
          filters.status &&
          e.status !== filters.status &&
          filters.status !== "All Statuses"
        )
          return false;
        if (!matchSearch(e, filters.search)) return false;
        return true;
      })
      .sort((/** @type {Order} */ a, /** @type {Order} */ b) => {
        /** @type {Record<string, number>} */
        const STATUS_PRIORITY = {
          "Pending Review": 0,
          Approved: 1,
          Ordered: 2,
          Received: 3,
          Denied: 4,
          Void: 5,
        };

        const priorityA = STATUS_PRIORITY[a.status] ?? 99;
        const priorityB = STATUS_PRIORITY[b.status] ?? 99;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return (
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      });
  });
</script>

<svelte:head>
  <title>All Orders | Westwood Finance</title>
</svelte:head>

<div class="page-header">
  <div class="header-left">
    <h1>All <span>Orders</span></h1>
  </div>

  <div class="header-right">
    {#if dataService.error}
      <span class="error-text" style="display:inline-flex;align-items:center;">
        <TriangleAlert size={14} style="margin-right:6px;" />
        {dataService.error}
      </span>
    {/if}

    <div class="header-actions">
      <button
        class="btn btn-ghost btn-sm hide-mobile"
        onclick={exportCSV}
        disabled={!filtered || !filtered.length}
      >
        <Download size={14} />
        <span class="hide-mobile">Export</span>
      </button>

      <a href="/add" class="btn btn-primary btn-sm hide-mobile">
        <Plus size={14} />
        <span>New Request</span>
      </a>
    </div>

    <button class="btn btn-ghost btn-sm refresh-btn" onclick={sync} disabled={dataService.isManualRefreshing}>
      <span class:spinning={dataService.isManualRefreshing}>↻</span>
      <span class="hide-mobile">{dataService.isManualRefreshing ? "Syncing..." : "Refresh"}</span>
    </button>
  </div>
</div>

<FilterBar bind:filters />

{#if dataService.loading && !dataService.orders.length}
  <LoadingIndicator text="Syncing records..." />
{:else if dataService.orders.length > 0}
  <div class={!dataService.hasLoadedOnce ? "fade-in" : ""}>
    <OrderTable orders={filtered} hideTeamColumn={!authStore.isAdmin} />
  </div>
{:else}
  <div class="empty-state card fade-in">
    <div class="icon">
      <Package size={48} stroke-width={1} />
    </div>
    <h3>No requests found</h3>
    <p>Submit a new order request to see it appear in the history.</p>
    <a href="/add" class="btn btn-primary btn-sm" style="margin-top: 16px;"
      >Create First Request</a
    >
  </div>
{/if}

<style>
  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  @media (max-width: 768px) {
    .btn { height: 42px; display: inline-flex; align-items: center; justify-content: center; }
    .refresh-btn { aspect-ratio: 1/1; width: 42px; padding: 0 !important; flex: none !important; }
  }

  .error-text {
    color: var(--status-rejected);
    font-size: 0.8rem;
    font-weight: 600;
  }
</style>
