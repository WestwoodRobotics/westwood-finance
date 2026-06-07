<script lang="ts">
  import { onMount } from 'svelte';
  import { Info, Clock } from '@lucide/svelte';
  import { authStore } from '$lib/authStore.svelte.js';
  import { api } from '$lib/api.js';
  import { GOOGLE_CLIENT_ID } from '$lib/config.js';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';

  let { children } = $props();

  // ── Google Sign-In ─────────────────────────────────────────────────────────
  let gsiReady = $state(false);
  let signInError = $state('');

  // Student ID input state
  let studentIdInput = $state('');
  let selectedTeam = $state('FRC');
  let idError = $state('');
  let registering = $state(false);
  let registerError = $state('');
  let checkingAgain = $state(false);

  const TEAM_OPTIONS = ['FRC', 'Kunai', 'Slingshot', 'Hunga Munga', 'Atlatl'];

  onMount(async () => {
    try {
      await loadGsiScript();
      // @ts-ignore
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
        use_fedcm_for_prompt: true,
      });
      gsiReady = true;
    } catch (e) {
      console.error('Google Sign-In failed to load:', e);
      signInError = 'Could not load Google Sign-In. Check your connection and reload.';
    }
  });

  function loadGsiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      if (window.google?.accounts?.id) return resolve();
      const existing = document.getElementById('google-gsi-script') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('GSI load failed')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('GSI load failed'));
      document.head.appendChild(script);
    });
  }

  function renderGoogleButton() {
    // @ts-ignore
    if (!gsiReady || !window.google?.accounts?.id) return;
    const container = document.getElementById('google-signin-btn');
    if (!container || container.childElementCount > 0) return;
    // @ts-ignore
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      width: 320,
    });
    // One Tap as a convenience; the rendered button is the guaranteed fallback.
    // @ts-ignore
    window.google.accounts.id.prompt();
  }

  function handleCredentialResponse(response: { credential: string }) {
    signInError = '';
    authStore.loginWithCredential(response.credential).catch((e) => {
      console.error('Sign-in failed:', e);
      signInError = 'Sign-in failed. Please try again.';
    });
  }

  async function submitStudentId() {
    const clean = studentIdInput.replace(/^s/i, '').trim();

    if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      idError = 'Please enter a valid 6-digit Student ID number (numbers only, without the S).';
      return;
    }

    idError = '';
    registerError = '';

    if (authStore.hasValidSession) {
      const [firstName, ...lastNameArr] = (authStore.googleUser?.name || '').split(' ');
      const lastName = lastNameArr.join(' ');
      registering = true;
      try {
        const data = await api.post({
          action: 'registerSelf',
          firstName: firstName || '',
          lastName: lastName || '',
          studentId: clean,
          team: selectedTeam,
          email: authStore.googleUser?.email || '',
        });
        if (data.error) {
          registerError = 'Registration failed: ' + data.error;
          registering = false;
          return;
        }
        authStore.updateFromRegistration(data);
      } catch (e) {
        registerError = 'Could not reach server. Check your connection and try again.';
        registering = false;
        return;
      }
      registering = false;
    } else {
      authStore.submitStudentId(clean, selectedTeam);
    }
  }

  function signOut() {
    authStore.signOut();
    // Clear all cached data so a fresh account can sign in cleanly
    if (typeof window !== 'undefined') {
      localStorage.removeItem('westwood_auth');
      localStorage.removeItem('westwood_members');
      localStorage.removeItem('westwood_finance_cache');
    }
  }

  // Render the Google button whenever the sign-in screen is shown and GSI is ready.
  $effect(() => {
    if (gsiReady && authStore.status === 'signed_out' && authStore.initialized) {
      renderGoogleButton();
    }
  });

</script>

