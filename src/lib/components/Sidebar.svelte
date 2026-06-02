<script lang="ts">
  import { page } from "$app/stores";
  import { authStore } from "$lib/authStore.svelte.js";
  import { perms } from "$lib/perms.js";
  import { isMobile } from "$lib/mediaQuery.svelte.js";
  import appInfo from "$lib/app-info.json";
  import { LayoutDashboard, PlusCircle, Users, ShoppingCart, BarChart3, User, X, LogOut } from '@lucide/svelte';

  const allNavItems = [
    { href: "/",        label: "Dashboard",       icon: LayoutDashboard },
    { href: "/add/",    label: "Submit an Order",  icon: PlusCircle },
    { href: "/funding/",label: "Team Dashboard",   icon: Users },
    { href: "/orders/", label: "Orders",           icon: ShoppingCart },
    { href: "/stats/",  label: "Analytics",        icon: BarChart3 },
    { href: "/admin/",  label: "Admin Portal",     icon: User, adminOnly: true },
  ];

  let navItems = $derived(
    allNavItems.filter(item => !item.adminOnly || perms.admin)
  );

  function isActive(href) {
    const current = $page.url.pathname.replace(/\/$/, '') || '/';
    const target = href.replace(/\/$/, '') || '/';
    return current === target;
  }

  let isMobileOpen = $state(false);

  function closeMobileNav() {
    isMobileOpen = false;
  }

  function toggleMobileNav() {
    isMobileOpen = !isMobileOpen;
  }

  function handleNavClick(href) {
    if (isMobile.current) {
      closeMobileNav();
    }
  }
</script>

<!-- Mobile Backdrop -->
{#if isMobile.current && isMobileOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div 
    class="mobile-backdrop" 
    onclick={closeMobileNav}
    role="button"
    tabindex="-1"
    aria-label="Close navigation"
  ></div>
{/if}

<aside class="sidebar" class:mobile-open={isMobileOpen} class:is-mobile={isMobile.current}>
  <div class="sidebar-brand">
    <div class="logo-wrapper">
      <img src="/logo-bordered.png" alt="Westwood Logo" class="logo-actual" />
    </div>
    <div class="brand-text">
       <span class="brand-title">WESTWOOD</span>
       <span class="brand-module">FINANCE</span>
    </div>
    {#if isMobile.current}
      <button class="mobile-close-btn" onclick={closeMobileNav} aria-label="Close navigation">
        <X size={18} />
      </button>
    {/if}
  </div>

  <nav class="sidebar-nav">
    {#each navItems as item}
      {@const NavIcon = item.icon}
      <a
        href={item.href}
        class="nav-link"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? "page" : undefined}
        onclick={() => handleNavClick(item.href)}
      >
        <span class="nav-icon"><NavIcon size={18} /></span>
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <!-- User Info & Sign Out -->
  <div class="sidebar-user">
    {#if authStore.googleUser}
      <div class="user-row">
        {#if authStore.googleUser.picture}
          <img src={authStore.googleUser.picture} alt="" class="user-avatar" referrerpolicy="no-referrer" />
        {:else}
          <div class="user-avatar-placeholder">
            {authStore.displayName.charAt(0)}
          </div>
        {/if}
        <div class="user-info">
          <div class="user-name">{authStore.displayName}</div>
          <div class="user-team">{authStore.userTeam}{perms.admin ? ' · Admin' : ''}</div>
        </div>
      </div>
      <button class="signout-btn" onclick={() => authStore.signOut()} title="Sign out">
        <LogOut size={16} />
      </button>
    {/if}
  </div>

  <div class="sidebar-footer">
    <div class="footer-version">v{appInfo.version} · {appInfo.deployedAt}</div>
    <div class="footer-copyright">Westwood Robotics © 2025</div>
  </div>
</aside>

<!-- Mobile FAB removed — MobileTabBar handles navigation on mobile -->

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: var(--sidebar-width);
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    z-index: 200;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .sidebar.is-mobile {
    transform: translateX(-100%);
    box-shadow: none;
    width: 280px;
  }

  .sidebar.is-mobile.mobile-open {
    transform: translateX(0);
    box-shadow: 4px 0 32px rgba(0, 0, 0, 0.6);
  }
  .mobile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    z-index: 199;
    animation: fadeBackdrop 0.25s ease;
  }

  @keyframes fadeBackdrop {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .mobile-close-btn {
    margin-left: auto;
    background: var(--surface-3);
    border: 1px solid var(--border);
    border-radius: 50%;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted);
    transition: all 0.2s;
    flex-shrink: 0;
    padding: 0;
  }
  .mobile-close-btn:hover {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 32px 24px;
    margin-bottom: 8px;
  }

  .logo-wrapper {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  .logo-actual {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .brand-title {
    font-weight: 800;
    font-size: 0.95rem;
    letter-spacing: 0.1em;
    color: #fff;
    line-height: 1;
  }

  .brand-module {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 0.25em;
    opacity: 0.8;
  }

  .sidebar-nav {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 14px;
    overflow-y: auto;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .nav-link:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .nav-link.active {
    background: var(--surface-3);
    color: #fff;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
  }
  
  .nav-link.active::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 8px;
    bottom: 8px;
    width: 2px;
    background: var(--primary);
    border-radius: 99px;
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    flex-shrink: 0;
    opacity: 0.7;
    transition: opacity 0.2s;
  }
  
  .nav-link:hover .nav-icon,
  .nav-link.active .nav-icon {
    opacity: 1;
  }
  .sidebar-user {
    padding: 16px 18px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
  }

  .user-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--surface-3);
    border: 1.5px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    color: var(--primary);
  }

  .user-info {
    min-width: 0;
    flex: 1;
  }

  .user-name {
    font-size: 0.8rem;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .user-team {
    font-size: 0.65rem;
    color: var(--text-dim);
    font-weight: 500;
  }

  .signout-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--text-muted);
    flex-shrink: 0;
    padding: 0;
    transition: all 0.2s;
  }

  .signout-btn:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .sidebar-footer {
    padding: 20px 24px;
    border-top: 1px solid var(--border);
    background: rgba(0,0,0,0.1);
  }
  
  .footer-version {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .footer-copyright {
    font-size: 0.65rem;
    color: var(--text-dim);
  }
</style>
