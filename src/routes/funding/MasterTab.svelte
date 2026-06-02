<script lang="ts">
  import { Receipt } from '@lucide/svelte';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import { dataService } from '$lib/dataService.svelte.js';
  import { formatCurrency } from '$lib/utils.js';

  let { selectedBudgetTeam }: { selectedBudgetTeam: string } = $props();

  let transactions = $derived.by(() => {
    const arr: { id: string; type: string; source: string | undefined; category: string | undefined; date: string; amount: number; status: string }[] = [];

    const expenses = dataService.orders.filter(o => {
      const s = (o.status || '').toLowerCase().trim();
      return s === 'received' || s === 'ordered';
    });
    const teamExpenses = selectedBudgetTeam === 'Westwood Overall'
      ? expenses
      : expenses.filter(o => {
          const t = (o.team || '').toLowerCase().trim();
          const s = selectedBudgetTeam.toLowerCase().trim();
          return t === s || t.includes(s) || (s === 'frc' && (t.includes('frc') || /^\d+$/.test(t)));
        });

    for (const e of teamExpenses) {
      arr.push({ id: e.id, type: 'Expense', source: e.company || e.item, category: e.category, date: e.timestamp?.slice(0, 10) || '—', amount: -(e.total || 0), status: e.status });
    }

    const income = dataService.funds.filter(f => {
      if (selectedBudgetTeam === 'Westwood Overall') return true;
      const t = (f.Recipient || '').toLowerCase().trim();
      const s = selectedBudgetTeam.toLowerCase().trim();
      return t === s || t.includes(s) || t === 'all' || t === 'westwood overall';
    });
    for (const f of income) {
      arr.push({ id: f.id, type: 'Income', source: String(f.Source), category: String(f.Type), date: String(f.Date || '—'), amount: Number(f.Amount) || 0, status: 'Received' });
    }

    arr.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    return arr;
  });

  let netBalance = $derived.by(() => {
    const budgetKey = selectedBudgetTeam === 'Westwood Overall' ? 'Total' : selectedBudgetTeam;
    const budgetObj = (dataService.budget as Record<string, Record<string, number>> | null)?.[budgetKey] || {};
    const income = transactions.filter(tx => tx.type === 'Income').reduce((s, tx) => s + tx.amount, 0);
    const expenses = transactions.filter(tx => tx.type === 'Expense').reduce((s, tx) => s + Math.abs(tx.amount), 0);
    return (budgetObj['Club Funds'] || 0) + (budgetObj['Personal Funds'] || 0) + income - expenses;
  });
</script>

<section class="fade-in">
  <div class="section-title section-title-row">
    <span>Finance History ({transactions.length})</span>
  </div>
  <div class="card orders-card" style="padding:0;overflow:hidden;">
    {#if dataService.loading && !transactions.length}
      <LoadingIndicator text="Loading ledger..." />
    {:else if transactions.length === 0}
      <div class="empty-state">
        <div class="icon"><Receipt size={48} stroke-width={1} /></div>
        No transactions found.
      </div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Source / Item</th>
              <th>Type</th>
              <th>Category</th>
              <th>Status</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each transactions as tx (tx.id + tx.type)}
              <tr class="fade-in">
                <td class="text-dim monospace" style="color: var(--text-dim);">{tx.date}</td>
                <td style="font-weight:600; color: #fff;">{tx.source || '—'}</td>
                <td>
                  <span class="badge {tx.type === 'Income' ? 'badge-awarded' : 'badge-rejected'}">{tx.type}</span>
                </td>
                <td>{tx.category || '—'}</td>
                <td><OrderStatusBadge status={tx.status} /></td>
                <td class="text-right monospace" style="font-weight:700; color: {tx.amount > 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot class="total-row">
            <tr>
              <td colspan={5} class="total-label">Net Balance</td>
              <td class="text-right monospace total-amount">{formatCurrency(netBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</section>

<style>
  .section-title { margin-bottom: 12px; font-size: 1.1rem; color: var(--text-muted); }
  .section-title-row { display: flex; justify-content: space-between; align-items: center; }
</style>
