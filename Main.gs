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

// ═══════════════════════════════════════════════════════════════════════════
// ACCESS CONTROL API (delegates to AccessControlService)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get current user info - called from frontend to check access
 * This triggers OAuth if user hasn't authorized yet
 */
function getCurrentUser() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(AccessControlService.getCurrentUser());
  }, 'getCurrentUser');
}

/**
 * Verify a passphrase for access
 * @param {string} input - The passphrase entered by user
 * @returns {Object} { valid: boolean, expiresAt: string }
 */
function verifyPassphrase(input) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(AccessControlService.verifyPassphrase(input));
  }, 'verifyPassphrase');
}

/**
 * Get passphrase settings (admin only)
 * @returns {Object} Current passphrase configuration
 */
function getPassphraseSettings() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(AccessControlService.getPassphraseSettings());
  }, 'getPassphraseSettings');
}

/**
 * Set passphrase settings (admin only)
 * @param {Object} settings - { mode, staticPassphrase, seed, expiryHours }
 * @returns {Object} Result
 */
function setPassphraseSettings(settings) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(AccessControlService.setPassphraseSettings(settings));
  }, 'setPassphraseSettings');
}

/**
 * Get the deployed web app URL
 * Tries Script Properties first (set via setWebAppUrl), falls back to ScriptApp
 * @returns {string} The web app URL
 */
function getWebAppUrl() {
  return Utils.wrapApiCall(() => {
    // First try Script Properties (manually set after deployment)
    const props = PropertiesService.getScriptProperties();
    const storedUrl = props.getProperty('WEB_APP_URL');
    if (storedUrl) {
      return storedUrl;
    }
    // Fall back to ScriptApp (works for dev mode)
    const serviceUrl = ScriptApp.getService().getUrl();
    if (serviceUrl) {
      return serviceUrl;
    }
    return null;
  }, 'getWebAppUrl');
}

/**
 * Set the web app URL (call after deployment)
 * @param {string} url - The deployed web app URL
 */
function setWebAppUrl(url) {
  return Utils.wrapApiCall(() => {
    if (!AccessControlService.isOwner()) {
      return { success: false, error: 'Admin access required' };
    }
    const props = PropertiesService.getScriptProperties();
    props.setProperty('WEB_APP_URL', url);
    return { success: true, message: 'Web app URL saved' };
  }, 'setWebAppUrl');
}

/**
 * Check if current session is the script owner (for admin functions)
 */
function isOwner() {
  return Utils.wrapApiCall(() => {
    return AccessControlService.isOwner();
  }, 'isOwner');
}

/**
 * Get the script owner's email (always has access and is always admin)
 */
function getOwnerEmail() {
  return Utils.wrapApiCall(() => {
    return AccessControlService.getOwnerEmail();
  }, 'getOwnerEmail');
}

/**
 * Check if a user has access to the web app
 * @param {string} email - User's email address
 * @returns {Object} { allowed: boolean, isAdmin: boolean, requiresPassphrase: boolean }
 */
function checkUserAccess(email) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(AccessControlService.checkUserAccess(email));
  }, 'checkUserAccess');
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
  const template = HtmlService.createTemplateFromFile("Sidebar");
  const html = template.evaluate()
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
  const template = HtmlService.createTemplateFromFile("ControlCenter");
  const html = template.evaluate()
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
  return Utils.wrapApiCall(() => {
    return sanitizeForClient({
      version: CONFIG.VERSION,
      appName: CONFIG.APP_NAME,
      colors: CONFIG.COLORS,
      itemStatus: CONFIG.ITEM_STATUS,
      conditions: CONFIG.CONDITIONS,
      eras: CONFIG.ERAS,
      paymentMethods: CONFIG.PAYMENT_METHODS,
      variantTypes: CONFIG.VARIANT_TYPES,
      pageSize: CONFIG.PERFORMANCE.PAGE_SIZE,
    });
  }, 'getConfig');
}

/**
 * Get dashboard data
 */
function getDashboard() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient({
      inventory: InventoryService.getDashboardStats(),
      sales: SalesService.getDashboardStats(),
    });
  }, 'getDashboard');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD V2 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get quick stats from cache - Returns inventory counts and values
 * Used internally by getDashboardV2 for fast initial load
 * @returns {Object} Quick stats data with inventory and sales info
 */
function getQuickStatsCached() {
  const quickStats = DashboardCacheService.getMetricsByCategory("quick_stats");
  const recent = DashboardCacheService.getMetricsByCategory("recent");

  return {
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
  };
}

/**
 * Get health metrics from cache - Returns health score data
 * @returns {Object} Health metrics including score, turnover rate, aging count, etc.
 */
