<script lang="ts">
  let { text = "Loading" } = $props();
</script>

<div class="loading-wrapper fade-in">
  <!-- Glowing text -->
  <div class="loading-text">
    {text}
  </div>

  <!-- Progress bar track and fill with rounded ends -->
  <div class="progress-track">
    <div class="progress-fill"></div>
  </div>
</div>

<style>
  .loading-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 16px;
  }

  .loading-text {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .progress-track {
    width: 200px;
    height: 6px;
    background: var(--surface-2);
    border-radius: 999px; /* rounded ends */
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 40%;
    background: var(--primary);
    border-radius: 999px;
    animation: loading-bar 1.5s infinite ease-in-out;
    box-shadow: 0 0 10px var(--primary-glow);
  }

  @keyframes loading-bar {
    0% {
      left: -40%;
    }
    100% {
      left: 100%;
    }
  }
</style>
