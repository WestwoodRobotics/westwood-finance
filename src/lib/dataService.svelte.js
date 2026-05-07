import { BASE_URL, SECRET_KEY } from './config.js';
import { generateShortId } from './utils.js';

/**
 * @typedef {Object} Order
 * @property {string} item
 * @property {string} company
 * @property {string} link
 * @property {number} price
 * @property {number} quantity
 * @property {string} notes
 * @property {string} category
 * @property {string} team
 * @property {string} timestamp
 * @property {number} total
 * @property {string} status
 * @property {string} tracking
 * @property {string} id
 * @property {string} orderUUID
 * @property {number} rowIndex
 * @property {string} orderedBy
 */

/**
 * Global reactive data store for the application.
 * Uses Svelte 5 $state with localStorage persistence for "Instant Load".
 * Includes improved error handling and GAS-specific response validation.
 */
class DataStore {
  /** @type {Order[]} */
  orders = $state([]);
  /** @type {any[]} */
  funds = $state([]);
  /** @type {any} */
  budget = $state(null);
  /** @type {boolean} */
  loading = $state(false);
  /** @type {string | null} */
  error = $state(/** @type {string|null} */ (null));
  /** @type {number | null} */
  lastFetched = $state(/** @type {number|null} */ (null));
  /** @type {boolean} */
  isSilentLoading = $state(false);
  /** @type {boolean} */
  isManualRefreshing = $state(false);
  /** @type {boolean} */
  hasLoadedOnce = $state(false);

