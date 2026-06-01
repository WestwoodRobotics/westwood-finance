<script lang="ts">
  import { CATEGORIES, TEAMS, formatDate } from "$lib/utils.js";
  import { DollarSign, Info, Check, Plus } from '@lucide/svelte';
  import { goto } from "$app/navigation";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import AdminLock from "$lib/components/AdminLock.svelte";
  import { dataService } from "$lib/dataService.svelte.js";
  import { BASE_URL } from "$lib/config.js";
  import { fade, scale } from "svelte/transition";
  import { authStore } from "$lib/authStore.svelte.js";
  import { perms } from "$lib/perms.js";

  const teamOptions = perms.manageOrders
    ? TEAMS.filter(t => t !== "Westwood Overall").map((team) => ({
        label: team,
        value: team,
      }))
    : [{ label: authStore.userTeam, value: authStore.userTeam }];

  let vendorSelect = $state("");
  const presetVendors = [
    { label: "Select Vendor...", value: "" },
    { label: "GoBilda", value: "GoBilda" },
    { label: "REV", value: "REV" },
    { label: "Andymark", value: "Andymark" },
    { label: "Axon", value: "Axon" },
    { label: "Polymaker", value: "Polymaker" },
    { label: "Other", value: "Other" }
  ];

  let form = $state({
    destination: "sheets",
    item: "",
    company: "",
    link: "",
    price: "",
    quantity: "1",
    notes: "",
    team: authStore.userTeam || "",
    category: "hardware",
    uuid: "",
    orderedBy: authStore.displayName || "",
    isExpense: false, // Tracks if adding as immediate expense
  });

  let submitting = $state(false);
  let submitError = $state("");
  let submitSuccess = $state("");
  let computedTotal = $derived(
    (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1),
  );

  let showPassword = $state(false);
  let showTestLock = $state(false);
  let testModalError = $state("");

  $effect(() => {
    if (vendorSelect && vendorSelect !== 'Other') {
      form.company = vendorSelect;
    }
  });

  function handleTestUnlock() {
    fillTestOrder();
    showTestLock = false;
  }

  function fillTestOrder() {
    const items = ["REV UltraPlanetary Motor", "Spark Max Controller", "Neo Brushless Motor", "Expansion Hub", "3D Printing Filament", "Metric Bolt Set", "Through-Bore Encoder", "Aluminum Extrusion (1x1)", "Soldering Station", "Zip Ties (Bulk)"];
    const companies = ["REV Robotics", "Amazon", "McMaster-Carr", "VEX Robotics", "AndyMark", "DigiKey"];
    const categories = ["hardware", "hardware", "hardware", "miscellaneous", "miscellaneous"];
    
    form.item = items[Math.floor(Math.random() * items.length)];
    form.company = companies[Math.floor(Math.random() * companies.length)];
    form.price = (Math.random() * 80 + 5).toFixed(2);
    form.quantity = Math.floor(Math.random() * 4 + 1).toString();
    form.team = "FRC";
    form.category = categories[Math.floor(Math.random() * categories.length)];
    form.notes = "Website Test";
    form.link = "https://example.com/item-" + Math.floor(Math.random() * 1000);
    form.orderedBy = "Test Bot";
    vendorSelect = "Other";
  }

  async function submit() {
    submitError = "";
    submitSuccess = "";

    // For non-admins, always force orderedBy to be their verified name
    if (!perms.manageOrders) {
      form.orderedBy = authStore.displayName;
    }

    const required = {
      "Item name": form.item,
      "Vendor/Company": form.company,
      "Price": form.price,
      "Quantity": form.quantity,
      "Team": form.team,
      "Category": form.category,
      "Ordered By": form.orderedBy,
      "Team Notes": form.notes,
    };

    const missing = Object.entries(required)
      .filter(([_, v]) => !v || !String(v).trim())
      .map(([k]) => k);

    if (missing.length > 0) {
      submitError = `The following fields are required: ${missing.join(", ")}.`;
      return;
    }

    if (isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) {
      submitError = "Please enter a valid numeric unit price.";
      return;
    }

    submitting = true;

    try {
      let finalLink = form.link.trim();

      if (finalLink && !finalLink.startsWith("http")) {
        finalLink = "https://" + finalLink;
      }

      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          idToken: authStore.idToken,
          action: 'addOrder',
          item: form.item,
          company: form.company,
          link: finalLink,
          price: String(form.price),
          quantity: String(form.quantity),
          notes: form.notes,
          category: form.category,
          team: form.team,
          status: form.isExpense ? "Received" : "Pending Review",
          tracking: "",
          uuid: form.uuid,
          timestamp: formatDate(new Date()),
          orderedBy: form.orderedBy,
        }),
      });
      const result = JSON.parse(await response.text());

      console.log("API result:", result);

      if (!response.ok || result.error) {
        throw new Error(result.error || "Request failed");
      }

      submitSuccess = "✓ Order successfully sent! Redirecting to dashboard...";
      submitting = false; // ← release the button immediately
      
      // ⚡ Optimistic Update: inject order into local store instantly
      dataService.addOrderOptimistic({
        item: form.item,
        company: form.company,
        link: finalLink,
        price: Number(form.price) || 0,
        quantity: Number(form.quantity) || 1,
        notes: form.notes,
        category: form.category,
        team: form.team,
        status: form.isExpense ? "Received" : "Pending Review",
        timestamp: formatDate(new Date()),
        orderedBy: form.orderedBy,
      });

      // reset form
      form = {
        destination: "sheets",
        item: "",
        company: form.company,
        link: "",
        price: "",
        quantity: "1",
        notes: "",
        team: form.team,
        category: "hardware",
        uuid: "",
        orderedBy: authStore.displayName || form.orderedBy,
        isExpense: false,
      };

      setTimeout(() => goto("/orders"), 2500);
    } catch (e) {
      // ✅ FIX: proper error typing
      if (e instanceof Error) {
        submitError = e.message;
      } else {
        submitError = "Unknown error occurred";
      }
    } finally {
      // Only set false here if we haven't already (success path sets it earlier)
      if (submitting) submitting = false;
    }
  }
  function toggleExpenseMode() {
    goto("/admin?view=addOrder");
  }
