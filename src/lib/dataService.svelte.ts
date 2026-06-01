import { BASE_URL } from './config.js';
import { generateShortId } from './utils.js';
import { authStore } from './authStore.svelte.js';
import type { Order, Fund, Budget, ApprovedMember, OrderStatus } from './types.js';

async function gasPost(payload: Record<string, unknown>): Promise<unknown> {
  const idToken = authStore.idToken;
  if (!idToken) throw new Error('Not authenticated');
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ idToken, ...payload }),
  });
  if (!res.ok) throw new Error(`Network error: ${res.status}`);
  return JSON.parse(await res.text());
}

class DataStore {
  orders = $state<Order[]>([]);
  funds = $state<Fund[]>([]);
  budget = $state<Budget | null>(null);
  loading = $state(false);
  error = $state<string | null>(null);
  lastFetched = $state<number | null>(null);
  isSilentLoading = $state(false);
  isManualRefreshing = $state(false);
  hasLoadedOnce = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('westwood_finance_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          this.orders = parsed.orders || [];
          this.funds = parsed.funds || [];
          this.budget = parsed.budget || null;
          this.lastFetched = parsed.lastFetched || null;
          console.debug("DataStore: restored from cache");
        }
      } catch (e) {
        console.warn("DataStore Cache Load Failed:", e);
      }
    }
  }

  persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('westwood_finance_cache', JSON.stringify({
          orders: this.orders,
          funds: this.funds,
          budget: this.budget,
          lastFetched: this.lastFetched
        }));
      } catch (e) {
        console.warn("DataStore Cache Save Failed:", e);
      }
    }
  }

  normalizeOrders(data: unknown[]): Order[] {
    if (!Array.isArray(data)) return [];
    const rows = data as Record<string, unknown>[];
    const seenIds = new Set<string>();
    return rows
      .filter((o) => {
        const hasItem = !!(o['Item'] || o['item']);
        const hasCompany = !!(o['Company'] || o['company']);
        const hasTracking = !!(o['Tracking'] || o['tracking']);
        const hasUUID = !!(o['UUID'] || o['List UUID'] || o['Order UUID'] || o['orderUUID'] || o['id']);
        return hasItem || hasCompany || hasTracking || hasUUID;
      })
      .map((o, index) => {
        const stableInput = encodeURIComponent(String(o['Item'] ?? o['item'] ?? "item"));
        let baseId = String(o['UUID'] || o['Order UUID'] || o['List UUID'] || o['orderUUID'] || o['id'] || `order-${index}-${stableInput}`);
        let finalId = baseId;
        let counter = 1;
        while (seenIds.has(finalId)) {
          finalId = `${baseId}-dup${counter}`;
          counter++;
        }
        seenIds.add(finalId);

        const rawStatus = String(o['Status'] ?? o['status'] ?? 'Pending Review').trim();
        const low = rawStatus.toLowerCase();
        let status: OrderStatus;
        if (low === 'submitted, in review' || low === 'submitted' || low === 'pending review') status = 'Pending Review';
        else if (low === 'ordered') status = 'Ordered';
        else if (low === 'received' || low === 'recieved') status = 'Received';
        else if (low === 'approved') status = 'Approved';
        else if (low === 'denied') status = 'Denied';
        else if (low === 'cancelled') status = 'Cancelled';
        else if (low === 'void') status = 'Void';
        else status = 'Pending Review';

        return {
          item: String(o['Item'] ?? o['item'] ?? 'Unknown'),
          company: String(o['Company'] ?? o['company'] ?? ''),
          link: String(o['Link'] ?? o['link'] ?? ''),
          price: Number(o['Price'] ?? o['price']) || 0,
          quantity: Number(o['Quantity'] ?? o['quantity']) || 1,
          notes: String(o['Notes'] ?? o['notes'] ?? ''),
          category: String(o['Category'] || o['category'] || 'miscellaneous').toLowerCase().trim(),
          team: String(o['Team'] ?? o['team'] ?? o['user'] ?? ''),
          timestamp: String(o['Timestamp'] ?? o['timestamp'] ?? ''),
          total: Number(o['Total'] ?? o['total']) || (Number(o['Price'] ?? o['price']) * Number(o['Quantity'] ?? o['quantity'])) || 0,
          status,
          tracking: String(o['Tracking'] ?? o['tracking'] ?? ''),
          id: finalId,
          orderUUID: String(o['Order UUID'] || o['orderUUID'] || ''),
          rowIndex: Number(o['rowIndex']) || (index + 3),
          orderedBy: String(o['Ordered By'] ?? o['orderedBy'] ?? ''),
        } satisfies Order;
      });
  }

  normalizeFunds(data: unknown[]): Fund[] {
    if (!Array.isArray(data)) return [];
    const seenIds = new Set<string>();
    return (data as Record<string, unknown>[]).map((f, index) => {
      const stableInput = encodeURIComponent(String(f['Type'] ?? f['Source'] ?? 'fund'));
      let baseId = String(f['id'] || f['UUID'] || `fund-${index}-${stableInput}`);
      let finalId = baseId;
      let counter = 1;
      while (seenIds.has(finalId)) {
        finalId = `${baseId}-dup${counter}`;
        counter++;
      }
      seenIds.add(finalId);
      return {
        ...f,
        id: finalId,
        rowIndex: Number(f['rowIndex']) || (index + 2),
        Amount: Number(f['Amount']) || 0,
      } as Fund;
    });
  }

  async load(force = false, silent = false): Promise<void> {
    if (!force && this.orders.length > 0 && this.lastFetched && (Date.now() - this.lastFetched < 120000)) {
      return;
    }

    this.error = null;

    const idToken = authStore.idToken;
    if (!idToken) return;

    if (this.orders.length === 0 && !silent) {
      this.loading = true;
    }

    if (silent) this.isSilentLoading = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken, action: 'getAllData' }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Network error: ${res.status} ${res.statusText}`);

      const data = JSON.parse(await res.text()) as Record<string, unknown>;

      if (data['error']) {
        throw new Error(`Google Script Error: ${data['error']}`);
      }

      this.orders = this.normalizeOrders((data['orders'] as unknown[]) || []);
      this.funds = this.normalizeFunds((data['funds'] as unknown[]) || []);
      this.budget = (data['budget'] as Budget) || null;
      this.lastFetched = Date.now();

      if (data['members'] && Array.isArray(data['members'])) {
        authStore.updateMembersList(data['members'] as ApprovedMember[]);
      }

      this.persist();
      console.log(`DataStore: ${this.orders.length} orders, ${this.funds.length} funding entries`);
    } catch (e) {
      if (e instanceof Error) {
        this.error = e.name === 'AbortError' ? "Connection timed out. Trying again..." : e.message;
      } else {
        this.error = "Unknown error occurred while fetching data.";
      }
      console.error("DataStore Load Error:", e);
    } finally {
      this.loading = false;
      this.isSilentLoading = false;
      this.hasLoadedOnce = true;
    }
  }

  async refresh(): Promise<void> {
    this.isManualRefreshing = true;
    try {
      await this.load(true);
    } finally {
      setTimeout(() => { this.isManualRefreshing = false; }, 800);
    }
  }

  addOrderOptimistic(orderData: Partial<Order>): void {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newOrder: Order = {
      item: orderData.item || 'Unknown',
      company: orderData.company || '',
      link: orderData.link || '',
      price: Number(orderData.price) || 0,
      quantity: Number(orderData.quantity) || 1,
      notes: orderData.notes || '',
      category: (orderData.category || 'miscellaneous').toLowerCase().trim(),
      team: orderData.team || '',
      timestamp: orderData.timestamp || new Date().toISOString(),
      total: (Number(orderData.price) || 0) * (Number(orderData.quantity) || 1),
      status: orderData.status || 'Pending Review',
      tracking: orderData.tracking || '',
      id: tempId,
      orderUUID: orderData.orderUUID || `OPT-${generateShortId()}`,
      rowIndex: this.orders.length + 3,
      orderedBy: orderData.orderedBy || '',
    };

    this.orders = [...this.orders, newOrder];
    this.persist();
    console.debug(`optimistic add — "${newOrder.item}"`);

    setTimeout(() => this.load(true, true), 2000);
  }

  updateOrderOptimistic(orderId: string, updates: Partial<Order>): void {
    this.orders = this.orders.map(o => o.id === orderId ? { ...o, ...updates } : o);
    this.persist();
    console.debug(`optimistic update — order "${orderId}"`);
  }

  deleteOrderOptimistic(orderId: string): void {
    this.orders = this.orders.filter(o => o.id !== orderId);
    this.persist();
    console.debug(`optimistic delete — order "${orderId}"`);
  }

  addFundOptimistic(fundData: Partial<Fund>): void {
    const tempId = `temp-fund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newFund: Fund = {
      ...fundData,
      id: tempId,
      Amount: Number(fundData.Amount || fundData['amount']) || 0,
      rowIndex: this.funds.length + 2,
    };
    this.funds = [...this.funds, newFund];
    this.persist();
    console.debug(`optimistic add — funding entry`);
    setTimeout(() => this.load(true, true), 2000);
  }
}

export const dataService = new DataStore();