  constructor() {
    // 🏠 Initialize from localStorage for instant boot
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('westwood_finance_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          this.orders = parsed.orders || [];
          this.funds = parsed.funds || [];
          this.budget = parsed.budget || null;
          this.lastFetched = parsed.lastFetched || null;
          console.log("💾 DataStore: Initialized from cache");
        }
      } catch (e) {
        console.warn("DataStore Cache Load Failed:", e);
      }
    }
  }

  /**
   * Persists current state to localStorage
   */
  persist() {
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

  /**
   * Normalizes order data from the API
   * @param {any[]} data 
   * @returns {Order[]}
   */
  normalizeOrders(data) {
    if (!Array.isArray(data)) return [];
    const seenIds = new Set();
    return data
      .filter(o => {
          const hasItem = !!(o.Item || o.item);
          const hasCompany = !!(o.Company || o.company);
          const hasTracking = !!(o.Tracking || o.tracking);
          const hasUUID = !!(o["UUID"] || o["List UUID"] || o["Order UUID"] || o.orderUUID || o.id);
          // Only keep rows that have some actual data
          return hasItem || hasCompany || hasTracking || hasUUID;
      })
      .map((o, index) => {
      const stableInput = encodeURIComponent(o.Item ?? o.item ?? "item");
      let baseId = String(o.UUID || o["Order UUID"] || o["List UUID"] || o.orderUUID || o.id || `order-${index}-${stableInput}`);
      let finalId = baseId;
      let counter = 1;
      while (seenIds.has(finalId)) {
        finalId = `${baseId}-dup${counter}`;
        counter++;
      }
      seenIds.add(finalId);
      
      return {
      item: o.Item ?? o.item ?? "Unknown",
      company: o.Company ?? o.company ?? "",
      link: o.Link ?? o.link ?? "",
      price: Number(o.Price ?? o.price) || 0,
      quantity: Number(o.Quantity ?? o.quantity) || 1,
      notes: o.Notes ?? o.notes ?? "",
      category: (o.Category || o.category || "miscellaneous").toString().toLowerCase().trim(),
      team: o.Team ?? o.team ?? o.user ?? "",
      timestamp: o.Timestamp ?? o.timestamp ?? "",
      total: Number(o.Total ?? o.total) || (Number(o.Price ?? o.price) * Number(o.Quantity ?? o.quantity)) || 0,
      status: (() => {
        const val = o.Status ?? o.status ?? "Pending Review";
        const s = String(val).trim();
        const low = s.toLowerCase();
        if (low === "submitted, in review" || low === "submitted" || low === "pending review") return "Pending Review";
        if (low === "ordered") return "Ordered";
        if (low === "received" || low === "recieved") return "Received";
        if (low === "approved") return "Approved";
        if (low === "denied") return "Denied";
        if (low === "cancelled") return "Cancelled";
        if (low === "void") return "Void";
        return s; // Fallback
      })(),
      tracking: o.Tracking ?? o.tracking ?? "",
      id: finalId,
      orderUUID: o["Order UUID"] || o.orderUUID || "",
      rowIndex: o.rowIndex ?? (index + 3),
      orderedBy: o["Ordered By"] ?? o.orderedBy ?? "",
    }});
  }

  /**
   * Normalizes funding data
   * @param {any[]} data 
   */
  normalizeFunds(data) {
    if (!Array.isArray(data)) return [];
    const seenIds = new Set();
    return data.map((f, index) => {
      const stableInput = encodeURIComponent(f.Type ?? f.Source ?? "fund");
      let baseId = String(f.id || f.UUID || `fund-${index}-${stableInput}`);
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
        rowIndex: f.rowIndex ?? (index + 2), // Header is row 1
        Amount: Number(f.Amount) || 0
      };
    });
  }

  /**
   * Performance-optimized loader.
   * Uses getAllData to fetch everything in ONE request.
   */
  async load(force = false, silent = false) {
    // If not forced and we have data less than 2 minutes old, skip background refresh
    if (!force && this.orders.length > 0 && this.lastFetched && (Date.now() - this.lastFetched < 120000)) {
      return;
    }

    // Only show loading indicator if we have NO data at all
    if (this.orders.length === 0 && !silent) {
      this.loading = true;
    }
    
    if (silent) this.isSilentLoading = true;
    
    this.error = null;
    console.log("DataStore: Syncing with Google Sheets...");

    try {
      // Add a timeout to prevent infinite loading if Google is slow
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

      const res = await fetch(`${BASE_URL}?action=getAllData&key=${SECRET_KEY}`, {
          signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Network error: ${res.status} ${res.statusText}`);

      const data = await res.json();
      
      // Handle GAS internal errors (it returns 200 even for logical errors)
      if (data.error) {
        throw new Error(`Google Script Error: ${data.error}`);
      }

      this.orders = this.normalizeOrders(data.orders || []);
      this.funds = this.normalizeFunds(data.funds || []); 
      this.budget = data.budget || null;
      this.lastFetched = Date.now();
      
      this.persist();
      console.log(`✅ DataStore: Sync complete. Received ${this.orders.length} orders and ${this.funds.length} funding entries.`);
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

  /**
   * Optimistically add a new order to the local store.
   * Immediately updates UI, then silently syncs with Google Sheets in the background.
   * @param {Partial<Order>} orderData
   */
  addOrderOptimistic(orderData) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    /** @type {Order} */
    const newOrder = {
      item: orderData.item || "Unknown",
      company: orderData.company || "",
      link: orderData.link || "",
      price: Number(orderData.price) || 0,
      quantity: Number(orderData.quantity) || 1,
      notes: orderData.notes || "",
      category: (orderData.category || "miscellaneous").toLowerCase().trim(),
      team: orderData.team || "",
      timestamp: orderData.timestamp || new Date().toISOString(),
      total: (Number(orderData.price) || 0) * (Number(orderData.quantity) || 1),
      status: orderData.status || "Pending Review",
      tracking: orderData.tracking || "",
      id: tempId,
      orderUUID: orderData.orderUUID || `OPT-${generateShortId()}`,
      rowIndex: this.orders.length + 3,
      orderedBy: orderData.orderedBy || "",
    };

    // Inject immediately into the reactive store
    this.orders = [...this.orders, newOrder];
    this.persist();
    console.log(`⚡ DataStore: Optimistic add — "${newOrder.item}" injected instantly.`);

    // Background sync to get the real data from Google Sheets
    setTimeout(() => this.load(true, true), 2000);
  }

  /**
   * Optimistically update an order's status/tracking in the local store.
   * @param {string} orderId
   * @param {Partial<Order>} updates
   */
  updateOrderOptimistic(orderId, updates) {
    this.orders = this.orders.map(o => {
      if (o.id === orderId) {
        return { ...o, ...updates };
      }
      return o;
    });
    this.persist();
    console.log(`⚡ DataStore: Optimistic update — order "${orderId}" updated instantly.`);
  }

  /**
   * Optimistically remove an order from the local store.
   * @param {string} orderId
   */
  deleteOrderOptimistic(orderId) {
    this.orders = this.orders.filter(o => o.id !== orderId);
    this.persist();
    console.log(`⚡ DataStore: Optimistic delete — order "${orderId}" removed instantly.`);
  }

  /**
   * Optimistically add a funding entry.
   * @param {any} fundData
   */
  addFundOptimistic(fundData) {
    const tempId = `temp-fund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newFund = {
      ...fundData,
      id: tempId,
      Amount: Number(fundData.Amount || fundData.amount) || 0,
      rowIndex: this.funds.length + 2,
    };
    this.funds = [...this.funds, newFund];
    this.persist();
    console.log(`⚡ DataStore: Optimistic add — funding entry injected instantly.`);
    setTimeout(() => this.load(true, true), 2000);
  }
}

export const dataService = new DataStore();
