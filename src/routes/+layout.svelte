<script>
  import { onMount } from 'svelte';
  import { onNavigate } from '$app/navigation';
  import { dataService } from '$lib/dataService.svelte.js';
  import { authStore } from '$lib/authStore.svelte.js';
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import MobileTabBar from '$lib/components/MobileTabBar.svelte';
  import AuthGate from '$lib/components/AuthGate.svelte';

  let { children } = $props();

  // ── Global 3s data poll ─────────────────────────────────────────────────────
  onMount(() => {
    const interval = setInterval(() => {
      dataService.load(true, true);
    }, 3000);
    return () => clearInterval(interval);
  });

  // ── iOS View Transitions (push slide) ──────────────────────────────────────
  onNavigate((navigation) => {
    // Only animate on mobile via View Transitions API
    if (!document.startViewTransition) return;
    if (window.innerWidth > 768) return;
    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });

  // ── Pull-to-Refresh ─────────────────────────────────────────────────────────
  let ptrActive = $state(false);
  let ptrTouchStartY = 0;
  const PTR_THRESHOLD = 64;

  onMount(() => {
    const main = document.querySelector('.main-content');
    if (!main) return;

    function onTouchStart(/** @type {any} */ e) {
      if (window.innerWidth > 768) return;
      ptrTouchStartY = e.touches[0].clientY;
    }
 
    async function onTouchEnd(/** @type {any} */ e) {
      if (window.innerWidth > 768 || dataService.isManualRefreshing) return;
      const delta = e.changedTouches[0].clientY - ptrTouchStartY;
      // Only fire if pulled down AND scroll is at top
      if (!main) return;
      const scrollTop = main.scrollTop ?? window.scrollY;
      if (delta > PTR_THRESHOLD && scrollTop <= 0) {
        if ('vibrate' in navigator) navigator.vibrate([8, 40, 8]);
        dataService.isManualRefreshing = true;
        try {
          await dataService.load(true);
        } finally {
          setTimeout(() => { dataService.isManualRefreshing = false; }, 600);
        }
      }
    }
 
    main.addEventListener('touchstart', onTouchStart, { passive: true });
    main.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      if (main) {
        main.removeEventListener('touchstart', onTouchStart);
        main.removeEventListener('touchend', onTouchEnd);
      }
    };
  });
</script>

<svelte:head>
  <title>Westwood Finance</title>
  <meta name="description" content="Finance management system for Westwood Robotics" />
</svelte:head>

<AuthGate>
  {#snippet children()}
    <!-- Pull-to-Refresh Indicator -->
    {#if dataService.isManualRefreshing}
      <div class="ptr-indicator">
        <div class="ptr-spinner"></div>
        Refreshing…
      </div>
    {/if}

    <div class="app-shell">
      <Sidebar />
      <main class="main-content">
        {@render children()}
      </main>
    </div>

    <!-- iOS Tab Bar (renders itself only on mobile) -->
    <MobileTabBar />
  {/snippet}
</AuthGate>
