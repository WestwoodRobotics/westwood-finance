<script>
  import { CATEGORIES, TEAMS } from '../utils.js';
  import { Search, CircleX, ListFilter } from '@lucide/svelte';
  import CustomDropdown from './CustomDropdown.svelte';
  import IOSBottomSheet from './IOSBottomSheet.svelte';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/authStore.svelte.js';

  const categoryOptions = [
    { label: 'All Categories', value: '' },
    ...CATEGORIES.map(cat => ({ label: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))
  ];

  const teamOptions = [
    { label: 'All Teams', value: '' },
    ...TEAMS.filter(t => t !== 'Westwood Overall').map(team => ({ label: team, value: team }))
  ];

  const statusOptions = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending Review', value: 'Pending Review' },
    { label: 'Approved', value: 'Approved' },
    { label: 'Ordered', value: 'Ordered' },
    { label: 'Received', value: 'Received' },
    { label: 'Denied', value: 'Denied' },
    { label: 'Cancelled', value: 'Cancelled' },
    { label: 'Void', value: 'Void' }
  ];

  /** @type {{ onchange?: (f: any) => void, filters: any }} */
  let { onchange, filters = $bindable() } = $props();

  let isMobile = $state(false);
  let showFilterSheet = $state(false);

  onMount(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    mq.addEventListener('change', e => { isMobile = e.matches; });
  });

  function emit() {
    onchange?.({ ...filters });
  }

  function reset() {
    filters.search = "";
    filters.category = "";
    filters.company = "";
    // Only reset team filter for admins — members stay locked to their team
    if (authStore.isAdmin) filters.team = "";
    filters.status = "";
    filters.dateFrom = "";
    filters.dateTo = "";
    emit();
  }

  let activeFilterCount = $derived(
    [filters.category, filters.company, filters.team, filters.status, filters.dateFrom, filters.dateTo]
      .filter(v => v && v.trim()).length
  );
</script>

