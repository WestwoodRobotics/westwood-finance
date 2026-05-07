<script>
  /** @type {{ status: string }} */
  let { status } = $props();

  /** @type {Record<string, { color: string, bg: string, border: string, icon: string }>} */
  const config = {
    'Pending Review': { 
      color: '#3b82f6', 
      bg: 'rgba(59, 130, 246, 0.08)',
      border: 'rgba(59, 130, 246, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    },
    'Ordered': { 
      color: '#f97316', 
      bg: 'rgba(249, 115, 22, 0.08)',
      border: 'rgba(249, 115, 22, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
    },
    'Received': { 
      color: '#10b981', 
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"/></svg>'
    },
    'Approved': { 
      color: '#06b6d4', 
      bg: 'rgba(6, 182, 212, 0.08)',
      border: 'rgba(6, 182, 212, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    },
    'Denied': { 
      color: '#ef4444', 
      bg: 'rgba(239, 68, 68, 0.08)',
      border: 'rgba(239, 68, 68, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    },
    'Void': { 
      color: '#71717a', 
      bg: 'rgba(113, 113, 122, 0.08)',
      border: 'rgba(113, 113, 122, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
    },
    'Cancelled': { 
      color: '#f59e0b', 
      bg: 'rgba(245, 158, 11, 0.08)',
      border: 'rgba(245, 158, 11, 0.2)',
      icon: '<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    },
  };

  let cfg = $derived(config[status] ?? { 
    color: '#71717a', 
    bg: 'rgba(113, 113, 122, 0.08)', 
    border: 'rgba(113, 113, 122, 0.2)',
    icon: '' 
  });
</script>

<span class="status-badge" style="color: {cfg.color}; background: {cfg.bg}; border-color: {cfg.border}">
  {#if cfg.icon}
    <span class="status-icon">{@html cfg.icon}</span>
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