function getHealthMetrics() {
  const health = DashboardCacheService.getMetricsByCategory("health");

  return {
    inventoryHealthScore: health.health_score || 0,
    turnoverRate: health.health_turnover_rate || 0,
    agingItemCount: health.health_aging_count || 0,
    blendedMargin: health.health_blended_margin || 0,
    averageVelocity: health.health_avg_velocity || 0,
  };
}

/**
 * Get today's summary from cache - Returns today's sales summary
 * @returns {Object} Today's summary with revenue, items sold, margin, and comparison
 */
function getTodaySummaryCached() {
  const today = DashboardCacheService.getMetricsByCategory("today");

  return {
    revenue: today.today_revenue || 0,
    itemsSold: today.today_items_sold || 0,
    avgMargin: today.today_avg_margin || 0,
    vsLastWeek: today.today_vs_last_week || 0,
  };
}

/**
 * Get action items from cache - Returns action items list
 * @returns {Array} List of action items requiring attention
 */
function getActionItemsCached() {
  const actions = DashboardCacheService.getMetric("action_items");
  return actions || [];
}

/**
 * Get chart data from cache - Returns category performance and weekly revenue
 * @returns {Object} Chart data with categoryPerformance and weeklyRevenue arrays
 */
function getChartDataCached() {
  const charts = DashboardCacheService.getMetricsByCategory("charts");

  return {
    categoryPerformance: charts.category_performance || [],
    weeklyRevenue: charts.weekly_revenue || [],
  };
}

/**
 * Get enhanced dashboard data (V2) - Cache-first with fallback
 * Returns health score, action items, charts data, etc.
 * Orchestrates the smaller focused functions for dashboard data retrieval.
 */
function getDashboardV2() {
  return Utils.wrapApiCall(() => {
    // Check if we have cached data
    const quickStats =
      DashboardCacheService.getMetricsByCategory("quick_stats");
    const hasCachedData = Object.keys(quickStats).length > 0;

    // If cache exists and not empty, use cache-first approach
    if (hasCachedData) {
      const healthMetrics = getHealthMetrics();
      const todaySummary = getTodaySummaryCached();
      const chartData = getChartDataCached();
      const actionItems = getActionItemsCached();
      const quickStatsData = getQuickStatsCached();

      return sanitizeForClient({
        // Health score and metrics
        ...healthMetrics,

        // Action items
        actionItems: actionItems,

        // Today's summary
        todaySummary: todaySummary,

        // Chart data
        categoryPerformance: chartData.categoryPerformance,
        weeklyRevenue: chartData.weeklyRevenue,

        // Legacy/compatibility
        inventory: quickStatsData.inventory,
        sales: quickStatsData.sales,

        // Flag that this is from cache
        fromCache: true,
      });
    }

    // No cache - compute everything fresh
    console.log("No cache found, computing fresh dashboard data");
    return sanitizeForClient(computeFreshDashboard());
  }, 'getDashboardV2');
}

/**
 * Compute fresh dashboard data (no caching)
 */
function computeFreshDashboard() {
  try {
    console.log('[computeFreshDashboard] Starting fresh computation...');
    const startTime = Date.now();
    const healthData = InventoryAnalyticsService.calculateHealthScore();
    console.log('[computeFreshDashboard] Health data computed in ' + (Date.now() - startTime) + 'ms');

    const result = {
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
    console.log('[computeFreshDashboard] Completed successfully in ' + (Date.now() - startTime) + 'ms');
    return result;
  } catch (error) {
    console.error("[computeFreshDashboard] Error:", error);
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
  return Utils.wrapApiCall(() => {
    const cached = DashboardCacheService.getMetricsByCategory("quick_stats");

    if (Object.keys(cached).length > 0) {
      return sanitizeForClient({
        totalItems: cached.inventory_total_items || 0,
        availableItems: cached.inventory_available_count || 0,
        totalValue: cached.inventory_total_value || 0,
        weeklyRevenue: cached.sales_weekly_revenue || 0,
        fromCache: true,
      });
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

    return sanitizeForClient({
      totalItems: invStats.totalItems,
      availableItems: invStats.availableItems,
      totalValue: invStats.totalValue,
      weeklyRevenue: salesStats.weeklyRevenue,
      fromCache: false,
    });
  }, 'getQuickStats');
}

/**
 * Get chart data separately (for deferred load)
 */
function getChartData() {
  return Utils.wrapApiCall(() => {
    const cached = DashboardCacheService.getMetricsByCategory("charts");

    if (cached.category_performance && cached.weekly_revenue) {
      return sanitizeForClient({
        categoryPerformance: cached.category_performance,
        weeklyRevenue: cached.weekly_revenue,
        fromCache: true,
      });
    }

    // Fallback: compute fresh
    const categoryPerformance = SalesService.getCategoryPerformance();
    const weeklyRevenue = SalesService.getWeeklyRevenue(12);

    DashboardCacheService.setMetric("category_performance", categoryPerformance);
    DashboardCacheService.setMetric("weekly_revenue", weeklyRevenue);

    return sanitizeForClient({
      categoryPerformance,
      weeklyRevenue,
      fromCache: false,
    });
  }, 'getChartData');
}

/**
 * Get recent activity (for deferred load)
 */
function getRecentActivity() {
  return Utils.wrapApiCall(() => {
    const cached = DashboardCacheService.getMetricsByCategory("recent");

    if (cached.recent_sales && cached.recent_items) {
      return sanitizeForClient({
        recentSales: cached.recent_sales,
        recentItems: cached.recent_items,
        fromCache: true,
      });
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

    return sanitizeForClient({
      recentSales,
      recentItems,
      fromCache: false,
    });
  }, 'getRecentActivity');
}

/**
 * Force refresh the dashboard cache
 */
function refreshDashboardCache() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(DashboardCacheService.refreshAllMetrics());
  }, 'refreshDashboardCache');
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
  return Utils.wrapApiCall(() => {
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
  }, 'getInventory');
}

/**
 * Get single item details
 */
function getItemDetails(itemId) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.getItem(itemId));
  }, 'getItemDetails');
}