</script>

<svelte:head>
  <title>Add Order | Westwood Finance</title>
</svelte:head>

<div class="page-header">
  <div class="header-left">
    <h1>Add <span>Order</span></h1>
    <p class="text-muted">Fill out the form below to request a new purchase</p>
  </div>
  {#if perms.manageOrders}
    <div class="header-right">
      <button class="btn btn-ghost btn-sm" onclick={toggleExpenseMode}>
        <DollarSign size={14} />
        Add as Expense
      </button>
    </div>
  {/if}
</div>

<div class="add-layout fade-in">
  <div class="card add-card">
      {#if submitError}
        <div class="error-bar message-bar">
           <Info size={18} />
           {submitError}
        </div>
      {/if}
      {#if submitSuccess}
        <div class="success-bar message-bar">
           <Check size={18} />
           {submitSuccess}
        </div>
      {/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        id="add-expense-form"
      >
        <div class="form-grid">
          <div class="form-group" style="grid-column: 1 / -1">
            <label for="ae-item">Item Name *</label>
            <input
              id="ae-item"
              type="text"
              bind:value={form.item}
              placeholder="ex. Pit Banner"
              required
            />
          </div>

          <div class="form-group">
            <label for="ae-company">Vendor / Supplier *</label>
            <div class="vendor-field-group">
              <CustomDropdown options={presetVendors} bind:value={vendorSelect} />
              <input
                id="ae-company"
                type="text"
                bind:value={form.company}
                placeholder="or type vendor name"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="ae-team">Team *</label>
            {#if perms.manageOrders}
              <CustomDropdown
                options={teamOptions}
                bind:value={form.team}
              />
            {:else}
              <input
                id="ae-team"
                type="text"
                value={form.team}
                disabled
                style="background: rgba(255, 255, 255, 0.03); color: var(--text-muted); cursor: not-allowed; border-color: transparent;"
              />
            {/if}
          </div>

          <div class="form-group">
            <label for="ae-price">Unit Price ($) *</label>
            <input
              id="ae-price"
              type="number"
              bind:value={form.price}
              min="0"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div class="form-group">
            <label for="ae-qty">Quantity *</label>
            <input
              id="ae-qty"
              type="number"
              bind:value={form.quantity}
              min="1"
              step="1"
              placeholder="1"
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
              bind:value={form.category}
            />
          </div>

          <div class="form-group">
            <label for="ae-orderedby">Ordered By *</label>
            {#if perms.manageOrders}
              <input
                id="ae-orderedby"
                type="text"
                bind:value={form.orderedBy}
                placeholder="Enter name"
                required
              />
            {:else}
              <input
                id="ae-orderedby"
                type="text"
                value={authStore.displayName}
                disabled
                class="disabled-input"
              />
            {/if}
          </div>

          <div class="form-group" style="grid-column: 1 / -1">
            <label for="ae-link">Reference Link</label>
            <input
              id="ae-link"
              type="text"
              bind:value={form.link}
              placeholder="https://..."
            />
          </div>

          <div class="form-group" style="grid-column: 1 / -1">
            <label for="ae-notes">Team Notes *</label>
            <textarea
              id="ae-notes"
              bind:value={form.notes}
              placeholder="Reason for ordering this item..."
              rows="3"
              required
            ></textarea>
          </div>
        </div>

        <div class="summary-section">
          <div class="total-preview">
            <strong class="total-title">Order Total</strong>
            <strong class="total-val amount">${computedTotal.toFixed(2)}</strong>
          </div>
        </div>

        <div class="form-footer">
          <button
            id="submit-expense-btn"
            type="submit"
            class="btn btn-primary btn-block"
            disabled={submitting}
            aria-busy={submitting}
            aria-label={submitting ? "Processing order" : form.isExpense ? "Confirm Immediate Expense" : "Submit Order Request"}
          >
            {#if submitting}
              <span class="submit-spinner" aria-hidden="true"></span> Processing...
            {:else}
              <Plus size={16} aria-hidden="true" />
              {form.isExpense ? "Confirm Immediate Expense" : "Submit Order Request"}
            {/if}
          </button>
          <a href="/orders" class="btn btn-ghost btn-block">Cancel</a>
        </div>
      </form>
    </div>

  {#if showTestLock}
    <div class="lock-screen-wrapper fade-in" style="position: fixed; inset: 0; z-index: 1000; background: var(--bg); display: flex; align-items: center; justify-content: center;">
      <div style="position: relative; width: 100%; max-width: 420px;">
        <AdminLock 
          onunlock={handleTestUnlock} 
          oncancel={() => { showTestLock = false; }}
          title="Developer Login" 
          description="Authenticate to populate sample data for testing."
        />
      </div>
    </div>
  {/if}
</div>

<style>
  
  .add-layout {
    max-width: 720px;
    margin: 0 auto 80px;
  }

  .add-card {
    padding: 40px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-xl);
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 32px;
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

  .summary-section {
    padding: 24px;
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    margin-bottom: 32px;
  }

  .total-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .total-title { font-size: 1.1rem; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
  .total-val { font-size: 1.5rem; color: var(--primary); font-weight: 800; }

  .form-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-block { width: 100%; justify-content: center; height: 48px; font-size: 0.95rem; }

  @media (max-width: 768px) {
    .form-grid { grid-template-columns: 1fr; gap: 16px; }
    .add-card { 
      padding: 16px; 
      border-radius: 0; 
      width: 100%; 
      border-left: none; 
      border-right: none; 
      box-sizing: border-box; 
      margin: 0; 
    }
    .add-layout { 
      padding: 0; 
      width: 100%; 
      margin: 0; 
    }
    .summary-section { padding: 16px; margin-bottom: 24px; }
  }

  .vendor-field-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .disabled-input {
    background: rgba(255, 255, 255, 0.03) !important;
    color: var(--text-muted) !important;
    cursor: not-allowed !important;
    border-color: transparent !important;
  }

  .submit-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 8px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

</style>
