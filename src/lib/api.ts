import { BASE_URL } from "./config.js";
import { authStore } from "./authStore.svelte.js";

// Errors from GAS that mean "your session is no longer valid". On these we sign
// out so AuthGate renders the sign-in screen (One Tap recovers in ~one tap).
const SESSION_ERRORS = new Set(["Unauthorized", "Session expired"]);
const ACCESS_ERRORS = new Set(["Forbidden"]);

export const api = {
  async post(
    payload: Record<string, unknown>,
    opts: { signal?: AbortSignal } = {},
  ): Promise<any> {
    if (!authStore.hasValidSession) {
      authStore.signOut();
      throw new Error("Session expired");
    }

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        sessionToken: authStore.sessionToken,
        ...payload,
      }),
      signal: opts.signal,
    });

    if (res.status === 401) {
      authStore.signOut();
      throw new Error("Session expired");
    }
    if (!res.ok) throw new Error(`Network error: ${res.status}`);

    const data = JSON.parse(await res.text());
    if (data?.error) {
      if (SESSION_ERRORS.has(data.error)) {
        authStore.signOut();
        throw new Error("Session expired");
      }
      if (ACCESS_ERRORS.has(data.error)) {
        authStore.revokeAccess();
        throw new Error("Forbidden");
      }
    }
    return data;
  },
};
