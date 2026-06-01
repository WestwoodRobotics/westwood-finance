import { BASE_URL } from './config.js';

/**
 * @typedef {Object} GoogleUser
 * @property {string} email
 * @property {string} name
 * @property {string} picture
 * @property {string} sub - Google unique user ID
 */

/**
 * @typedef {Object} ApprovedMember
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} team
 * @property {string} studentId
 * @property {string} [role]
 * @property {string} [email]
 */

class AuthStore {
  /** @type {'signed_out' | 'needs_student_id' | 'pending_approval' | 'approved' | 'unauthorized'} */
  status = $state('signed_out');

  /** @type {GoogleUser | null} */
  googleUser = $state(null);

  /** @type {ApprovedMember | null} */
  member = $state(null);

  /** @type {string} */
  studentId = $state('');

  /** @type {string} */
  pendingTeam = $state('FRC');

  /** @type {boolean} */
  initialized = $state(false);

  /** @type {ApprovedMember[]} */
  membersList = $state([]);

  /** @type {boolean} */
  membersLoaded = $state(false);

  /** @type {string | null} */
  idToken = $state(null);

  /** @type {number} */
  idTokenExp = $state(0);

  get isAdmin() {
    return this.member?.role === 'admin';
  }

  get isApproved() {
    return this.status === 'approved' && this.member !== null;
  }

  get hasValidToken() {
    return !!this.idToken && Date.now() / 1000 < this.idTokenExp - 60;
  }

  get userTeam() {
    return this.member?.team || '';
  }

  get displayName() {
    if (this.member) return `${this.member.firstName} ${this.member.lastName}`;
    return this.googleUser?.name || '';
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this._restoreSession();
    }
  }

  _restoreSession() {
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
          const conflictingEmail = match.member.email &&
            this.googleUser.email &&
            match.member.email.toLowerCase() !== this.googleUser.email.toLowerCase();

          if (conflictingEmail) {
            console.warn('🔐 Auth: Email mismatch for student ID', this.studentId);
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
          this.studentId = match.member.studentId;
          this.pendingTeam = match.member.team;
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

  _persist() {
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

  /** @param {string} credential */
  _setCredential(credential) {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1]));
      this.idToken = credential;
      this.idTokenExp = payload.exp || 0;
    } catch (_) {
      this.idToken = null;
      this.idTokenExp = 0;
    }
  }

  /**
   * @param {ApprovedMember | null} m
   * @returns {'approved' | 'unauthorized' | 'pending_approval'}
   */
  _evaluateStatus(m) {
    if (!m) return 'pending_approval';
    const role = (m.role || '').trim().toLowerCase();
    if (role === 'unauthorized') return 'unauthorized';
    if (role !== '') return 'approved';
    return 'pending_approval';
  }

  /** @param {string} sid */
  _findMember(sid) {
    const clean = sid.replace(/^s/i, '').trim();
    const found = this.membersList.find(
      (/** @type {ApprovedMember} */ m) => String(m.studentId) === clean
    ) || null;
    if (found) return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  /** @param {string} email */
  _findMemberByEmail(email) {
    if (!email) return null;
    const found = this.membersList.find(m => m.email && m.email.toLowerCase() === email.toLowerCase()) || null;
    if (found) return { member: found, evalStatus: this._evaluateStatus(found) };
    return null;
  }

  async fetchMembers() {
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
        console.debug(`🔐 Auth: ${data.members.length} members loaded`);
      }
    } catch (e) {
      console.warn('Failed to fetch members list:', e);
    }
  }

  _revalidate() {
    if (!this.googleUser) return;
    const emailMatch = this._findMemberByEmail(this.googleUser.email);
    const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
    const match = emailMatch || sidMatch;

    if (match) {
      const conflictingEmail = match.member.email &&
        this.googleUser.email &&
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
      this.studentId = match.member.studentId;
      this.pendingTeam = match.member.team;
    } else if (this.status === 'approved') {
      this.member = null;
      this.status = 'pending_approval';
    }
  }

  /** @param {ApprovedMember[]} members */
  updateMembersList(members) {
    if (!Array.isArray(members)) return;
    this.membersList = members;
    this.membersLoaded = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem('westwood_members', JSON.stringify(members));
    }
    this._revalidate();
  }

  /**
   * @param {GoogleUser} user
   * @param {string} credential - raw Google ID token JWT
   */
  handleGoogleSignIn(user, credential) {
    this.googleUser = user;
    this._setCredential(credential);
    this.fetchMembers();

    const emailMatch = this._findMemberByEmail(user.email);
    if (emailMatch) {
      this.member = emailMatch.evalStatus === 'approved' ? emailMatch.member : null;
      this.studentId = emailMatch.member.studentId;
      this.pendingTeam = emailMatch.member.team;
      this.status = emailMatch.evalStatus;
      this._persist();
      console.log(`🔐 Auth: Logged in via Email (${this.status}) —`, user.email);
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
    console.log('🔐 Auth: Google sign-in complete —', user.email);
  }

  /**
   * @param {string} sid
   * @param {string} team
   */
  submitStudentId(sid, team) {
    const clean = sid.replace(/^s/i, '').trim();
    this.studentId = clean;
    this.pendingTeam = team;

    const sidMatch = this._findMember(clean);
    if (sidMatch) {
      const existingEmail = sidMatch.member.email;
      const currentEmail = this.googleUser?.email;
      if (existingEmail && currentEmail && existingEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        console.warn('🔐 Auth: Student ID already linked to another email');
        this.status = 'pending_approval';
      } else {
        this.member = sidMatch.evalStatus === 'approved' ? sidMatch.member : null;
        this.status = sidMatch.evalStatus;
        console.log(`✅ Auth: Student ID submitted (${this.status}) —`, clean);
      }
    } else {
      this.status = 'pending_approval';
      console.log('⏳ Auth: Pending approval — Student ID:', clean, 'Team:', team);
    }

    this._persist();
  }

  signOut() {
    this.googleUser = null;
    this.member = null;
    this.studentId = '';
    this.pendingTeam = 'FRC';
    this.status = 'signed_out';
    this.idToken = null;
    this.idTokenExp = 0;

    if (typeof window !== 'undefined') {
      localStorage.removeItem('westwood_auth');
      // @ts-ignore
      if (window.google?.accounts?.id) {
        // @ts-ignore
        window.google.accounts.id.disableAutoSelect();
      }
    }

    console.log('🔓 Auth: Signed out');
  }
}

export const authStore = new AuthStore();
