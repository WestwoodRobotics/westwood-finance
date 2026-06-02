<script lang="ts">
  import { Receipt } from '@lucide/svelte';
  import OrderStatusBadge from '$lib/components/OrderStatusBadge.svelte';
  import LoadingIndicator from '$lib/components/LoadingIndicator.svelte';
  import { formatCurrency, capitalize } from '$lib/utils.js';
  import { dataService } from '$lib/dataService.svelte.js';

  let { syncing }: { syncing: boolean } = $props();

  let masterTransactions = $derived.by(() => {
    const arr: { id: string; type: string; source: string | undefined; category: string | undefined; team: string | undefined; date: string; amount: number; status: string }[] = [];
    dataService.orders.filter(o => { const s = o.status?.toLowerCase().trim(); return s === 'received' || s === 'ordered'; })
      .forEach(e => arr.push({ id: e.id, type: 'Expense', source: e.company || e.item, category: e.category, team: e.team, date: e.timestamp?.slice(0, 10) || '—', amount: -e.total, status: e.status }));
    dataService.funds
      .forEach(f => arr.push({ id: f.id, type: 'Income', source: String(f.Source), category: String(f.Type), team: String(f.Recipient), date: String(f.Date || '—'), amount: Number(f.Amount) || 0, status: 'Received' }));
    arr.sort((a, b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0));
    return arr;
  });

  function exportMasterCSV() {
    if (!masterTransactions.length) return;
    const headers = ['Date', 'Type', 'Source/Item', 'Category', 'Team', 'Status', 'Amount'];
    const rows = masterTransactions.map(row =>
      [row.date, row.type, row.source, row.category, row.team, row.status, row.amount]
        .map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `westwood_finance_master_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<section class="fade-in">
  <div class="section-title" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
    <span>Master Finance History ({masterTransactions.length})</span>
    <button class="btn btn-ghost btn-sm" onclick={exportMasterCSV} disabled={!masterTransactions.length}>↓ Export CSV</button>
  </div>
  <div class="card orders-card" style="padding:0;overflow:hidden">
    {#if dataService.loading && !masterTransactions.length}
      <LoadingIndicator text="Loading ledger..." />
    {:else if masterTransactions.length === 0}
      <div class="empty-state"><div class="icon"><Receipt size={48} stroke-width={1} /></div>No transactions found.</div>
    {:else}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Source / Item</th><th>Type</th><th>Category</th><th>Team</th><th>Status</th><th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each masterTransactions as tx (tx.id + tx.type)}
              <tr class="fade-in">
                <td class="text-dim monospace">{tx.date}</td>
                <td style="font-weight:600; color:#fff">{tx.source || '—'}</td>
                <td><span class="badge {tx.type === 'Income' ? 'badge-awarded' : 'badge-rejected'}">{tx.type}</span></td>
                <td>{capitalize(tx.category ?? '') || '—'}</td>
                <td>{tx.team || '—'}</td>
                <td><OrderStatusBadge status={tx.status} /></td>
                <td class="text-right monospace" style="font-weight:700; color:{tx.amount > 0 ? 'var(--status-awarded)' : 'var(--status-rejected)'}">
                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
