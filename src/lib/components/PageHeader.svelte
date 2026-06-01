<script>
  import { RefreshCw, TriangleAlert } from '@lucide/svelte';
  import { dataService } from '$lib/dataService.svelte.js';

  let { title, titleAccent = '', subtitle = '', actions } = $props();

  async function sync() {
    dataService.isManualRefreshing = true;
    try {
      await dataService.load(true);
    } finally {
      setTimeout(() => { dataService.isManualRefreshing = false; }, 800);
    }
  }
</script>

<div class="page-header">
  <div class="header-left">
    <h1>{title}{#if titleAccent} <span>{titleAccent}</span>{/if}</h1>
    {#if subtitle}<p class="text-muted">{subtitle}</p>{/if}
  </div>
  <div class="header-right">
    {#if dataService.error}
      <span class="error-text">
        <TriangleAlert size={14} />
        {dataService.error}
      </span>
    {/if}
    {@render actions?.()}
    <button
      class="btn btn-ghost btn-sm refresh-btn"
      onclick={sync}
      disabled={dataService.isManualRefreshing}
      aria-label="Refresh data"
    >
      <span class="refresh-icon" class:spinning={dataService.isManualRefreshing}>
        <RefreshCw size={14} />
      </span>
      <span class="hide-mobile">{dataService.isManualRefreshing ? "Syncing..." : "Refresh"}</span>
    </button>
  </div>
</div>

<style>
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .error-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--status-rejected);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .refresh-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinning {
    animation: spin 0.8s linear infinite;
  }

  @media (max-width: 768px) {
    .refresh-btn {
      aspect-ratio: 1/1;
      width: 42px;
      padding: 0 !important;
      flex: none !important;
    }
  }
</style>
