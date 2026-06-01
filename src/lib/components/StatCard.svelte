<script>
  import { formatCurrency } from '../utils.js';

  let {
    label = '',
    value = '',
    isCurrency = false,
    sub = '',
    accentColor = 'var(--primary)',
    icon = undefined,
    progress = undefined,
    progressLabel = '',
    percentage = undefined,
  } = $props();
</script>

<div class="stat-card">
  <div class="stat-header">
    <div class="stat-meta">
      {#if icon}
        <span class="stat-icon" style="color:{accentColor}">{@render icon()}</span>
      {/if}
      <span class="stat-label">{label}</span>
    </div>
    {#if percentage !== undefined}
      <div class="stat-percentage" style="color: {accentColor}">
        {percentage}%
      </div>
    {/if}
  </div>

  <div class="stat-main">
    <div class="stat-value">
      {isCurrency ? formatCurrency(Number(value)) : value}
    </div>
    {#if sub}
      <div class="stat-sub">{sub}</div>
    {/if}
  </div>

  {#if progress !== undefined}
    <div class="progress-section">
      <div class="progress-info">
        <span class="progress-label">{progressLabel || ' '}</span>
        <span class="progress-pct">{progress.toFixed(2)}%</span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill"
          style="width:{Math.min(100, Math.max(0, progress))}%; background:{accentColor}"
        ></div>
      </div>
    </div>
  {/if}
</div>

<style>
  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  
  .stat-card::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-bright), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }

  @media (hover: hover) {
    .stat-card:hover { 
      border-color: var(--border-bright);
      background: var(--surface-2);
    }
    .stat-card:hover::after {
      opacity: 0.5;
    }
  }

  @media (max-width: 768px) {
    .stat-card {
      padding: 14px 16px;
      gap: 8px;
      border-radius: 14px;
      border-color: rgba(255,255,255,0.07);
      background: rgba(24, 24, 27, 0.9);
    }
  }

  .stat-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
  }

  .stat-icon { 
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    opacity: 0.8;
  }

  .stat-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-value {
    font-family: 'Outfit', sans-serif;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #fff;
    line-height: 1.1;
  }

  .stat-sub { 
    font-size: 0.8rem; 
    font-weight: 500;
    color: var(--text-muted); 
  }
  
  .stat-percentage {
    font-size: 0.85rem;
    font-weight: 700;
    font-family: 'Outfit', sans-serif;
    padding: 2px 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 6px;
  }

  /* ── Progress Section ────────────────────────────────────────────────── */
  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .progress-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
  }

  .progress-pct {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: var(--surface-3);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
  }
</style>
