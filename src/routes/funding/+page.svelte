<script>
  import { onMount } from "svelte";
  import {
    formatCurrency,
    formatFullDate,
    getTeamBadgeClass,
    CATEGORIES,
  } from "$lib/utils.js";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";
  import OrderTable from "$lib/components/OrderTable.svelte";
  import { dataService } from "$lib/dataService.svelte.js";
  import { BASE_URL } from "$lib/config.js";
  import AdminLock from "$lib/components/AdminLock.svelte";
  import PieChart from "$lib/components/PieChart.svelte";
  import { browser } from "$app/environment";
  import { authStore } from "$lib/authStore.svelte.js";

  const typeOptions = [
    { label: "Fundraiser", value: "Fundraiser" },
    { label: "Grant", value: "Grant" },
    { label: "Dues", value: "Dues" },
    { label: "Sponsor", value: "Sponsor" },
    { label: "Other", value: "Other" },
  ];
  const recipientOptions = [
    { label: "Slingshot", value: "Slingshot" },
    { label: "Atlatl", value: "Atlatl" },
    { label: "Kunai", value: "Kunai" },
    { label: "Hunga Munga", value: "Hunga Munga" },
    { label: "FRC", value: "FRC" },
    { label: "Westwood Overall", value: "Westwood Overall" },
  ];

  // ── State ───────────────────────────────────────────────────────────────────
  let syncing = $state(false);

  let activeTab = $state("budget");
  let sortCol = $state("Date");
  let sortDir = $state("desc");

  let selectedBudgetTeam = $state(authStore.isAdmin ? "FRC" : authStore.userTeam);

  let teamSpecificBudgetOrders = $derived(
    dataService.orders.filter((/** @type {any} */ o) => {
      // Westwood Overall shows all teams (aggregate)
      if (selectedBudgetTeam === "Westwood Overall") return true;
      const t = (o.team || "").toLowerCase().trim();
      const s = selectedBudgetTeam.toLowerCase().trim();
      return t === s || t.includes(s) || (s === 'frc' && (t.includes('frc') || /^\d+$/.test(t)));
    }),
  );

  // ── Lock ─────────────────────────────────────────────────────────────────────
  let unlocked = $state(false);

  // ── Data Loading ─────────────────────────────────────────────────────────────
  let isMobile = $state(false);

  onMount(() => {
    dataService.load(); // Uses cache for instant load
    const mq = window.matchMedia("(max-width: 768px)");
    isMobile = mq.matches;
    mq.addEventListener("change", (e) => { isMobile = e.matches; });
  });

  async function sync() {
    dataService.isManualRefreshing = true;
    try {
      await dataService.load(true);
    } finally {
      setTimeout(() => { dataService.isManualRefreshing = false; }, 800);
    }
  }

  // ── Derived totals ──────────────────────────────────────────────────────────
  let totalRaised = $derived(
    dataService.funds.reduce(
      (/** @type {number} */ sum, /** @type {any} */ f) =>
        sum + (Number(f.Amount) || 0),
      0,
    ),
  );

  let byType = $derived(() => {
    /** @type {Record<string, number>} */
    const map = {};
    for (const f of dataService.funds) {
      const t = f.Type || "Other";
      map[t] = (map[t] || 0) + (Number(f.Amount) || 0);
    }
    return map;
  });

  let budgetTeams = $derived(
    dataService.budget
      ? Object.entries(dataService.budget)
          .filter(([key]) => key !== "Total")
          .sort(([a], [b]) => {
            if (a === "FRC") return -1;
            if (b === "FRC") return 1;
            return a.localeCompare(b);
          })
      : [],
  );

  let budgetTotal = $derived(
    /** @type {any} */ (dataService.budget)?.["Total"] || null
  );

  let currentBudgetObj = $derived(
    /** @type {any} */ (dataService.budget)?.[selectedBudgetTeam === 'Westwood Overall' ? 'Total' : selectedBudgetTeam] || {}
  );

  let realExpenses = $derived(
    teamSpecificBudgetOrders
      .filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return s === "received" || s === "ordered";
      })
      .reduce((sum, o) => sum + (o.total || 0), 0)
  );

  let pendingExpenses = $derived(
    teamSpecificBudgetOrders
      .filter((o) => {
        const s = (o.status || "").toLowerCase().trim();
        return s === "pending review" || s === "approved";
      })
      .reduce((sum, o) => sum + (o.total || 0), 0)
  );
  let teamSpecificFunds = $derived(
    dataService.funds.filter((/** @type {any} */ f) => {
      if (selectedBudgetTeam === "Westwood Overall") return true;
      const r = String(f.Recipient || "")
        .toLowerCase()
        .trim();
      const s = selectedBudgetTeam.toLowerCase().trim();
      return r === s || r === "all";
    }),
  );

  let sortedFunds = $derived(
    teamSpecificFunds
      .slice()
      .sort((/** @type {any} */ a, /** @type {any} */ b) => {
        let valA = a[sortCol] || "";
        let valB = b[sortCol] || "";
        if (sortCol === "Amount") {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      }),
  );

  function toggleSort(/** @type {string} */ col) {
    if (sortCol === col) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = col;
      sortDir = col === "Date" || col === "Amount" ? "desc" : "asc";
    }
  }

  // ── Formatting helpers ──────────────────────────────────────────────────────
  function formatDate(/** @type {string} */ ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  const TYPE_COLORS = /** @type {Record<string,string>} */ ({
    Fundraiser: "var(--primary)",
    Grant: "#b97cf3",
    Dues: "#4e9af1",
    Sponsor: "#6bcb77",
    Other: "#f1a94e",
  });

  const CATEGORY_LABELS = /** @type {Record<string,string>} */ ({
    hardware: "Hardware",
    software: "Software",
    outreach: "Outreach",
    food: "Food",
    miscellaneous: "Misc",
  });

  let spentByCategory = $derived.by(() => {
    const map = /** @type {Record<string,number>} */ ({});
    CATEGORIES.forEach((c) => (map[c] = 0));

    // Filter team specific orders by status for "Spent" calculation
    const expenses = teamSpecificBudgetOrders.filter((o) => {
      const s = (o.status || "").toLowerCase().trim();
      return s === "received" || s === "ordered";
    });

    for (const e of expenses) {
      const cat = (e.category || "miscellaneous").toLowerCase().trim();
      map[cat] = (map[cat] || 0) + (e.total || 0);
    }
    return map;
  });

  let totalSpentForBreakdown = $derived(
    Object.values(spentByCategory).reduce((sum, val) => sum + val, 0),
  );

  let teamMasterTransactions = $derived.by(() => {
    /** @type {any[]} */
    const arr = [];

    const expenses = teamSpecificBudgetOrders.filter((/** @type {any} */ o) => {
      const s = (o.status || "").toLowerCase().trim();
      return s === "received" || s === "ordered";
    });
    for (let e of expenses) {
      arr.push({
        id: e.id,
        type: "Expense",
        source: e.company || e.item,
        category: e.category,
        date: e.timestamp?.slice(0, 10) || "—",
        amount: -(e.total || 0),
        status: e.status,
      });
    }

    const income = dataService.funds.filter((/** @type {any} */ f) => {
      if (selectedBudgetTeam === "Westwood Overall") return true;
      const t = (f.Recipient || "").toLowerCase().trim();
      const s = selectedBudgetTeam.toLowerCase().trim();
      return t === s || t.includes(s) || t === "all" || t === "westwood overall";
    });
    for (let f of income) {
      arr.push({
        id: f.id,
        type: "Income",
        source: f.Source,
        category: f.Type,
        date: f.Date || "—",
        amount: Number(f.Amount) || 0,
        status: "Received",
      });
    }

    arr.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });
    return arr;
  });

  let masterIncome = $derived(
    teamMasterTransactions
      .filter(tx => tx.type === 'Income')
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  let masterExpenses = $derived(
    teamMasterTransactions
      .filter(tx => tx.type === 'Expense')
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  );
  let masterNetBalance = $derived(
    (currentBudgetObj["Club Funds"] || 0) + 
    (currentBudgetObj["Personal Funds"] || 0) + 
    masterIncome - masterExpenses
  );
</script>

<svelte:head>
  <title>Team Dashboard | Westwood Finance</title>
</svelte:head>

<div class="page-header">
  <div class="header-left">
    <h1>Team <span>Dashboard</span></h1>
  </div>

  <div class="header-right">
    <button class="btn btn-ghost btn-sm refresh-btn" onclick={sync} disabled={dataService.isManualRefreshing}>
      <span class:spinning={dataService.isManualRefreshing}>↻</span>
      <span class="hide-mobile">{dataService.isManualRefreshing ? "Syncing..." : "Refresh"}</span>
    </button>
    <div class="team-selector">
      {#if authStore.isAdmin}
        <CustomDropdown
          options={[
            "FRC",
            "Slingshot",
            "Atlatl",
            "Kunai",
            "Hunga Munga",
            "Westwood Overall",
          ]}
          bind:value={selectedBudgetTeam}
          placeholder="Select Team"
        />
      {:else}
        <div class="team-preview-box">
          <span>{selectedBudgetTeam}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- ── Tab Nav ──────────────────────────────────────────────────────────────── -->
<div class="tabs-container">
  <div class="segmented-control">
    <div
      class="segment-highlight"
  style="transform: translateX(calc({(selectedBudgetTeam === 'Westwood Overall' ? 0 : ['budget', 'history', 'master'].indexOf(activeTab))} * 100%)); width: calc((100% - 10px) / {selectedBudgetTeam === 'Westwood Overall' ? 1 : 3});"
    ></div>
    {#each [["budget", "Team Dashboard"], ["history", `${selectedBudgetTeam} Funding`], ["master", "Finance History"]] as [key, label]}
      {#if selectedBudgetTeam !== 'Westwood Overall' || key === 'budget'}
        <button
          class="segment"
          class:active={activeTab === key}
          onclick={() => (activeTab = key)}
          id="tab-{key}">{label}</button
        >
      {/if}
    {/each}
  </div>
</div>

<!-- ══ TEAM BUDGETS ══════════════════════════════════════════════════════════ -->
{#if activeTab === "budget"}

  {#if dataService.loading && !dataService.budget}
    <LoadingIndicator text="Loading budgets..." />
  {:else if !dataService.budget}
    <div class="empty-state card">
      <div class="icon">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
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
      No budget data available.
    </div>
  {:else}
    {#if selectedBudgetTeam === "Westwood Overall"}
      <!-- ── Westwood Overall: Clean Team Summary Table ─────────────────── -->
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
                  const r = String(f.Recipient || "").toLowerCase().trim();
                  const s = team.toLowerCase().trim();
                  return (r === s || r === "all") ? sum + (Number(f.Amount) || 0) : sum;
                }, 0)}
                {@const clubFunds = data["Club Funds"] ?? 0}
                {@const personalFunds = data["Personal Funds"] ?? 0}
                {@const teamRealExpenses = dataService.orders.filter(o => {
                  const t = (o.team || "").toLowerCase().trim();
                  const s = team.toLowerCase().trim();
                  // Match exact team, or robust FRC match
                  const teamMatches = t === s || t.includes(s) || (s === 'frc' && (t.includes('frc') || /^\d+$/.test(t)));
                  if (!teamMatches) return false;
                  
                  const st = (o.status || "").toLowerCase().trim();
                  return st === "received" || st === "ordered";
                }).reduce((sum, o) => sum + (o.total || 0), 0)}
                {@const final = clubFunds + personalFunds + teamFundsRaised - teamRealExpenses}
                {@const pct = budgetTotal && (budgetTotal["Club Funds"] + totalRaised) > 0
                  ? Math.min(100, (Math.max(0, final) / (budgetTotal["Club Funds"] + totalRaised)) * 100)
                  : 0}
                <tr class="overall-row">
                  <td>
                    <span class="overall-team-name">{team}</span>
                  </td>
                  <td class="text-right monospace">{formatCurrency(clubFunds)}</td>
                  <td class="text-right monospace" style="color:#6bcb77">+{formatCurrency(teamFundsRaised)}</td>
                  <td class="text-right monospace" style="color:#f16a4e">{formatCurrency(Math.abs(teamRealExpenses))}</td>
                  <td class="text-right monospace overall-balance" style="color:{final >= 0 ? '#6bcb77' : '#f16a4e'}">{formatCurrency(final)}</td>
                  <td style="padding-left: 8px; padding-right: 20px;">
                    <div class="overall-bar-track">
                      <div class="overall-bar-fill" style="width:{pct}%"></div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
            {#if budgetTotal}
              {@const totalClub = budgetTotal["Club Funds"] || 0}
              {@const totalPersonal = budgetTotal["Personal Funds"] || 0}
              {@const totalRealExpenses = dataService.orders.filter(o => {
                const st = (o.status || "").toLowerCase().trim();
                return st === "received" || st === "ordered";
              }).reduce((sum, o) => sum + (o.total || 0), 0)}
              {@const totalFinal = totalClub + totalPersonal + totalRaised - totalRealExpenses}
              <tfoot>
                <tr class="total-row">
                  <td class="total-label" style="text-align:left; padding-left:20px;">Westwood Total</td>
                  <td class="text-right monospace total-amount" style="font-size:0.9rem">{formatCurrency(totalClub)}</td>
                  <td class="text-right monospace total-amount" style="font-size:0.9rem; color:#6bcb77">+{formatCurrency(totalRaised)}</td>
                  <td class="text-right monospace total-amount" style="font-size:0.9rem; color:#f16a4e">{formatCurrency(Math.abs(totalRealExpenses))}</td>
                  <td class="text-right monospace total-amount" style="color:{totalFinal >= 0 ? '#6bcb77' : '#f16a4e'}">{formatCurrency(totalFinal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            {/if}
          </table>
        </div>
      </div>
    {:else}
      <!-- ── Single Team: Card + Pie Chart ──────────────────────────────── -->
      <div class="budget-overview-container is-single fade-in">
        <div class="budget-single-view">
          {#each budgetTeams as [team, data]}
            {#if team === selectedBudgetTeam}
              {@const teamFundsRaised = dataService.funds.reduce((sum, f) => {
                const r = String(f.Recipient || "").toLowerCase().trim();
                const s = team.toLowerCase().trim();
                // Match exact team, "all" (split across teams), or "westwood overall"
                const matches = r === s || r.includes(s) || r === "all" || r === "westwood overall";
                return matches ? sum + (Number(f.Amount) || 0) : sum;
              }, 0)}
              {@const clubFunds = data["Club Funds"] ?? 0}
              {@const personal = data["Personal Funds"] ?? 0}
              {@const teamBudgetOnly = teamFundsRaised + personal}
              {@const budgetTotalVal = clubFunds + personal + teamFundsRaised}
              {@const final = budgetTotalVal - realExpenses}
              {@const usagePct = teamBudgetOnly > 0 ? (realExpenses / teamBudgetOnly) * 100 : 0}
              {@const pctColor = usagePct > 90 ? '#f16a4e' : (usagePct > 60 ? '#f97316' : '#6bcb77')}
              {@const pctBg = usagePct > 90 ? 'rgba(241, 106, 78, 0.1)' : (usagePct > 60 ? 'rgba(249, 115, 22, 0.1)' : 'rgba(107, 203, 119, 0.1)')}
              <div class="budget-card card selected">
                <div class="budget-team-name" style="font-size: 1.3rem; color: var(--primary);">{team}</div>
                <div class="budget-final" style="color:{final >= 0 ? '#6bcb77' : '#f16a4e'}; font-size: 2.0rem;">
                  {formatCurrency(final)} <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: 500;">/ {formatCurrency(teamFundsRaised + personal)}</span>
                </div>
                {#if usagePct > 0}
                  <div style="position: absolute; top: 22px; right: 22px;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: {pctColor}; background: {pctBg}; padding: 4px 10px; border-radius: 6px;">
                      {usagePct.toFixed(1)}% Used
                    </div>
                  </div>
                {/if}
                <div class="budget-details" style="gap: 11px; margin-top: 18px;">
                  <div class="budget-detail-row" style="font-size: 0.95rem;">
                    <span class="text-muted">Raised</span>
                    <span class="monospace" style="color:#6bcb77">+{formatCurrency(teamFundsRaised)}</span>
                  </div>
                  <div class="budget-detail-row" style="font-size: 0.95rem;">
                    <span class="text-muted">Personal</span>
                    <span class="monospace" style="color:#4e9af1">{formatCurrency(personal)}</span>
                  </div>
                  <div class="budget-detail-row" style="font-size: 0.95rem;">
                    <span class="text-muted">Expenses</span>
                    <span class="monospace" style="color:#f16a4e">{formatCurrency(Math.abs(realExpenses))}</span>
                  </div>
                  <div class="budget-detail-row" style="font-size: 0.95rem;">
                    <span class="text-muted">Pending Expenses</span>
                    <span class="monospace" style="color:var(--text-muted)">{formatCurrency(pendingExpenses)}</span>
                  </div>
                </div>
                <div class="budget-bar-track" style="margin-top:22px; height: 8px;">
                  <div class="budget-bar-fill" style="background:var(--primary);width:100%"></div>
                </div>
              </div>
            {/if}
          {/each}
        </div>
        <div class="breakdown-card fade-in">
          <PieChart data={spentByCategory} hideLegend={true} />
        </div>
      </div>
    {/if}

    <!-- Team Order History -->
    <div class="team-dashboard-content fade-in" style="margin-top: 40px;">
      <div class="section-title" style="margin-bottom: 20px; font-size: 1.1rem; color: var(--text-muted);">
        {selectedBudgetTeam} Orders
      </div>
      <OrderTable
        orders={teamSpecificBudgetOrders}
        hideTeamColumn={true}
      />
    </div>
  {/if}

  <!-- ══ TEAM HISTORY ═════════════════════════════════════════════════════════ -->
{:else if activeTab === "history"}
  <div class="team-dashboard-content fade-in">
    <div
      class="dashboard-stack"
      style="display: flex; flex-direction: column; gap: 40px;"
    >
      <!-- Section 2: Team Funding (Grants/Sponsors) -->
      <div class="funding-section">
        <div
          class="section-title"
          style="margin-bottom: 20px; font-size: 1.1rem; color: var(--text-muted);"
        >
          {selectedBudgetTeam} History
        </div>
        <div class="card" style="padding:0; overflow:hidden">
          {#if teamSpecificFunds.length === 0}
            <div class="empty-state" style="padding: 40px;">
              No funding entries for this team.
            </div>
          {:else}
            <table style="font-size: 0.85rem;">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each teamSpecificFunds as f}
                  <tr>
                    <td style="font-weight:500">{f.Source || "—"}</td>
                    <td
                      ><span
                        style="font-size: 1.05rem; font-weight: 500; border-left: 2px solid {TYPE_COLORS[
                          f.Type
                        ] || '#ccc'}; padding-left: 8px;">{f.Type}</span
                      ></td
                    >
                    <td class="text-right monospace" style="color:#6bcb77"
                      >{formatCurrency(f.Amount)}</td
                    >
                  </tr>
                {/each}
              </tbody>

              <tfoot class="total-row">
                <tr>
                  <td colspan="2" class="total-label">Total Raised</td>
                  <td class="text-right monospace total-amount">
                    {formatCurrency(
                      teamSpecificFunds.reduce(
                        (sum, f) => sum + (Number(f.Amount) || 0),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          {/if}
        </div>
      </div>
    </div>
  </div>
{:else if activeTab === "master"}
  <section class="fade-in">
    <div
      class="section-title"
      style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;"
    >
      <span>Finance History ({teamMasterTransactions.length})</span>
    </div>

    <div class="card orders-card" style="padding:0;overflow:hidden; width:100%">
      {#if dataService.loading && !teamMasterTransactions.length}
        <LoadingIndicator text="Loading ledger..." />
      {:else if teamMasterTransactions.length === 0}
        <div class="empty-state">
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
              ><path
                d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"
              /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path
                d="M12 17.5v-11"
              /></svg
            >
          </div>
          No transactions found.
        </div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source / Item</th>
                <th>Type</th>
                <th>Category</th>
                <th>Team</th>
                <th>Status</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {#each teamMasterTransactions as tx (tx.id + tx.type)}
                <tr class="fade-in">
                  <td
                    class="text-dim monospace"
                    style="color: var(--text-dim);">{tx.date}</td
                  >
                  <td style="font-weight:600; color: #fff;"
                    >{tx.source || "—"}</td
                  >
                  <td>
                    <span
                      class="badge {tx.type === 'Income'
                        ? 'badge-awarded'
                        : 'badge-rejected'}"
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td>{tx.category || "—"}</td>
                  <td>{tx.team || "—"}</td>
                  <td><span class="badge badge-{(tx.status||'').toLowerCase().replace(' ','-')}">{tx.status}</span></td>
                  <td
                    class="text-right monospace"
                    style="font-weight:700; color: {tx.amount > 0
                      ? 'var(--status-awarded)'
                      : 'var(--status-rejected)'}"
                  >
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot class="total-row">
              <tr>
                <td colspan="6" class="total-label">Net Balance</td>
                <td class="text-right monospace total-amount">
                  {formatCurrency(masterNetBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      {/if}
    </div>
  </section>
{/if}

<!-- Mobile tab FAB removed — tabs-container is now shown on mobile -->


<style>
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .team-selector {
    width: 180px;
  }
  @media (max-width: 768px) {
    .header-right { gap: 12px; }
    .team-selector { width: 175px; }
    .btn { height: 42px; line-height: 1; display: inline-flex; align-items: center; }
    .refresh-btn { width: 42px; padding: 0; justify-content: center; flex-shrink: 0; }
  }
  @media (max-width: 400px) {
    .team-selector { width: 165px; }
  }
  
  .tabs-container {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
    margin-top: 8px;
  }

  /* ── Tabs ──────────────────────────────────────────────────────────────────── */
  .segmented-control {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--surface-2);
    padding: 4px;
    border-radius: 99px;
    border: 1px solid var(--border);
    position: relative;
    gap: 0;
  }
  .segment-highlight {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / 3);
    background: var(--surface);
    border-radius: 99px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
  }
  .segment {
    position: relative;
    z-index: 2;
    background: transparent;
    border: none;
    padding: 8px 18px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
    border-radius: 99px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .segment:hover {
    color: var(--text);
  }
  .segment.active {
    color: var(--primary);
  }

  /* ── Overview ─────────────────────────────────────────────────────────────── */
  .stat-value {
    font-size: 1.7rem;
    font-weight: 700;
    margin: 4px 0;
  }

  .type-breakdown {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }
  .breakdown-row {
    flex: 1;
    min-width: 140px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .breakdown-meta {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .breakdown-label {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .breakdown-amount {
    font-size: 0.85rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .breakdown-bar-track {
    grid-column: 1;
    height: 5px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
  }
  .breakdown-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease;
  }
  .breakdown-pct {
    grid-column: 2;
    font-size: 0.75rem;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }
  .sortable:hover {
    background: var(--surface-2);
  }

  .budget-card {
    padding: 20px 24px;
    width: 100%;
    max-width: 420px;
    min-height: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--border); /* Default muted border */
  }
  .budget-card.selected {
    border-color: var(--border-bright) !important;
    box-shadow: var(--shadow-md);
  }

  /* Wide card for single team view */
  .is-single .budget-card {
    width: 450px;
    max-width: none;
    padding: 26px 30px;
    height: auto;
  }
  .budget-team-name {
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .budget-final {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 16px;
  }
  .budget-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .budget-detail-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }
  .budget-bar-track {
    height: 6px;
    background: var(--surface-2);
    border-radius: 99px;
    overflow: hidden;
  }
  .budget-bar-fill {
    height: 100%;
    transition: width 0.6s ease;
  }

  .date-chip {
    background: var(--surface-2);
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid var(--border);
  }

  /* ── Enhanced Budget View Styles ────────────────────── */
  .budget-overview-container {
    display: flex;
    flex-direction: column;
    gap: 32px;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .budget-overview-container.is-single {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 32px;
    max-width: 1100px;
    margin: 0 auto;
  }

  .budget-single-view:not(.is-grid) {
    display: flex;
    justify-content: center;
    width: auto;
    min-width: 0;
  }

  /* ── Westwood Overall Table ────────────────────────────────────────── */
  .overall-summary {
    width: 100%;
    margin-bottom: 8px;
  }

  .overall-table {
    font-size: 0.875rem;
  }

  .overall-row td {
    padding: 14px 16px;
    vertical-align: middle;
  }

  .overall-team-name {
    font-weight: 700;
    color: var(--primary);
    font-size: 0.9rem;
  }

  .overall-balance {
    font-weight: 700;
    font-size: 0.95rem;
  }

  .overall-bar-track {
    height: 5px;
    background: var(--surface-2);
    border-radius: 99px;
    overflow: hidden;
    min-width: 60px;
  }

  .overall-bar-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 99px;
    transition: width 0.5s ease;
  }

  @media (max-width: 950px) {
    .budget-overview-container.is-single {
      flex-direction: column;
      gap: 32px;
      align-items: stretch;
    }
    .is-single .budget-card {
      width: 100% !important;
      max-width: none !important;
    }
    .breakdown-card {
      width: 100% !important;
      height: 225px !important;
    }
  }

  @media (max-width: 768px) {
    .budget-overview-container.is-single {
      gap: 20px;
    }
    .budget-card {
      min-height: unset !important;
    }
    .breakdown-card {
      height: 190px !important;
    }
    /* Show tabs on mobile — make them scrollable and compact */
    .tabs-container {
      margin-bottom: 20px;
    }
    .segmented-control {
      width: 100%;
    }
    .segment {
      font-size: 0.8rem;
      padding: 7px 14px;
    }
  }

  .breakdown-card {
    flex: none;
    min-height: 240px;
    height: auto;
    width: 295px;
    flex-shrink: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    position: relative;
  }
  @media (max-width: 768px) {
    .refresh-btn { aspect-ratio: 1/1; width: 42px; padding: 0 !important; display: inline-flex; align-items: center; justify-content: center; flex: none !important; }
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
    width: 180px;
  }
</style>
