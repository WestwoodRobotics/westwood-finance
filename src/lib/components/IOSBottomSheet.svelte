<script>
  import { onMount } from 'svelte';
  import { X } from '@lucide/svelte';
  import { browser } from '$app/environment';

  /** @type {{ open: boolean, onclose: () => void, title?: string, children: import('svelte').Snippet }} */
  let { open = false, onclose, title = '', children } = $props();

  let sheetEl = /** @type {HTMLElement|null} */ ($state(null));
  let dragStartY = 0;
  let currentY = $state(0);
  let isDragging = $state(false);

  function haptic() {
    if ('vibrate' in navigator) navigator.vibrate(8);
  }

  /** @param {TouchEvent} e */
  function onTouchStart(e) {
    dragStartY = e.touches[0].clientY;
    currentY = 0;
    isDragging = true;
  }

  /** @param {TouchEvent} e */
  function onTouchMove(e) {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartY;
    if (delta > 0) {
      currentY = delta;
    }
  }

  /** @param {TouchEvent} e */
  function onTouchEnd(e) {
    isDragging = false;
    const delta = e.changedTouches[0].clientY - dragStartY;
    if (delta > 80) {
      haptic();
      onclose();
    }
    currentY = 0;
  }

  $effect(() => {
    if (!browser) return;
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { if (browser) document.body.style.overflow = ''; };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div class="ios-sheet-backdrop" onclick={onclose} role="button" tabindex="-1"></div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="ios-sheet"
    bind:this={sheetEl}
    style="--drag-y: {currentY}px"
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
  >
    <!-- Drag handle -->
    <div class="ios-sheet-handle-area">
      <div class="ios-sheet-handle"></div>
    </div>

    {#if title}
      <div class="ios-sheet-header">
        <span class="ios-sheet-title">{title}</span>
        <button class="ios-sheet-close" onclick={onclose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
    {/if}

    <div class="ios-sheet-content">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .ios-sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 600;
    animation: backdropIn 0.22s ease;
  }

  @keyframes backdropIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .ios-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #1c1c1e;
    border-radius: 16px 16px 0 0;
    max-height: 90vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    z-index: 610;
    transform: translateY(var(--drag-y, 0px));
    will-change: transform;
    padding-bottom: env(safe-area-inset-bottom, 20px);
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.4);
    animation: sheetSlideUp 0.32s cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  @keyframes sheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(var(--drag-y, 0px)); }
  }

  @media (min-width: 769px) {
    .ios-sheet {
      left: 50%;
      right: auto;
      transform: translate(-50%, var(--drag-y, 0px));
      width: 90%;
      max-width: 550px;
      border-radius: 16px;
      bottom: 40px; /* Elevated on desktop */
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      animation: sheetSlideUpDesktop 0.32s cubic-bezier(0.34, 1.2, 0.64, 1);
    }
  }

  @keyframes sheetSlideUpDesktop {
    from { transform: translate(-50%, 100%); opacity: 0; }
    to { transform: translate(-50%, var(--drag-y, 0px)); opacity: 1; }
  }

  .ios-sheet-handle-area {
    display: flex;
    justify-content: center;
    padding: 12px 0 8px;
    cursor: grab;
  }

  .ios-sheet-handle {
    width: 36px;
    height: 5px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 99px;
  }

  .ios-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 20px 16px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
  }

  .ios-sheet-title {
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    font-family: -apple-system, 'SF Pro Text', sans-serif;
    letter-spacing: -0.02em;
  }

  .ios-sheet-close {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s;
  }

  .ios-sheet-close:active {
    background: rgba(255, 255, 255, 0.18);
  }

  .ios-sheet-content {
    padding: 0;
  }
</style>