<!-- ── Desktop Filter Bar ─────────────────────────────────────────────────── -->
{#if !isMobile}
  <div class="filter-bar fade-in">
    <div class="filter-main">
      <div class="search-input">
        <div class="input-wrapper">
          <Search size={16} class="search-icon" />
          <input
            id="filter-search"
            type="search"
            placeholder="Filter requests, vendors, or notes..."
            bind:value={filters.search}
            oninput={emit}
          />
        </div>
      </div>
      <button class="btn btn-ghost btn-sm reset-button" onclick={reset} title="Reset filters">
         Reset Filters
      </button>
    </div>

    <div class="filter-grid">
      <div class="filter-field">
        <span class="field-label">Category</span>
        <CustomDropdown options={categoryOptions} bind:value={filters.category} onchange={emit} />
      </div>
      <div class="filter-field">
        <span class="field-label">Vendor</span>
        <input id="filter-company" type="text" placeholder="Any vendor" bind:value={filters.company} oninput={emit} />
      </div>
      {#if authStore.isAdmin}
      <div class="filter-field">
        <span class="field-label">Team</span>
        <CustomDropdown options={teamOptions} bind:value={filters.team} onchange={emit} />
      </div>
      {/if}
      <div class="filter-field filter-status">
        <span class="field-label">Status</span>
        <CustomDropdown options={statusOptions} bind:value={filters.status} onchange={emit} />
      </div>
      <div class="filter-field filter-timeline">
        <span class="field-label">Timeline</span>
        <div class="date-range">
          <input type="date" bind:value={filters.dateFrom} onchange={emit} />
          <span class="connector">→</span>
          <input type="date" bind:value={filters.dateTo} onchange={emit} />
        </div>
      </div>
    </div>
  </div>
{:else}
  <!-- ── iOS Mobile Search Bar ─────────────────────────────────────────────── -->
  <div class="ios-filter-row fade-in">
    <div class="ios-search-wrap">
      <Search size={15} class="ios-search-icon" />
      <input
        id="filter-search-mobile"
        type="search"
        placeholder="Search orders..."
        bind:value={filters.search}
        oninput={emit}
        class="ios-search-input"
      />
      {#if filters.search}
        <button class="ios-search-clear" onclick={() => { filters.search = ''; emit(); }} aria-label="Clear search">
          <CircleX size={14} />
        </button>
      {/if}
    </div>

    <button
      class="ios-filter-btn"
      class:ios-filter-active={activeFilterCount > 0}
      onclick={() => showFilterSheet = true}
      aria-label="Open filters"
    >
      <ListFilter size={16} />
      Filters
      {#if activeFilterCount > 0}
        <span class="ios-filter-badge">{activeFilterCount}</span>
      {/if}
    </button>
  </div>

  <!-- iOS Filter Bottom Sheet -->
  <IOSBottomSheet open={showFilterSheet} onclose={() => showFilterSheet = false} title="Filters">
    {#snippet children()}
      <div class="ios-sheet-filters">
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Category</div>
          <select bind:value={filters.category} onchange={emit} class="ios-native-select">
            {#each categoryOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        {#if authStore.isAdmin}
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Team</div>
          <select bind:value={filters.team} onchange={emit} class="ios-native-select">
            {#each teamOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        {/if}
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Status</div>
          <select bind:value={filters.status} onchange={emit} class="ios-native-select">
            {#each statusOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Vendor</div>
          <input type="text" placeholder="Any vendor" bind:value={filters.company} oninput={emit} class="ios-native-input" />
        </div>
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Date From</div>
          <input type="date" bind:value={filters.dateFrom} onchange={emit} class="ios-native-input" />
        </div>
        <div class="ios-sheet-filter-group">
          <div class="ios-sheet-filter-label">Date To</div>
          <input type="date" bind:value={filters.dateTo} onchange={emit} class="ios-native-input" />
        </div>
        <div class="ios-sheet-filter-actions">
          <button class="ios-reset-btn" onclick={() => { reset(); showFilterSheet = false; }}>Reset All Filters</button>
          <button class="ios-apply-btn" onclick={() => showFilterSheet = false}>Show Results</button>
        </div>
      </div>
    {/snippet}
  </IOSBottomSheet>
{/if}

<style>
  /* ── Desktop ────────────────────────────────────────────────────── */
  .filter-bar {
    margin-bottom: 24px;
    padding: 20px;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .filter-main { display: flex; gap: 12px; align-items: center; }
  .search-input { flex: 1; }
  .filter-grid { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
  .filter-field { display: flex; flex-direction: column; gap: 6px; flex: 1 1 160px; min-width: 0; }
  .filter-status { flex: 0 1 140px; }
  .filter-timeline { flex: 2 1 280px; }
  .field-label { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); }
  .input-wrapper { position: relative; display: flex; align-items: center; }
  :global(.search-icon) { position: absolute; left: 14px; color: var(--text-dim); pointer-events: none; }
  .input-wrapper input { padding-left: 40px; height: 44px; background: var(--surface-2); border-radius: var(--radius-sm); font-size: 0.9rem; }
  .date-range { display: flex; align-items: center; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm); height: 44px; overflow: hidden; }
  .date-range:focus-within { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.2); }
  .date-range input { background: transparent; border: none; padding: 0 12px; font-size: 0.85rem; flex: 1; width: 0; min-width: 0; height: 100%; color: #fff; cursor: pointer; text-align: center; }
  .date-range input:focus { background: rgba(255,255,255,0.03); outline: none; }
  .connector { color: var(--text-dim); font-size: 0.8rem; }
  .reset-button { height: 44px; padding: 0 16px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600; white-space: nowrap; }

  /* ── iOS Mobile ─────────────────────────────────────────────────── */
  .ios-filter-row { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; margin-top: 8px; }
  .ios-search-wrap { flex: 1; position: relative; display: flex; align-items: center; background: rgba(118, 118, 128, 0.18); border-radius: 10px; overflow: hidden; }
  :global(.ios-search-icon) { position: absolute; left: 10px; color: var(--text-dim); pointer-events: none; flex-shrink: 0; }
  .ios-search-input { flex: 1; background: transparent; border: none; outline: none; padding: 10px 36px 10px 34px; font-size: 16px; color: #fff; font-family: -apple-system, 'SF Pro Text', sans-serif; min-height: 38px; -webkit-appearance: none; appearance: none; }
  .ios-search-input::placeholder { color: var(--text-dim); }
  .ios-search-clear { position: absolute; right: 8px; background: var(--surface-3); border: none; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); -webkit-tap-highlight-color: transparent; padding: 0; }
  .ios-filter-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: rgba(118, 118, 128, 0.18); border: none; border-radius: 10px; color: var(--text-muted); font-size: 14px; font-weight: 600; font-family: -apple-system, 'SF Pro Text', sans-serif; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: background 0.15s; min-height: 38px; }
  .ios-filter-btn:active { background: rgba(118, 118, 128, 0.3); }
  .ios-filter-active { background: rgba(249, 115, 22, 0.15) !important; color: var(--primary); }
  .ios-filter-badge { background: var(--primary); color: #fff; font-size: 11px; font-weight: 700; border-radius: 99px; padding: 1px 6px; min-width: 18px; text-align: center; line-height: 16px; }

  /* ── Sheet Content ──────────────────────────────────────────────── */
  .ios-sheet-filters { padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 16px; }
  .ios-sheet-filter-group { display: flex; flex-direction: column; gap: 6px; }
  .ios-sheet-filter-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.07em; font-family: -apple-system, 'SF Pro Text', sans-serif; }
  .ios-native-select, .ios-native-input { width: 100%; background: rgba(118, 118, 128, 0.18); border: none; border-radius: 10px; color: #fff; font-size: 16px; font-family: -apple-system, 'SF Pro Text', sans-serif; padding: 12px 14px; -webkit-appearance: none; appearance: none; outline: none; min-height: 44px; }
  .ios-native-select option { background: var(--surface-2); }
  .ios-sheet-filter-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .ios-apply-btn { background: var(--primary); color: #fff; border: none; border-radius: 12px; font-size: 17px; font-weight: 600; padding: 14px; cursor: pointer; font-family: -apple-system, 'SF Pro Text', sans-serif; -webkit-tap-highlight-color: transparent; transition: opacity 0.15s; }
  .ios-apply-btn:active { opacity: 0.8; }
  .ios-reset-btn { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; padding: 12px; cursor: pointer; font-family: -apple-system, 'SF Pro Text', sans-serif; -webkit-tap-highlight-color: transparent; transition: opacity 0.15s; }
  .ios-reset-btn:active { opacity: 0.7; }
</style>
