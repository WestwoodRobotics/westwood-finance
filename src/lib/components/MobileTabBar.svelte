<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { perms } from '$lib/perms.js';
  import { isMobile } from '$lib/mediaQuery.svelte.js';
  import { LayoutDashboard, ShoppingBag, Plus, Users, MoreHorizontal, BarChart3, User, ChevronRight } from '@lucide/svelte';

  let showMoreSheet = $state(false);

  const mainTabs = [
    { href: '/',       label: 'Dashboard', icon: LayoutDashboard },
    { href: '/orders', label: 'All Orders', icon: ShoppingBag },
    { href: '/add',    label: 'Submit', icon: Plus, center: true },
    { href: '/funding',label: 'Team', icon: Users },
    { href: '#more',   label: 'More', isMore: true, icon: MoreHorizontal },
  ];

  const allMoreItems = [
    { href: '/stats', label: 'Analytics', subtitle: 'Spending trends & charts', icon: BarChart3, color: '#3b82f6' },
    { href: '/admin', label: 'Admin Portal', subtitle: 'Manage orders & funding', icon: User, color: '#f97316', adminOnly: true },
  ];

  let moreItems = $derived(
    allMoreItems.filter(item => !item.adminOnly || perms.admin)
  );

  function isActive(href) {
    if (href === '#more') {
      const p = $page.url.pathname;
      return p.startsWith('/stats') || p.startsWith('/admin');
    }
    const current = $page.url.pathname.replace(/\/$/, '') || '/';
    const target = href.replace(/\/$/, '') || '/';
    return current === target;
  }

  function haptic(duration = 8) {
    if ('vibrate' in navigator) navigator.vibrate(duration);
  }

  function handleTabClick(tab) {
    haptic();
    if (tab.isMore) {
      showMoreSheet = !showMoreSheet;
      return;
    }
    showMoreSheet = false;
    goto(tab.href);
  }

  function handleMoreItemClick(href) {
    haptic();
    showMoreSheet = false;
    goto(href);
  }

  function closeSheet() {
    showMoreSheet = false;
  }

  // Drag-to-dismiss
  let dragStartY = 0;
  let sheetEl = ($state(null));

  function onSheetTouchStart(e) {
    dragStartY = e.touches[0].clientY;
  }

  function onSheetTouchEnd(e) {
    const delta = e.changedTouches[0].clientY - dragStartY;
    if (delta > 60) closeSheet();
  }
</script>

{#if isMobile.current}
  <!-- More Sheet Backdrop -->
  {#if showMoreSheet}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div class="sheet-backdrop" onclick={closeSheet} role="button" tabindex="-1"></div>

    <!-- More Sheet -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="more-sheet"
      bind:this={sheetEl}
      ontouchstart={onSheetTouchStart}
      ontouchend={onSheetTouchEnd}
    >
      <div class="sheet-handle"></div>
      <div class="sheet-title">More</div>
      <div class="sheet-items">
        {#each moreItems as item}
          {@const SheetIcon = item.icon}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="sheet-item"
            class:sheet-item-active={isActive(item.href)}
            onclick={() => handleMoreItemClick(item.href)}
          >
            <div class="sheet-item-icon" style="background: {item.color}20; color: {item.color}">
              <SheetIcon size={22} />
            </div>
            <div class="sheet-item-text">
              <div class="sheet-item-label">{item.label}</div>
              <div class="sheet-item-subtitle">{item.subtitle}</div>
            </div>
            <ChevronRight size={16} class="sheet-chevron" />
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- iOS Tab Bar -->
  <nav class="ios-tab-bar" aria-label="Main navigation">
    {#each mainTabs as tab}
      {@const TabIcon = tab.icon}
      <button
        class="ios-tab"
        class:ios-tab-active={isActive(tab.href)}
        class:ios-tab-center={tab.center}
        onclick={() => handleTabClick(tab)}
        aria-label={tab.label}
        aria-current={isActive(tab.href) ? 'page' : undefined}
      >
        {#if tab.center}
          <div class="ios-tab-center-pill">
            <TabIcon size={26} />
          </div>
        {:else}
          <div class="ios-tab-icon">
            <TabIcon size={24} />
          </div>
          <span class="ios-tab-label">{tab.label}</span>
        {/if}
      </button>
    {/each}
  </nav>
{/if}

<style>
  /* ── iOS Tab Bar ───────────────────────────────────────────────── */
  .ios-tab-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(49px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    display: flex;
    align-items: flex-start;
    justify-content: space-around;
    background: rgba(18, 18, 20, 0.85);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 0.5px solid rgba(255, 255, 255, 0.1);
    z-index: 500;
    padding-top: 6px;
  }

  .ios-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 4px;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s;
    min-height: 43px;
  }

  .ios-tab:active {
    opacity: 0.6;
  }

  .ios-tab-icon {
    color: var(--text-dim);
    transition: color 0.2s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ios-tab-active .ios-tab-icon {
    color: var(--primary);
    transform: scale(1.05);
  }

  .ios-tab-label {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-dim);
    letter-spacing: -0.01em;
    transition: color 0.2s;
    line-height: 1;
  }

  .ios-tab-active .ios-tab-label {
    color: var(--primary);
    font-weight: 600;
  }

  /* Center submit button */
  .ios-tab-center {
    margin-top: -12px;
  }

  .ios-tab-center-pill {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .ios-tab-center:active .ios-tab-center-pill {
    transform: scale(0.94);
  }

  /* ── More Sheet ────────────────────────────────────────────────── */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 490;
    animation: backdropIn 0.25s ease;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .more-sheet {
    position: fixed;
    bottom: calc(49px + env(safe-area-inset-bottom, 0px));
    left: 12px;
    right: 12px;
    background: var(--surface);
    border-radius: 16px;
    padding: 12px 0 8px;
    z-index: 495;
    animation: sheetUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.6);
  }

  @keyframes sheetUp {
    from { transform: translateY(30px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 99px;
    margin: 0 auto 12px;
  }

  .sheet-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 20px 12px;
  }

  .sheet-items {
    display: flex;
    flex-direction: column;
  }

  .sheet-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;
  }

  .sheet-item:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .sheet-item:not(:last-child) {
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
  }

  .sheet-item-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sheet-item-text {
    flex: 1;
    min-width: 0;
  }

  .sheet-item-label {
    font-size: 17px;
    font-weight: 600;
    color: #fff;
    letter-spacing: -0.02em;
  }

  .sheet-item-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .sheet-item-active .sheet-item-label {
    color: var(--primary);
  }

  :global(.sheet-chevron) {
    color: var(--text-dim);
    flex-shrink: 0;
  }
</style>
