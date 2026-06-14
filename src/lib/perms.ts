import { authStore } from "./authStore.svelte.js";

export const perms = {
  get admin(): boolean {
    return authStore.isAdmin;
  },
  get viewAllTeams(): boolean {
    return authStore.isAdmin;
  },
  get manageOrders(): boolean {
    return authStore.isAdmin;
  },
  get addFunding(): boolean {
    return authStore.isAdmin;
  },
};
