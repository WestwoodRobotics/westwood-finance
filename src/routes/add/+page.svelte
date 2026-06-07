<script lang="ts">
  import { CATEGORIES, TEAMS, formatDate } from "$lib/utils.js";
  import { DollarSign, Info, Check, Plus } from '@lucide/svelte';
  import { goto } from "$app/navigation";
  import CustomDropdown from "$lib/components/CustomDropdown.svelte";
  import { dataService } from "$lib/dataService.svelte.js";
  import { api } from "$lib/api.js";
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
  let fieldErrors = $state<Record<string, string>>({});

  let _successTimer: ReturnType<typeof setTimeout>;
  $effect(() => {
    if (submitSuccess) {
      clearTimeout(_successTimer);
      _successTimer = setTimeout(() => { submitSuccess = ""; }, 8000);
    }
  });
  let computedTotal = $derived(
    (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1),
  );

  let showPassword = $state(false);

  function validateField(name: string, value: string | number) {
    if (value == null || !String(value).trim()) {
      fieldErrors[name] = 'Required';
    } else if (name === 'price' && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      fieldErrors[name] = 'Enter a valid price';
    } else {
      delete fieldErrors[name];
      fieldErrors = { ...fieldErrors };
    }
  }

  $effect(() => {
    if (vendorSelect && vendorSelect !== 'Other') form.company = vendorSelect;
  });

  $effect(() => {
    if (!form.orderedBy && authStore.displayName) form.orderedBy = authStore.displayName;
  });

  async function submit() {
    submitError = "";
    submitSuccess = "";

    // For non-admins, always force orderedBy to be their verified name
    if (!perms.manageOrders) {
      form.orderedBy = authStore.displayName;
    }

    const requiredFields: [string, string | number][] = [
      ['item', form.item], ['company', form.company], ['price', form.price],
      ['quantity', form.quantity], ['team', form.team], ['category', form.category],
      ['orderedBy', form.orderedBy], ['notes', form.notes],
    ];
    requiredFields.forEach(([name, val]) => validateField(name, val));
    if (Object.keys(fieldErrors).length > 0) return;

    submitting = true;

    try {
      let finalLink = form.link.trim();

      if (finalLink && !finalLink.startsWith("http")) {
        finalLink = "https://" + finalLink;
      }

      const result = await api.post({
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
      });

      if (result.error) {
        throw new Error(result.error || "Request failed");
      }

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
        orderUUID: result.uuid || '',
      });
      submitSuccess = "✓ Order successfully sent!";

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

    } catch (e) {
      submitError = e instanceof Error ? e.message : "Unknown error occurred";
    } finally {
      submitting = false;
    }
  }
  function toggleExpenseMode() {
    const dirty = form.item || form.company || form.link || form.price || form.notes;
    if (dirty && !confirm('Leave page? Unsaved form data will be lost.')) return;
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
        <div class="success-bar message-bar" style="justify-content: space-between;">
          <span style="display:flex;align-items:center;gap:12px;"><Check size={18} />{submitSuccess}</span>
          <a href="/orders" class="btn btn-ghost btn-sm" style="white-space:nowrap;">View Orders →</a>
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
              class:field-error={fieldErrors.item}
              onblur={() => validateField('item', form.item)}
            />
            {#if fieldErrors.item}<span class="field-error-msg">{fieldErrors.item}</span>{/if}
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
              class:field-error={fieldErrors.price}
              onblur={() => validateField('price', form.price)}
            />
            {#if fieldErrors.price}<span class="field-error-msg">{fieldErrors.price}</span>{/if}
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
            <label for="ae-orderedby">Ordered By{#if perms.manageOrders} *{/if}</label>
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
              class:field-error={fieldErrors.notes}
              onblur={() => validateField('notes', form.notes)}
            ></textarea>
            {#if fieldErrors.notes}<span class="field-error-msg">{fieldErrors.notes}</span>{/if}
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
    .add-card { padding: 16px; }
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

  :global(input.field-error),
  :global(textarea.field-error) {
    border-color: var(--status-rejected) !important;
    box-shadow: 0 0 0 1px var(--status-rejected);
  }

  .field-error-msg {
    font-size: 0.72rem;
    color: var(--status-rejected);
    font-weight: 600;
    margin-top: -4px;
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
