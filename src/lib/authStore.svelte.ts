import { BASE_URL } from "./config.js";
import { api } from "./api.js";
import type {
  AuthStatus,
  GoogleUser,
  ApprovedMember,
  MemberMatch,
} from "./types.js";

class AuthStore {
  status = $state<AuthStatus>("signed_out");
  googleUser = $state<GoogleUser | null>(null);
  member = $state<ApprovedMember | null>(null);
  studentId = $state("");
  pendingTeam = $state("FRC");
  initialized = $state(typeof window === "undefined");
  membersList = $state<ApprovedMember[]>([]);
  membersLoaded = $state(false);
  sessionToken = $state<string | null>(null);
  sessionExp = $state(0); // unix seconds

  get isAdmin(): boolean {
    return this.member?.role === "admin";
  }

  get isApproved(): boolean {
    return this.status === "approved" && this.member !== null;
  }

  get hasValidSession(): boolean {
    return !!this.sessionToken && Date.now() / 1000 < this.sessionExp - 60;
  }

  get userTeam(): string {
    return this.member?.team || "";
  }

  get displayName(): string {
    if (this.member) return `${this.member.firstName} ${this.member.lastName}`;
    return this.googleUser?.name || "";
  }

  constructor() {
    if (typeof window !== "undefined") {
      this._restoreSession();
    }
  }

  _restoreSession(): void {
    try {
      const saved = localStorage.getItem("westwood_auth");
      if (!saved) {
        this.initialized = true;
        return;
      }

      const parsed = JSON.parse(saved);
      this.googleUser = parsed.googleUser || null;
      this.studentId = parsed.studentId || "";
      this.pendingTeam = parsed.pendingTeam || "FRC";

      // Drop any legacy Google ID token from the old auth scheme.
      sessionStorage.removeItem("westwood_id_token");

      // Restore the backend-issued session token if still valid.
      try {
        const raw = localStorage.getItem("westwood_session");
        if (raw) {
          const { token, exp } = JSON.parse(raw);
          if (token && exp && Date.now() / 1000 < exp - 60) {
            this.sessionToken = token;
            this.sessionExp = exp;
          } else {
            localStorage.removeItem("westwood_session");
          }
        }
      } catch (_) {
        localStorage.removeItem("westwood_session");
      }

      const cachedMembers = localStorage.getItem("westwood_members");
      if (cachedMembers) {
        try {
          this.membersList = JSON.parse(cachedMembers);
          this.membersLoaded = true;
        } catch (_) {
          /* ignore */
        }
      }

      if (this.googleUser) {
        const emailMatch = this._findMemberByEmail(this.googleUser.email);
        const sidMatch = this.studentId
          ? this._findMember(this.studentId)
          : null;
        const match = emailMatch || sidMatch;

        if (match) {
          if (
            match.member.email &&
            this.googleUser.email &&
            match.member.email.toLowerCase() !==
              this.googleUser.email.toLowerCase()
          ) {
            console.warn("Auth: Email mismatch for student ID", this.studentId);
          }
          this._applyMatch(match);
        } else if (this.studentId) {
          this.status = "pending_approval";
        } else {
          this.status = "needs_student_id";
        }
      }
    } catch (e) {
      console.warn("Auth session restore failed:", e);
    } finally {
      this.initialized = true;
    }
  }

