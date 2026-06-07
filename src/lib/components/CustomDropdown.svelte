<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { ChevronDown, Check } from '@lucide/svelte';

  let {
    options = [],
    value = $bindable(''),
    placeholder = 'Selection required',
    onchange = undefined,
    id = undefined
  } = $props();

  let isOpen = $state(false);
  let dropdownRef = $state();

  function toggle() {
    const nextOpen = !isOpen;
    if (nextOpen) {
      // Broadcast to close all other dropdowns
      window.dispatchEvent(new CustomEvent('close-dropdowns', { detail: { caller: dropdownRef } }));
    }
    isOpen = nextOpen;
  }

  function select(optValue) {
    value = optValue;
    isOpen = false;
    onchange?.({ target: { value: optValue } });
  }

  function handleClickOutside(event) {
    if (dropdownRef && !dropdownRef.contains(event.target)) {
      isOpen = false;
    }
  }

  onMount(() => {
    const handleCloseOthers = (e) => {
      if (e.detail && e.detail.caller !== dropdownRef) {
        isOpen = false;
      }
    };

    window.addEventListener('click', handleClickOutside);
    // @ts-ignore - custom event
    window.addEventListener('close-dropdowns', handleCloseOthers);
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
      // @ts-ignore - custom event
      window.removeEventListener('close-dropdowns', handleCloseOthers);
    };
  });

  let selectedLabel = $derived(() => {
    const opt = options.find(o => (typeof o === 'string' ? o : o.value) === value);
    if (!opt) return placeholder;
    return typeof opt === 'string' ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt.label;
  });
</script>

<div class="custom-dropdown" bind:this={dropdownRef}>
  <button
    type="button"
    class="dropdown-trigger"
    class:active={isOpen}
    onclick={toggle}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    {id}
  >
    <span class="label" class:placeholder={!value}>{selectedLabel()}</span>
    <span class="chevron" class:open={isOpen}>
      <ChevronDown size={12} />
    </span>
  </button>

  {#if isOpen}
    <ul class="dropdown-menu fade-in" role="listbox">
      {#each options as opt}
        {@const val = typeof opt === 'string' ? opt : opt.value}
        {@const label = typeof opt === 'string' ? opt.charAt(0).toUpperCase() + opt.slice(1) : opt.label}
        <li 
          class="dropdown-item" 
          class:selected={value === val}
          role="none"
        >
          <button
            type="button"
            class="dropdown-item-button"
            onclick={() => select(val)}
            role="option"
            aria-selected={value === val}
          >
            {label}
            {#if value === val}
               <Check size={14} class="check-icon" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .custom-dropdown {
    position: relative;
    width: 100%;
    user-select: none;
  }

  .dropdown-trigger {
    width: 100%;
    background-color: var(--surface-2) !important;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    color: #fff;
    transition: all 0.2s ease;
    text-align: left;
    outline: none;
    font-size: 0.9rem;
    font-weight: 600;
    -webkit-appearance: none;
    appearance: none;
    opacity: 1 !important;
  }

  .dropdown-trigger:hover {
    border-color: var(--primary);
    background: var(--surface-3);
  }

  .dropdown-trigger.active {
    border-color: var(--primary);
    background: var(--surface-3);
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .label.placeholder {
    color: var(--text-muted);
    font-weight: 500;
  }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.2s ease;
    color: var(--text-dim);
  }

  .chevron.open {
    transform: rotate(180deg);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    background: var(--surface);
    background-color: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    z-index: 9999;
    max-height: 280px;
    overflow-y: auto;
    box-shadow: var(--shadow-2xl);
    padding: 6px;
    list-style: none;
    margin: 0;
    opacity: 1;
  }

  .dropdown-item {
    margin-bottom: 2px;
  }
  
  .dropdown-item:last-child { margin-bottom: 0; }

  .dropdown-item-button {
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.15s ease;
    color: var(--text-dim);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    outline: none;
  }

  .dropdown-item-button:hover,
  .dropdown-item-button:focus {
    background: var(--surface-3);
    color: #fff;
  }

  .dropdown-item.selected .dropdown-item-button {
    background: rgba(249, 115, 22, 0.1);
    color: var(--primary);
  }

  :global(.check-icon) {
    flex-shrink: 0;
  }

  .dropdown-menu::-webkit-scrollbar {
    width: 4px;
  }
  .dropdown-menu::-webkit-scrollbar-track {
    background: transparent;
  }
  .dropdown-menu::-webkit-scrollbar-thumb {
    background: var(--surface-3);
    border-radius: 10px;
  }
</style>
