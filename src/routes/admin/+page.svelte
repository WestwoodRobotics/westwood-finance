<script>
  import { onMount } from "svelte";
  import { Check, Info, Grid2x2, Package, DollarSign, Receipt, TriangleAlert, X } from '@lucide/svelte';
  import OrderStatusBadge from "$lib/components/OrderStatusBadge.svelte";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import LoadingIndicator from "$lib/components/LoadingIndicator.svelte";

  import OrderTable from "$lib/components/OrderTable.svelte";
  import {
    formatCurrency,
    formatFullDate,
    formatDate,
    capitalize,
    truncate,
    generateShortId,
  } from "$lib/utils.js";
  import { dataService } from "$lib/dataService.svelte.js";
  import { authStore } from "$lib/authStore.svelte.js";
  import { BASE_URL } from "$lib/config.js";
  import { goto } from "$app/navigation";

  /** @typedef {import('$lib/dataService.svelte.js').Order} Order */

  $effect(() => {
    if (authStore && authStore.initialized && !authStore.isAdmin) goto('/');
  });

  const ORDER_STATUSES = [
    "Pending Review",
    "Approved",
    "Ordered",
    "Received",
    "Denied",
    "Cancelled",
    "Void",
  ];

  // ── State ───────────────────────────────────────────────────────────────────
  let syncing = $state(false);

  /** @type {Record<string, number>} */
  const STATUS_PRIORITY = {
    "pending review": 0,
    approved: 1,
    ordered: 2,
    received: 3,
    denied: 4,
    cancelled: 5,
    void: 6,
  };

  let adminSortCol = $state("status");
  let adminSortDir = $state("asc");

  function toggleAdminSort(/** @type {string} */ col) {
    if (adminSortCol === col) {
      adminSortDir = adminSortDir === "asc" ? "desc" : "asc";
    } else {
      adminSortCol = col;
      adminSortDir = col === "timestamp" || col === "total" ? "desc" : "asc";
    }
  }

  let sortedAdminOrders = $derived.by(() => {
    return dataService.orders.slice().sort((a, b) => {
      if (adminSortCol === "status") {
        let pA = STATUS_PRIORITY[(a.status || "").toLowerCase().trim()] ?? 99;
        let pB = STATUS_PRIORITY[(b.status || "").toLowerCase().trim()] ?? 99;
        const diff = adminSortDir === "asc" ? pA - pB : pB - pA;
        if (diff !== 0) return diff;
        let tA = new Date(a.timestamp || 0).getTime();
        let tB = new Date(b.timestamp || 0).getTime();
        return tB - tA;
      }
      if (adminSortCol === "timestamp") {
        let tA = new Date(a.timestamp || 0).getTime();
        let tB = new Date(b.timestamp || 0).getTime();
        return adminSortDir === "asc" ? tA - tB : tB - tA;
      }
      if (adminSortCol === "total") {
        return adminSortDir === "asc" ? (a.total || 0) - (b.total || 0) : (b.total || 0) - (a.total || 0);
      }
      let valA = String((/** @type {any} */ (a))[adminSortCol] || "").toLowerCase();
      let valB = String((/** @type {any} */ (b))[adminSortCol] || "").toLowerCase();
      if (valA < valB) return adminSortDir === "asc" ? -1 : 1;
      if (valA > valB) return adminSortDir === "asc" ? 1 : -1;
      return 0;
    });
  });

  let newTabOrders = $derived.by(() => {
    return dataService.orders.filter((/** @type {Order} */ o) => {
      const s = (o.status || "").toLowerCase().trim();
      return !["received", "void", "denied", "ordered"].includes(s);
    });
  });

  let groupedCompanyOrders = $derived.by(() => {
    /** @type {Record<string, Order[]>} */
    const groups = {};
    // Ensure all sorted keys so output is consistent
    const sorted = newTabOrders.slice().sort((a, b) => {
      let tA = new Date(a.timestamp || 0).getTime();
      let tB = new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    for (const o of sorted) {
      const comp = o.company?.trim() || "General Items";
      if (!groups[comp]) groups[comp] = [];
      groups[comp].push(o);
    }
    return groups;
  });



  /** @type {(() => void) | null} */
  let undoFn = $state(null);

  async function sync() {
    syncing = true;
    await dataService.load(true);
    syncing = false;
  }

  let actionMsg = $state("");
  let actionErr = $state("");

  // ── Modal state ─────────────────────────────────────────────────────────────
  let editingOrderId = $state("");
  let currentEditingOrder = $derived(
    dataService.orders.find((o) => o.id === editingOrderId) || null,
  );

  let editStatus = $state("");
  let editTracking = $state("");
  let editUUID = $state("");
  let originalUUID = $state("");
  let editSaving = $state(false);
  let showDeleteConfirm = $state(false);
  let deleteSaving = $state(false);

  // Derived state for the grouping dropdown targets
  let groupingOptions = $derived.by(() => {
    if (!currentEditingOrder) return [];

    // 1. Get all other orders from same company (any status)
    const otherPending = dataService.orders.filter(
      (o) =>
        o.company === currentEditingOrder.company &&
        o.id !== editingOrderId,
    );

    if (otherPending.length === 0) return [];

    const isCurrentlyGrouped = otherPending.some(
      (o) => o.orderUUID && o.orderUUID === editUUID,
    );
    const seenUUIDs = new Set();

    // 2. Identify unique targets for grouping
    const uniqueTargets = otherPending.filter((o) => {
      if (!o.orderUUID || seenUUIDs.has(o.orderUUID)) return false;
      seenUUIDs.add(o.orderUUID);
      return true;
    });

    return [
      {
        label: "Make separate order",
        value: isCurrentlyGrouped ? "__NEW__" : editUUID,
      },
      ...uniqueTargets.map((t) => {
        const isMatch = t.orderUUID === editUUID;
        return {
          label:
            (isMatch ? "Keep grouped with: " : "Group with: ") +
            truncate(t.item, 40) +
            " (" +
            (t.team || "Unknown Team") +
            ")",
          value: String(t.orderUUID),
        };
      }),
    ];
  });

  // ── Funding Edit State ──────────────────────────────────────────────────────
  let editingFund = $state(null);
  let editFundFields = $state({
    Source: "",
    Amount: 0,
    Recipient: "",
    Notes: "",
    Type: "",
    Date: "",
  });
  let activeView = $state("orderHistory"); // "orderHistory" | "orders" | "master" | "funding" | "add" | "addOrder" | "members"

  const typeOptions = [
    { label: "Fundraiser", value: "Fundraiser" },
    { label: "Grant", value: "Grant" },
    { label: "Dues", value: "Dues" },
    { label: "Sponsor", value: "Sponsor" },
    { label: "Other", value: "Other" },
  ];
  const recipientOptions = [
    { label: "Slingshot", value: "Slingshot" },
    { label: "Atlatl", value: "Atlatl" },
    { label: "Kunai", value: "Kunai" },
    { label: "Hunga Munga", value: "Hunga Munga" },
    { label: "FRC", value: "FRC" },
    { label: "Westwood Overall", value: "Westwood Overall" },
  ];

  let addFundsForm = $state({
    type: "Fundraiser",
    source: "",
    amount: "",
    date: "",
    notes: "",
    recipient: "Westwood Overall",
  });
  let addFundsSubmitting = $state(false);

  let addOrderForm = $state({
    item: "",
    company: "",
    link: "",
    price: "",
    quantity: "1",
    notes: "",
    team: "FRC",
    category: "hardware",
    status: "Received",
  });
  let addOrderSubmitting = $state(false);

  const TYPE_COLORS = /** @type {Record<string,string>} */ ({
    Fundraiser: "var(--primary)",
    Grant: "#b97cf3",
    Dues: "#4e9af1",
    Sponsor: "#6bcb77",
    Other: "#f1a94e",
  });

  let masterTransactions = $derived.by(() => {
    /** @type {any[]} */
    const arr = [];

    // Expenses (Ordered, Received, Approved)
    const expenses = dataService.orders.filter((/** @type {Order} */ o) => {
      const s = o.status?.toLowerCase().trim();
      return s === "received" || s === "ordered";
    });
    for (let e of expenses) {
      arr.push({
        id: e.id,
        type: "Expense",
        source: e.company || e.item,
        category: e.category,
        team: e.team,
        date: e.timestamp?.slice(0, 10) || "—",
        amount: -e.total,
        status: e.status,
      });
    }

    // Income
    for (let f of dataService.funds) {
      arr.push({
        id: f.id,
        type: "Income",
        source: f.Source,
        category: f.Type,
        team: f.Recipient,
        date: f.Date || "—",
        amount: Number(f.Amount) || 0,
        status: "Received",
      });
    }

    arr.sort((a, b) => {
      const dateA = new Date(a.date).getTime() || 0;
      const dateB = new Date(b.date).getTime() || 0;
      return dateB - dateA;
    });
    return arr;
  });

  // ── Data Loading ─────────────────────────────────────────────────────────────
  let isMobile = $state(false);
  let showTabMenu = $state(false);

  onMount(() => {
    dataService.load(); // Uses persistent cache for instant load

    // Mobile detection
    const mq = window.matchMedia("(max-width: 768px)");
    isMobile = mq.matches;
    mq.addEventListener("change", (e) => { isMobile = e.matches; });
    
    // Check for view parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get("view");
    const validViews = ["orderHistory", "orders", "master", "funding", "add", "addOrder", "members"];
    if (view && validViews.includes(view)) {
      activeView = view;
    }

    // Redirect non-admins away from admin page
    if (!authStore.isAdmin) {
      goto('/');
    }
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  /** @param {string} url */
  function openExternal(url) {
    if (!url) return;
    const href = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function openEdit(/** @type {Order} */ order) {
    editingOrderId = order.id;
    editStatus = order.status || "Pending Review";
    editTracking = order.tracking || "";
    editUUID = order.orderUUID || "";
    originalUUID = order.orderUUID || "";
    editSaving = false;
    actionMsg = "";
    actionErr = "";
  }

  function closeEdit() {
    editingOrderId = "";
  }

  async function saveEdit() {
    if (!currentEditingOrder) return;
    
    // Store previous state for undo
    const prevStatus = currentEditingOrder.status;
    const prevTracking = currentEditingOrder.tracking;
    const prevUUID = currentEditingOrder.orderUUID;
    const editId = currentEditingOrder.id;
    const editRowIndex = currentEditingOrder.rowIndex;
    
    editSaving = true;
    actionErr = "";
    actionMsg = "";
    undoFn = null;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'updateOrderStatus',
          id: currentEditingOrder.id,
          rowIndex: currentEditingOrder.rowIndex.toString(),
          status: editStatus,
          tracking: editTracking,
          orderUUID: editUUID,
        }),
      });
      const result = JSON.parse(await res.text());
      if (!res.ok || result?.error)
        throw new Error(result?.error || "Update failed");

      actionMsg = `"${currentEditingOrder.item}" updated!`;

      // ⚡ Optimistic: update local store immediately
      dataService.updateOrderOptimistic(currentEditingOrder.id, {
        status: editStatus,
        tracking: editTracking,
        orderUUID: editUUID,
      });

      undoFn = () => {
        dataService.updateOrderOptimistic(editId, {
          status: prevStatus,
          tracking: prevTracking,
          orderUUID: prevUUID,
        });
        fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            idToken: authStore.idToken,
            action: 'updateOrderStatus',
            id: editId,
            rowIndex: String(editRowIndex),
            status: prevStatus || "",
            tracking: prevTracking || "",
            orderUUID: prevUUID || "",
          }),
        }).then(() => dataService.load(true, true));
      };

      closeEdit();
      // Silent background sync for authoritative data
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Update failed";
    } finally {
      editSaving = false;
    }
  }

  function requestDelete() {
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  async function deleteOrder() {
    if (!currentEditingOrder) return;
    
    const editId = currentEditingOrder.id;
    
    deleteSaving = true;
    actionErr = "";
    undoFn = null;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: authStore.idToken, action: 'deleteOrder', uuid: editId }),
      });
      const result = JSON.parse(await res.text());

      if (!res.ok || result?.error) {
        throw new Error(result?.error || "Delete failed");
      }

      actionMsg = "Order deleted permanently.";

      // 🔥 Optimistic UI Update: Remove from local state
      dataService.deleteOrderOptimistic(editId);

      closeEdit();
      showDeleteConfirm = false;
      
      // Perform background re-sync
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Delete failed";
      console.error("Delete Order Error:", e);
    } finally {
      deleteSaving = false;
      showDeleteConfirm = false;
    }
  }

  function exportMasterCSV() {
    if (!masterTransactions || !masterTransactions.length) return;
    const headers = [
      "Date",
      "Type",
      "Source/Item",
      "Category",
      "Team",
      "Status",
      "Amount",
    ];
    const csvRows = [headers.join(",")];
    for (const row of masterTransactions) {
      const values = [
        row.date,
        row.type,
        row.source,
        row.category,
        row.team,
        row.status,
        row.amount,
      ].map((val) => `"${String(val || "").replace(/"/g, '""')}"`);
      csvRows.push(values.join(","));
    }
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute(
      "download",
      `westwood_finance_master_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Generate a stable hue from an order UUID
  function getOrderColor(/** @type {string|undefined} */ uuid) {
    if (!uuid) return "var(--border)";
    let hash = 0;
    for (let i = 0; i < uuid.length; i++) {
      hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 65%, 45%)`;
  }

  // ── Funding Edit Helpers ──────────────────────────────────────────────────────
  /**
   * @param {any} fund
   */
  function openEditFund(fund) {
    editingFund = fund;
    editFundFields = {
      Source: fund.Source || "",
      Amount: fund.Amount || 0,
      Recipient: fund.Recipient || "",
      Notes: fund.Notes || "",
      Type: fund.Type || "Part Order",
      Date: fund.Date || new Date().toISOString().split("T")[0],
    };
    actionMsg = "";
    actionErr = "";
  }

  async function saveFundEdit() {
    if (!editingFund) return;
    const currentFund = /** @type {any} */ (editingFund);
    editSaving = true;
    actionErr = "";
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'updateFunding',
          rowIndex: String(currentFund.rowIndex),
          Source: String(editFundFields.Source),
          Amount: String(editFundFields.Amount),
          Recipient: String(editFundFields.Recipient),
          Notes: String(editFundFields.Notes),
          Type: String(editFundFields.Type),
          Date: formatDate(editFundFields.Date),
        }),
      });
      const result = JSON.parse(await res.text());
      if (!res.ok || result?.error)
        throw new Error(result?.error || "Update failed");

      actionMsg = `Funding entry updated!`;

      // ⚡ Optimistic: update local store immediately
      dataService.funds = dataService.funds.map((f) => {
        if (f.id === currentFund.id) {
          return { ...f, ...editFundFields };
        }
        return f;
      });
      dataService.persist();

      editingFund = null;
      // Silent background sync
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Update failed";
    } finally {
      editSaving = false;
    }
  }

  async function adminAddOrder() {
    actionErr = "";
    actionMsg = "";
    if (!addOrderForm.item.trim()) {
      actionErr = "Item name is required.";
      return;
    }
    if (!addOrderForm.price || isNaN(Number(addOrderForm.price))) {
      actionErr = "Valid price is required.";
      return;
    }
    if (!addOrderForm.notes.trim()) {
      actionErr = "Team Notes (Reason for order) is required.";
      return;
    }

    addOrderSubmitting = true;
    try {
      let finalLink = addOrderForm.link.trim();
      if (finalLink && !finalLink.startsWith("http")) {
        finalLink = "https://" + finalLink;
      }

      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'addOrder',
          item: addOrderForm.item,
          company: addOrderForm.company,
          link: finalLink,
          price: String(addOrderForm.price),
          quantity: String(addOrderForm.quantity),
          notes: addOrderForm.notes,
          category: addOrderForm.category,
          team: addOrderForm.team,
          status: addOrderForm.status,
          timestamp: formatDate(new Date()),
        }),
      });
      const result = JSON.parse(await res.text());
      if (!res.ok || result?.error)
        throw new Error(result?.error || "Request failed");

      actionMsg = "Order recorded successfully!";

      // ⚡ Optimistic: inject into local store instantly
      dataService.addOrderOptimistic({
        item: addOrderForm.item,
        company: addOrderForm.company,
        link: finalLink,
        price: Number(addOrderForm.price) || 0,
        quantity: Number(addOrderForm.quantity) || 1,
        notes: addOrderForm.notes,
        category: addOrderForm.category,
        team: addOrderForm.team,
        status: addOrderForm.status,
        timestamp: new Date().toISOString(),
      });

      addOrderForm = {
        item: "",
        company: "",
        link: "",
        price: "",
        quantity: "1",
        notes: "",
        team: "FRC",
        category: "hardware",
        status: "Received",
      };
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Request failed";
    } finally {
      addOrderSubmitting = false;
    }
  }

  async function addFunds() {
    actionErr = "";
    actionMsg = "";
    if (!addFundsForm.source.trim()) {
      actionErr = "Source is required.";
      return;
    }
    if (!addFundsForm.amount || isNaN(Number(addFundsForm.amount))) {
      actionErr = "A valid amount is required.";
      return;
    }
    if (!addFundsForm.date) {
      actionErr = "Date is required.";
      return;
    }

    addFundsSubmitting = true;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'addFundraising',
          type: addFundsForm.type,
          source: addFundsForm.source,
          amount: addFundsForm.amount,
          date: addFundsForm.date,
          notes: addFundsForm.notes,
          recipient: addFundsForm.recipient,
        }),
      });
      const result = JSON.parse(await res.text());
      if (!res.ok || result?.error)
        throw new Error(result?.error || "Request failed");

      actionMsg = "Funding entry added!";

      // ⚡ Optimistic: inject into local store instantly
      dataService.addFundOptimistic({
        Type: addFundsForm.type,
        Source: addFundsForm.source,
        Amount: Number(addFundsForm.amount) || 0,
        Date: addFundsForm.date,
        Notes: addFundsForm.notes,
        Recipient: addFundsForm.recipient,
      });

      addFundsForm = {
        type: "Fundraiser",
        source: "",
        amount: "",
        date: "",
        notes: "",
        recipient: "Westwood Overall",
      };
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Update failed";
    } finally {
      addFundsSubmitting = false;
    }
  }

  /** @param {any[]} orders */
  async function linkGroupOrders(orders) {
    if (!orders || orders.length < 2) return;

    syncing = true;
    actionMsg = "Linking " + orders.length + " orders...";

    // Pick first valid UUID or generate new
    const targetUUID =
      orders.find((o) => o.orderUUID)?.orderUUID || generateShortId();

    try {
      const promises = orders.map((/** @type {any} */ o) =>
        fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ idToken: authStore.idToken, action: 'updateOrderStatus', id: o.id, rowIndex: String(o.rowIndex), orderUUID: targetUUID }),
        }).then((r) => r.text()).then(JSON.parse)
      );

      const results = await Promise.all(promises);
      if (results.some((r) => r.error)) throw new Error("Batch link failed");

      actionMsg = "✓ Linked into Order #" + targetUUID;

      orders.forEach((/** @type {any} */ o) =>
        dataService.updateOrderOptimistic(o.id, { orderUUID: targetUUID }),
      );
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Error linking orders";
    } finally {
      syncing = false;
    }
  }

  /** @type {any[] | null} */
  let editingGroupOrders = $state(null);
  let groupStatus = $state("Ordered");

  /** @param {any[]} orders */
  function openGroupStatusModal(orders) {
    editingGroupOrders = orders;
    groupStatus = "Ordered";
  }

  async function saveGroupStatus() {
    if (!editingGroupOrders) return;
    
    const prevStates = editingGroupOrders.map((/** @type {any} */ o) => ({ id: o.id, rowIndex: o.rowIndex, status: o.status }));
    
    syncing = true;
    actionErr = "";
    undoFn = null;
    actionMsg = `Updating status for ${editingGroupOrders.length} orders...`;
    
    try {
      const promises = editingGroupOrders.map((/** @type {any} */ o) =>
        fetch(BASE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ idToken: authStore.idToken, action: 'updateOrderStatus', id: o.id, rowIndex: String(o.rowIndex), status: groupStatus }),
        }).then((r) => r.text()).then(JSON.parse)
      );

      const results = await Promise.all(promises);
      if (results.some((/** @type {any} */ r) => r.error)) throw new Error("Batch status update failed");

      actionMsg = `✓ Status updated to ${groupStatus}`;
      editingGroupOrders.forEach((/** @type {any} */ o) => dataService.updateOrderOptimistic(o.id, { status: groupStatus }));
      
      undoFn = () => {
        prevStates.forEach((prev) => {
          dataService.updateOrderOptimistic(prev.id, { status: prev.status });
          fetch(BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ idToken: authStore.idToken, action: 'updateOrderStatus', id: prev.id, rowIndex: String(prev.rowIndex), status: prev.status || "" }),
          });
        });
        setTimeout(() => dataService.load(true, true), 1000);
      };
      
      dataService.load(true, true);
    } catch (e) {
      actionErr = e instanceof Error ? e.message : "Error updating group status";
    } finally {
      syncing = false;
      editingGroupOrders = null;
    }
  }

  // ── Members Management ──────────────────────────────────────────────────────
  let addMemberForm = $state({
    firstName: '',
    lastName: '',
    studentId: '',
    team: 'FRC',
    isAdmin: false,
  });
  let addMemberSubmitting = $state(false);
  let memberActionMsg = $state('');
  let memberActionErr = $state('');

  async function addNewMember() {
    memberActionMsg = '';
    memberActionErr = '';

    if (!addMemberForm.firstName.trim() || !addMemberForm.lastName.trim()) {
      memberActionErr = 'First and last name are required.';
      return;
    }
    const cleanId = addMemberForm.studentId.replace(/^s/i, '').trim();
    if (!cleanId || cleanId.length !== 6 || !/^\d{6}$/.test(cleanId)) {
      memberActionErr = 'Student ID must be exactly 6 digits (without the S).';
      return;
    }

    addMemberSubmitting = true;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'addMember',
          firstName: addMemberForm.firstName.trim(),
          lastName: addMemberForm.lastName.trim(),
          studentId: cleanId,
          team: addMemberForm.team,
          role: addMemberForm.isAdmin ? 'admin' : '',
        }),
      });
      const result = JSON.parse(await res.text());
      if (result.error) throw new Error(result.error);

      memberActionMsg = `✓ ${addMemberForm.firstName} ${addMemberForm.lastName} approved!`;
      addMemberForm = { firstName: '', lastName: '', studentId: '', team: 'FRC', isAdmin: false };

      // Refresh members list
      await authStore.fetchMembers();
    } catch (e) {
      memberActionErr = e instanceof Error ? e.message : 'Failed to add member';
    } finally {
      addMemberSubmitting = false;
    }
  }

  /** @param {string} studentId */
  async function removeMember(studentId) {
    memberActionMsg = '';
    memberActionErr = '';
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: authStore.idToken, action: 'removeMember', studentId }),
      });
      const result = JSON.parse(await res.text());
      if (result.error) throw new Error(result.error);

      memberActionMsg = '✓ Member removed.';
      await authStore.fetchMembers();
    } catch (e) {
      memberActionErr = e instanceof Error ? e.message : 'Failed to remove member';
    }
  }