  _persist(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "westwood_auth",
        JSON.stringify({
          googleUser: this.googleUser,
          studentId: this.studentId,
          pendingTeam: this.pendingTeam,
        }),
      );
    } catch (e) {
      console.warn("Auth session save failed:", e);
    }
  }

  _persistSession(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        "westwood_session",
        JSON.stringify({
          token: this.sessionToken,
          exp: this.sessionExp,
        }),
      );
    } catch (e) {
      console.warn("Session save failed:", e);
    }
  }

  _evaluateStatus(
    m: ApprovedMember | null,
  ): "approved" | "unauthorized" | "pending_approval" {
    if (!m) return "pending_approval";
    const role = (m.role || "").trim().toLowerCase();
    if (role === "unauthorized") return "unauthorized";
    if (role !== "") return "approved";
    return "pending_approval";
  }

  _findMember(sid: string): MemberMatch | null {
    const clean = sid.replace(/^s/i, "").trim();
    const found =
      this.membersList.find((m) => String(m.studentId) === clean) || null;
    if (found)
      return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  _findMemberByEmail(email: string): MemberMatch | null {
    if (!email) return null;
    const found =
      this.membersList.find(
        (m) => m.email && m.email.toLowerCase() === email.toLowerCase(),
      ) || null;
    if (found)
      return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  async fetchMembers(): Promise<void> {
    if (!this.hasValidSession) return;
    try {
      const data = await api.post({ action: "getSelf" });

      if (data.member) {
        const existing = this.membersList.filter(
          (m) => m.email?.toLowerCase() !== data.member.email?.toLowerCase(),
        );
        this.membersList = [...existing, data.member];
        this.membersLoaded = true;
        localStorage.setItem(
          "westwood_members",
          JSON.stringify(this.membersList),
        );
        this._revalidate();
        console.debug(`Auth: self record loaded — ${data.member.role}`);
      } else {
        this.membersLoaded = true;
        this._revalidate();
      }
    } catch (e) {
      console.warn("Failed to fetch members list:", e);
    }
  }

  _applyMatch(match: MemberMatch): void {
    const conflictingEmail =
      match.member.email &&
      this.googleUser?.email &&
      match.member.email.toLowerCase() !== this.googleUser.email.toLowerCase();
    if (conflictingEmail) {
      this.status = "unauthorized";
      this.member = null;
    } else if (match.evalStatus === "approved") {
      this.member = match.member;
      this.status = "approved";
    } else if (match.evalStatus === "unauthorized") {
      this.member = null;
      this.status = "unauthorized";
    } else {
      this.member = null;
      this.status = "pending_approval";
    }
    this.studentId = String(match.member.studentId);
    this.pendingTeam = match.member.team;
  }

  _revalidate(): void {
    if (!this.googleUser) return;
    const emailMatch = this._findMemberByEmail(this.googleUser.email);
    const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
    const match = emailMatch || sidMatch;

    if (match) {
      this._applyMatch(match);
    } else if (this.status === "approved") {
      this.member = null;
      this.status = "pending_approval";
    }
  }

  updateMembersList(members: ApprovedMember[]): void {
    if (!Array.isArray(members)) return;
    this.membersList = members;
    this.membersLoaded = true;
    if (typeof window !== "undefined") {
      localStorage.setItem("westwood_members", JSON.stringify(members));
    }
    this._revalidate();
  }

  // Exchange a fresh Google ID token for a backend-issued session token. The
  // server is authoritative on status/member/role.
  async loginWithCredential(credential: string): Promise<void> {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "login", idToken: credential }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = JSON.parse(await res.text());
    if (data.error || !data.sessionToken) {
      this.signOut();
      throw new Error(data.error || "Login failed");
    }

    this.sessionToken = data.sessionToken;
    this.sessionExp = data.expiresAt;
    this._persistSession();

    this.googleUser = {
      email: data.googleEmail,
      name: data.googleName || this.googleUser?.name || "",
      picture: data.googlePicture || this.googleUser?.picture || "",
      sub: this.googleUser?.sub || "",
    };

    if (data.member) {
      this.member = data.status === "approved" ? data.member : null;
      this.studentId = String(data.member.studentId);
      this.pendingTeam = data.member.team;
      this.status = data.status;
      // Keep the local members cache consistent with the server's view of self.
      const others = this.membersList.filter(
        (m) => m.email?.toLowerCase() !== data.member.email?.toLowerCase(),
      );
      this.updateMembersList([...others, data.member]);
    } else {
      // Authenticated with Google but not yet registered as a member.
      this.status = this.studentId ? "pending_approval" : "needs_student_id";
    }

    this._persist();
    console.log(`Auth: Logged in (${this.status}) —`, this.googleUser.email);
  }

  updateFromRegistration(data: any): void {
    if (data.sessionToken) {
      this.sessionToken = data.sessionToken;
      this.sessionExp = data.expiresAt;
      this._persistSession();
    }

    if (data.member) {
      this.member = data.status === "approved" ? data.member : null;
      this.studentId = String(data.member.studentId);
      this.pendingTeam = data.member.team;
      this.status = data.status;

      const others = this.membersList.filter(
        (m) =>
          m.email?.toLowerCase() !== data.member.email?.toLowerCase() &&
          String(m.studentId) !== String(data.member.studentId),
      );
      this.updateMembersList([...others, data.member]);
    } else {
      this.status = "pending_approval";
    }
    this._persist();
    console.log(
      `Auth: Student ID registered/claimed (${this.status}) —`,
      this.studentId,
    );
  }

  submitStudentId(sid: string, team: string): void {
    const clean = sid.replace(/^s/i, "").trim();
    this.studentId = clean;
    this.pendingTeam = team;

    const sidMatch = this._findMember(clean);
    if (sidMatch) {
      const existingEmail = sidMatch.member.email;
      const currentEmail = this.googleUser?.email;
      if (
        existingEmail &&
        currentEmail &&
        existingEmail.toLowerCase() !== currentEmail.toLowerCase()
      ) {
        console.warn("Auth: Student ID already linked to another email");
        this.status = "pending_approval";
      } else {
        this.member =
          sidMatch.evalStatus === "approved" ? sidMatch.member : null;
        this.status = sidMatch.evalStatus;
        console.log(`Auth: Student ID submitted (${this.status}) —`, clean);
      }
    } else {
      this.status = "pending_approval";
      console.log("Auth: Pending approval — Student ID:", clean, "Team:", team);
    }

    this._persist();
  }

  signOut(): void {
    this.googleUser = null;
    this.member = null;
    this.studentId = "";
    this.pendingTeam = "FRC";
    this.status = "signed_out";
    this.sessionToken = null;
    this.sessionExp = 0;

    if (typeof window !== "undefined") {
      localStorage.removeItem("westwood_auth");
      localStorage.removeItem("westwood_session");
      sessionStorage.removeItem("westwood_id_token");
      // @ts-ignore
      if (window.google?.accounts?.id) {
        // @ts-ignore
        window.google.accounts.id.disableAutoSelect();
      }
    }

    console.log("Auth: Signed out");
  }
}

export const authStore = new AuthStore();
