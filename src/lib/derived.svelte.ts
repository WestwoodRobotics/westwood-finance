import { dataService } from "./dataService.svelte.js";
import { matchesTeam } from "./utils.js";

export function createTeamView(getTeam: () => string) {
  const teamOrders = $derived(
    dataService.orders.filter((o) => matchesTeam(o, getTeam())),
  );

  const teamFunds = $derived(
    getTeam() === "Westwood Overall"
      ? dataService.funds
      : dataService.funds.filter((f) => {
          const r = String(f.Recipient || "")
            .toLowerCase()
            .trim();
          const s = getTeam().toLowerCase().trim();
          return (
            r === s || r.includes(s) || r === "all" || r === "westwood overall"
          );
        }),
  );

  const financialOrders = $derived(
    teamOrders.filter((o) => {
      const s = (o.status || "").toLowerCase().trim();
      return s === "received" || s === "ordered";
    }),
  );

  const totalRaised = $derived(
    teamFunds.reduce((sum, f) => sum + (Number(f.Amount) || 0), 0),
  );
  const totalSpent = $derived(
    financialOrders.reduce((sum, o) => sum + (o.total || 0), 0),
  );
  const netBalance = $derived(totalRaised - totalSpent);

  const monthlyTrends = $derived.by(() => {
    const map: Record<string, number> = {};
    financialOrders.forEach((o) => {
      const d = new Date(o.timestamp || "");
      if (isNaN(d.getTime())) return;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[month] = (map[month] || 0) + (o.total || 0);
    });
    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  });

  return {
    get teamOrders() {
      return teamOrders;
    },
    get teamFunds() {
      return teamFunds;
    },
    get financialOrders() {
      return financialOrders;
    },
    get totalRaised() {
      return totalRaised;
    },
    get totalSpent() {
      return totalSpent;
    },
    get netBalance() {
      return netBalance;
    },
    get monthlyTrends() {
      return monthlyTrends;
    },
  };
}
