/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Inventory Analytics Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles inventory health scoring, aging analysis, and action items.
 * Extracted from InventoryService for better separation of concerns.
 */

const InventoryAnalyticsService = (function() {

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH SCORE & ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Calculate inventory health score (0-100)
   * Weighted: turnover 25%, aging 30%, margin 25%, velocity 20%
   */
  function calculateHealthScore(preloadedItems = null, preloadedSales = null) {
    const items = preloadedItems || InventoryService.getItems({ includeCategory: true });
    const sales = preloadedSales || DataService.getAll(CONFIG.SHEETS.SALES, { filters: { Status: 'Completed' } });

    if (items.length === 0) {
      return {
        score: 0,
        turnoverRate: 0,
        agingItemCount: 0,
        blendedMargin: 0,
        averageVelocity: 0
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Calculate metrics
    let totalValue = 0;
    let totalCost = 0;
    let agingCount = 0;
    let availableCount = 0;

    items.forEach(item => {
      if (item.Status === 'Available') {
        availableCount++;
        totalValue += (item.Price || 0) * (item.Quantity || 1);
        totalCost += (item.Cost || 0) * (item.Quantity || 1);

        // Count items older than 90 days
        const dateAdded = new Date(item.Date_Added);
        if (dateAdded < ninetyDaysAgo) {
          agingCount++;
        }
      }
    });

    // Turnover rate: items sold in last 30 days / average inventory
    const recentSales = sales.filter(s => new Date(s.Date) > thirtyDaysAgo);
    const itemsSoldLast30 = recentSales.reduce((sum, s) => sum + (s.Quantity || 1), 0);
    const turnoverRate = availableCount > 0 ? (itemsSoldLast30 / availableCount) : 0;

    // Blended margin
    const blendedMargin = totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100) : 0;

    // Aging ratio (lower is better)
    const agingRatio = availableCount > 0 ? (agingCount / availableCount) : 0;

    // Velocity: average days to sell (estimate from recent sales)
    // Build lookup map once to avoid N+1 queries
    const itemsMap = Utils.buildLookupMap(items, 'Item_ID');
    let totalDaysToSell = 0;
    let velocityCount = 0;
    recentSales.forEach(sale => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item && item.Date_Added) {
          const daysToSell = Math.max(1, Math.floor((new Date(sale.Date) - new Date(item.Date_Added)) / (1000 * 60 * 60 * 24)));
          totalDaysToSell += daysToSell;
          velocityCount++;
        }
      }
    });
    const defaultVelocity = CONFIG.BUSINESS_RULES.TARGET_VELOCITY_DAYS * 2; // Default if no sales
    const averageVelocity = velocityCount > 0 ? totalDaysToSell / velocityCount : defaultVelocity;

    // Get multipliers and weights from config
    const multipliers = CONFIG.BUSINESS_RULES.HEALTH_SCORE_MULTIPLIERS;
    const weights = CONFIG.BUSINESS_RULES.HEALTH_SCORE_WEIGHTS;

    // Calculate component scores (0-100 scale)
    const turnoverScore = Math.min(100, turnoverRate * multipliers.TURNOVER);
    const agingScore = Math.max(0, 100 - (agingRatio * multipliers.AGING));
    const marginScore = Math.min(100, Math.max(0, blendedMargin)); // Cap at 100%
    const velocityScore = Math.max(0, multipliers.VELOCITY_BASE - (averageVelocity - multipliers.VELOCITY_TARGET));

    // Weighted average using config weights
    const healthScore = Math.round(
      (turnoverScore * weights.TURNOVER) +
      (agingScore * weights.AGING) +
      (marginScore * weights.MARGIN) +
      (velocityScore * weights.VELOCITY)
    );

    return {
      score: Math.min(100, Math.max(0, healthScore)),
      turnoverRate: parseFloat(turnoverRate.toFixed(2)),
      agingItemCount: agingCount,
      blendedMargin: parseFloat(blendedMargin.toFixed(1)),
      averageVelocity: Math.round(averageVelocity)
    };
  }

  /**
   * Get aging distribution by category
   * Returns items by age bucket (0-30, 30-90, 90-180, 180+) per category
   */
  function getAgingDistribution() {
    const items = InventoryService.getItems({ includeCategory: true });
    const now = new Date();
    const distribution = {};

    items.forEach(item => {
      if (item.Status !== 'Available') return;

      const catName = item.Category_Name || 'Uncategorized';
      if (!distribution[catName]) {
        distribution[catName] = { fresh: 0, normal: 0, aging: 0, stale: 0 };
      }

      const dateAdded = new Date(item.Date_Added);
      const daysListed = Math.floor((now - dateAdded) / (1000 * 60 * 60 * 24));

      if (daysListed <= 30) {
        distribution[catName].fresh++;
      } else if (daysListed <= 90) {
        distribution[catName].normal++;
      } else if (daysListed <= 180) {
        distribution[catName].aging++;
      } else {
        distribution[catName].stale++;
      }
    });

    return Object.entries(distribution).map(([category, buckets]) => ({
      category,
      ...buckets
    }));
  }

  /**
   * Generate action items based on inventory data
   * Returns prioritized alerts for items needing attention
   */
  function getActionItems(preloadedItems = null, preloadedSales = null) {
    const items = preloadedItems || InventoryService.getItems({ includeCategory: true });
    const sales = preloadedSales || DataService.getAll(CONFIG.SHEETS.SALES, { filters: { Status: 'Completed' } });
    const now = new Date();
    const actionItems = [];

    // Track category velocity for comparison
    const categoryVelocity = {};
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Build lookup map once to avoid N+1 queries
    const itemsMap = Utils.buildLookupMap(items, 'Item_ID');

    // Calculate category-level metrics
    items.forEach(item => {
      const catName = item.Category_Name || 'Uncategorized';
      if (!categoryVelocity[catName]) {
        categoryVelocity[catName] = { totalItems: 0, soldLast90: 0 };
      }
      if (item.Status === 'Available') {
        categoryVelocity[catName].totalItems++;
      }
    });

    sales.filter(s => new Date(s.Date) > ninetyDaysAgo).forEach(sale => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item) {
          const catName = item.Category_Name || 'Uncategorized';
          if (categoryVelocity[catName]) {
            categoryVelocity[catName].soldLast90 += (sale.Quantity || 1);
          }
        }
      }
    });

    // Generate action items
    const agingItems = [];
    const lowMarginItems = [];
    const highValueStale = [];

    // Get thresholds from config
    const thresholds = CONFIG.BUSINESS_RULES.ACTION_ITEM_THRESHOLDS;
    const lowMarginThreshold = CONFIG.BUSINESS_RULES.LOW_MARGIN_THRESHOLD;

    items.forEach(item => {
      if (item.Status !== 'Available') return;

      const dateAdded = new Date(item.Date_Added);
      const daysListed = Math.floor((now - dateAdded) / (1000 * 60 * 60 * 24));
      const margin = item.Cost > 0 ? ((item.Price - item.Cost) / item.Cost * 100) : 0;

      // High priority: Stale items with high value
      if (daysListed > thresholds.HIGH_VALUE_STALE_DAYS && item.Price >= thresholds.HIGH_VALUE_PRICE) {
        highValueStale.push(item);
      }
      // Medium priority: Aging items
      else if (daysListed > thresholds.AGING_DAYS) {
        agingItems.push(item);
      }

      // Low margin items that could use markdown
      if (margin < lowMarginThreshold && margin > 0 && daysListed > thresholds.LOW_MARGIN_DAYS) {
        lowMarginItems.push({ ...item, margin, daysListed });
      }
    });

    // Build action items list
    if (highValueStale.length > 0) {
      actionItems.push({
        type: 'stale_inventory',
        priority: 'high',
        message: `${highValueStale.length} high-value items stale ${thresholds.HIGH_VALUE_STALE_DAYS}+ days`,
        detail: highValueStale.slice(0, 3).map(i => i.Name).join(', ')
      });
    }

    if (agingItems.length > thresholds.MIN_ITEMS_FOR_SLOW) {
      actionItems.push({
        type: 'aging_inventory',
        priority: 'medium',
        message: `${agingItems.length} items aging ${thresholds.AGING_DAYS}+ days`,
        detail: 'Consider markdowns or promotions'
      });
    }

    if (lowMarginItems.length > 0) {
      actionItems.push({
        type: 'low_margin',
        priority: 'low',
        message: `${lowMarginItems.length} items with <${lowMarginThreshold}% margin`,
        detail: 'Review pricing strategy'
      });
    }

    // Check for slow categories
    Object.entries(categoryVelocity).forEach(([cat, data]) => {
      if (data.totalItems > thresholds.MIN_ITEMS_FOR_SLOW && data.soldLast90 === 0) {
        actionItems.push({
          type: 'slow_category',
          priority: 'medium',
          message: `${cat}: No sales in ${thresholds.SLOW_CATEGORY_DAYS} days`,
          detail: `${data.totalItems} items in stock`
        });
      }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    actionItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return actionItems.slice(0, 5); // Return top 5 action items
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    calculateHealthScore,
    getAgingDistribution,
    getActionItems
  };
})();
