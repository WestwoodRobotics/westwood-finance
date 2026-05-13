import { BASE_URL, SECRET_KEY } from './config.js';

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

/**
 * Reactive authentication store for Svelte 5.
 * Manages Google Sign-In state, member approval lookup, and session persistence.
 * Fetches the approved member list from Google Sheets via the API.
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

  /** @type {boolean} */


  /** @type {ApprovedMember[]} */
  membersList = $state([]);

  /** @type {boolean} */
  membersLoaded = $state(false);

  /** @type {boolean} */
  get isAdmin() {
    return this.member?.role === 'admin';
  }

  /** @type {boolean} */
  get isApproved() {
    return this.status === 'approved' && this.member !== null;
  }

  /** @type {string} */
  get userTeam() {
    return this.member?.team || '';
  }

  /** @type {string} */
  get displayName() {
    if (this.member) return `${this.member.firstName} ${this.member.lastName}`;
    return this.googleUser?.name || '';
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this._restoreSession();
    }
  }

  /**
   * Restore session from localStorage on page load
   */
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


      // Restore cached members list
      const cachedMembers = localStorage.getItem('westwood_members');
      if (cachedMembers) {
        try {
          this.membersList = JSON.parse(cachedMembers);
          this.membersLoaded = true;
        } catch (_) { /* ignore */ }
      }

      if (this.googleUser) {
        // Try by email first, then student ID
        const emailMatch = this._findMemberByEmail(this.googleUser.email);
        const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
        const match = emailMatch || sidMatch;

        if (match) {
          // Strict Email Check: If we matched by SID, ensure the email doesn't conflict
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
      // Fetch fresh members list in background
      if (this.googleUser) {
        this.fetchMembers();
      }
    }
  }

  /**
   * Persist current session to localStorage
   */
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

  /**
   * Find a member by student ID in the fetched members list
   * @param {string} sid
   * @returns {ApprovedMember | null}
   */
  /**
   * Evaluates a member's role and returns their status
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

  /**
   * Find a member by student ID and return their data along with their evaluation status.
   * @param {string} sid
   * @returns {{ member: ApprovedMember, evalStatus: 'approved' | 'unauthorized' | 'pending_approval' } | null}
   */
  _findMember(sid) {
    const clean = sid.replace(/^s/i, '').trim();
    const found = this.membersList.find(
      (/** @type {ApprovedMember} */ m) => String(m.studentId) === clean
    ) || null;

    if (found) {
      return { member: found, evalStatus: this._evaluateStatus(found) };
    }
    return null;
  }

  /**
   * Find a member by email and return their data along with their evaluation status.
   * @param {string} email
   * @returns {{ member: ApprovedMember, evalStatus: 'approved' | 'unauthorized' | 'pending_approval' } | null}
   */
  _findMemberByEmail(email) {
    if (!email) return null;
    const found = this.membersList.find(m => m.email && m.email.toLowerCase() === email.toLowerCase()) || null;
    
    if (found) {
      return { member: found, evalStatus: this._evaluateStatus(found) };
    }
    return null;
  }

  /**
   * Fetch the approved members list from Google Sheets API
   */
  async fetchMembers() {
    try {
      const res = await fetch(`${BASE_URL}?action=getMembers&key=${SECRET_KEY}`);
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      
      if (data.members && Array.isArray(data.members)) {
        this.membersList = data.members;
        this.membersLoaded = true;
        
        // Cache for instant restore
        localStorage.setItem('westwood_members', JSON.stringify(data.members));
        
        // Re-validate current user if signed in
        if (this.googleUser) {
          const emailMatch = this._findMemberByEmail(this.googleUser.email);
          const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
          const match = emailMatch || sidMatch;

          if (match) {
            // Strict Email Check
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
            // Was approved but no longer in list (removed)
            this.member = null;
            this.status = 'pending_approval';
          }
        }
        
        console.log(`🔐 Auth: Loaded ${data.members.length} approved members`);
      }
    } catch (e) {
      console.warn('Failed to fetch members list:', e);
      // Fall back to cached data — don't break the session
    }
  }

  /**
   * Update the members list (called by dataService when it loads getAllData)
   * @param {ApprovedMember[]} members
   */
  updateMembersList(members) {
    if (!Array.isArray(members)) return;
    this.membersList = members;
    this.membersLoaded = true;
    
    // Cache for instant restore
    if (typeof window !== 'undefined') {
      localStorage.setItem('westwood_members', JSON.stringify(members));
    }
    
    // Re-validate current user
    if (this.googleUser) {
      const emailMatch = this._findMemberByEmail(this.googleUser.email);
      const sidMatch = this.studentId ? this._findMember(this.studentId) : null;
      const match = emailMatch || sidMatch;

      if (match) {
        // Strict Email Check
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
  }

  /**
   * Called when Google Sign-In succeeds.
   * @param {GoogleUser} user
   */
  handleGoogleSignIn(user) {
    this.googleUser = user;

    // Fetch members list to make sure we are up to date
    this.fetchMembers();

    // 1. Try to find member by email
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

    // 2. Fallback to localStorage student ID
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
   * Called when user submits their student ID.
   * @param {string} sid
   * @param {string} team - selected team for pending registration
   */
  submitStudentId(sid, team) {
    const clean = sid.replace(/^s/i, '').trim();
    this.studentId = clean;
    this.pendingTeam = team;

    const sidMatch = this._findMember(clean);
    if (sidMatch) {
      // Strict Email Check: If this member already has an email, it MUST match the current one
      const existingEmail = sidMatch.member.email;
      const currentEmail = this.googleUser?.email;
      
      if (existingEmail && currentEmail && existingEmail.toLowerCase() !== currentEmail.toLowerCase()) {
        console.warn('🔐 Auth: Student ID already linked to another email');
        // We could set an error message here, or just push to unauthorized
        // For now, let's just not approve them automatically
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

  /**
   * Sign out completely
   */
  signOut() {
    this.googleUser = null;
    this.member = null;
    this.studentId = '';
    this.pendingTeam = 'FRC';
    this.status = 'signed_out';

    if (typeof window !== 'undefined') {
      localStorage.removeItem('westwood_auth');

      // Revoke Google session
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