/**
 * Create new item
 */
function createItem(data) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.createItem(data));
  }, 'createItem');
}

/**
 * Update item
 */
function updateItem(itemId, updates) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.updateItem(itemId, updates));
  }, 'updateItem');
}

/**
 * Delete item
 */
function deleteItem(itemId) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.deleteItem(itemId));
  }, 'deleteItem');
}

/**
 * Search inventory
 */
function searchInventory(query) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.searchItems(query));
  }, 'searchInventory');
}

/**
 * Get categories tree
 */
function getCategories() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(TaxonomyService.getCategoryTree());
  }, 'getCategories');
}

/**
 * Get flat categories list
 */
function getCategoriesList() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(TaxonomyService.getCategories());
  }, 'getCategoriesList');
}

/**
 * Get locations
 */
function getLocations() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(TaxonomyService.getLocations());
  }, 'getLocations');
}

/**
 * Get tags
 */
function getTags() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(TaxonomyService.getTags());
  }, 'getTags');
}

/**
 * Get sales (paginated - efficient, reads only needed rows)
 */
function getSales(options = {}) {
  return Utils.wrapApiCall(() => {
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
  }, 'getSales');
}

/**
 * Record new sale
 */
function recordSale(data) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(SalesService.recordSale(data));
  }, 'recordSale');
}

/**
 * Get weekly sales
 */
function getWeeklySales(weeks = 12) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(SalesService.getWeeklySales({ weeks }));
  }, 'getWeeklySales');
}

/**
 * Get customers
 */
function getCustomers() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(SalesService.getCustomers());
  }, 'getCustomers');
}

/**
 * Create customer
 */
function createCustomer(data) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(SalesService.createCustomer(data));
  }, 'createCustomer');
}

/**
 * Get available items (for sale recording)
 */
function getAvailableItems() {
  return Utils.wrapApiCall(() => {
    const items = InventoryService.getItems({
      filters: { Status: CONFIG.DEFAULTS.STATUS },
    }).map((item) => ({
      id: item.Item_ID,
      name: item.Name,
      price: item.Price,
      quantity: item.Quantity,
    }));
    return sanitizeForClient(items);
  }, 'getAvailableItems');
}

/**
 * Bulk operations
 */
function bulkUpdateStatus(itemIds, status) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.bulkUpdateField(itemIds, "Status", status));
  }, 'bulkUpdateStatus');
}

function bulkMoveItems(itemIds, locationId) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.bulkMoveToLocation(itemIds, locationId));
  }, 'bulkMoveItems');
}

function bulkDeleteItems(itemIds) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.bulkDeleteItems(itemIds));
  }, 'bulkDeleteItems');
}

function quickSale(itemIds, options) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.quickSaleItems(itemIds, options));
  }, 'quickSale');
}

/**
 * Get bundles
 */
function getBundles() {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.getBundles());
  }, 'getBundles');
}

/**
 * Export inventory to CSV
 */
function exportInventoryCSV(filters = {}) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.exportInventoryToCSV(filters));
  }, 'exportInventoryCSV');
}

/**
 * Import inventory from CSV
 */
function importInventoryCSV(csvString) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(BulkOperations.importInventoryFromCSV(csvString));
  }, 'importInventoryCSV');
}
