<script>
  import { onMount } from "svelte";
  import { Info, Eye, EyeOff } from '@lucide/svelte';

  let { 
    onunlock = () => {}, 
    oncancel = null,
    title = "Admin Login", 
    description = "Enter the password to access admin features.",
    placeholder = "Enter admin code"
  } = $props();

  let adminPassInput = $state("");
  let authError = $state("");
  let showPassword = $state(false);

  function tryUnlock() {
    const cleanPass = adminPassInput.trim();
    if (cleanPass === "/dev3432" || cleanPass === "dev3432" || cleanPass === "3432") {
      onunlock();
      authError = "";
      adminPassInput = "";
    } else {
      authError = "Incorrect password. Please try again.";
      adminPassInput = "";
    }
  }
</script>

<div class="lock-screen fade-in">
  <div class="lock-card card">
    <div
      class="lock-logo"
    >
      <img
        src="/logo-bordered.png"
        alt="Westwood Logo"
      />
    </div>
    <h2>{title.split(' ')[0]} <span>{title.split(' ').slice(1).join(' ') || ''}</span></h2>
    <p class="text-muted">
      {description}
    </p>

    {#if authError}
      <div class="error-bar message-bar">
         <Info size={16} />
         {authError}
      </div>
    {/if}

    <form
      onsubmit={(e) => {
        e.preventDefault();
        tryUnlock();
      }}
      class="lock-form"
    >
      <div class="form-group">
        <label for="admin-password">Admin Password</label>
        <div class="password-input-group">
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            bind:value={adminPassInput}
            placeholder={placeholder}
            autocomplete="current-password"
            class="admin-input"
          />
          <button
            type="button"
            onmousedown={() => { showPassword = true; }}
            onmouseup={() => { showPassword = false; }}
            onmouseleave={() => { showPassword = false; }}
            class="password-toggle"
          >
            {#if showPassword}
              <Eye size={18} />
            {:else}
              <EyeOff size={18} />
            {/if}
          </button>
        </div>
      </div>

      <div class="lock-actions">
        <button type="submit" class="btn btn-primary btn-block">Sign In</button>
        {#if oncancel}
          <button type="button" class="btn btn-ghost btn-block" onclick={oncancel}>Cancel</button>
        {/if}
      </div>
    </form>
  </div>
</div>

<style>
  .lock-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .lock-card {
    width: 100%;
    max-width: 420px;
    min-height: 520px;
    padding: 60px 40px;
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
  }

  .lock-logo {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.95);
    background: #000;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
  }

  .lock-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lock-card h2 { 
    margin-bottom: 8px; 
    font-size: 1.5rem; 
    color: #fff;
  }
  
  .lock-card h2 span {
    color: var(--primary);
  }

  .lock-card p {
    margin-bottom: 24px;
    font-size: 0.9rem;
  }

  .lock-form { 
    margin-top: 32px; 
    text-align: left; 
    width: 100%;
  }

  .password-input-group { 
    position: relative; 
  }

  .admin-input {
    text-align: center;
    font-size: 1.25rem;
    letter-spacing: 0.3em;
    height: 54px;
    padding-right: 50px !important;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: #fff;
    width: 100%;
    outline: none;
  }
  
  .admin-input:focus {
    border-color: var(--primary);
    background: var(--surface-3);
  }
  
  .admin-input::placeholder {
    letter-spacing: normal;
    font-size: 0.9rem;
    color: var(--text-dim);
  }

  .password-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-dim);
    display: flex;
    padding: 0;
  }

  .lock-actions { 
    display: flex; 
    flex-direction: column; 
    gap: 12px; 
    margin-top: 32px; 
  }

  .btn-block { 
    width: 100%; 
    justify-content: center; 
    height: 48px; 
    font-size: 0.95rem; 
  }

  .message-bar { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    padding: 14px 18px; 
    border-radius: var(--radius-sm); 
    font-size: 0.9rem; 
    font-weight: 600; 
    margin-bottom: 24px; 
    border: 1px solid transparent;
    text-align: left;
  }

  .error-bar { 
    background: rgba(239, 68, 68, 0.08); 
    border-color: rgba(239, 68, 68, 0.2); 
    color: var(--status-rejected); 
  }
</style>
