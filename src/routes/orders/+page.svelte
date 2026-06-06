<script lang="ts">
  import { onMount } from "svelte";
  import { Download, Plus, Package } from '@lucide/svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { browser } from "$app/environment";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import OrderTable from "$lib/components/OrderTable.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";
  import { perms } from "$lib/perms.js";
  import { STATUS_PRIORITY } from "$lib/utils.js";

  let filters = $state({
    search: "",
    category: "",
    company: "",
    team: perms.viewAllTeams ? "" : authStore.userTeam,
    status: "",
    dateFrom: "",
    dateTo: "",
  });

  onMount(() => {
    if (browser) {
      const q = new URLSearchParams(window.location.search);
      if (q.has("search")) filters.search = q.get("search") || "";
      if (q.has("category")) filters.category = q.get("category") || "";
      if (q.has("company")) filters.company = q.get("company") || "";
      // Only allow team filter override for admins
      if (q.has("team") && perms.viewAllTeams) filters.team = q.get("team") || "";
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
        let str = String(val ?? "").replace(/"/g, '""');
        if (/^[=+\-@]/.test(str)) str = '\t' + str;
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
      .filter((e) => {
        // HARD GUARD: Non-admin members can ONLY see their own team's data
        if (!perms.viewAllTeams && authStore.userTeam) {
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
      .sort((a, b) => {
        const priorityA = STATUS_PRIORITY[(a.status || '').toLowerCase().trim()] ?? 99;
        const priorityB = STATUS_PRIORITY[(b.status || '').toLowerCase().trim()] ?? 99;

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

<PageHeader title="All " titleAccent="Orders">
  {#snippet actions()}
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
  {/snippet}
</PageHeader>

<FilterBar bind:filters />

{#if dataService.loading && !dataService.orders.length}
  <LoadingIndicator text="Syncing records..." />
{:else if dataService.orders.length > 0}
  <div class={!dataService.hasLoadedOnce ? "fade-in" : ""}>
    <OrderTable orders={filtered} hideTeamColumn={!perms.viewAllTeams} />
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
  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  @media (max-width: 768px) {
    .btn { height: 42px; display: inline-flex; align-items: center; justify-content: center; }
  }
</style>