</script>

<svelte:head>
  <title>Admin Dashboard | Westwood Finance</title>
</svelte:head>

{#if !authStore.isAdmin}
  <div class="admin-auth-container" style="text-align:center; padding: 80px 20px;">
    <h2 style="color: #fff; margin-bottom: 12px;">Access Denied</h2>
    <p style="color: var(--text-muted); margin-bottom: 24px;">You need admin privileges to access this page.</p>
    <a href="/" class="btn btn-primary">Back to Dashboard</a>
  </div>
{:else}
  <div class="page-header">
    <div class="header-left">
      <h1>Admin <span>Portal</span></h1>
    </div>

    <div
      class="header-right"
      style="display: flex; align-items: center; gap: 12px;"
    >
      <button class="btn btn-ghost btn-sm refresh-btn" onclick={sync} disabled={syncing}>
        <span class:spinning={syncing}>↻</span>
        <span class="hide-mobile">{syncing ? "Syncing..." : "Refresh"}</span>
      </button>
    </div>
  </div>

  <!-- ── Tab Nav ──────────────────────────────────────────────────────── -->
  <div class="tabs-wrapper" style="margin-bottom: 32px;">
    <div
      class="segmented-control"
      style="width: auto; min-width: 750px; margin: 0 auto; position: relative; grid-template-columns: repeat(7, 1fr);"
    >
      <div
        class="segment-highlight"
        style="transform: translateX(calc({[
          'orderHistory',
          'orders',
          'master',
          'funding',
          'add',
          'addOrder',
          'members',
        ].indexOf(activeView)} * 100%)); width: calc((100% - 10px) / 7);"
      ></div>
      <button
        class="segment"
        class:active={activeView === "orderHistory"}
        onclick={() => (activeView = "orderHistory")}
      >
        Order History
      </button>
      <button
        class="segment"
        class:active={activeView === "orders"}
        onclick={() => (activeView = "orders")}
      >
        Orders
      </button>
      <button
        class="segment"
        class:active={activeView === "master"}
        onclick={() => (activeView = "master")}
      >
        Finance History
      </button>
      <button
        class="segment"
        class:active={activeView === "funding"}
        onclick={() => (activeView = "funding")}
      >
        Funding
      </button>
      <button
        class="segment"
        class:active={activeView === "add"}
        onclick={() => (activeView = "add")}
      >
        Add Funds +
      </button>
      <button
        class="segment"
        class:active={activeView === "addOrder"}
        onclick={() => (activeView = "addOrder")}
      >
        Add Expense +
      </button>
      <button
        class="segment"
        class:active={activeView === "members"}
        onclick={() => (activeView = "members")}
      >
        Members
      </button>
    </div>
  </div>

  {#if actionMsg}
    <div class="success-bar message-bar" style="justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <Check size={16} />
        {actionMsg}
      </div>
      {#if undoFn}
        <button class="btn btn-ghost btn-sm" onclick={() => { if(undoFn) undoFn(); undoFn = null; actionMsg = "Action undone."; }} style="padding: 4px 12px; margin-left: auto;">
          Undo
        </button>
      {/if}
    </div>
  {/if}
  {#if actionErr}
    <div class="error-bar message-bar">
      <Info size={16} />
      {actionErr}
    </div>
  {/if}

  {#if activeView === "orderHistory"}
    <section class="fade-in">
      <div
        class="section-title"
        style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;"
      >
        <span>Order History ({dataService.orders.length})</span>
      </div>
      <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">
        Manage order statuses, UUIDs, and tracking links. Updates sync directly
        to Google Sheets.
      </p>

      <div class="card orders-card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !dataService.orders.length}
          <LoadingIndicator text="Loading admin backlog..." />
        {:else if dataService.orders.length === 0}
          <div class="empty-state fade-in">
            <div class="icon">
              <Package size={48} stroke-width={1} />
            </div>
            <h3>No requests on file</h3>
            <p>New requests will appear here for admin action.</p>
          </div>
        {:else}
          <div class="table-wrap" style="border: none; border-radius: 0;">
            <table>
              <thead>
                <tr>
                  <th class="sortable" style="padding-left: 24px;" onclick={() => toggleAdminSort('item')}>
                    <div class="th-content">Provision/Item {adminSortCol === 'item' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('category')}>
                    <div class="th-content">Category {adminSortCol === 'category' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('team')}>
                    <div class="th-content">Team {adminSortCol === 'team' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('timestamp')}>
                    <div class="th-content">Date {adminSortCol === 'timestamp' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable text-right" onclick={() => toggleAdminSort('total')}>
                    <div class="th-content text-right">Investment {adminSortCol === 'total' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="sortable" onclick={() => toggleAdminSort('status')}>
                    <div class="th-content">Status {adminSortCol === 'status' ? (adminSortDir === 'asc' ? '↑' : '↓') : ''}</div>
                  </th>
                  <th class="text-right" style="padding-right: 24px;"></th>
                </tr>
              </thead>
              <tbody>
                {#each sortedAdminOrders as order (order.id)}
                  {@const orderColor = getOrderColor(order.orderUUID)}
                  <tr
                    class="fade-in group-row"
                    style="--group-color: {orderColor}"
                  >
                    <td style="padding-left: 24px;">
                      <div class="item-primary">
                        {#if order.link}
                          <button type="button" class="admin-link-btn" onclick={() => openExternal(order.link)}>
                            {order.item} ↗
                          </button>
                        {:else}
                          {order.item}
                        {/if}
                      </div>
                      {#if order.company || order.notes}
                        <div class="item-secondary">
                          {order.company || ""}
                          {order.notes ? `· ${order.notes}` : ""}
                        </div>
                      {/if}
                    </td>
                    <td>
                      <span
                        class="badge badge-{(
                          order.category || ''
                        ).toLowerCase()}"
                      >
                        {capitalize(order.category) || "—"}
                      </span>
                    </td>
                    <td>{order.team || "—"}</td>
                    <td class="text-dim">{formatFullDate(order.timestamp)}</td>
                    <td class="text-right monospace amount">
                      {formatCurrency(order.total)}
                    </td>
                    <td><OrderStatusBadge status={order.status} /></td>
                    <td class="text-right" style="padding-right: 24px;">
                      <button
                        class="btn btn-primary btn-sm"
                        onclick={() => openEdit(order)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>
  {:else if activeView === "orders"}
    <section class="fade-in">
      <div
        class="section-title"
        style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;"
      >
        <span>Pending Orders by Vendor ({newTabOrders.length})</span>
      </div>

      {#if Object.keys(groupedCompanyOrders).length === 0}
        <div class="card empty-state fade-in" style="margin-bottom: 24px;">
          <div class="icon">
            <Package size={48} stroke-width={1.2} />
          </div>
          <h3>All caught up</h3>
          <p>There are no active orders to display.</p>
        </div>
      {:else}
        {#each Object.entries(groupedCompanyOrders) as [company, compOrders]}
          <div style="margin-bottom: 32px;" class="fade-in">
            <h3
              style="margin-bottom: 12px; color: var(--primary); font-size: 1.25rem;"
            >
              {company}
              <span
                class="badge badge-hardware"
                style="margin-left: 10px; padding: 4px 10px; font-weight: 600; vertical-align: middle; line-height: 1;"
                >Quantity: {compOrders.length}</span
              >

              {#if compOrders.length > 1}
                <button
                  class="badge badge-hardware admin-action-tag"
                  onclick={() => linkGroupOrders(compOrders)}
                  disabled={syncing}
                >
                  Merge Group
                </button>
              {/if}
              {#if compOrders.length > 0}
                <button
                  class="badge badge-hardware admin-action-tag"
                  onclick={() => openGroupStatusModal(compOrders)}
                  disabled={syncing}
                >
                  Change All Status
                </button>
              {/if}
            </h3>
            <OrderTable
              orders={compOrders}
              hideCategoryColumn={true}
              hideCompanyColumn={true}
              onmanage={openEdit}
            />
          </div>
        {/each}
      {/if}
    </section>
  {:else if activeView === "funding"}
    <!-- ── Funding Management ────────────────────────────────────────────────── -->
    <section class="fade-in">
      <div class="section-title" style="margin-bottom:12px">
        Manage Funding & Grants ({dataService.funds.length})
      </div>
      <p class="text-muted" style="margin-bottom:16px;font-size:0.875rem">
        Edit funding sources, amounts, and recipients. These changes sync to the
        Fundraising sheet.
      </p>

      <div class="card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !dataService.funds.length}
          <LoadingIndicator text="Loading funds..." />
        {:else if dataService.funds.length === 0}
          <div class="empty-state">
            <div class="icon">
              <DollarSign size={48} stroke-width={1} />
            </div>
            No funding entries found.
          </div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Source</th>
                  <th>Team</th>
                  <th>Date</th>
                  <th class="text-right">Amount</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each dataService.funds as fund (fund.id)}
                  <tr class="fade-in">
                    <td><span class="type-tag">{fund.Type || "—"}</span></td>
                    <td style="font-weight:500">{fund.Source || "—"}</td>
                    <td>{fund.Recipient || "—"}</td>
                    <td
                      class="text-dim"
                      style="font-size:0.875rem; color: var(--text-dim);"
                      >{formatFullDate(fund.Date)}</td
                    >
                    <td
                      class="text-right monospace"
                      style="font-weight:600;color:#6bcb77"
                      >{formatCurrency(fund.Amount)}</td
                    >
                    <td class="text-muted" style="font-size:0.8rem"
                      >{fund.Notes || "—"}</td
                    >
                    <td>
                      <button
                        class="btn btn-primary btn-sm"
                        onclick={() => openEditFund(fund)}
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr style="border-top: 2px solid var(--border);">
                  <td
                    colspan="4"
                    style="font-weight: 700; text-align: right; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; padding: 12px 16px;"
                    >Total Funding</td
                  >
                  <td
                    class="text-right monospace"
                    style="color:#6bcb77; font-weight: 700; font-size: 1rem; padding: 12px 16px;"
                  >
                    {formatCurrency(
                      dataService.funds.reduce(
                        (sum, f) => sum + (Number(f.Amount) || 0),
                        0,
                      ),
                    )}
                  </td>
                  <td colspan="2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        {/if}
      </div>
    </section>
  {:else if activeView === "master"}
    <section class="fade-in">
      <div
        class="section-title"
        style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;"
      >
        <span>Master Finance History ({masterTransactions.length})</span>
        <button
          class="btn btn-ghost btn-sm"
          onclick={exportMasterCSV}
          disabled={!masterTransactions.length}
        >
          ↓ Export CSV
        </button>
      </div>

      <div class="card orders-card" style="padding:0;overflow:hidden">
        {#if dataService.loading && !masterTransactions.length}
          <LoadingIndicator text="Loading ledger..." />
        {:else if masterTransactions.length === 0}
          <div class="empty-state">
            <div class="icon">
              <Receipt size={48} stroke-width={1} />
            </div>
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
                  <th>Team</th>
                  <th>Status</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each masterTransactions as tx (tx.id + tx.type)}
                  <tr class="fade-in">
                    <td
                      class="text-dim monospace"
                      style="color: var(--text-dim);">{tx.date}</td
                    >
                    <td style="font-weight:600; color: #fff;"
                      >{tx.source || "—"}</td
                    >
                    <td>
                      <span
                        class="badge {tx.type === 'Income'
                          ? 'badge-awarded'
                          : 'badge-rejected'}"
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td>{capitalize(tx.category) || "—"}</td>
                    <td>{tx.team || "—"}</td>
                    <td><OrderStatusBadge status={tx.status} /></td>
                    <td
                      class="text-right monospace"
                      style="font-weight:700; color: {tx.amount > 0
                        ? 'var(--status-awarded)'
                        : 'var(--status-rejected)'}"
                    >
                      {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>
  {:else if activeView === "add"}
    <!-- ── Add Funds ────────────────────────────────────────────────────────── -->
    <div
      class="add-layout fade-in"
    >
      <div class="card add-card">
        <h3 style="margin-bottom:20px; color: var(--primary);">
          Add Funding Entry
        </h3>

        <form
          onsubmit={(e) => {
            e.preventDefault();
            addFunds();
          }}
          id="add-funds-form"
        >
          <div
            class="form-grid"
          >
            <div class="form-group">
              <label for="f-type">History Type *</label>
              <CustomDropdown
                options={typeOptions}
                bind:value={addFundsForm.type}
              />
            </div>

            <div class="form-group">
              <label for="f-recipient">Destination Team *</label>
              <CustomDropdown
                options={recipientOptions}
                bind:value={addFundsForm.recipient}
              />
            </div>

            <div class="form-group" style="grid-column:1/-1">
              <label for="f-source">Source / Description *</label>
              <input
                id="f-source"
                type="text"
                bind:value={addFundsForm.source}
                placeholder="ex. Member Dues"
                required
              />
            </div>

            <div class="form-group">
              <label for="f-amount">Amount ($) *</label>
              <input
                id="f-amount"
                type="number"
                bind:value={addFundsForm.amount}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>

            <div class="form-group">
              <label for="f-date">Date</label>
              <input id="f-date" type="date" bind:value={addFundsForm.date} />
            </div>

            <div class="form-group" style="grid-column:1/-1">
              <label for="f-notes">Notes</label>
              <textarea
                id="f-notes"
                bind:value={addFundsForm.notes}
                rows="3"
                placeholder="Any additional context…"
              ></textarea>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            style="margin-top:24px; width: 100%; justify-content: center;"
            disabled={addFundsSubmitting}
          >
            {addFundsSubmitting ? "Saving…" : "+ Add Entry"}
          </button>
        </form>
      </div>

      <aside class="tips-card card hide-mobile" style="padding: 24px;">
        <div
          class="card-title"
          style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;"
        >
          Entry Tips
        </div>
        <ul
          class="tips-list"
          style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem;"
        >
          <li style="color: var(--text-dim); line-height: 1.4;">
            Use <strong>All</strong> for income that gets distributed equally.
          </li>
          <li style="color: var(--text-dim); line-height: 1.4;">
            <strong>Grants</strong> and <strong>Sponsors</strong> go to specific
            teams.
          </li>
          <li style="color: var(--text-dim); line-height: 1.4;">
            Date is optional but recommended.
          </li>
        </ul>

        <div style="margin-top:24px">
          <div
            class="card-title"
            style="font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;"
          >
            Fund Types
          </div>
          <div
            style="display:flex; flex-direction:column; gap:8px; margin-top:8px"
          >
            {#each typeOptions as t}
              <span
                class="type-tag"
                style="font-size: 0.75rem; padding: 4px 8px; background: var(--surface-2); border-left: 3px solid {TYPE_COLORS[
                  t.value
                ] || '#8a8a8a'};"
              >
                {t.label}
              </span>
            {/each}
          </div>
        </div>
      </aside>
    </div>
  {:else if activeView === "addOrder"}
    <!-- ── Add Expense ──────────────────────────────────────────────────────── -->
    <div
      class="add-layout fade-in"
    >
      <div class="card add-card">
        <h3 style="margin-bottom:20px; color: var(--primary);">
          Record Manual Expense
        </h3>

        <form
          onsubmit={(e) => {
            e.preventDefault();
            adminAddOrder();
          }}
        >
          <div
            class="form-grid"
          >
            <div class="form-group" style="grid-column: 1 / -1">
              <label for="ae-item">Item Name *</label>
              <input
                id="ae-item"
                type="text"
                bind:value={addOrderForm.item}
                placeholder="ex. Pit Banner"
                required
              />
            </div>

            <div class="form-group">
              <label for="ae-company">Vendor / Company *</label>
              <input
                id="ae-company"
                type="text"
                bind:value={addOrderForm.company}
                placeholder="ex. REV Robotics"
                required
              />
            </div>

            <div class="form-group">
              <label for="ae-team">Team *</label>
              <CustomDropdown
                options={recipientOptions}
                bind:value={addOrderForm.team}
              />
            </div>

            <div class="form-group">
              <label for="ae-price">Unit Price ($) *</label>
              <input
                id="ae-price"
                type="number"
                step="0.01"
                bind:value={addOrderForm.price}
                placeholder="0.00"
                required
              />
            </div>

            <div class="form-group">
              <label for="ae-qty">Quantity *</label>
              <input
                id="ae-qty"
                type="number"
                bind:value={addOrderForm.quantity}
                min="1"
                required
              />
            </div>

            <div class="form-group">
              <label for="ae-category">Category *</label>
              <CustomDropdown
                options={[
                  { label: "Hardware", value: "hardware" },
                  { label: "Software", value: "software" },
                  { label: "Outreach", value: "outreach" },
                  { label: "Miscellaneous", value: "miscellaneous" },
                ]}
                bind:value={addOrderForm.category}
              />
            </div>

            <div class="form-group">
              <label for="ae-status">Initial Status</label>
              <CustomDropdown
                options={ORDER_STATUSES.map((s) => ({ label: s, value: s }))}
                bind:value={addOrderForm.status}
              />
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label for="ae-link">Link</label>
              <input
                id="ae-link"
                type="text"
                bind:value={addOrderForm.link}
                placeholder="https://..."
              />
            </div>

            <div class="form-group" style="grid-column: 1 / -1">
              <label for="ae-notes">Notes *</label>
              <textarea
                id="ae-notes"
                rows="3"
                bind:value={addOrderForm.notes}
                placeholder="Reason for ordering this item..."
                required
              ></textarea>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary"
            style="margin-top:24px; width: 100%; justify-content: center;"
            disabled={addOrderSubmitting}
          >
            {addOrderSubmitting ? "Recording..." : "Confirm Expense Entry"}
          </button>
        </form>
      </div>

      <aside class="tips-card card hide-mobile" style="padding: 24px;">
        <div class="card-title">Expense Control</div>
        <p class="text-muted" style="font-size: 0.85rem; line-height: 1.5;">
          This form allows you to bypass the standard request flow and record an
          expense immediately with its final status.
        </p>
        <ul
          style="margin: 16px 0 0 16px; padding: 0; font-size: 0.8rem; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px;"
        >
          <li>Use Received for items already bought and in-hand.</li>
          <li>Use Ordered for items paid for but still in transit.</li>
          <li>
            Setting status to Approved puts it in the pending orders list.
          </li>
        </ul>
      </aside>
    </div>
  {:else if activeView === "members"}
    <!-- ── Members Management ──────────────────────────────────────────── -->
    <div class="add-layout fade-in">
      <div class="card add-card">
        <h3 style="margin-bottom:4px; color: var(--primary);">
          Approve New Member
        </h3>
        <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 20px;">
          Add a member to grant them access to the site. They'll be able to see data for their assigned team.
        </p>

        {#if memberActionMsg}
          <div class="success-bar message-bar">
            <Check size={16} />
            {memberActionMsg}
          </div>
        {/if}
        {#if memberActionErr}
          <div class="error-bar message-bar">
            <Info size={16} />
            {memberActionErr}
          </div>
        {/if}

        <form onsubmit={(e) => { e.preventDefault(); addNewMember(); }}>
          <div class="form-grid">
            <div class="form-group">
              <label for="member-first">First Name *</label>
              <input id="member-first" type="text" bind:value={addMemberForm.firstName} placeholder="Jane" required />
            </div>
            <div class="form-group">
              <label for="member-last">Last Name *</label>
              <input id="member-last" type="text" bind:value={addMemberForm.lastName} placeholder="Doe" required />
            </div>
            <div class="form-group">
              <label for="member-sid">Student ID (6 digits, no S) *</label>
              <input id="member-sid" type="text" inputmode="numeric" maxlength="6" bind:value={addMemberForm.studentId} placeholder="123456" required />
            </div>
            <div class="form-group">
              <label for="member-team">Team *</label>
              <CustomDropdown
                options={[
                  { label: "FRC", value: "FRC" },
                  { label: "Kunai", value: "Kunai" },
                  { label: "Slingshot", value: "Slingshot" },
                  { label: "Hunga Munga", value: "Hunga Munga" },
                  { label: "Atlatl", value: "Atlatl" },
                ]}
                bind:value={addMemberForm.team}
              />
            </div>
            <div class="form-group" style="display: flex; align-items: center; gap: 10px; padding-top: 24px;">
              <input id="member-admin" type="checkbox" bind:checked={addMemberForm.isAdmin} style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;" />
              <label for="member-admin" style="margin: 0; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #fff;">Grant Admin Access</label>
            </div>
          </div>

          <button type="submit" class="btn btn-primary" style="margin-top:24px; width: 100%; justify-content: center;" disabled={addMemberSubmitting}>
            {addMemberSubmitting ? "Adding..." : "Approve Member"}
          </button>
        </form>
      </div>

      <aside class="tips-card card hide-mobile" style="padding: 24px;">
        <div class="card-title">Member Access</div>
        <p class="text-muted" style="font-size: 0.85rem; line-height: 1.5;">
          Approved members can only view data for their assigned team. Admin members get full access to all teams and this portal.
        </p>
        <ul style="margin: 16px 0 0 16px; padding: 0; font-size: 0.8rem; color: var(--text-dim); display: flex; flex-direction: column; gap: 8px;">
          <li>Members sign in with Google and enter their Student ID</li>
          <li>Unapproved users see "Ask Ishaan to approve you"</li>
          <li>Admins see all teams and can manage orders</li>
          <li>Regular members only see their own team's data</li>
        </ul>
      </aside>
    </div>

    <!-- Current Members List -->
    <section class="fade-in" style="margin-top: 32px;">
      <div class="section-title" style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;">
        <span>Approved Members ({authStore.membersList.length})</span>
        <button class="btn btn-ghost btn-sm" onclick={() => authStore.fetchMembers()} style="font-size: 0.75rem;">
          ↻ Refresh List
        </button>
      </div>

      <div class="card orders-card" style="padding:0; overflow:hidden;">
        {#if authStore.membersList.length === 0}
          <div class="empty-state" style="padding: 40px;">
            No approved members yet. Add someone above.
          </div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th style="width: 80px; text-align: center;">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each authStore.membersList as m (m.studentId)}
                  <tr>
                    <td style="font-weight: 600; color: #fff;">{m.firstName} {m.lastName}</td>
                    <td class="monospace" style="color: var(--text-muted);">{m.studentId}</td>
                    <td><span class="badge" style="font-size: 0.75rem;">{m.team}</span></td>
                    <td>
                      {#if m.role === 'admin'}
                        <span class="badge badge-awarded" style="font-size: 0.7rem;">Admin</span>
                      {:else}
                        <span style="color: var(--text-dim); font-size: 0.8rem;">Member</span>
                      {/if}
                    </td>
                    <td style="text-align: center;">
                      <button
                        class="btn btn-ghost btn-sm"
                        style="color: var(--status-rejected); font-size: 0.7rem; padding: 4px 8px;"
                        onclick={() => removeMember(m.studentId)}
                        title="Remove member"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </section>
  {/if}
{/if}

<!-- ── Mobile Tab FAB (bottom right, admin) ────────────────────────────── -->
{#if authStore.isAdmin && isMobile}
  {#if showTabMenu}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div class="tab-fab-backdrop" onclick={() => showTabMenu = false} role="button" tabindex="-1"></div>
    <div class="tab-fab-menu">
      {#each [
        ['orderHistory', 'Order History'],
        ['orders', 'Orders'],
        ['master', 'Finance History'],
        ['funding', 'Funding'],
        ['add', 'Add Funds +'],
        ['addOrder', 'Add Expense +'],
        ['members', 'Members'],
      ] as [key, label]}
        <button class="tab-fab-option" class:active={activeView === key} onclick={() => { activeView = key; showTabMenu = false; }}>{label}</button>
      {/each}
    </div>
  {/if}
  <button class="page-fab" onclick={() => showTabMenu = !showTabMenu} aria-label="Switch admin view">
    <Grid2x2 size={20} />
  </button>
{/if}

<!-- ── Group Status Edit Modal ──────────────────────────────────────────────────────── -->
{#if editingGroupOrders}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={() => (editingGroupOrders = null)}
    onkeydown={(e) => e.key === "Escape" && (editingGroupOrders = null)}
    role="button"
    tabindex="0"
  >
    <div
      class="modal-card card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="modal-header">
        <div>
          <h2 style="margin:0">Change Group Status</h2>
          <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">
            Update {editingGroupOrders ? editingGroupOrders.length : 0} orders
          </p>
        </div>
        <button
          class="modal-close"
          onclick={() => (editingGroupOrders = null)}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {#if actionErr}<div class="error-bar">{actionErr}</div>{/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          saveGroupStatus();
        }}
      >
        <div class="modal-fields">
          <div class="form-group">
            <label for="group-status">New Status</label>
            <CustomDropdown
              options={ORDER_STATUSES.map((s) => ({ label: s, value: s }))}
              bind:value={groupStatus}
            />
          </div>
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" disabled={syncing}>
            {syncing ? "Saving…" : "Save Status"}
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (editingGroupOrders = null)}>Cancel</button
          >
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Funding Edit Modal ──────────────────────────────────────────────────────── -->
{#if editingFund}
  {@const currentFund = /** @type {any} */ (editingFund)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={() => (editingFund = null)}
    onkeydown={(e) => e.key === "Escape" && (editingFund = null)}
    role="button"
    tabindex="0"
  >
    <div
      class="modal-card card"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="modal-header">
        <div>
          <h2 style="margin:0">Edit Funding Entry</h2>
          <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">
            {currentFund.Source}
          </p>
        </div>
        <button
          class="modal-close"
          onclick={() => (editingFund = null)}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {#if actionErr}<div class="error-bar">{actionErr}</div>{/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          saveFundEdit();
        }}
      >
        <div class="modal-fields">
          <div class="form-group">
            <label for="fund-source">Source</label>
            <input id="fund-source" bind:value={editFundFields.Source} />
          </div>
          <div class="form-group">
            <label for="fund-amount">Amount</label>
            <input
              id="fund-amount"
              type="number"
              step="0.01"
              bind:value={editFundFields.Amount}
            />
          </div>
          <div class="form-group">
            <label for="fund-recipient">Recipient / Team</label>
            <input id="fund-recipient" bind:value={editFundFields.Recipient} />
          </div>
          <div class="form-group">
            <label for="fund-date">Date</label>
            <input
              id="fund-date"
              type="date"
              bind:value={editFundFields.Date}
            />
          </div>
          <div class="form-group" style="grid-column: 1 / -1">
            <label for="fund-notes">Notes</label>
            <textarea id="fund-notes" bind:value={editFundFields.Notes}
            ></textarea>
          </div>
        </div>

        <div class="modal-actions">
          <button type="submit" class="btn btn-primary" disabled={editSaving}>
            {editSaving ? "Saving…" : "Save Entry"}
          </button>
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (editingFund = null)}>Cancel</button
          >
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Edit Modal ────────────────────────────────────────────────────────────── -->
{#if currentEditingOrder}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    onclick={closeEdit}
    onkeydown={(e) => e.key === "Escape" && closeEdit()}
    role="button"
    tabindex="0"
    aria-label="Close modal"
  >
    <div
      class="modal-card card"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Edit Order"
      tabindex="-1"
    >
      <div class="modal-header">
        <div>
          <h2 style="margin:0">Edit Order</h2>
          <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem">
            {currentEditingOrder.item}
          </p>
        </div>
        <button class="modal-close" onclick={closeEdit} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {#if actionErr}
        <div class="error-bar" style="margin-bottom:16px">{actionErr}</div>
      {/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          saveEdit();
        }}
        id="edit-order-form"
      >
        <div class="modal-fields">
          <div class="form-group">
            <label for="edit-status">Status</label>
            <CustomDropdown options={ORDER_STATUSES} bind:value={editStatus} />
          </div>

          <div class="form-group">
            <label for="edit-uuid">Order UUID</label>
            <input
              id="edit-uuid"
              type="text"
              bind:value={editUUID}
              placeholder="ex. RFV2RF"
            />
          </div>

          {#if groupingOptions.length > 0}
            <div
              class="form-group"
              style="grid-column: 1 / -1; margin-top: 4px;"
            >
              <div
                style="font-size: 0.85rem; padding: 10px 14px; background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 16px;"
              >
                <span
                  class="text-dim"
                  style="margin: 0; font-weight: 500; white-space: nowrap;"
                  >Order grouping</span
                >
                <div style="flex-grow: 1; max-width: 70%;">
                  <CustomDropdown
                    options={groupingOptions}
                    bind:value={editUUID}
                    onchange={(/** @type {any} */ e) => {
                      if (e.target.value === "__NEW__") {
                        editUUID = generateShortId();
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          {/if}

          <div class="form-group" style="grid-column: 1 / -1">
            <label for="edit-tracking">Tracking Link</label>
            <input
              id="edit-tracking"
              type="text"
              bind:value={editTracking}
              placeholder="Please provide a LINK"
            />
          </div>
        </div>

        <div class="order-summary">
          <div class="summary-row">
            <span>Company</span><span>{currentEditingOrder.company || "—"}</span
            >
          </div>
          <div class="summary-row">
            <span>Team</span><span>{currentEditingOrder.team || "—"}</span>
          </div>
          <div class="summary-row">
            <span>Category</span><span
              >{currentEditingOrder.category || "—"}</span
            >
          </div>
          <div class="summary-row">
            <span>Total</span><span
              >{formatCurrency(currentEditingOrder.total)}</span
            >
          </div>
        </div>

        <div
          class="modal-actions"
          style="display: flex; justify-content: space-between; width: 100%;"
        >
          <button
            type="button"
            class="btn btn-ghost"
            style="color: var(--status-rejected);"
            onclick={requestDelete}
            disabled={editSaving}
          >
            Delete Order
          </button>
          <div style="display: flex; gap: 8px;">
            <button
              type="button"
              class="btn btn-ghost"
              onclick={closeEdit}
              disabled={editSaving}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={editSaving}>
              {editSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ── Delete Confirmation Modal ────────────────────────────────────────────── -->
{#if showDeleteConfirm}
  <div class="modal-backdrop fade-in" style="z-index: 1100;">
    <div
      class="card modal-card"
      style="width: 100%; max-width: 360px; padding: 32px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2);"
    >
      <div class="icon" style="margin-bottom: 20px;">
        <TriangleAlert size={48} style="color: var(--status-rejected);" />
      </div>
      <h3 style="margin-bottom: 12px; color: var(--text);">Delete Order?</h3>
      <p
        class="text-muted"
        style="font-size: 0.9rem; margin-bottom: 24px; line-height: 1.5;"
      >
        Are you sure you want to permanently delete <strong
          >{currentEditingOrder?.item}</strong
        >? This action cannot be undone.
      </p>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button
          class="btn"
          style="background: #ef4444; color: white; border: none;"
          onclick={deleteOrder}
          disabled={deleteSaving}
        >
          {#if deleteSaving}
            <span>Deleting<span class="dot-loading"></span></span>
          {:else}
            Yes, Delete Permanently
          {/if}
        </button>
        <button
          class="btn btn-ghost"
          onclick={cancelDelete}
          disabled={deleteSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .lock-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 40px 20px;
  }

  .lock-card {
    width: 100%;
    max-width: 380px;
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
  .btn-block {
    width: 100%;
    justify-content: center;
    height: 48px;
    font-size: 0.95rem;
  }

  .segmented-control {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: var(--surface-2);
    padding: 4px;
    border-radius: 99px;
    border: 1px solid var(--border);
    position: relative;
    gap: 0;
  }
  .segment-highlight {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / 3);
    background: var(--surface);
    border-radius: 99px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1;
  }
  .segment {
    position: relative;
    z-index: 2;
    background: transparent;
    border: none;
    padding: 8px 18px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-muted);
    border-radius: 99px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .segment:hover {
    color: var(--text);
  }
  .segment.active {
    color: var(--primary);
  }

  /* Table Customizations for Admin */
  .item-primary {
    font-weight: 700;
    color: #fff;
    font-size: 0.9rem;
  }
  .item-secondary {
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-top: 2px;
  }
  .amount {
    font-weight: 700;
    color: #fff;
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
  }
  .success-bar {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.2);
    color: var(--status-received);
  }
  .error-bar {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.2);
    color: var(--status-rejected);
  }

  /* Modal Refined */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .modal-card {
    width: 100%;
    max-width: 520px;
    padding: 40px;
    box-shadow: var(--shadow-2xl);
    border: 1px solid var(--border);
    animation: modal-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: visible !important;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.1rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .modal-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }

  .order-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 16px;
    margin-bottom: 24px;
  }

  .summary-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.85rem;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
  }

  /* ── Dot Loading Animation ────────────────────────────────────────────────── */
  .dot-loading {
    display: inline-block;
    width: 1.5em;
    text-align: left;
    animation: dots 1.5s steps(4, end) infinite;
  }

  @keyframes dots {
    0%,
    20% {
      content: "";
    }
    40% {
      content: ".";
    }
    60% {
      content: "..";
    }
    80%,
    100% {
      content: "...";
    }
  }

  /* Note: The above keyframes using 'content' only works on pseudo-elements. 
     For regular text, we use a slightly different approach or just manual dots. 
     I'll use pseudo-elements for better effect. */
  .dot-loading::after {
    content: "...";
    animation: dots-pseudo 1.5s steps(4, end) infinite;
  }

  @keyframes dots-pseudo {
    0%,
    20% {
      content: "";
    }
    40% {
      content: ".";
    }
    60% {
      content: "..";
    }
    80%,
    100% {
      content: "...";
    }
  }
  .admin-auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 130px);
    width: 100%;
    padding-top: env(safe-area-inset-top);
  }

  .add-layout {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 32px;
    align-items: start;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  @media (max-width: 768px) {
    .add-layout {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .form-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .add-card {
      padding: 16px;
      border-radius: 0;
      width: 100%;
      border-left: none;
      border-right: none;
      box-sizing: border-box;
      margin: 0;
    }
  }

  /* ── Mobile Tab FAB ──────────────────────────────────────────── */
  @media (max-width: 768px) {
    .tabs-wrapper { display: none; }
    .tab-fab-backdrop {
      position: fixed;
      inset: 0;
      z-index: 599;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(2px);
    }
    .tab-fab-menu {
      position: fixed;
      bottom: calc(var(--ios-tab-height, 49px) + env(safe-area-inset-bottom, 0px) + 84px);
      right: 20px;
      z-index: 601;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden;
      min-width: 200px;
      animation: tabMenuIn 0.2s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes tabMenuIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tab-fab-option {
      display: block;
      width: 100%;
      padding: 14px 20px;
      background: none;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.875rem;
      font-weight: 600;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-fab-option:last-child { border-bottom: none; }
    .tab-fab-option:hover { background: var(--surface-2); color: var(--text); }
    .tab-fab-option.active { color: var(--primary); background: var(--primary-glow); }
    .page-fab {
      position: fixed;
      bottom: calc(var(--ios-tab-height, 49px) + env(safe-area-inset-bottom, 0px) + 20px);
      right: 20px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: var(--surface-3);
      color: var(--text);
      border: 1px solid var(--border);
      cursor: pointer;
      z-index: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      transition: all 0.2s;
    }
    .page-fab:hover { transform: scale(1.06); }

    .refresh-btn { aspect-ratio: 1/1; width: 42px; padding: 0 !important; justify-content: center; flex: none !important; }
  }

  :global(.admin-action-tag) {
    margin-left: 12px;
    font-size: 0.7rem;
    padding: 4px 10px;
    border: 1px solid var(--border-bright) !important;
    font-weight: 600;
    border-radius: 6px;
    line-height: 1;
    vertical-align: middle;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    background: var(--surface-2);
    transition: all 0.2s;
  }
  :global(.admin-action-tag:hover) {
    background: var(--surface-3);
    border-color: var(--primary) !important;
  }
</style>