{#if !authStore.initialized}
  <div class="auth-loading">
    <div class="auth-spinner"></div>
    <p class="auth-loading-text">Signing you in...</p>
  </div>
{:else if authStore.status === 'approved'}
  <!-- Authenticated: render the app -->
  {@render children()}
{:else if authStore.status === 'unauthorized'}
  <!-- Access Denied Screen -->
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-user-info">
        {#if authStore.googleUser?.picture}
          <img src={authStore.googleUser.picture} alt="Profile photo for {authStore.googleUser.name}" class="auth-avatar" referrerpolicy="no-referrer" />
        {/if}
        <div class="auth-user-name">{authStore.googleUser?.name || ''}</div>
        <div class="auth-user-email">{authStore.googleUser?.email || ''}</div>
      </div>

      <h2 class="auth-step-title" style="color: var(--status-rejected);">Access <span style="color: var(--status-rejected);">Denied</span></h2>
      <p class="auth-step-desc" style="margin-bottom: 24px;">You do not have permission to access this site.</p>

      <div class="pending-highlight" style="border-color: rgba(239, 68, 68, 0.15); background: rgba(239, 68, 68, 0.06);">
        Contact <strong>Ishaan</strong> if you think this is a mistake.
      </div>

      <div class="pending-actions" style="margin-top: 24px;">
        <button class="auth-back-btn" onclick={signOut}>Sign out</button>
      </div>
    </div>
  </div>

{:else if authStore.status === 'signed_out'}
  <!-- Sign-In Screen -->
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-logo">
        <img src="/logo-bordered.png" alt="Westwood Robotics" />
      </div>
      <h1 class="auth-title">WESTWOOD <span>FINANCE</span></h1>
      <p class="auth-subtitle" style="margin-bottom: 16px;">Sign in with your Google account to continue</p>
      <p class="auth-step-note" style="margin-bottom: 32px; background: rgba(255, 255, 255, 0.03); color: var(--text-muted); border: 1px solid var(--border); padding: 12px; border-radius: 8px;">
        Please sign in with a personal account (not school email)
      </p>

      <div class="google-btn-wrapper">
        <div id="google-signin-btn"></div>
      </div>

      {#if signInError}
        <div class="auth-error" style="margin-bottom: 20px;">
          <Info size={16} />
          {signInError}
        </div>
      {/if}

      <div class="auth-footer-text">
        Members of Westwood Robotics only
      </div>
    </div>
  </div>

{:else if authStore.status === 'needs_student_id'}
  <!-- Student ID Entry Screen -->
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-user-info">
        {#if authStore.googleUser?.picture}
          <img src={authStore.googleUser.picture} alt="Profile photo for {authStore.googleUser.name}" class="auth-avatar" referrerpolicy="no-referrer" />
        {/if}
        <div class="auth-user-name">{authStore.googleUser?.name || ''}</div>
        <div class="auth-user-email">{authStore.googleUser?.email || ''}</div>
      </div>

      <h2 class="auth-step-title">Student <span>Verification</span></h2>
      <p class="auth-step-desc">Enter your 6-digit Student ID number</p>
      <p class="auth-step-note">Without the "S", numbers only</p>

      {#if idError}
        <div class="auth-error">
          <Info size={16} />
          {idError}
        </div>
      {/if}
      {#if registerError}
        <div class="auth-error">
          <Info size={16} />
          {registerError}
        </div>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); submitStudentId(); }} class="auth-form">
        <div class="auth-field">
          <label for="student-id-input">Student ID Number</label>
          <input
            id="student-id-input"
            type="text"
            inputmode="numeric"
            maxlength="6"
            bind:value={studentIdInput}
            placeholder="123456"
            autocomplete="off"
            class="auth-id-input"
          />
        </div>

        <div class="auth-field">
          <label for="team-select">What team are you on?</label>
          <CustomDropdown
            options={TEAM_OPTIONS}
            bind:value={selectedTeam}
            placeholder="Select your team"
          />
        </div>

        <button type="submit" class="auth-submit-btn" disabled={registering}>
          {#if registering}
            <span class="auth-spinner-inline"></span> Registering...
          {:else}
            Continue
          {/if}
        </button>
      </form>

      <div class="pending-actions" style="margin-top: 8px;">
        <button class="auth-back-btn" onclick={signOut}>Sign in with another account</button>
      </div>

    </div>
  </div>

{:else if authStore.status === 'pending_approval'}
  <!-- Pending Approval Screen -->
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-user-info">
        {#if authStore.googleUser?.picture}
          <img src={authStore.googleUser.picture} alt="Profile photo for {authStore.googleUser.name}" class="auth-avatar" referrerpolicy="no-referrer" />
        {/if}
        <div class="auth-user-name">{authStore.googleUser?.name || ''}</div>
        <div class="auth-user-email">{authStore.googleUser?.email || ''}</div>
      </div>

      <div class="pending-icon">
        <Clock size={48} stroke-width={1.5} />
      </div>

      <h2 class="auth-step-title" style="margin-top: 16px;">Approval <span>Required</span></h2>

      <div class="pending-message">
        <p>Your account is not yet approved.</p>
        <p class="pending-highlight">Ask <strong>Ishaan</strong> to approve you.</p>
        <p class="pending-details">
          Tell him your Student ID: <code>{authStore.studentId}</code>
          <br/>
          Team: <strong>{authStore.pendingTeam}</strong>
        </p>
      </div>

      <div class="pending-actions" style="margin-top: 24px;">
        <button class="auth-submit-btn" style="max-width: 240px; margin: 0 auto; height: 44px; font-size: 0.9rem;" disabled={checkingAgain} onclick={async () => { checkingAgain = true; await authStore.fetchMembers(); checkingAgain = false; }}>{checkingAgain ? 'Checking…' : 'Check Again'}</button>
        <button class="auth-back-btn" onclick={signOut}>Sign in with another account</button>
      </div>

    </div>
  </div>
{/if}

<style>
  .auth-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg, #09090b);
    z-index: 9999;
    padding: 20px;
    overflow-y: auto;
  }

  .auth-card {
    width: 100%;
    max-width: 440px;
    padding: 48px 40px;
    text-align: center;
    background: var(--surface, #141416);
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 20px;
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.03);
    animation: authFadeIn 0.5s ease;
  }

  @keyframes authFadeIn {
    from { opacity: 0; transform: translateY(20px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .auth-logo {
    width: 80px;
    height: 80px;
    margin: 0 auto 24px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: #000;
    box-shadow: 0 0 30px rgba(249, 115, 22, 0.15);
  }

  .auth-logo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .auth-title {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #fff;
    margin-bottom: 8px;
  }
  .auth-title span {
    color: var(--primary, #f97316);
  }

  .auth-subtitle {
    font-size: 0.9rem;
    color: var(--text-muted, #71717a);
    margin-bottom: 36px;
    line-height: 1.5;
  }

  .auth-step-title {
    font-size: 1.4rem;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
  }
  .auth-step-title span {
    color: var(--primary, #f97316);
  }

  .auth-step-desc {
    font-size: 0.9rem;
    color: var(--text-muted, #71717a);
    margin-bottom: 4px;
  }

  .auth-step-note {
    font-size: 0.8rem;
    color: var(--primary, #f97316);
    font-weight: 600;
    margin-bottom: 24px;
    padding: 8px 16px;
    background: rgba(249, 115, 22, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(249, 115, 22, 0.15);
    display: inline-block;
  }
  .google-btn-wrapper {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
    min-height: 44px;
  }

  .auth-footer-text {
    font-size: 0.7rem;
    color: var(--text-dim, #52525b);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  .auth-user-info {
    margin-bottom: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .auth-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid var(--primary, #f97316);
    box-shadow: 0 0 20px rgba(249, 115, 22, 0.2);
    margin-bottom: 4px;
  }

  .auth-user-name {
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
  }

  .auth-user-email {
    font-size: 0.8rem;
    color: var(--text-muted, #71717a);
  }
  .auth-form {
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .auth-field label {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted, #71717a);
  }

  .auth-id-input {
    text-align: center;
    font-size: 1.6rem;
    letter-spacing: 0.5em;
    font-weight: 700;
    height: 60px;
    background: var(--surface-2, #1c1c1e);
    border: 1px solid var(--border, rgba(255,255,255,0.08));
    border-radius: 12px;
    color: #fff;
    width: 100%;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .auth-id-input:focus {
    border-color: var(--primary, #f97316);
    box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
  }

  .auth-id-input::placeholder {
    letter-spacing: 0.3em;
    font-size: 1.2rem;
    color: var(--text-dim, #52525b);
    font-weight: 400;
  }
  .auth-submit-btn {
    width: 100%;
    height: 50px;
    background: var(--primary, #f97316);
    color: #fff;
    font-size: 0.95rem;
    font-weight: 700;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
    letter-spacing: 0.02em;
  }

  .auth-submit-btn:hover {
    opacity: 0.9;
  }

  .auth-submit-btn:active {
    transform: scale(0.98);
  }

  .auth-back-btn {
    background: none;
    border: none;
    color: var(--text-muted, #71717a);
    font-size: 0.85rem;
    cursor: pointer;
    padding: 8px;
    transition: color 0.2s;
  }

  .auth-back-btn:hover {
    color: #fff;
  }
  .auth-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 10px;
    color: #ef4444;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: left;
  }
  .pending-icon {
    color: var(--primary, #f97316);
    opacity: 0.6;
    animation: pendingPulse 2s ease-in-out infinite;
  }

  @keyframes pendingPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }

  .pending-message {
    margin: 20px 0 28px;
  }

  .pending-message p {
    font-size: 0.9rem;
    color: var(--text-muted, #71717a);
    margin-bottom: 8px;
    line-height: 1.6;
  }

  .pending-highlight {
    font-size: 1.1rem !important;
    color: #fff !important;
    font-weight: 600;
    padding: 16px;
    background: rgba(249, 115, 22, 0.06);
    border: 1px solid rgba(249, 115, 22, 0.15);
    border-radius: 12px;
    margin: 16px 0 !important;
  }

  .pending-details {
    font-size: 0.8rem !important;
    color: var(--text-dim, #52525b) !important;
  }

  .pending-details code {
    background: var(--surface-2, #1c1c1e);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--primary, #f97316);
    font-weight: 700;
    letter-spacing: 0.15em;
  }

  .pending-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .auth-spinner-inline {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: authSpin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }
  .auth-loading {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--bg, #09090b);
    z-index: 9999;
  }

  .auth-loading-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .auth-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: var(--primary, #f97316);
    border-radius: 50%;
    animation: authSpin 0.8s linear infinite;
  }

  @keyframes authSpin {
    to { transform: rotate(360deg); }
  }
  @media (max-width: 500px) {
    .auth-card {
      padding: 36px 24px;
      border-radius: 16px;
    }

    .auth-id-input {
      font-size: 1.3rem;
      letter-spacing: 0.4em;
      height: 54px;
    }

    .auth-title {
      font-size: 1.25rem;
    }
  }
</style>
