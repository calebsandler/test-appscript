/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Main Entry Points
 * ═══════════════════════════════════════════════════════════════════════════
 * Menu creation, sidebar/dialog launchers, and API functions for the frontend.
 * Supports both container-bound (sidebar/dialog) and standalone web app modes.
 */

// ═══════════════════════════════════════════════════════════════════════════
// WEB APP ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Serves the web app interface when accessed via URL
 * @param {Object} e - Event parameter containing URL info
 * @returns {HtmlOutput} The web app HTML
 */
/**
 * ALLOWED USERS - Add email addresses here to grant access
 * The script owner is always allowed automatically
 */
const ALLOWED_EMAILS = [
  // Add emails here, e.g.:
  // 'colleague@gmail.com',
  // 'partner@company.com',
];

function doGet(e) {
  // Always serve the app - auth check happens client-side via getCurrentUser()
  const page = e.parameter.page || 'app';

  let template;

  if (page === 'compact') {
    template = HtmlService.createTemplateFromFile('Sidebar');
  } else {
    template = HtmlService.createTemplateFromFile('WebApp');
  }

  return template.evaluate()
    .setTitle('Rosewood Antiques - Inventory Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Get current user info - called from frontend to check access
 * This triggers OAuth if user hasn't authorized yet
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

// ═══════════════════════════════════════════════════════════════════════════
// PASSPHRASE ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY ACCESS CONTROL (kept for admin identification)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if current session is the script owner (for admin functions)
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
 */
function triggerAuth() {
  // This function triggers the OAuth flow when called via google.script.run
  // Simply accessing the user email is enough to trigger auth
  const email = Session.getActiveUser().getEmail();
  const url = ScriptApp.getService().getUrl();
  return { email: email, url: url };
}

/**
 * Get the script owner's email (always has access and is always admin)
 */
function getScriptOwner() {
  return Session.getEffectiveUser().getEmail();
}

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
  const users = getAllowedUsers();
  const userEntry = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (userEntry) {
    return { allowed: true, isAdmin: userEntry.isAdmin || false };
  }

  return { allowed: false, isAdmin: false };
}

/**
 * Get the list of allowed users from Script Properties
 * @returns {Array} Array of { email, isAdmin, addedBy, addedAt }
 */
function getAllowedUsers() {
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
  const users = getAllowedUsers();
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

  const users = getAllowedUsers();
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

  const users = getAllowedUsers();
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
  const users = getAllowedUsers();

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

/**
 * Include helper for HTML templates
 * Allows <?!= include('SharedStyles') ?> syntax
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sanitizes data for google.script.run serialization
 * Converts Date objects to ISO strings to prevent null returns
 */
function sanitizeForClient(data) {
  if (data === null || data === undefined) {
    return data;
  }
  if (data instanceof Date) {
    return data.toISOString();
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeForClient);
  }
  if (typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        sanitized[key] = sanitizeForClient(data[key]);
      }
    }
    return sanitized;
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGERS & MENU
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates the menu when the spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu("🏛️ Rosewood")
    .addItem("📊 Open Manager", "showSidebar")
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("Quick Add")
        .addItem("➕ New Item", "showAddItemDialog")
        .addItem("💰 Record Sale", "showAddSaleDialog")
        .addItem("👤 New Customer", "showAddCustomerDialog")
    )
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("Test Data")
        .addItem("Generate Minimal (10 items)", "menuGenerateMinimal")
        .addItem("Generate Medium (75 items)", "menuGenerateMedium")
        .addItem("Generate Full (200 items)", "menuGenerateFull")
        .addSeparator()
        .addItem("📈 Add 100 Sales", "menuAdd100Sales")
        .addItem("📈 Add 500 Sales (1 year)", "menuAdd500Sales")
        .addItem("📈 Add 1000 Sales (1 year)", "menuAdd1000Sales")
        .addSeparator()
        .addItem("⚠️ Clear All Data", "menuClearAllData")
    )
    .addSeparator()
    .addSubMenu(
      ui
        .createMenu("Tools")
        .addItem("Initialize All Sheets", "menuInitializeSheets")
        .addItem("Rebuild Weekly Sales", "menuRebuildWeeklySales")
        .addItem("Clear Caches", "menuClearCaches")
        .addSeparator()
        .addItem("🔄 Refresh Dashboard Cache", "menuRefreshDashboardCache")
        .addItem("⏰ Install Cache Trigger", "menuInstallCacheTrigger")
    )
    .addSeparator()
    .addItem("ℹ️ About", "showAbout")
    .addToUi();
}

