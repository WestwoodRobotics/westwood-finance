import { authStore } from './authStore.svelte.js';

export const perms = {
  get admin() { return authStore.isAdmin; },
  get viewAllTeams() { return authStore.isAdmin; },
  get manageOrders() { return authStore.isAdmin; },
  get addFunding() { return authStore.isAdmin; },
};
