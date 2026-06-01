import { BASE_URL } from './config.js';
import type { AuthStatus, GoogleUser, ApprovedMember, MemberMatch } from './types.js';

class AuthStore {
  status = $state<AuthStatus>('signed_out');
  googleUser = $state<GoogleUser | null>(null);
  member = $state<ApprovedMember | null>(null);
  studentId = $state('');
  pendingTeam = $state('FRC');
  initialized = $state(typeof window === 'undefined');
  membersList = $state<ApprovedMember[]>([]);
  membersLoaded = $state(false);
  idToken = $state<string | null>(null);
  idTokenExp = $state(0);

  get isAdmin(): boolean {
    return this.member?.role === 'admin';
  }

  get isApproved(): boolean {
    return this.status === 'approved' && this.member !== null;
  }

  get hasValidToken(): boolean {
    return !!this.idToken && Date.now() / 1000 < this.idTokenExp - 60;
  }

  get userTeam(): string {
    return this.member?.team || '';
  }

  get displayName(): string {
    if (this.member) return `${this.member.firstName} ${this.member.lastName}`;
    return this.googleUser?.name || '';
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this._restoreSession();
    }
  }

  _restoreSession(): void {
    try {
      const saved = localStorage.getItem('westwood_auth');
      if (!saved) {
        this.initialized = true;
        return;
      }

      const parsed = JSON.parse(saved);
      this.googleUser = parsed.googleUser || null;
      this.studentId = parsed.studentId || '';
      this.pendingTeam = parsed.pendingTeam || 'FRC';

      // Restore idToken from sessionStorage if still valid (survives page reload)
      try {
        const sessionToken = sessionStorage.getItem('westwood_id_token');
        if (sessionToken) {
          const payload = JSON.parse(atob(sessionToken.split('.')[1]));
          if (payload.exp && Date.now() / 1000 < payload.exp - 60) {
            this.idToken = sessionToken;
            this.idTokenExp = payload.exp;
          } else {
            sessionStorage.removeItem('westwood_id_token');
          }
        }
      } catch (_) {
        sessionStorage.removeItem('westwood_id_token');
      }

      const cachedMembers = localStorage.getItem('westwood_members');
      if (cachedMembers) {
        try {
          this.membersList = JSON.parse(cachedMembers);
          this.membersLoaded = true;
        } catch (_) { /* ignore */ }
      }

      if (this.googleUser) {
        const emailMatch = this._findMemberByEmail(this.googleUser.email);
        const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
        const match = emailMatch || sidMatch;

        if (match) {
          if (match.member.email &&
              this.googleUser.email &&
              match.member.email.toLowerCase() !== this.googleUser.email.toLowerCase()) {
            console.warn('Auth: Email mismatch for student ID', this.studentId);
          }
          this._applyMatch(match);
        } else if (this.studentId) {
          this.status = 'pending_approval';
        } else {
          this.status = 'needs_student_id';
        }
      }
    } catch (e) {
      console.warn('Auth session restore failed:', e);
    } finally {
      this.initialized = true;
    }
  }

  _persist(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('westwood_auth', JSON.stringify({
        googleUser: this.googleUser,
        studentId: this.studentId,
        pendingTeam: this.pendingTeam,
      }));
    } catch (e) {
      console.warn('Auth session save failed:', e);
    }
  }

  _setCredential(credential: string): void {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      this.idToken = credential;
      this.idTokenExp = payload.exp || 0;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('westwood_id_token', credential);
      }
    } catch (_) {
      this.idToken = null;
      this.idTokenExp = 0;
    }
  }

  _evaluateStatus(m: ApprovedMember | null): 'approved' | 'unauthorized' | 'pending_approval' {
    if (!m) return 'pending_approval';
    const role = (m.role || '').trim().toLowerCase();
    if (role === 'unauthorized') return 'unauthorized';
    if (role !== '') return 'approved';
    return 'pending_approval';
  }

  _findMember(sid: string): MemberMatch | null {
    const clean = sid.replace(/^s/i, '').trim();
    const found = this.membersList.find(
      (m) => String(m.studentId) === clean
    ) || null;
    if (found) return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  _findMemberByEmail(email: string): MemberMatch | null {
    if (!email) return null;
    const found = this.membersList.find(m => m.email && m.email.toLowerCase() === email.toLowerCase()) || null;
    if (found) return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  async fetchMembers(): Promise<void> {
    if (!this.idToken) return;
    try {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ idToken: this.idToken, action: 'getMembers' }),
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = JSON.parse(await res.text());

      if (data.members && Array.isArray(data.members)) {
        this.membersList = data.members;
        this.membersLoaded = true;
        localStorage.setItem('westwood_members', JSON.stringify(data.members));
        this._revalidate();
        console.debug(`Auth: ${data.members.length} members loaded`);
      }
    } catch (e) {
      console.warn('Failed to fetch members list:', e);
    }
  }

  _applyMatch(match: MemberMatch): void {
    const conflictingEmail = match.member.email &&
      this.googleUser?.email &&
      match.member.email.toLowerCase() !== this.googleUser.email.toLowerCase();
    if (conflictingEmail) {
      this.status = 'unauthorized';
      this.member = null;
    } else if (match.evalStatus === 'approved') {
      this.member = match.member;
      this.status = 'approved';
    } else if (match.evalStatus === 'unauthorized') {
      this.member = null;
      this.status = 'unauthorized';
    } else {
      this.member = null;
      this.status = 'pending_approval';
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
    } else if (this.status === 'approved') {
      this.member = null;
      this.status = 'pending_approval';
    }
  }

  updateMembersList(members: ApprovedMember[]): void {
    if (!Array.isArray(members)) return;
    this.membersList = members;
    this.membersLoaded = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('westwood_members', JSON.stringify(members));
    }
    this._revalidate();
  }

  handleGoogleSignIn(user: GoogleUser, credential: string): void {
    this.googleUser = user;
    this._setCredential(credential);
    this.fetchMembers();

    const emailMatch = this._findMemberByEmail(user.email);
    if (emailMatch) {
      this.member = emailMatch.evalStatus === 'approved' ? emailMatch.member : null;
      this.studentId = String(emailMatch.member.studentId);
      this.pendingTeam = emailMatch.member.team;
      this.status = emailMatch.evalStatus;
      this._persist();
      console.log(`Auth: Logged in via Email (${this.status}) —`, user.email);
      return;
    }

    if (this.studentId) {
      const sidMatch = this._findMember(this.studentId);
      if (sidMatch) {
        this.member = sidMatch.evalStatus === 'approved' ? sidMatch.member : null;
        this.status = sidMatch.evalStatus;
      } else {
        this.status = this.membersLoaded ? 'pending_approval' : 'needs_student_id';
      }
    } else {
      this.status = 'needs_student_id';
    }

    this._persist();
    console.log('Auth: Google sign-in complete —', user.email);
  }

  submitStudentId(sid: string, team: string): void {
    const clean = sid.replace(/^s/i, '').trim();
    this.studentId = clean;
    this.pendingTeam = team;

    const sidMatch = this._findMember(clean);
    if (sidMatch) {
      const existingEmail = sidMatch.member.email;
      const currentEmail = this.googleUser?.email;
      if (existingEmail && currentEmail && existingEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        console.warn('Auth: Student ID already linked to another email');
        this.status = 'pending_approval';
      } else {
        this.member = sidMatch.evalStatus === 'approved' ? sidMatch.member : null;
        this.status = sidMatch.evalStatus;
        console.log(`Auth: Student ID submitted (${this.status}) —`, clean);
      }
    } else {
      this.status = 'pending_approval';
      console.log('Auth: Pending approval — Student ID:', clean, 'Team:', team);
    }

    this._persist();
  }

  signOut(): void {
    this.googleUser = null;
    this.member = null;
    this.studentId = '';
    this.pendingTeam = 'FRC';
    this.status = 'signed_out';
    this.idToken = null;
    this.idTokenExp = 0;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('westwood_auth');
      sessionStorage.removeItem('westwood_id_token');
      // @ts-ignore
      if (window.google?.accounts?.id) {
        // @ts-ignore
        window.google.accounts.id.disableAutoSelect();
      }
    }

    console.log('Auth: Signed out');
  }
}

export const authStore = new AuthStore();