/**
 * Called when the spreadsheet is installed
 */
function onInstall(e) {
  onOpen(e);
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR & DIALOGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Show the main sidebar
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar")
    .setTitle("Rosewood Manager")
    .setWidth(CONFIG.UI.SIDEBAR_WIDTH);

  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Show add item dialog
 */
function showAddItemDialog() {
  const template = HtmlService.createTemplateFromFile("Dialogs");
  template.dialogType = "item";

  const html = template
    .evaluate()
    .setWidth(CONFIG.UI.DIALOG_WIDTH)
    .setHeight(CONFIG.UI.DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(html, "Add New Item");
}

/**
 * Show add sale dialog
 */
function showAddSaleDialog() {
  const template = HtmlService.createTemplateFromFile("Dialogs");
  template.dialogType = "sale";

  const html = template
    .evaluate()
    .setWidth(CONFIG.UI.DIALOG_WIDTH)
    .setHeight(CONFIG.UI.DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(html, "Record Sale");
}

/**
 * Show add customer dialog
 */
function showAddCustomerDialog() {
  const template = HtmlService.createTemplateFromFile("Dialogs");
  template.dialogType = "customer";

  const html = template
    .evaluate()
    .setWidth(CONFIG.UI.DIALOG_WIDTH)
    .setHeight(CONFIG.UI.DIALOG_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(html, "Add Customer");
}

/**
 * Show the Control Center modal (full viewport for enhanced operations)
 */
function showControlCenter() {
  const html = HtmlService.createHtmlOutputFromFile("ControlCenter")
    .setWidth(CONFIG.UI.CONTROL_CENTER_WIDTH)
    .setHeight(CONFIG.UI.CONTROL_CENTER_HEIGHT);

  SpreadsheetApp.getUi().showModalDialog(html, "Rosewood Control Center");
}

/**
 * Show about dialog
 */
function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "Rosewood Antiques v" + CONFIG.VERSION,
    "A modern inventory management system for antique dealers.\n\n" +
      "Features:\n" +
      "• Inventory tracking with variants & bundles\n" +
      "• Weekly sales analytics\n" +
      "• Customer management\n" +
      "• Bulk operations\n" +
      "• Beautiful dark theme UI\n\n" +
      "Built with Google Apps Script",
    ui.ButtonSet.OK
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generic confirmation and execution for menu actions
 * @private
 */
function _executeWithConfirmation(title, message, action, resultFormatter) {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(title, message, ui.ButtonSet.YES_NO);

  if (result !== ui.Button.YES) return;

  try {
    const actionResult = action();
    if (resultFormatter) {
      resultFormatter(actionResult);
    } else {
      ui.alert("Success", "Operation completed successfully.", ui.ButtonSet.OK);
    }
  } catch (error) {
    console.error(`[MENU] ${title} failed: ${error.message}`);
    ui.alert("Error", error.message, ui.ButtonSet.OK);
  }
}

/**
 * Generic result display for data generation
 * @private
 */
function _showGenerationResult(result, type = "Data") {
  const ui = SpreadsheetApp.getUi();

  if (!result.success) {
    ui.alert("Error", result.error || "Operation failed", ui.ButtonSet.OK);
    return;
  }

  // Build message from result properties
  const r = result.results || {};
  const lines = [];

  if (r.categories) lines.push(`• ${r.categories} categories`);
  if (r.locations) lines.push(`• ${r.locations} locations`);
  if (r.tags) lines.push(`• ${r.tags} tags`);
  if (r.customers || r.customersCreated)
    lines.push(`• ${r.customers || r.customersCreated} customers`);
  if (r.items || r.itemsCreated)
    lines.push(`• ${r.items || r.itemsCreated} inventory items`);
  if (r.variants) lines.push(`• ${r.variants} variants`);
  if (r.bundles) lines.push(`• ${r.bundles} bundles`);
  if (r.sales || r.salesCreated)
    lines.push(`• ${r.sales || r.salesCreated} sales records`);
  if (r.weeksRebuilt) lines.push(`• ${r.weeksRebuilt} weekly summaries rebuilt`);

  ui.alert(
    `${type} Generated`,
    `Successfully created:\n\n${lines.join("\n")}`,
    ui.ButtonSet.OK
  );
}

// Test Data Generation Menu Handlers
function menuGenerateMinimal() {
  _executeWithConfirmation(
    "Generate Test Data",
    "This will create minimal test data (10 items, 5 customers).\n\nProceed?",
    () => TestDataGenerator.generateMinimal(),
    (result) => _showGenerationResult(result, "Minimal Data")
  );
}

function menuGenerateMedium() {
  _executeWithConfirmation(
    "Generate Test Data",
    "This will create medium test data (75 items, 25 customers, 30 sales).\n\nProceed?",
    () => TestDataGenerator.generateMedium(),
    (result) => _showGenerationResult(result, "Medium Data")
  );
}

function menuGenerateFull() {
  _executeWithConfirmation(
    "Generate Test Data",
    "This will create full test data (200 items, 50 customers, 100 sales).\n\nThis may take a moment. Proceed?",
    () => TestDataGenerator.generateFull(),
    (result) => _showGenerationResult(result, "Full Data")
  );
}

function menuClearAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    "⚠️ Clear All Data",
    "This will DELETE ALL DATA in this spreadsheet!\n\nThis action cannot be undone.\n\nAre you absolutely sure?",
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    const confirm = ui.alert(
      "Final Confirmation",
      "Type YES to confirm deletion of all data.",
      ui.ButtonSet.YES_NO
    );

    if (confirm === ui.Button.YES) {
      TestDataGenerator.clearAllData();
      ui.alert(
        "Data Cleared",
        "All data has been removed. Sheets have been reinitialized.",
        ui.ButtonSet.OK
      );
    }
  }
}

// Sales Generation Menu Handlers
function menuAdd100Sales() {
  _executeWithConfirmation(
    "Generate Sales Data",
    "This will add 100 sales from the last 90 days.\n\nProceed?",
    () =>
      TestDataGenerator.generateMassiveSales({
        salesCount: 100,
        daysBack: 90,
        createItems: true,
      }),
    (result) => _showGenerationResult(result, "Sales Data")
  );
}

function menuAdd500Sales() {
  _executeWithConfirmation(
    "Generate Sales Data",
    "This will add 500 sales spread over the last year.\n\nThis may take a moment. Proceed?",
    () =>
      TestDataGenerator.generateMassiveSales({
        salesCount: 500,
        daysBack: 365,
        createItems: true,
      }),
    (result) => _showGenerationResult(result, "Sales Data")
  );
}

function menuAdd1000Sales() {
  _executeWithConfirmation(
    "Generate Sales Data",
    "This will add 1000 sales spread over the last year.\n\nThis will take a while. Proceed?",
    () =>
      TestDataGenerator.generateMassiveSales({
        salesCount: 1000,
        daysBack: 365,
        createItems: true,
      }),
    (result) => _showGenerationResult(result, "Sales Data")
  );
}

// Tool Menu Handlers
function menuInitializeSheets() {
  _executeWithConfirmation(
    "Initialize Sheets",
    "This will create all required sheets. Proceed?",
    () => DataService.initializeAllSheets(),
    () =>
      SpreadsheetApp.getUi().alert(
        "Sheets Initialized",
        "All required sheets have been created.",
        SpreadsheetApp.getUi().ButtonSet.OK
      )
  );
}

function menuRebuildWeeklySales() {
  _executeWithConfirmation(
    "Rebuild Weekly Sales",
    "This will rebuild all weekly sales summaries. Proceed?",
    () => SalesService.rebuildAllWeeklySales(),
    (count) =>
      SpreadsheetApp.getUi().alert(
        "Weekly Sales Rebuilt",
        `Rebuilt summaries for ${count} weeks.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      )
  );
}

function menuClearCaches() {
  _executeWithConfirmation(
    "Clear Caches",
    "This will clear all cached data. Proceed?",
    () => DataService.clearAllCaches(),
    () =>
      SpreadsheetApp.getUi().alert(
        "Caches Cleared",
        "All caches have been cleared.",
        SpreadsheetApp.getUi().ButtonSet.OK
      )
  );
}

function menuRefreshDashboardCache() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "Refreshing Cache",
    "Please wait while the dashboard cache is refreshed...",
    ui.ButtonSet.OK
  );

  const result = DashboardCacheService.refreshAllMetrics();

  ui.alert(
    "Cache Refreshed",
    `Dashboard cache has been refreshed.\n\nMetrics updated: ${result.metricsUpdated}\nDuration: ${result.duration}ms`,
    ui.ButtonSet.OK
  );
}

function menuInstallCacheTrigger() {
  _executeWithConfirmation(
    "Install Cache Trigger",
    "This will install a time-based trigger that refreshes the dashboard cache every 5 minutes.\n\nProceed?",
    () => installCacheTrigger(),
    (result) =>
      SpreadsheetApp.getUi().alert(
        "Trigger Installed",
        result.message,
        SpreadsheetApp.getUi().ButtonSet.OK
      )
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS (called from frontend)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wrap API operations with consistent response format
 * @private
 */
function _apiResponse(operation) {
  try {
    const result = operation();
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[API] Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get configuration for frontend
 */
function getConfig() {
  return {
    version: CONFIG.VERSION,
    appName: CONFIG.APP_NAME,
    colors: CONFIG.COLORS,
    itemStatus: CONFIG.ITEM_STATUS,
    conditions: CONFIG.CONDITIONS,
    eras: CONFIG.ERAS,
    paymentMethods: CONFIG.PAYMENT_METHODS,
    variantTypes: CONFIG.VARIANT_TYPES,
    pageSize: CONFIG.PERFORMANCE.PAGE_SIZE,
  };
}

/**
 * Get dashboard data
 */
function getDashboard() {
  return {
    inventory: InventoryService.getDashboardStats(),
    sales: SalesService.getDashboardStats(),
  };
}

/**
 * Get enhanced dashboard data (V2) - Cache-first with fallback
 * Returns health score, action items, charts data, etc.
 */
function getDashboardV2() {
  try {
    // Check if we have cached data
    const quickStats =
      DashboardCacheService.getMetricsByCategory("quick_stats");
    const hasCachedData = Object.keys(quickStats).length > 0;

    // If cache exists and not empty, use cache-first approach
    if (hasCachedData) {
      const health = DashboardCacheService.getMetricsByCategory("health");
      const today = DashboardCacheService.getMetricsByCategory("today");
      const charts = DashboardCacheService.getMetricsByCategory("charts");
      const recent = DashboardCacheService.getMetricsByCategory("recent");
      const actions = DashboardCacheService.getMetric("action_items");

      return {
        // Health score and metrics
        inventoryHealthScore: health.health_score || 0,
        turnoverRate: health.health_turnover_rate || 0,
        agingItemCount: health.health_aging_count || 0,
        blendedMargin: health.health_blended_margin || 0,
        averageVelocity: health.health_avg_velocity || 0,

        // Action items
        actionItems: actions || [],

        // Today's summary
        todaySummary: {
          revenue: today.today_revenue || 0,
          itemsSold: today.today_items_sold || 0,
          avgMargin: today.today_avg_margin || 0,
          vsLastWeek: today.today_vs_last_week || 0,
        },

        // Chart data
        categoryPerformance: charts.category_performance || [],
        weeklyRevenue: charts.weekly_revenue || [],

        // Legacy/compatibility
        inventory: {
          totalItems: quickStats.inventory_total_items || 0,
          availableItems: quickStats.inventory_available_count || 0,
          totalValue: quickStats.inventory_total_value || 0,
          recentItems: recent.recent_items || [],
        },
        sales: {
          weeklyRevenue: quickStats.sales_weekly_revenue || 0,
          recentSales: recent.recent_sales || [],
        },

        // Flag that this is from cache
        fromCache: true,
      };
    }

    // No cache - compute everything fresh
    console.log("No cache found, computing fresh dashboard data");
    return computeFreshDashboard();
  } catch (error) {
    console.error("Error in getDashboardV2:", error);
    // Fallback - compute fresh without caching
    return computeFreshDashboard();
  }
}

/**
 * Compute fresh dashboard data (no caching)
 */
function computeFreshDashboard() {
  try {
    const healthData = InventoryAnalyticsService.calculateHealthScore();

    return {
      inventoryHealthScore: healthData.score,
      turnoverRate: healthData.turnoverRate,
      agingItemCount: healthData.agingItemCount,
      blendedMargin: healthData.blendedMargin,
      averageVelocity: healthData.averageVelocity,
      actionItems: InventoryAnalyticsService.getActionItems(),
      todaySummary: SalesService.getTodaySummary(),
      categoryPerformance: SalesService.getCategoryPerformance(),
      agingDistribution: InventoryAnalyticsService.getAgingDistribution(),
      weeklyRevenue: SalesService.getWeeklyRevenue(12),
      inventory: InventoryService.getDashboardStats(),
      sales: SalesService.getDashboardStats(),
      fromCache: false,
    };
  } catch (error) {
    console.error("Error in computeFreshDashboard:", error);
    // Return empty but valid structure
    return {
      inventoryHealthScore: 0,
      turnoverRate: 0,
      agingItemCount: 0,
      blendedMargin: 0,
      averageVelocity: 0,
      actionItems: [],
      todaySummary: { revenue: 0, itemsSold: 0, avgMargin: 0, vsLastWeek: 0 },
      categoryPerformance: [],
      weeklyRevenue: [],
      inventory: {
        totalItems: 0,
        availableItems: 0,
        totalValue: 0,
        recentItems: [],
      },
      sales: { weeklyRevenue: 0, recentSales: [] },
      fromCache: false,
      error: error.message,
    };
  }
}

/**
 * Get quick stats only (for fast initial load)
 * Returns minimal data from cache for immediate display
 */
function getQuickStats() {
  const cached = DashboardCacheService.getMetricsByCategory("quick_stats");

  if (Object.keys(cached).length > 0) {
    return {
      totalItems: cached.inventory_total_items || 0,
      availableItems: cached.inventory_available_count || 0,
      totalValue: cached.inventory_total_value || 0,
      weeklyRevenue: cached.sales_weekly_revenue || 0,
      fromCache: true,
    };
  }

  // Fallback: compute fresh
  const invStats = InventoryService.getDashboardStats();
  const salesStats = SalesService.getDashboardStats();

  // Update cache for next time
  DashboardCacheService.setMetric("inventory_total_items", invStats.totalItems);
  DashboardCacheService.setMetric(
    "inventory_available_count",
    invStats.availableItems
  );
  DashboardCacheService.setMetric("inventory_total_value", invStats.totalValue);
  DashboardCacheService.setMetric(
    "sales_weekly_revenue",
    salesStats.weeklyRevenue
  );

  return {
    totalItems: invStats.totalItems,
    availableItems: invStats.availableItems,
    totalValue: invStats.totalValue,
    weeklyRevenue: salesStats.weeklyRevenue,
    fromCache: false,
  };
}

/**
 * Get chart data separately (for deferred load)
 */
function getChartData() {
  const cached = DashboardCacheService.getMetricsByCategory("charts");

  if (cached.category_performance && cached.weekly_revenue) {
    return {
      categoryPerformance: cached.category_performance,
      weeklyRevenue: cached.weekly_revenue,
      fromCache: true,
    };
  }

  // Fallback: compute fresh
  const categoryPerformance = SalesService.getCategoryPerformance();
  const weeklyRevenue = SalesService.getWeeklyRevenue(12);

  DashboardCacheService.setMetric("category_performance", categoryPerformance);
  DashboardCacheService.setMetric("weekly_revenue", weeklyRevenue);

  return {
    categoryPerformance,
    weeklyRevenue,
    fromCache: false,
  };
}

/**
 * Get recent activity (for deferred load)
 */
function getRecentActivity() {
  const cached = DashboardCacheService.getMetricsByCategory("recent");

  if (cached.recent_sales && cached.recent_items) {
    return {
      recentSales: cached.recent_sales,
      recentItems: cached.recent_items,
      fromCache: true,
    };
  }

  // Fallback: compute fresh
  const sales = DataService.getAll(CONFIG.SHEETS.SALES, {
    filters: { Status: CONFIG.DEFAULTS.SALE_STATUS },
  });
  const items = InventoryService.getItems({ includeCategory: true });

  // Build lookup map once instead of using .find() in a loop (eliminates N+1)
  const itemsMap = Utils.buildLookupMap(items, 'Item_ID');

  const recentSales = sales
    .sort((a, b) => new Date(b.Date) - new Date(a.Date))
    .slice(0, 10)
    .map((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        sale.Item_Name = item ? item.Name : CONFIG.DEFAULTS.ITEM_NAME;
      }
      return sale;
    });

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentItems = items
    .filter((i) => new Date(i.Date_Added) > weekAgo)
    .sort((a, b) => new Date(b.Date_Added) - new Date(a.Date_Added))
    .slice(0, 10);

  DashboardCacheService.setMetric("recent_sales", recentSales);
  DashboardCacheService.setMetric("recent_items", recentItems);

  return {
    recentSales,
    recentItems,
    fromCache: false,
  };
}

/**
 * Force refresh the dashboard cache
 */
function refreshDashboardCache() {
  return DashboardCacheService.refreshAllMetrics();
}

/**
 * Install time-driven trigger for cache refresh
 */
function installCacheTrigger() {
  // Remove existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === "refreshDashboardCache") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger every 5 minutes
  ScriptApp.newTrigger("refreshDashboardCache")
    .timeBased()
    .everyMinutes(5)
    .create();

  return {
    success: true,
    message: "Cache refresh trigger installed (every 5 minutes)",
  };
}

/**
 * Get inventory items (paginated - efficient, reads only needed rows)
 */
function getInventory(options = {}) {
  try {
    const { page = 1, pageSize = CONFIG.PERFORMANCE.PAGE_SIZE } = options;

    console.log("getInventory called with page:", page, "pageSize:", pageSize);

    // Use efficient pagination - only reads needed rows
    const result = DataService.getPaginated(CONFIG.SHEETS.INVENTORY, {
      page,
      pageSize,
      reverseOrder: true, // Newest first
    });

    console.log(
      "getPaginated returned:",
      result.items.length,
      "items, total:",
      result.total
    );

    // Enrich with category names
    if (result.items.length > 0) {
      const categories = TaxonomyService.getCategoriesMap();
      result.items = result.items.map((item) => ({
        ...item,
        Category_Name:
          categories[item.Category_ID] || CONFIG.DEFAULTS.CATEGORY_NAME,
      }));
    }

    // Sanitize Date objects for google.script.run serialization
    return sanitizeForClient(result);
  } catch (error) {
    console.error("Error in getInventory:", error);

    // Fallback to old method
    console.log("Falling back to getAll method");
    const allItems = InventoryService.getItems({ includeCategory: true });
    const page = options.page || 1;
    const pageSize = options.pageSize || CONFIG.PERFORMANCE.PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return sanitizeForClient({
      items,
      total: allItems.length,
      page,
      pageSize,
      totalPages: Math.ceil(allItems.length / pageSize),
    });
  }
}

/**
 * Get single item details
 */
function getItemDetails(itemId) {
  return InventoryService.getItem(itemId);
}

/**
 * Create new item
 */
function createItem(data) {
  return InventoryService.createItem(data);
}

/**
 * Update item
 */
function updateItem(itemId, updates) {
  return InventoryService.updateItem(itemId, updates);
}

/**
 * Delete item
 */
function deleteItem(itemId) {
  return InventoryService.deleteItem(itemId);
}

/**
 * Search inventory
 */
function searchInventory(query) {
  return InventoryService.searchItems(query);
}

/**
 * Get categories tree
 */
function getCategories() {
  return TaxonomyService.getCategoryTree();
}

/**
 * Get flat categories list
 */
function getCategoriesList() {
  return TaxonomyService.getCategories();
}

/**
 * Get locations
 */
function getLocations() {
  return TaxonomyService.getLocations();
}

/**
 * Get tags
 */
function getTags() {
  return TaxonomyService.getTags();
}

/**
 * Get sales (paginated - efficient, reads only needed rows)
 */
function getSales(options = {}) {
  try {
    const { page = 1, pageSize = CONFIG.PERFORMANCE.PAGE_SIZE } = options;

    console.log("getSales called with page:", page, "pageSize:", pageSize);

    // Use efficient pagination - only reads needed rows
    const result = DataService.getPaginated(CONFIG.SHEETS.SALES, {
      page,
      pageSize,
      reverseOrder: true, // Newest first
    });

    console.log(
      "getPaginated returned:",
      result.items.length,
      "items, total:",
      result.total
    );

    // Enrich with item names using batch lookup (eliminates N+1)
    if (result.items.length > 0) {
      const itemIds = [...new Set(result.items.map(s => s.Item_ID).filter(Boolean))];
      const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

      result.items = result.items.map((sale) => {
        if (sale.Item_ID) {
          const item = itemsMap[sale.Item_ID];
          sale.Item_Name = item ? item.Name : CONFIG.DEFAULTS.ITEM_NAME;
        }
        return sale;
      });
    }

    // Rename items to sales for consistency with frontend
    result.sales = result.items;
    delete result.items;

    // Sanitize Date objects for google.script.run serialization
    return sanitizeForClient(result);
  } catch (error) {
    console.error("Error in getSales:", error);

    // Fallback to old method
    console.log("Falling back to SalesService.getSales method");
    const allSales = SalesService.getSales({ enrichItems: true });
    const page = options.page || 1;
    const pageSize = options.pageSize || CONFIG.PERFORMANCE.PAGE_SIZE;
    const start = (page - 1) * pageSize;
    const sales = allSales.slice(start, start + pageSize);

    return sanitizeForClient({
      sales,
      total: allSales.length,
      page,
      pageSize,
      totalPages: Math.ceil(allSales.length / pageSize),
    });
  }
}

/**
 * Record new sale
 */
function recordSale(data) {
  return SalesService.recordSale(data);
}

/**
 * Get weekly sales
 */
function getWeeklySales(weeks = 12) {
  return SalesService.getWeeklySales({ weeks });
}

/**
 * Get customers
 */
function getCustomers() {
  return SalesService.getCustomers();
}

/**
 * Create customer
 */
function createCustomer(data) {
  return SalesService.createCustomer(data);
}

/**
 * Get available items (for sale recording)
 */
function getAvailableItems() {
  return InventoryService.getItems({
    filters: { Status: CONFIG.DEFAULTS.STATUS },
  }).map((item) => ({
    id: item.Item_ID,
    name: item.Name,
    price: item.Price,
    quantity: item.Quantity,
  }));
}

/**
 * Bulk operations
 */
function bulkUpdateStatus(itemIds, status) {
  return BulkOperations.bulkUpdateField(itemIds, "Status", status);
}

function bulkMoveItems(itemIds, locationId) {
  return BulkOperations.bulkMoveToLocation(itemIds, locationId);
}

function bulkDeleteItems(itemIds) {
  return BulkOperations.bulkDeleteItems(itemIds);
}

function quickSale(itemIds, options) {
  return BulkOperations.quickSaleItems(itemIds, options);
}

/**
 * Get bundles
 */
function getBundles() {
  return InventoryService.getBundles();
}

/**
 * Export inventory to CSV
 */
function exportInventoryCSV(filters = {}) {
  return BulkOperations.exportInventoryToCSV(filters);
}

/**
 * Import inventory from CSV
 */
function importInventoryCSV(csvString) {
  return BulkOperations.importInventoryFromCSV(csvString);
}
