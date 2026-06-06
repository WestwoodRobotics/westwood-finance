<script lang="ts">
  import { onMount } from 'svelte';
  import { Check, Info, Grid2x2 } from '@lucide/svelte';
  import OrderModal from './OrderModal.svelte';
  import FundModal from './FundModal.svelte';
  import GroupModal from './GroupModal.svelte';
  import AddFundsForm from './AddFundsForm.svelte';
  import AddExpenseForm from './AddExpenseForm.svelte';
  import MembersView from './MembersView.svelte';
  import HistoryTab from './HistoryTab.svelte';
  import OrdersTab from './OrdersTab.svelte';
  import MasterTab from './MasterTab.svelte';
  import FundingTab from './FundingTab.svelte';
  import { generateShortId } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';
  import { authStore } from '$lib/authStore.svelte.js';
  import { perms } from '$lib/perms.js';
  import { api } from '$lib/api.js';
  import { goto } from '$app/navigation';
  import type { Order, Fund } from '$lib/types.js';

  $effect(() => {
    if (authStore.initialized && !perms.admin) goto('/');
  });

  let activeView = $state('orderHistory');
  let syncing = $state(false);
  let actionMsg = $state('');
  let actionErr = $state('');
  let undoFn = $state<(() => void) | null>(null);

  let editingOrder = $state<Order | null>(null);
  let editingFund = $state<Fund | null>(null);
  let editingGroupOrders = $state<Order[] | null>(null);

  let isMobile = $state(false);
  let showTabMenu = $state(false);

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
        api.post({ action: 'updateOrderStatus', id: o.id, rowIndex: String(o.rowIndex), orderUUID: targetUUID })
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

  onMount(() => {
    if (authStore.isApproved && authStore.hasValidSession) dataService.load();
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
    <HistoryTab {syncing} onmanage={(o) => (editingOrder = o)} />
  {:else if activeView === 'orders'}
    <OrdersTab {syncing} onmanage={(o) => (editingOrder = o)} onlinkgroup={linkGroupOrders} oneditgroup={(orders) => (editingGroupOrders = orders)} />
  {:else if activeView === 'master'}
    <MasterTab {syncing} />
  {:else if activeView === 'funding'}
    <FundingTab {syncing} oneditfund={(f) => (editingFund = f)} />
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
    <button class="tab-fab-backdrop" onclick={() => (showTabMenu = false)} aria-label="Close menu"></button>
    <div class="tab-fab-menu">
      {#each [['orderHistory','Order History'],['orders','Orders'],['master','Finance History'],['funding','Funding'],['add','Add Funds +'],['addOrder','Add Expense +'],['members','Members']] as [key, label]}
        <button class="tab-fab-option" class:active={activeView === key} onclick={() => { activeView = key; showTabMenu = false; }}>{label}</button>
      {/each}
    </div>
  {/if}
  <button class="page-fab" onclick={() => (showTabMenu = !showTabMenu)} aria-label={`Admin view: ${[['orderHistory','Order History'],['orders','Orders'],['master','Finance History'],['funding','Funding'],['add','Add Funds +'],['addOrder','Add Expense +'],['members','Members']].find(([k]) => k === activeView)?.[1] ?? activeView}. Switch view`}>
    <Grid2x2 size={20} />
  </button>
{/if}

{#if editingOrder}
  {#key editingOrder.id}
    <OrderModal
      order={editingOrder}
      onclose={() => (editingOrder = null)}
      onsaved={(msg, undo) => { actionMsg = msg; actionErr = ''; undoFn = undo; editingOrder = null; }}
    />
  {/key}
{/if}

{#if editingFund}
  {#key editingFund.id}
    <FundModal
      fund={editingFund}
      onclose={() => (editingFund = null)}
      onsaved={(msg) => { actionMsg = msg; actionErr = ''; editingFund = null; }}
    />
  {/key}
{/if}

{#if editingGroupOrders}
  <GroupModal
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
      border: none;
      padding: 0;
      cursor: default;
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
