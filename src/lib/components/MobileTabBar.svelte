<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/authStore.svelte.js';

  let showMoreSheet = $state(false);
  let isMobile = $state(false);

  const mainTabs = [
    {
      href: '/',
      label: 'Dashboard',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1.5"/><rect width="7" height="5" x="14" y="3" rx="1.5"/><rect width="7" height="9" x="14" y="12" rx="1.5"/><rect width="7" height="5" x="3" y="16" rx="1.5"/></svg>`,
    },
    {
      href: '/orders',
      label: 'All Orders',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    },
    {
      href: '/add',
      label: 'Submit',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
      center: true,
    },
    {
      href: '/funding',
      label: 'Team',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      href: '#more',
      label: 'More',
      isMore: true,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
    },
  ];

  const allMoreItems = [
    {
      href: '/stats',
      label: 'Analytics',
      subtitle: 'Spending trends & charts',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      color: '#3b82f6',
    },
    {
      href: '/admin',
      label: 'Admin Portal',
      subtitle: 'Manage orders & funding',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      color: '#f97316',
      adminOnly: true,
    },
  ];

  let moreItems = $derived(
    allMoreItems.filter(item => !item.adminOnly || authStore.isAdmin)
  );

  onMount(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    isMobile = mq.matches;
    mq.addEventListener('change', (e) => { isMobile = e.matches; });
  });

  /** @param {string} href */
  function isActive(href) {
    if (href === '#more') {
      const p = $page.url.pathname;
      return p.startsWith('/stats') || p.startsWith('/admin');
    }
    const current = $page.url.pathname.replace(/\/$/, '') || '/';
    const target = href.replace(/\/$/, '') || '/';
    return current === target;
  }

  function haptic(/** @type {number} */ duration = 8) {
    if ('vibrate' in navigator) navigator.vibrate(duration);
  }

  /** @param {typeof mainTabs[0]} tab */
  function handleTabClick(tab) {
    haptic();
    if (tab.isMore) {
      showMoreSheet = !showMoreSheet;
      return;
    }
    showMoreSheet = false;
    goto(tab.href);
  }

  /** @param {string} href */
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
  let sheetEl = /** @type {HTMLElement|null} */ ($state(null));

  /** @param {TouchEvent} e */
  function onSheetTouchStart(e) {
    dragStartY = e.touches[0].clientY;
  }

  /** @param {TouchEvent} e */
  function onSheetTouchEnd(e) {
    const delta = e.changedTouches[0].clientY - dragStartY;
    if (delta > 60) closeSheet();
  }
</script>

{#if isMobile}
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
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div
            class="sheet-item"
            class:sheet-item-active={isActive(item.href)}
            onclick={() => handleMoreItemClick(item.href)}
          >
            <div class="sheet-item-icon" style="background: {item.color}20; color: {item.color}">
              {@html item.icon}
            </div>
            <div class="sheet-item-text">
              <div class="sheet-item-label">{item.label}</div>
              <div class="sheet-item-subtitle">{item.subtitle}</div>
            </div>
            <svg class="sheet-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- iOS Tab Bar -->
  <nav class="ios-tab-bar" aria-label="Main navigation">
    {#each mainTabs as tab}
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
            {@html tab.icon}
          </div>
        {:else}
          <div class="ios-tab-icon">
            {@html tab.icon}
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
    color: #636366;
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
    color: #636366;
    font-family: -apple-system, 'SF Pro Text', 'Plus Jakarta Sans', sans-serif;
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
    background: #1c1c1e;
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
    font-family: -apple-system, 'SF Pro Text', sans-serif;
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
    font-family: -apple-system, 'SF Pro Text', sans-serif;
    letter-spacing: -0.02em;
  }

  .sheet-item-subtitle {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 2px;
    font-family: -apple-system, 'SF Pro Text', sans-serif;
  }

  .sheet-item-active .sheet-item-label {
    color: var(--primary);
  }

  .sheet-chevron {
    color: var(--text-dim);
    flex-shrink: 0;
  }
</style>
