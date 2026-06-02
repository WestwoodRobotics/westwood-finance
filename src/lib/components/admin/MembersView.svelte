<script lang="ts">
  import { Check, Info } from '@lucide/svelte';
  import CustomDropdown from '$lib/components/CustomDropdown.svelte';
  import { authStore } from '$lib/authStore.svelte.js';
  import { BASE_URL } from '$lib/config.js';

  let addForm = $state({ firstName: '', lastName: '', studentId: '', team: 'FRC', isAdmin: false });
  let submitting = $state(false);
  let actionMsg = $state('');
  let actionErr = $state('');

  async function addMember() {
    actionMsg = '';
    actionErr = '';
    if (!addForm.firstName.trim() || !addForm.lastName.trim()) { actionErr = 'First and last name are required.'; return; }
    const cleanId = addForm.studentId.replace(/^s/i, '').trim();
    if (!cleanId || cleanId.length !== 6 || !/^\d{6}$/.test(cleanId)) { actionErr = 'Student ID must be exactly 6 digits (without the S).'; return; }

    submitting = true;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: authStore.idToken, action: 'addMember', firstName: addForm.firstName.trim(), lastName: addForm.lastName.trim(), studentId: cleanId, team: addForm.team, role: addForm.isAdmin ? 'admin' : '' }),
      });
      const result = JSON.parse(await res.text());
      if (result.error) throw new Error(result.error);

      actionMsg = `✓ ${addForm.firstName} ${addForm.lastName} approved!`;
      addForm = { firstName: '', lastName: '', studentId: '', team: 'FRC', isAdmin: false };
      await authStore.fetchMembers();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Failed to add member';
    } finally {
      submitting = false;
    }
  }

  async function removeMember(studentId: string) {
    actionMsg = '';
    actionErr = '';
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: authStore.idToken, action: 'removeMember', studentId }),
      });
      const result = JSON.parse(await res.text());
      if (result.error) throw new Error(result.error);

      actionMsg = '✓ Member removed.';
      await authStore.fetchMembers();
    } catch (e) {
      actionErr = e instanceof Error ? e.message : 'Failed to remove member';
    }
  }
</script>

<div class="add-layout fade-in">
  <div class="card add-card">
    <h3 style="margin-bottom:4px; color: var(--primary);">Approve New Member</h3>
    <p class="text-muted" style="font-size: 0.85rem; margin-bottom: 20px;">
      Add a member to grant them access to the site. They'll be able to see data for their assigned team.
    </p>

    {#if actionMsg}
      <div class="message-bar success-bar"><Check size={16} />{actionMsg}</div>
    {/if}
    {#if actionErr}
      <div class="message-bar error-bar"><Info size={16} />{actionErr}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); addMember(); }}>
      <div class="form-grid">
        <div class="form-group">
          <label for="member-first">First Name *</label>
          <input id="member-first" type="text" bind:value={addForm.firstName} placeholder="Jane" required />
        </div>
        <div class="form-group">
          <label for="member-last">Last Name *</label>
          <input id="member-last" type="text" bind:value={addForm.lastName} placeholder="Doe" required />
        </div>
        <div class="form-group">
          <label for="member-sid">Student ID (6 digits, no S) *</label>
          <input id="member-sid" type="text" inputmode="numeric" maxlength={6} bind:value={addForm.studentId} placeholder="123456" required />
        </div>
        <div class="form-group">
          <label>Team *</label>
          <CustomDropdown
            options={[{ label: 'FRC', value: 'FRC' }, { label: 'Kunai', value: 'Kunai' }, { label: 'Slingshot', value: 'Slingshot' }, { label: 'Hunga Munga', value: 'Hunga Munga' }, { label: 'Atlatl', value: 'Atlatl' }]}
            bind:value={addForm.team}
          />
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 10px; padding-top: 24px;">
          <input id="member-admin" type="checkbox" bind:checked={addForm.isAdmin} style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;" />
          <label for="member-admin" style="margin: 0; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #fff; text-transform: none; letter-spacing: 0;">Grant Admin Access</label>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="margin-top:24px; width: 100%; justify-content: center;" disabled={submitting}>
        {submitting ? 'Adding...' : 'Approve Member'}
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

<section class="fade-in" style="margin-top: 32px;">
  <div class="section-title" style="margin-bottom:12px; display: flex; justify-content: space-between; align-items: center;">
    <span>Approved Members ({authStore.membersList.length})</span>
    <button class="btn btn-ghost btn-sm" onclick={() => authStore.fetchMembers()} style="font-size: 0.75rem;">↻ Refresh List</button>
  </div>
  <div class="card orders-card" style="padding:0; overflow:hidden;">
    {#if authStore.membersList.length === 0}
      <div class="empty-state" style="padding: 40px;">No approved members yet. Add someone above.</div>
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
                  <button class="btn btn-ghost btn-sm" style="color: var(--status-rejected); font-size: 0.7rem; padding: 4px 8px;" onclick={() => removeMember(m.studentId)} title="Remove member">
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

<style>
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
    .add-layout { grid-template-columns: 1fr; gap: 16px; }
    .form-grid { grid-template-columns: 1fr; gap: 16px; }
    .add-card { padding: 16px; border-radius: 0; border-left: none; border-right: none; }
  }
</style>
