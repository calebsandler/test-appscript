/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Access Control Service
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Simple access control:
 * 1. Admin (script owner) - always has access
 * 2. @calebsandler.com domain - always has access
 * 3. Everyone else - requires passphrase set by admin
 */

const AccessControlService = (function() {
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Configuration
  // ─────────────────────────────────────────────────────────────────────────

  // Allowed email domain (hardcoded for security)
  const ALLOWED_DOMAIN = 'calebsandler.com';

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
   * Check if an email belongs to the allowed domain
   * @param {string} email - Email to check
   * @returns {boolean} True if email is from allowed domain
   */
  function isAllowedDomain(email) {
    if (!email) return false;
    return email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN.toLowerCase());
  }

  /**
   * Check if email is admin (owner) or from allowed domain
   * @param {string} email - Email to check
   * @returns {Object} { hasAccess: boolean, isAdmin: boolean, reason: string }
   */
  function checkEmailAccess(email) {
    if (!email) {
      return { hasAccess: false, isAdmin: false, reason: 'No email provided' };
    }

    const owner = getScriptOwner();
    const emailLower = email.toLowerCase();

    // Check if owner (admin)
    if (emailLower === owner.toLowerCase()) {
      return { hasAccess: true, isAdmin: true, reason: 'Script owner' };
    }

    // Check if from allowed domain
    if (isAllowedDomain(email)) {
      return { hasAccess: true, isAdmin: false, reason: 'Allowed domain' };
    }

    // External user - needs passphrase
    return { hasAccess: false, isAdmin: false, reason: 'External user - passphrase required' };
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
      hash = hash & hash;
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
   * @returns {Object} User authorization status and details
   */
  function getCurrentUser() {
    const email = Session.getActiveUser().getEmail();
    const owner = getScriptOwner();

    // If email is empty, user hasn't authorized with Google
    // They can still access via passphrase
    if (!email) {
      return {
        authorized: false,
        email: null,
        isOwner: false,
        isAllowedDomain: false,
        hasAccess: false,
        requiresPassphrase: true,
        message: 'External user - passphrase required'
      };
    }

    const accessCheck = checkEmailAccess(email);

    return {
      authorized: true,
      email: email,
      isOwner: accessCheck.isAdmin,
      isAllowedDomain: isAllowedDomain(email),
      hasAccess: accessCheck.hasAccess,
      requiresPassphrase: !accessCheck.hasAccess,
      message: accessCheck.hasAccess ? 'Access granted' : 'Passphrase required'
    };
  }

  /**
   * Check if current session is the script owner (for admin functions)
   * @returns {boolean} True if current user is owner
   */
  function isOwner() {
    const active = Session.getActiveUser().getEmail();
    const effective = Session.getEffectiveUser().getEmail();
    return active && active.toLowerCase() === effective.toLowerCase();
  }

  /**
   * Get the script owner email
   * @returns {string} Owner's email
   */
  function getOwnerEmail() {
    return getScriptOwner();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Access Control
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a user has access to the web app
   * @param {string} email - User's email address (optional for passphrase users)
   * @returns {Object} { allowed: boolean, isAdmin: boolean, requiresPassphrase: boolean }
   */
  function checkUserAccess(email) {
    const accessCheck = checkEmailAccess(email);
    return {
      allowed: accessCheck.hasAccess,
      isAdmin: accessCheck.isAdmin,
      requiresPassphrase: !accessCheck.hasAccess,
      reason: accessCheck.reason
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Passphrase Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify a passphrase for access (for external users)
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
    // Only owner can view settings
    if (!isOwner()) {
      return { error: 'Admin access required' };
    }

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
    // Only owner can modify settings
    if (!isOwner()) {
      return { success: false, error: 'Admin access required' };
    }

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
    getOwnerEmail: getOwnerEmail,

    // Access Control
    checkUserAccess: checkUserAccess,

    // Passphrase Management
    verifyPassphrase: verifyPassphrase,
    getPassphraseSettings: getPassphraseSettings,
    setPassphraseSettings: setPassphraseSettings
  };
})();
