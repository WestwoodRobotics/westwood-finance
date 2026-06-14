<script lang="ts">
  import { Clock, ShoppingBag, Check, CircleCheck, CircleX, Ban } from '@lucide/svelte';

  let { status } = $props();

  const config = {
    'Pending Review': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)',  border: 'rgba(59, 130, 246, 0.2)',  icon: Clock },
    'Ordered':        { color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)',   border: 'rgba(249, 115, 22, 0.2)',  icon: ShoppingBag },
    'Received':       { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)',   border: 'rgba(16, 185, 129, 0.2)',  icon: Check },
    'Approved':       { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)',    border: 'rgba(6, 182, 212, 0.2)',   icon: CircleCheck },
    'Denied':         { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)',    border: 'rgba(239, 68, 68, 0.2)',   icon: CircleX },
    'Void':           { color: '#71717a', bg: 'rgba(113, 113, 122, 0.08)', border: 'rgba(113, 113, 122, 0.2)', icon: Ban },
    'Cancelled':      { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)',   border: 'rgba(245, 158, 11, 0.2)',  icon: CircleX },
  };

  const cfgMap = config;
  let cfg = $derived(cfgMap[status] ?? { color: '#71717a', bg: 'rgba(113, 113, 122, 0.08)', border: 'rgba(113, 113, 122, 0.2)', icon: null });
</script>

<span class="status-badge" style="color: {cfg.color}; background: {cfg.bg}; border-color: {cfg.border}">
  {#if cfg.icon}
    {@const StatusIcon = cfg.icon}
    <span class="status-icon"><StatusIcon size={12} /></span>
  {/if}
  <span class="status-text">{status}</span>
</span>

<style>
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.725rem;
    font-weight: 700;
    white-space: nowrap;
    border: 1px solid transparent;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.9;
  }
  
  .status-text {
    line-height: 1;
  }
</style>
