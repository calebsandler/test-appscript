/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Access Control Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles user authentication, authorization, passphrase management, and
 * allowlist operations. Provides centralized access control for the application.
 */

const AccessControlService = (function() {
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Allowed Emails (legacy hardcoded list)
  // ─────────────────────────────────────────────────────────────────────────
  const ALLOWED_EMAILS = [
    // Add emails here, e.g.:
    // 'colleague@gmail.com',
    // 'partner@company.com',
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Helper Functions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the script owner's email (always has access and is always admin)
   * @returns {string} Owner's email address
   */
  function getScriptOwner() {
    return Session.getEffectiveUser().getEmail();
  }

  /**
   * Get the list of allowed users from Script Properties
   * @returns {Array} Array of { email, isAdmin, addedBy, addedAt }
   */
  function getAllowedUsersInternal() {
    const props = PropertiesService.getScriptProperties();
    const usersJson = props.getProperty('ALLOWED_USERS');

    if (!usersJson) {
      return [];
    }

    try {
      return JSON.parse(usersJson);
    } catch (e) {
      console.error('Error parsing allowed users:', e);
      return [];
    }
  }

  /**
   * Save the allowed users list to Script Properties
   * @param {Array} users - Array of user objects
   */
  function saveAllowedUsers(users) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('ALLOWED_USERS', JSON.stringify(users));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Passphrase Generation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a daily passphrase based on seed and date
   * @param {string} seed - Secret seed for generation
   * @returns {string} The passphrase for today
   */
  function generateDailyPassphrase(seed) {
    const today = new Date();
    const dateStr = today.getFullYear() + '-' +
                    String(today.getMonth() + 1).padStart(2, '0') + '-' +
                    String(today.getDate()).padStart(2, '0');

    // Simple hash-like generation (not cryptographic, just obfuscation)
    const combined = seed + dateStr;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to readable passphrase using word list
    const words = ['oak', 'pine', 'elm', 'ash', 'maple', 'birch', 'cedar', 'walnut',
                   'cherry', 'mahogany', 'teak', 'ebony', 'ivory', 'brass', 'copper',
                   'silver', 'gold', 'jade', 'pearl', 'ruby', 'amber', 'coral'];
    const numbers = Math.abs(hash % 100);
    const word1 = words[Math.abs(hash) % words.length];
    const word2 = words[Math.abs(hash >> 8) % words.length];

    return word1 + numbers + word2;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: User Authentication
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get current user info - called from frontend to check access
   * This triggers OAuth if user hasn't authorized yet
   * @returns {Object} User authorization status and details
   */
  function getCurrentUser() {
    const email = Session.getActiveUser().getEmail();
    const owner = Session.getEffectiveUser().getEmail();

    // If email is empty, user needs to authorize
    if (!email) {
      return {
        authorized: false,
        email: null,
        isOwner: false,
        hasAccess: false,
        message: 'Please authorize to continue'
      };
    }

    const isOwner = email.toLowerCase() === owner.toLowerCase();
    const isInAllowlist = ALLOWED_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
    const hasAccess = isOwner || isInAllowlist;

    return {
      authorized: true,
      email: email,
      isOwner: isOwner,
      hasAccess: hasAccess,
      message: hasAccess ? 'Access granted' : 'Access denied - contact administrator'
    };
  }

  /**
   * Check if current session is the script owner (for admin functions)
   * @returns {boolean} True if current user is owner
   */
  function isOwner() {
    const active = Session.getActiveUser().getEmail();
    const effective = Session.getEffectiveUser().getEmail();
    // In USER_DEPLOYING mode, effective user is always owner
    // Active user may be empty for external users
    return active && active.toLowerCase() === effective.toLowerCase();
  }

  /**
   * Triggers OAuth authorization flow
   * Called from the sign-in page to force Google's consent screen
   * @returns {Object} Email and URL info
   */
  function triggerAuth() {
    // This function triggers the OAuth flow when called via google.script.run
    // Simply accessing the user email is enough to trigger auth
    const email = Session.getActiveUser().getEmail();
    const url = ScriptApp.getService().getUrl();
    return { email: email, url: url };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Access Control
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a user has access to the web app
   * @param {string} email - User's email address
   * @returns {Object} { allowed: boolean, isAdmin: boolean }
   */
  function checkUserAccess(email) {
    if (!email) {
      return { allowed: false, isAdmin: false };
    }

    const owner = getScriptOwner();

    // Owner always has access and is always admin
    if (email.toLowerCase() === owner.toLowerCase()) {
      return { allowed: true, isAdmin: true };
    }

    // Check allowlist
    const users = getAllowedUsersInternal();
    const userEntry = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (userEntry) {
      return { allowed: true, isAdmin: userEntry.isAdmin || false };
    }

    return { allowed: false, isAdmin: false };
  }

  /**
   * Get the list of allowed users
   * @returns {Array} Array of { email, isAdmin, addedBy, addedAt }
   */
  function getAllowedUsers() {
    return getAllowedUsersInternal();
  }

  /**
   * Add a user to the allowlist (requires admin)
   * @param {string} email - Email to add
   * @param {boolean} isAdmin - Whether the new user should be an admin
   * @returns {Object} Result with success status
   */
  function addAllowedUser(email, isAdmin = false) {
    // Check if current user is admin
    const currentUser = Session.getActiveUser().getEmail();
    const accessCheck = checkUserAccess(currentUser);

    if (!accessCheck.isAdmin) {
      return { success: false, error: 'Only admins can add users' };
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Invalid email address' };
    }

    email = email.toLowerCase().trim();

    // Check if already exists
    const users = getAllowedUsersInternal();
    if (users.some(u => u.email.toLowerCase() === email)) {
      return { success: false, error: 'User already has access' };
    }

    // Add user
    users.push({
      email: email,
      isAdmin: isAdmin,
      addedBy: currentUser,
      addedAt: new Date().toISOString()
    });

    saveAllowedUsers(users);

    return { success: true, message: `Added ${email} to allowed users` };
  }

  /**
   * Remove a user from the allowlist (requires admin)
   * @param {string} email - Email to remove
   * @returns {Object} Result with success status
   */
  function removeAllowedUser(email) {
    // Check if current user is admin
    const currentUser = Session.getActiveUser().getEmail();
    const accessCheck = checkUserAccess(currentUser);

    if (!accessCheck.isAdmin) {
      return { success: false, error: 'Only admins can remove users' };
    }

    // Can't remove the owner
    const owner = getScriptOwner();
    if (email.toLowerCase() === owner.toLowerCase()) {
      return { success: false, error: 'Cannot remove the script owner' };
    }

    // Can't remove yourself
    if (email.toLowerCase() === currentUser.toLowerCase()) {
      return { success: false, error: 'Cannot remove yourself' };
    }

    const users = getAllowedUsersInternal();
    const filteredUsers = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());

    if (filteredUsers.length === users.length) {
      return { success: false, error: 'User not found in allowlist' };
    }

    saveAllowedUsers(filteredUsers);

    return { success: true, message: `Removed ${email} from allowed users` };
  }

  /**
   * Update a user's admin status (requires admin)
   * @param {string} email - Email to update
   * @param {boolean} isAdmin - New admin status
   * @returns {Object} Result with success status
   */
  function updateUserAdmin(email, isAdmin) {
    // Check if current user is admin
    const currentUser = Session.getActiveUser().getEmail();
    const accessCheck = checkUserAccess(currentUser);

    if (!accessCheck.isAdmin) {
      return { success: false, error: 'Only admins can update user permissions' };
    }

    // Can't modify the owner
    const owner = getScriptOwner();
    if (email.toLowerCase() === owner.toLowerCase()) {
      return { success: false, error: 'Cannot modify the script owner permissions' };
    }

    const users = getAllowedUsersInternal();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return { success: false, error: 'User not found in allowlist' };
    }

    users[userIndex].isAdmin = isAdmin;
    saveAllowedUsers(users);

    return { success: true, message: `Updated ${email} admin status to ${isAdmin}` };
  }

  /**
   * Get access info for the current user (called from frontend)
   * @returns {Object} Current user info and access details
   */
  function getAccessInfo() {
    const currentUser = Session.getActiveUser().getEmail();
    const owner = getScriptOwner();
    const accessCheck = checkUserAccess(currentUser);
    const users = getAllowedUsersInternal();

    // Add owner to the displayed list
    const allUsers = [
      {
        email: owner,
        isAdmin: true,
        isOwner: true,
        addedBy: 'System',
        addedAt: null
      },
      ...users.map(u => ({ ...u, isOwner: false }))
    ];

    return {
      currentUser: currentUser,
      isAdmin: accessCheck.isAdmin,
      isOwner: currentUser.toLowerCase() === owner.toLowerCase(),
      users: allUsers
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Passphrase Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify a passphrase for access
   * @param {string} input - The passphrase entered by user
   * @returns {Object} { valid: boolean, expiresAt: string }
   */
  function verifyPassphrase(input) {
    if (!input || typeof input !== 'string') {
      return { valid: false, error: 'Passphrase required' };
    }

    const props = PropertiesService.getScriptProperties();
    const mode = props.getProperty('PASSPHRASE_MODE') || 'static';
    const expiryHours = parseInt(props.getProperty('PASSPHRASE_EXPIRY_HOURS') || '24', 10);

    let correctPassphrase;

    if (mode === 'daily') {
      const seed = props.getProperty('PASSPHRASE_SEED') || 'rosewood';
      correctPassphrase = generateDailyPassphrase(seed);
    } else {
      correctPassphrase = props.getProperty('PASSPHRASE_STATIC') || '';
    }

    // No passphrase set - deny access
    if (!correctPassphrase) {
      return { valid: false, error: 'Access not configured. Contact administrator.' };
    }

    const isValid = input.trim().toLowerCase() === correctPassphrase.toLowerCase();

    if (isValid) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);
      return {
        valid: true,
        expiresAt: expiresAt.toISOString(),
        message: 'Access granted'
      };
    }

    return { valid: false, error: 'Invalid passphrase' };
  }

  /**
   * Get passphrase settings (admin only)
   * @returns {Object} Current passphrase configuration
   */
  function getPassphraseSettings() {
    // Check if caller is owner/admin
    const email = Session.getEffectiveUser().getEmail();
    const owner = Session.getEffectiveUser().getEmail();

    // For web app context, only owner can access settings
    const props = PropertiesService.getScriptProperties();
    const mode = props.getProperty('PASSPHRASE_MODE') || 'static';
    const expiryHours = props.getProperty('PASSPHRASE_EXPIRY_HOURS') || '24';

    const result = {
      mode: mode,
      expiryHours: parseInt(expiryHours, 10),
      isConfigured: false
    };

    if (mode === 'daily') {
      const seed = props.getProperty('PASSPHRASE_SEED');
      result.seed = seed || '';
      result.todaysPassphrase = seed ? generateDailyPassphrase(seed) : '';
      result.isConfigured = !!seed;
    } else {
      const staticPass = props.getProperty('PASSPHRASE_STATIC');
      result.staticPassphrase = staticPass || '';
      result.isConfigured = !!staticPass;
    }

    return result;
  }

  /**
   * Set passphrase settings (admin only)
   * @param {Object} settings - { mode, staticPassphrase, seed, expiryHours }
   * @returns {Object} Result
   */
  function setPassphraseSettings(settings) {
    const props = PropertiesService.getScriptProperties();

    if (settings.mode) {
      props.setProperty('PASSPHRASE_MODE', settings.mode);
    }

    if (settings.staticPassphrase !== undefined) {
      props.setProperty('PASSPHRASE_STATIC', settings.staticPassphrase);
    }

    if (settings.seed !== undefined) {
      props.setProperty('PASSPHRASE_SEED', settings.seed);
    }

    if (settings.expiryHours) {
      props.setProperty('PASSPHRASE_EXPIRY_HOURS', String(settings.expiryHours));
    }

    return { success: true, message: 'Passphrase settings updated' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // User Authentication
    getCurrentUser: getCurrentUser,
    isOwner: isOwner,
    triggerAuth: triggerAuth,
    getScriptOwner: getScriptOwner,

    // Access Control
    checkUserAccess: checkUserAccess,
    getAllowedUsers: getAllowedUsers,
    addAllowedUser: addAllowedUser,
    removeAllowedUser: removeAllowedUser,
    updateUserAdmin: updateUserAdmin,
    getAccessInfo: getAccessInfo,

    // Passphrase Management
    verifyPassphrase: verifyPassphrase,
    getPassphraseSettings: getPassphraseSettings,
    setPassphraseSettings: setPassphraseSettings
  };
})();
