<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Info, Grid2x2, Package, DollarSign, Receipt } from '@lucide/svelte';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import OrderTable from '$lib/components/OrderTable.svelte';
  import OrderEditModal from '$lib/components/admin/OrderEditModal.svelte';
  import FundEditModal from '$lib/components/admin/FundEditModal.svelte';
  import GroupStatusModal from '$lib/components/admin/GroupStatusModal.svelte';
  import AddFundsForm from '$lib/components/admin/AddFundsForm.svelte';
  import AddExpenseForm from '$lib/components/admin/AddExpenseForm.svelte';
  import MembersView from '$lib/components/admin/MembersView.svelte';
  import { formatCurrency, formatFullDate, capitalize, truncate, generateShortId } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';
  import { authStore } from '$lib/authStore.svelte.js';
  import { perms } from '$lib/perms.js';
  import { BASE_URL } from '$lib/config.js';
  import { goto } from '$app/navigation';
  import type { Order, Fund } from '$lib/types.js';

  $effect(() => {
    if (authStore.initialized && !perms.admin) goto('/');
  });

  const ORDER_STATUSES = ['Pending Review', 'Approved', 'Ordered', 'Received', 'Denied', 'Cancelled', 'Void'];
  const STATUS_PRIORITY: Record<string, number> = { 'pending review': 0, approved: 1, ordered: 2, received: 3, denied: 4, cancelled: 5, void: 6 };
  const TYPE_COLORS: Record<string, string> = { Fundraiser: 'var(--primary)', Grant: '#b97cf3', Dues: '#4e9af1', Sponsor: '#6bcb77', Other: '#f1a94e' };

  let activeView = $state('orderHistory');
  let syncing = $state(false);
  let actionMsg = $state('');
  let actionErr = $state('');
  let undoFn = $state<(() => void) | null>(null);

  let editingOrder = $state<Order | null>(null);
  let editingFund = $state<Fund | null>(null);
  let editingGroupOrders = $state<Order[] | null>(null);

  let adminSortCol = $state('status');
  let adminSortDir = $state('asc');
  let isMobile = $state(false);
  let showTabMenu = $state(false);

  let sortedAdminOrders = $derived.by(() =>
    dataService.orders.slice().sort((a, b) => {
      if (adminSortCol === 'status') {
        const pA = STATUS_PRIORITY[(a.status || '').toLowerCase().trim()] ?? 99;
        const pB = STATUS_PRIORITY[(b.status || '').toLowerCase().trim()] ?? 99;
        const diff = adminSortDir === 'asc' ? pA - pB : pB - pA;
        if (diff !== 0) return diff;
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      }
      if (adminSortCol === 'timestamp') {
        const tA = new Date(a.timestamp || 0).getTime();
        const tB = new Date(b.timestamp || 0).getTime();
        return adminSortDir === 'asc' ? tA - tB : tB - tA;
      }
      if (adminSortCol === 'total') {
        return adminSortDir === 'asc' ? (a.total || 0) - (b.total || 0) : (b.total || 0) - (a.total || 0);
      }
      const valA = String((a as Record<string, unknown>)[adminSortCol] || '').toLowerCase();
      const valB = String((b as Record<string, unknown>)[adminSortCol] || '').toLowerCase();
      return adminSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    })
  );

  let newTabOrders = $derived(
    dataService.orders.filter(o => !['received', 'void', 'denied', 'ordered'].includes((o.status || '').toLowerCase().trim()))
  );

  let groupedCompanyOrders = $derived.by(() => {
    const groups: Record<string, Order[]> = {};
    newTabOrders.slice()
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
      .forEach(o => {
        const comp = o.company?.trim() || 'General Items';
        if (!groups[comp]) groups[comp] = [];
        groups[comp].push(o);
      });
    return groups;
  });

  let masterTransactions = $derived.by(() => {
    const arr: { id: string; type: string; source: string | undefined; category: string | undefined; team: string | undefined; date: string; amount: number; status: string }[] = [];
    dataService.orders.filter(o => { const s = o.status?.toLowerCase().trim(); return s === 'received' || s === 'ordered'; })
      .forEach(e => arr.push({ id: e.id, type: 'Expense', source: e.company || e.item, category: e.category, team: e.team, date: e.timestamp?.slice(0, 10) || '—', amount: -e.total, status: e.status }));
    dataService.funds
      .forEach(f => arr.push({ id: f.id, type: 'Income', source: String(f.Source), category: String(f.Type), team: String(f.Recipient), date: String(f.Date || '—'), amount: Number(f.Amount) || 0, status: 'Received' }));
    arr.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    return arr;
  });

  function toggleAdminSort(col: string) {
    if (adminSortCol === col) { adminSortDir = adminSortDir === 'asc' ? 'desc' : 'asc'; }
    else { adminSortCol = col; adminSortDir = col === 'timestamp' || col === 'total' ? 'desc' : 'asc'; }
  }

  function getOrderColor(uuid: string | undefined): string {
    if (!uuid) return 'var(--border)';
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 65%, 45%)`;
  }

  function openExternal(url: string) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  async function sync() {
    syncing = true;
    await dataService.load(true);
    syncing = false;
  }

  async function linkGroupOrders(orders: Order[]) {
    if (orders.length < 2) return;
    syncing = true;
    actionMsg = `Linking ${orders.length} orders...`;
    const targetUUID = orders.find(o => o.orderUUID)?.orderUUID || generateShortId();
    try {
      const results = await Promise.all(orders.map(o =>
        fetch(BASE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ idToken: authStore.idToken, action: 'updateOrderStatus', id: o.id, rowIndex: String(o.rowIndex), orderUUID: targetUUID }) })
          .then(r => r.text()).then(JSON.parse)
      ));
      if (results.some((r: { error?: string }) => r.error)) throw new Error('Batch link failed');
      actionMsg = `✓ Linked into Order #${targetUUID}`;
      orders.forEach(o => dataService.updateOrderOptimistic(o.id, { orderUUID: targetUUID }));
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Error linking orders';
    } finally {
      syncing = false;
    }
  }

  function exportMasterCSV() {
    if (!masterTransactions.length) return;
    const headers = ['Date', 'Type', 'Source/Item', 'Category', 'Team', 'Status', 'Amount'];
    const rows = masterTransactions.map(row =>
      [row.date, row.type, row.source, row.category, row.team, row.status, row.amount]
        .map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `westwood_finance_master_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onMount(() => {
    dataService.load();
    const mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    mq.addEventListener('change', e => { isMobile = e.matches; });
    const view = new URLSearchParams(window.location.search).get('view');
    const validViews = ['orderHistory', 'orders', 'master', 'funding', 'add', 'addOrder', 'members'];
    if (view && validViews.includes(view)) activeView = view;
    if (!perms.admin) goto('/');
  });
</script>

<svelte:head>
  <title>Admin Dashboard | Westwood Finance</title>
</svelte:head>

{#if !perms.admin}
  <div class="admin-auth-container">
    <h2 style="color: #fff; margin-bottom: 12px;">Access Denied</h2>
    <p style="color: var(--text-muted); margin-bottom: 24px;">You need admin privileges to access this page.</p>
    <a href="/" class="btn btn-primary">Back to Dashboard</a>
  </div>
{:else}
  <div class="page-header">
    <div class="header-left">
      <h1>Admin <span>Portal</span></h1>
    </div>
    <div class="header-right">
      <button class="btn btn-ghost btn-sm refresh-btn" onclick={sync} disabled={syncing}>
        <span class:spinning={syncing}>↻</span>
        <span class="hide-mobile">{syncing ? 'Syncing...' : 'Refresh'}</span>
      </button>
    </div>
  </div>

  <div class="tabs-wrapper" style="margin-bottom: 32px;">
    <div class="segmented-control" style="width: auto; min-width: 750px; margin: 0 auto; grid-template-columns: repeat(7, 1fr);">
      <div class="segment-highlight" style="transform: translateX(calc({['orderHistory','orders','master','funding','add','addOrder','members'].indexOf(activeView)} * 100%)); width: calc((100% - 8px) / 7);"></div>
      {#each [['orderHistory','Order History'],['orders','Orders'],['master','Finance History'],['funding','Funding'],['add','Add Funds +'],['addOrder','Add Expense +'],['members','Members']] as [key, label]}
        <button class="segment" class:active={activeView === key} onclick={() => (activeView = key)}>{label}</button>
      {/each}
    </div>
  </div>

  {#if actionMsg}
    <div class="message-bar success-bar" style="justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 12px;"><Check size={16} />{actionMsg}</div>
      {#if undoFn}
        <button class="btn btn-ghost btn-sm" onclick={() => { undoFn?.(); undoFn = null; actionMsg = 'Action undone.'; }}>Undo</button>
      {/if}
    </div>
  {/if}
  {#if actionErr}
    <div class="message-bar error-bar"><Info size={16} />{actionErr}</div>
  {/if}

  {#if activeView === 'orderHistory'}
    <section class="fade-in">
      <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Order History ({dataService.orders.length})</span>
      </div>
      <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">Manage order statuses, UUIDs, and tracking links. Updates sync directly to Google Sheets.</p>
      <div class="card orders-card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !dataService.orders.length}
          <LoadingIndicator text="Loading admin backlog..." />
        {:else if dataService.orders.length === 0}
          <div class="empty-state fade-in">
            <div class="icon"><Package size={48} stroke-width={1} /></div>
            <h3>No requests on file</h3>
            <p>New requests will appear here for admin action.</p>
          </div>
        {:else}
          <div class="table-wrap" style="border: none; border-radius: 0;">
            <table>
              <thead>
                <tr>
                  <th class="sortable" style="padding-left: 24px;" onclick={() => toggleAdminSort('item')}>
                    <div class="th-content">Provision/Item {adminSortCol === 'item' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('category')}>
                    <div class="th-content">Category {adminSortCol === 'category' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('team')}>
                    <div class="th-content">Team {adminSortCol === 'team' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('timestamp')}>
                    <div class="th-content">Date {adminSortCol === 'timestamp' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable text-right" onclick={() => toggleAdminSort('total')}>
                    <div class="th-content text-right">Investment {adminSortCol === 'total' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('status')}>
                    <div class="th-content">Status {adminSortCol === 'status' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="text-right" style="padding-right: 24px;"></th>
                </tr>
              </thead>
              <tbody>
                {#each sortedAdminOrders as order (order.id)}
                  <tr class="fade-in group-row" style="--group-color: {getOrderColor(order.orderUUID)}">
                    <td style="padding-left: 24px;">
                      <div class="item-primary">
                        {#if order.link}
                          <button type="button" class="admin-link-btn" onclick={() => openExternal(order.link)}>
                            {order.item} ↗
                          </button>
                        {:else}
                          {order.item}
                        {/if}
                      </div>
                      {#if order.company || order.notes}
                        <div class="item-secondary">{order.company || ''}{order.notes ? ` · ${order.notes}` : ''}</div>
                      {/if}
                    </td>
                    <td><span class="badge badge-{(order.category || '').toLowerCase()}">{capitalize(order.category) || '—'}</span></td>
                    <td>{order.team || '—'}</td>
                    <td class="text-dim">{formatFullDate(order.timestamp)}</td>
                    <td class="text-right monospace amount">{formatCurrency(order.total)}</td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td class="text-right" style="padding-right: 24px;">
                      <button class="btn btn-primary btn-sm" onclick={() => (editingOrder = order)}>Manage</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>

  {:else if activeView === 'orders'}
    <section class="fade-in">
      <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Pending Orders by Vendor ({newTabOrders.length})</span>
      </div>
      {#if Object.keys(groupedCompanyOrders).length === 0}
        <div class="card empty-state fade-in" style="margin-bottom: 24px;">
          <div class="icon"><Package size={48} stroke-width={1.2} /></div>
          <h3>All caught up</h3>
          <p>There are no active orders to display.</p>
        </div>
      {:else}
        {#each Object.entries(groupedCompanyOrders) as [company, compOrders]}
          <div style="margin-bottom: 32px;" class="fade-in">
            <h3 style="margin-bottom: 12px; color: var(--primary); font-size: 1.25rem;">
              {company}
              <span class="badge badge-hardware" style="margin-left: 10px; padding: 4px 10px; font-weight: 600; vertical-align: middle;">Quantity: {compOrders.length}</span>
              {#if compOrders.length > 1}
                <button class="badge badge-hardware admin-action-tag" onclick={() => linkGroupOrders(compOrders)} disabled={syncing}>Merge Group</button>
              {/if}
              <button class="badge badge-hardware admin-action-tag" onclick={() => (editingGroupOrders = compOrders)} disabled={syncing}>Change All Status</button>
            </h3>
            <OrderTable orders={compOrders} hideCategoryColumn={true} hideCompanyColumn={true} onmanage={(o: Order) => (editingOrder = o)} />
          </div>
        {/each}
      {/if}
    </section>

  {:else if activeView === 'master'}
    <section class="fade-in">
      <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <span>Master Finance History ({masterTransactions.length})</span>
        <button class="btn btn-ghost btn-sm" onclick={exportMasterCSV} disabled={!masterTransactions.length}>↓ Export CSV</button>
      </div>
      <div class="card orders-card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !masterTransactions.length}
          <LoadingIndicator text="Loading ledger..." />
        {:else if masterTransactions.length === 0}
          <div class="empty-state"><div class="icon"><Receipt size={48} stroke-width={1} /></div>No transactions found.</div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Source / Item</th><th>Type</th><th>Category</th><th>Team</th><th>Status</th><th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each masterTransactions as tx (tx.id + tx.type)}
                  <tr class="fade-in">
                    <td class="text-dim monospace">{tx.date}</td>
                    <td style="font-weight:600; color:#fff">{tx.source || '—'}</td>
                    <td><span class="badge {tx.type === 'Income' ? 'badge-awarded' : 'badge-rejected'}">{tx.type}</span></td>
                    <td>{capitalize(tx.category ?? '') || '—'}</td>
                    <td>{tx.team || '—'}</td>
                    <td><OrderStatusBadge status={tx.status} /></td>
                    <td class="text-right monospace" style="font-weight:700; color:{tx.amount > 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>

  {:else if activeView === 'funding'}
    <section class="fade-in">
      <div class="section-title" style="margin-bottom:12px">Manage Funding & Grants ({dataService.funds.length})</div>
      <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">Edit funding sources, amounts, and recipients. These changes sync to the Fundraising sheet.</p>
      <div class="card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !dataService.funds.length}
          <LoadingIndicator text="Loading funds..." />
        {:else if dataService.funds.length === 0}
          <div class="empty-state"><div class="icon"><DollarSign size={48} stroke-width={1} /></div>No funding entries found.</div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th><th>Source</th><th>Team</th><th>Date</th><th class="text-right">Amount</th><th>Notes</th><th></th>
                </tr>
              </thead>
              <tbody>
                {#each dataService.funds as fund (fund.id)}
                  <tr class="fade-in">
                    <td><span class="type-tag" style="border-left: 2px solid {TYPE_COLORS[String(fund.Type)] || '#ccc'}; padding-left: 8px;">{fund.Type || '—'}</span></td>
                    <td style="font-weight:500">{fund.Source || '—'}</td>
                    <td>{fund.Recipient || '—'}</td>
                    <td class="text-dim" style="font-size:0.875rem">{formatFullDate(String(fund.Date))}</td>
                    <td class="text-right monospace" style="font-weight:600;color:#6bcb77">{formatCurrency(fund.Amount)}</td>
                    <td class="text-muted" style="font-size:0.8rem">{fund.Notes || '—'}</td>
                    <td><button class="btn btn-primary btn-sm" onclick={() => (editingFund = fund)}>Manage</button></td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid var(--border);">
                  <td colspan={4} style="font-weight:700; text-align:right; color:var(--text-muted); text-transform:uppercase; font-size:0.75rem; letter-spacing:0.05em; padding:12px 16px;">Total Funding</td>
                  <td class="text-right monospace" style="color:#6bcb77; font-weight:700; font-size:1rem; padding:12px 16px;">
                    {formatCurrency(dataService.funds.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0))}
                  </td>
                  <td colspan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </div>
    </section>

  {:else if activeView === 'add'}
    <AddFundsForm />

  {:else if activeView === 'addOrder'}
    <AddExpenseForm />

  {:else if activeView === 'members'}
    <MembersView />
  {/if}
{/if}

{#if perms.admin && isMobile}
  {#if showTabMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div class="tab-fab-backdrop" onclick={() => (showTabMenu = false)} role="button" tabindex="-1"></div>
    <div class="tab-fab-menu">
      {#each [['orderHistory','Order History'],['orders','Orders'],['master','Finance History'],['funding','Funding'],['add','Add Funds +'],['addOrder','Add Expense +'],['members','Members']] as [key, label]}
        <button class="tab-fab-option" class:active={activeView === key} onclick={() => { activeView = key; showTabMenu = false; }}>{label}</button>
      {/each}
    </div>
  {/if}
  <button class="page-fab" onclick={() => (showTabMenu = !showTabMenu)} aria-label="Switch admin view">
    <Grid2x2 size={20} />
  </button>
{/if}

{#if editingOrder}
  {#key editingOrder.id}
    <OrderEditModal
      order={editingOrder}
      onclose={() => (editingOrder = null)}
      onsaved={(msg, undo) => { actionMsg = msg; actionErr = ''; undoFn = undo; editingOrder = null; }}
    />
  {/key}
{/if}

{#if editingFund}
  {#key editingFund.id}
    <FundEditModal
      fund={editingFund}
      onclose={() => (editingFund = null)}
      onsaved={(msg) => { actionMsg = msg; actionErr = ''; editingFund = null; }}
    />
  {/key}
{/if}

{#if editingGroupOrders}
  <GroupStatusModal
    orders={editingGroupOrders}
    onclose={() => (editingGroupOrders = null)}
    onsaved={(msg, undo) => { actionMsg = msg; actionErr = ''; undoFn = undo; editingGroupOrders = null; }}
  />
{/if}

<style>
  .admin-auth-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 130px);
    width: 100%;
    text-align: center;
    padding-top: env(safe-area-inset-top);
  }

  .item-primary { font-weight: 700; color: #fff; font-size: 0.9rem; }
  .item-secondary { font-size: 0.75rem; color: var(--text-dim); margin-top: 2px; }
  .amount { font-weight: 700; color: #fff; }

  :global(.admin-action-tag) {
    margin-left: 12px;
    font-size: 0.7rem;
    padding: 4px 10px;
    border: 1px solid var(--border-bright) !important;
    font-weight: 600;
    border-radius: 6px;
    line-height: 1;
    vertical-align: middle;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    background: var(--surface-2);
    transition: all 0.2s;
  }
  :global(.admin-action-tag:hover) { background: var(--surface-3); border-color: var(--primary) !important; }

  @media (max-width: 768px) {
    .tabs-wrapper { display: none; }
    .tab-fab-backdrop {
      position: fixed;
      inset: 0;
      z-index: 599;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(2px);
    }
    .tab-fab-menu {
      position: fixed;
      bottom: calc(var(--ios-tab-height, 49px) + env(safe-area-inset-bottom, 0px) + 84px);
      right: 20px;
      z-index: 601;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
      min-width: 200px;
      animation: tabMenuIn 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes tabMenuIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tab-fab-option {
      display: block;
      width: 100%;
      padding: 14px 20px;
      background: none;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.875rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-fab-option:last-child { border-bottom: none; }
    .tab-fab-option:hover { background: var(--surface-2); color: var(--text); }
    .tab-fab-option.active { color: var(--primary); background: var(--primary-glow); }
    .page-fab {
      position: fixed;
      bottom: calc(var(--ios-tab-height, 49px) + env(safe-area-inset-bottom, 0px) + 20px);
      right: 20px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--surface-3);
      color: var(--text);
      border: 1px solid var(--border);
      cursor: pointer;
      z-index: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      transition: all 0.2s;
    }
    .page-fab:hover { transform: scale(1.06); }
    .refresh-btn { aspect-ratio: 1/1; width: 42px; padding: 0 !important; justify-content: center; }
  }
</style>
