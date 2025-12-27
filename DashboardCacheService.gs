/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Dashboard Cache Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Manages pre-computed dashboard metrics for fast loading.
 * Uses a dedicated sheet for persistent caching with TTL support.
 */

const DashboardCacheService = (function () {
  // ─────────────────────────────────────────────────────────────────────────
  // MODULE-LEVEL CACHE (eliminates N+1 sheet reads within execution)
  // ─────────────────────────────────────────────────────────────────────────
  let _metricsCache = null;
  let _metricsCacheTime = null;
  const METRICS_CACHE_TTL = 5000; // 5 seconds within execution

  // Cache configuration with TTLs in seconds (from Config.gs)
  const CACHE_TTL = CONFIG.PERFORMANCE.CACHE_TTL;

  const METRIC_CONFIG = {
    // Quick stats (shown immediately)
    inventory_total_items: { ttl: 120, category: "quick_stats" },
    inventory_available_count: { ttl: 120, category: "quick_stats" },
    inventory_total_value: { ttl: 120, category: "quick_stats" },
    sales_weekly_revenue: { ttl: 120, category: "quick_stats" },

    // Health metrics
    health_score: { ttl: 300, category: "health" },
    health_turnover_rate: { ttl: 300, category: "health" },
    health_aging_count: { ttl: 300, category: "health" },
    health_blended_margin: { ttl: 300, category: "health" },
    health_avg_velocity: { ttl: 300, category: "health" },

    // Today's summary
    today_revenue: { ttl: 60, category: "today" },
    today_items_sold: { ttl: 60, category: "today" },
    today_avg_margin: { ttl: 60, category: "today" },
    today_vs_last_week: { ttl: 60, category: "today" },

    // Action items (JSON)
    action_items: { ttl: 300, category: "actions" },

    // Chart data (JSON)
    category_performance: { ttl: 300, category: "charts" },
    weekly_revenue: { ttl: 300, category: "charts" },

    // Recent activity (JSON)
    recent_sales: { ttl: 60, category: "recent" },
    recent_items: { ttl: 120, category: "recent" },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Single-read cache loader (fixes N+1 pattern)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load all metrics from sheet into memory cache (single read)
   * Subsequent calls within TTL return cached data
   */
  function _loadMetricsCache() {
    const now = Date.now();
    if (
      _metricsCache &&
      _metricsCacheTime &&
      now - _metricsCacheTime < METRICS_CACHE_TTL
    ) {
      return _metricsCache;
    }

    const sheet = DataService.getSheet(CONFIG.SHEETS.DASHBOARD_CACHE);
    const data = sheet.getDataRange().getValues();

    _metricsCache = {};
    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];
      const lastUpdated = data[i][2];
      const category = data[i][4]; // Category is column 5

      _metricsCache[key] = {
        value: value,
        lastUpdated: lastUpdated,
        category: category,
        rowIndex: i + 1,
      };
    }
    _metricsCacheTime = now;
    return _metricsCache;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API (optimized to use single-read cache)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a cached metric value (optimized - uses single read cache)
   */
  function getMetric(key) {
    const cache = _loadMetricsCache();
    const metric = cache[key];
    if (!metric) return null;

    // Check if stale based on category TTL
    const ttl = CACHE_TTL[metric.category] || CACHE_TTL.default;
    const age = (Date.now() - new Date(metric.lastUpdated).getTime()) / 1000;
    if (age > ttl) return null;

    // Parse JSON if needed
    try {
      if (
        typeof metric.value === "string" &&
        (metric.value.startsWith("[") || metric.value.startsWith("{"))
      ) {
        return JSON.parse(metric.value);
      }
      return metric.value;
    } catch (e) {
      return metric.value;
    }
  }

  /**
   * Set a cached metric value
   */
  function setMetric(key, value) {
    const sheet = DataService.getSheet(CONFIG.SHEETS.DASHBOARD_CACHE);
    const data = sheet.getDataRange().getValues();
    const config = METRIC_CONFIG[key] || { ttl: 300, category: "misc" };

    // Serialize objects/arrays to JSON
    const storedValue =
      typeof value === "object" ? JSON.stringify(value) : value;

    // Find existing row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        // Update existing
        sheet
          .getRange(i + 1, 2, 1, 4)
          .setValues([[storedValue, new Date(), config.ttl, config.category]]);
        // Invalidate cache
        _metricsCache = null;
        return;
      }
    }

    // Insert new
    sheet.appendRow([
      key,
      storedValue,
      new Date(),
      config.ttl,
      config.category,
    ]);
    // Invalidate cache
    _metricsCache = null;
  }

  /**
   * Get multiple metrics at once (optimized - uses single read cache)
   */
  function getMetrics(keys) {
    const cache = _loadMetricsCache();
    const result = {};

    keys.forEach((key) => {
      const metric = cache[key];
      if (metric) {
        // Check if stale based on category TTL
        const ttl = CACHE_TTL[metric.category] || CACHE_TTL.default;
        const age =
          (Date.now() - new Date(metric.lastUpdated).getTime()) / 1000;
        if (age <= ttl) {
          // Parse JSON if needed
          try {
            const value = metric.value;
            if (
              typeof value === "string" &&
              (value.startsWith("[") || value.startsWith("{"))
            ) {
              result[key] = JSON.parse(value);
            } else {
              result[key] = value;
            }
          } catch (e) {
            result[key] = metric.value;
          }
        }
      }
    });

    return result;
  }

  /**
   * Get all metrics by category (optimized - uses single read cache)
   */
  function getMetricsByCategory(category) {
    const cache = _loadMetricsCache();
    const result = {};
    const ttl = CACHE_TTL[category] || CACHE_TTL.default;

    Object.keys(cache).forEach((key) => {
      if (cache[key].category === category) {
        // Check TTL
        const age =
          (Date.now() - new Date(cache[key].lastUpdated).getTime()) / 1000;
        if (age <= ttl) {
          try {
            const value = cache[key].value;
            if (
              typeof value === "string" &&
              (value.startsWith("[") || value.startsWith("{"))
            ) {
              result[key] = JSON.parse(value);
            } else {
              result[key] = value;
            }
          } catch (e) {
            result[key] = cache[key].value;
          }
        }
      }
    });

    return result;
  }

  /**
   * Set multiple metrics in a single sheet operation (eliminates N writes)
   * @param {Array} metrics - Array of {key, value, category} objects
   */
  function batchSetMetrics(metrics) {
    if (!metrics || metrics.length === 0) return;

    const sheet = DataService.getSheet(CONFIG.SHEETS.DASHBOARD_CACHE);
    const data = sheet.getDataRange().getValues();
    const now = new Date();

    // Build map of existing rows
    const existingRows = {};
    for (let i = 1; i < data.length; i++) {
      existingRows[data[i][0]] = i + 1; // row number (1-indexed)
    }

    // Prepare updates and inserts
    const updates = [];
    const inserts = [];

    metrics.forEach(({ key, value, category }) => {
      const config = METRIC_CONFIG[key] || { ttl: 300, category: category || "misc" };
      const serialized = typeof value === "object" ? JSON.stringify(value) : value;
      const rowData = [key, serialized, now, config.ttl, config.category];

      if (existingRows[key]) {
        updates.push({ row: existingRows[key], data: rowData });
      } else {
        inserts.push(rowData);
      }
    });

    // Batch update existing rows (optimized to minimize setValues calls)
    if (updates.length > 0) {
      // Sort by row to enable contiguous grouping
      updates.sort((a, b) => a.row - b.row);

      // Group contiguous rows for batch writes
      let groupStart = 0;
      while (groupStart < updates.length) {
        let groupEnd = groupStart;

        // Find contiguous rows
        while (
          groupEnd < updates.length - 1 &&
          updates[groupEnd + 1].row === updates[groupEnd].row + 1
        ) {
          groupEnd++;
        }

        // Write this contiguous group in one call
        const groupData = updates.slice(groupStart, groupEnd + 1).map(u => u.data);
        const startRow = updates[groupStart].row;
        sheet.getRange(startRow, 1, groupData.length, groupData[0].length).setValues(groupData);

        groupStart = groupEnd + 1;
      }
    }

    // Batch insert new rows
    if (inserts.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, inserts.length, inserts[0].length).setValues(inserts);
    }

    // Invalidate cache
    _metricsCache = null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFRESH METRICS HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute inventory metrics from items data
   * @param {Array} items - Array of inventory items
   * @returns {Object} Inventory stats with totalItems, availableCount, totalValue
   */
  function computeInventoryMetrics(items) {
    let totalValue = 0;
    let availableCount = 0;

    items.forEach((item) => {
      if (item.Status === "Available") {
        availableCount++;
        totalValue += (item.Price || 0) * (item.Quantity || 1);
      }
    });

    return {
      totalItems: items.length,
      availableCount: availableCount,
      totalValue: totalValue,
    };
  }

  /**
   * Compute health metrics using InventoryAnalyticsService
   * @returns {Object} Health data including score, turnover rate, etc.
   */
  function computeHealthMetrics() {
    return InventoryAnalyticsService.calculateHealthScore();
  }

  /**
   * Compute today's summary metrics
   * @returns {Object} Today's summary with revenue, items sold, margin, comparison
   */
  function computeTodayMetrics() {
    return SalesService.getTodaySummary();
  }

  /**
   * Compute chart data - category performance and weekly revenue
   * @returns {Object} Chart data with categoryPerformance and weeklyRevenue
   */
  function computeChartData() {
    const categoryPerformance = SalesService.getCategoryPerformance();
    const weeklyRevenue = SalesService.getWeeklyRevenue(12);

    // Get weekly revenue total for current week
    const currentWeekId = DataService.getWeekId(new Date());
    const weeklySales = DataService.getAll(CONFIG.SHEETS.WEEKLY_SALES, {
      filters: { Week_ID: currentWeekId },
    });
    const weeklyRev =
      weeklySales.length > 0 ? weeklySales[0].Total_Revenue || 0 : 0;

    return {
      categoryPerformance: categoryPerformance,
      weeklyRevenue: weeklyRevenue,
      currentWeekRevenue: weeklyRev,
    };
  }

  /**
   * Compute recent activity - recent items and sales
   * @param {Array} items - Array of inventory items
   * @param {Array} sales - Array of sales records
   * @returns {Object} Recent activity with recentSales and recentItems
   */
  function computeRecentActivity(items, sales) {
    // Build lookup map for items (optimized - avoids N+1)
    const itemsMap = Utils.buildLookupMap(items, "Item_ID");

    // Get recent sales with item names
    const recentSales = sales
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .slice(0, 10)
      .map((sale) => {
        if (sale.Item_ID) {
          const item = itemsMap[sale.Item_ID];
          sale.Item_Name = item ? item.Name : "Unknown";
        }
        return sale;
      });

    // Get recent items added in the last week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentItems = items
      .filter((i) => new Date(i.Date_Added) > weekAgo)
      .sort((a, b) => new Date(b.Date_Added) - new Date(a.Date_Added))
      .slice(0, 10);

    return {
      recentSales: recentSales,
      recentItems: recentItems,
    };
  }

  /**
   * Refresh all dashboard cache metrics (optimized with batch writes)
   * Orchestrates the smaller compute functions and batches all writes.
   * This is the expensive operation - should run in background
   */
  function refreshAllMetrics() {
    const startTime = Date.now();

    // Get all data once
    const items = InventoryService.getItems({ includeCategory: true });
    const sales = DataService.getAll(CONFIG.SHEETS.SALES, {
      filters: { Status: "Completed" },
    });

    // Compute all metrics using helper functions
    const inventoryMetrics = computeInventoryMetrics(items);
    const healthData = computeHealthMetrics();
    const todaySummary = computeTodayMetrics();
    const actionItems = InventoryAnalyticsService.getActionItems();
    const chartData = computeChartData();
    const recentActivity = computeRecentActivity(items, sales);

    // OPTIMIZED: Single batch write instead of 20 individual writes
    batchSetMetrics([
      // Inventory metrics
      { key: "inventory_total_items", value: inventoryMetrics.totalItems, category: "quick_stats" },
      { key: "inventory_available_count", value: inventoryMetrics.availableCount, category: "quick_stats" },
      { key: "inventory_total_value", value: inventoryMetrics.totalValue, category: "quick_stats" },
      // Health metrics
      { key: "health_score", value: healthData.score, category: "health" },
      { key: "health_turnover_rate", value: healthData.turnoverRate, category: "health" },
      { key: "health_aging_count", value: healthData.agingItemCount, category: "health" },
      { key: "health_blended_margin", value: healthData.blendedMargin, category: "health" },
      { key: "health_avg_velocity", value: healthData.averageVelocity, category: "health" },
      // Today's summary
      { key: "today_revenue", value: todaySummary.revenue, category: "today" },
      { key: "today_items_sold", value: todaySummary.itemsSold, category: "today" },
      { key: "today_avg_margin", value: todaySummary.avgMargin, category: "today" },
      { key: "today_vs_last_week", value: todaySummary.vsLastWeek, category: "today" },
      // Action items
      { key: "action_items", value: actionItems, category: "actions" },
      // Chart data
      { key: "category_performance", value: chartData.categoryPerformance, category: "charts" },
      { key: "weekly_revenue", value: chartData.weeklyRevenue, category: "charts" },
      { key: "sales_weekly_revenue", value: chartData.currentWeekRevenue, category: "quick_stats" },
      // Recent activity
      { key: "recent_sales", value: recentActivity.recentSales, category: "recent" },
      { key: "recent_items", value: recentActivity.recentItems, category: "recent" },
    ]);

    const duration = Date.now() - startTime;
    console.log(`Dashboard cache refreshed in ${duration}ms`);

    return {
      success: true,
      duration,
      metricsUpdated: Object.keys(METRIC_CONFIG).length,
    };
  }

  /**
   * Check if cache needs refresh
   */
  function needsRefresh() {
    const healthScore = getMetric("health_score");
    return healthScore === null;
  }

  /**
   * Clear all cached metrics
   */
  function clearCache() {
    const sheet = DataService.getSheet(CONFIG.SHEETS.DASHBOARD_CACHE);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    getMetric,
    setMetric,
    batchSetMetrics,
    getMetrics,
    getMetricsByCategory,
    refreshAllMetrics,
    needsRefresh,
    clearCache,
    METRIC_CONFIG,
    // Compute helper functions (exposed for testing/direct use)
    computeInventoryMetrics,
    computeHealthMetrics,
    computeTodayMetrics,
    computeChartData,
    computeRecentActivity,
  };
})();
