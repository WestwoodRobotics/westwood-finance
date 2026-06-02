<script lang="ts">
  import { ChevronDown } from '@lucide/svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import BudgetTab from './BudgetTab.svelte';
  import HistoryTab from './HistoryTab.svelte';
  import MasterTab from './MasterTab.svelte';
  import { authStore } from '$lib/authStore.svelte.js';
  import { perms } from '$lib/perms.js';

  const TABS = ['budget', 'history', 'master'];
  let activeTab = $state('budget');
  let selectedBudgetTeam = $state(perms.viewAllTeams ? 'FRC' : authStore.userTeam);
  let tabIndex = $derived(TABS.indexOf(activeTab));
  let tabCount = $derived(selectedBudgetTeam === 'Westwood Overall' ? 1 : 3);
</script>

<svelte:head>
  <title>Team Dashboard | Westwood Finance</title>
</svelte:head>

<PageHeader title="Team " titleAccent="Dashboard">
  {#snippet actions()}
    <div class="team-selector">
      {#if perms.viewAllTeams}
        <CustomDropdown
          options={['FRC', 'Slingshot', 'Atlatl', 'Kunai', 'Hunga Munga', 'Westwood Overall']}
          bind:value={selectedBudgetTeam}
          placeholder="Select Team"
        />
      {:else}
        <div class="team-preview-box">
          <span>{selectedBudgetTeam}</span>
          <ChevronDown size={12} style="opacity: 0.3;" />
        </div>
      {/if}
    </div>
  {/snippet}
</PageHeader>

{#if tabCount > 1}
  <div class="tabs-container">
    <div class="segmented-control" style="--tab-index:{tabIndex}; --tab-count:{tabCount};">
      <div class="segment-highlight"></div>
      {#each [['budget', 'Team Dashboard'], ['history', `${selectedBudgetTeam} Funding`], ['master', 'Finance History']] as [key, label]}
        <button class="segment" class:active={activeTab === key} onclick={() => (activeTab = key)}>{label}</button>
      {/each}
    </div>
  </div>
{/if}

{#if activeTab === 'budget'}
  <BudgetTab {selectedBudgetTeam} />
{:else if activeTab === 'history'}
  <HistoryTab {selectedBudgetTeam} />
{:else if activeTab === 'master'}
  <MasterTab {selectedBudgetTeam} />
{/if}

<style>
  .team-selector { width: 180px; }
  @media (max-width: 768px) { .team-selector { width: 175px; } }
  @media (max-width: 400px) { .team-selector { width: 165px; } }

  .tabs-container {
    display: flex;
    justify-content: center;
    margin-bottom: 32px;
    margin-top: 8px;
  }

  @media (max-width: 768px) {
    .tabs-container { margin-bottom: 20px; }
    :global(.segmented-control) { width: 100%; }
    :global(.segment) { font-size: 0.8rem; padding: 7px 14px; }
  }

  .team-preview-box {
    background: var(--surface-2);
    color: var(--text-muted);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.9rem;
    font-weight: 600;
    border: 1px solid var(--border);
    cursor: not-allowed;
    opacity: 0.6;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 180px;
  }
</style>
