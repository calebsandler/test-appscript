/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Sales Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles sales transactions, weekly sales aggregation, and analytics.
 * Uses YYYY-WW format for week identification.
 */

const SalesService = (function () {
  // ─────────────────────────────────────────────────────────────────────────
  // SALES TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record a new sale
   */
  function recordSale(saleData) {
    // Validate required fields
    if (!saleData.Item_ID && !saleData.Bundle_ID) {
      throw new Error('Either Item_ID or Bundle_ID is required');
    }

    // Validate foreign keys
    if (saleData.Item_ID) {
      const item = DataService.getById(CONFIG.SHEETS.INVENTORY, saleData.Item_ID);
      if (!item) {
        throw new Error(`Invalid Item_ID: ${saleData.Item_ID}`);
      }
    }

    if (saleData.Customer_ID) {
      const customer = DataService.getById(CONFIG.SHEETS.CUSTOMERS, saleData.Customer_ID);
      if (!customer) {
        throw new Error(`Invalid Customer_ID: ${saleData.Customer_ID}`);
      }
    }

    // Validate date
    const date = Utils.validateDate(saleData.Date || new Date(), 'Sale Date');
    const weekId = DataService.getWeekId(date);

    // Validate numeric fields
    const quantity = Utils.validatePositiveInteger(saleData.Quantity || 1, 'Quantity');
    const unitPrice = Utils.validatePositiveNumber(saleData.Unit_Price || 0, 'Unit Price');
    const discount = Utils.validatePositiveNumber(saleData.Discount || 0, 'Discount');

    // Calculate total
    const total = quantity * unitPrice - discount;

    if (total < 0) {
      throw new Error('Total cannot be negative. Discount exceeds item price.');
    }

    const data = {
      Date: date,
      Week_ID: weekId,
      Customer_ID: saleData.Customer_ID || "",
      Item_ID: saleData.Item_ID || "",
      Variant_ID: saleData.Variant_ID || "",
      Bundle_ID: saleData.Bundle_ID || "",
      Quantity: quantity,
      Unit_Price: unitPrice,
      Total: total,
      Payment_Method: saleData.Payment_Method || CONFIG.DEFAULTS.PAYMENT_METHOD,
      Status: saleData.Status || CONFIG.DEFAULTS.SALE_STATUS,
      Notes: Utils.sanitizeString(saleData.Notes || '', CONFIG.VALIDATION.MAX_NOTES_LENGTH),
    };

    const saleId = DataService.insert(CONFIG.SHEETS.SALES, data);

    // Update inventory quantity
    if (data.Item_ID && data.Status === "Completed") {
      updateInventoryAfterSale(data.Item_ID, data.Variant_ID, quantity);
    }

    // Update customer stats
    if (data.Customer_ID) {
      CustomerService.updateCustomerStats(data.Customer_ID, total);
    }

    // Trigger weekly aggregation update
    updateWeeklySales(weekId);

    return saleId;
  }

  /**
   * Update inventory after sale
   * @returns {Object} Result with success flag and details
   */
  function updateInventoryAfterSale(itemId, variantId, quantitySold) {
    try {
      if (variantId) {
        // Update variant quantity
        const variant = DataService.getById(CONFIG.SHEETS.VARIANTS, variantId);
        if (!variant) {
          console.warn(`[SalesService] Variant not found: ${variantId}`);
          return { success: false, error: 'Variant not found', variantId };
        }
        const newQty = Math.max(0, (variant.Quantity || 0) - quantitySold);
        const newStatus = newQty === 0 ? "Sold" : variant.Status;
        const result = DataService.update(CONFIG.SHEETS.VARIANTS, variantId, {
          Quantity: newQty,
          Status: newStatus,
        });
        if (!result) {
          console.error(`[SalesService] Failed to update variant: ${variantId}`);
          return { success: false, error: 'Failed to update variant', variantId };
        }
        return { success: true, type: 'variant', id: variantId, newQty, newStatus };
      } else {
        // Update item quantity
        const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
        if (!item) {
          console.warn(`[SalesService] Item not found: ${itemId}`);
          return { success: false, error: 'Item not found', itemId };
        }
        const newQty = Math.max(0, (item.Quantity || 0) - quantitySold);
        const newStatus = newQty === 0 ? "Sold" : item.Status;
        const result = DataService.update(CONFIG.SHEETS.INVENTORY, itemId, {
          Quantity: newQty,
          Status: newStatus,
        });
        if (!result) {
          console.error(`[SalesService] Failed to update item: ${itemId}`);
          return { success: false, error: 'Failed to update item', itemId };
        }
        return { success: true, type: 'item', id: itemId, newQty, newStatus };
      }
    } catch (error) {
      console.error(`[SalesService] Error updating inventory: ${error.message}`);
      return { success: false, error: error.message, itemId, variantId };
    }
  }


  /**
   * Get all sales with optional filters
   */
  function getSales(options = {}) {
    const { filters = {}, startDate, endDate, enrichItems = false } = options;

    let sales = DataService.getAll(CONFIG.SHEETS.SALES, { filters });

    // Filter by date range
    if (startDate || endDate) {
      sales = sales.filter((sale) => {
        const saleDate = new Date(sale.Date);
        if (startDate && saleDate < new Date(startDate)) return false;
        if (endDate && saleDate > new Date(endDate)) return false;
        return true;
      });
    }

    // Enrich with item and customer details using batch lookups (avoids N+1)
    if (enrichItems && sales.length > 0) {
      // Build lookup maps once
      const itemIds = [...new Set(sales.map(s => s.Item_ID).filter(Boolean))];
      const customerIds = [...new Set(sales.map(s => s.Customer_ID).filter(Boolean))];

      const itemsMap = itemIds.length > 0
        ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds)
        : {};
      const customersMap = customerIds.length > 0
        ? DataService.getByIds(CONFIG.SHEETS.CUSTOMERS, customerIds)
        : {};

      sales = sales.map((sale) => {
        if (sale.Item_ID) {
          const item = itemsMap[sale.Item_ID];
          sale.Item_Name = item ? item.Name : "Unknown";
        }
        if (sale.Customer_ID) {
          const customer = customersMap[sale.Customer_ID];
          sale.Customer_Name = customer ? customer.Name : "Unknown";
        }
        return sale;
      });
    }

    return sales;
  }

  /**
   * Get a single sale by ID
   */
  function getSale(saleId) {
    const sale = DataService.getById(CONFIG.SHEETS.SALES, saleId);
    if (!sale) return null;

    // Enrich with details
    if (sale.Item_ID) {
      sale.Item = DataService.getById(CONFIG.SHEETS.INVENTORY, sale.Item_ID);
    }
    if (sale.Customer_ID) {
      sale.Customer = DataService.getById(
        CONFIG.SHEETS.CUSTOMERS,
        sale.Customer_ID
      );
    }
    if (sale.Bundle_ID) {
      sale.Bundle = InventoryService.getBundle(sale.Bundle_ID);
    }

    return sale;
  }

  /**
   * Update a sale
   */
  function updateSale(saleId, updates) {
    // Recalculate total if price or quantity changed
    if (updates.Unit_Price !== undefined || updates.Quantity !== undefined) {
      const existing = DataService.getById(CONFIG.SHEETS.SALES, saleId);
      const qty =
        updates.Quantity !== undefined ? updates.Quantity : existing.Quantity;
      const price =
        updates.Unit_Price !== undefined
          ? updates.Unit_Price
          : existing.Unit_Price;
      updates.Total = qty * price;
    }

    return DataService.update(CONFIG.SHEETS.SALES, saleId, updates);
  }

  /**
   * Cancel/refund a sale
   */
  function cancelSale(saleId, reason = "") {
    const sale = DataService.getById(CONFIG.SHEETS.SALES, saleId);
    if (!sale) throw new Error("Sale not found");

    // Restore inventory
    if (sale.Item_ID) {
      if (sale.Variant_ID) {
        const variant = DataService.getById(
          CONFIG.SHEETS.VARIANTS,
          sale.Variant_ID
        );
        if (variant) {
          DataService.update(CONFIG.SHEETS.VARIANTS, sale.Variant_ID, {
            Quantity: (variant.Quantity || 0) + sale.Quantity,
            Status: "Available",
          });
        }
      } else {
        const item = DataService.getById(CONFIG.SHEETS.INVENTORY, sale.Item_ID);
        if (item) {
          DataService.update(CONFIG.SHEETS.INVENTORY, sale.Item_ID, {
            Quantity: (item.Quantity || 0) + sale.Quantity,
            Status: "Available",
          });
        }
      }
    }

    // Update customer stats (subtract the refunded amount)
    if (sale.Customer_ID) {
      CustomerService.updateCustomerStats(sale.Customer_ID, -sale.Total);
    }

    // Update sale status
    DataService.update(CONFIG.SHEETS.SALES, saleId, {
      Status: "Cancelled",
      Notes: sale.Notes
        ? `${sale.Notes} | Cancelled: ${reason}`
        : `Cancelled: ${reason}`,
    });

    // Update weekly aggregation
    updateWeeklySales(sale.Week_ID);

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WEEKLY SALES AGGREGATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch completed sales for a specific week
   * @param {string} weekId - Week ID in YYYY-WW format
   * @returns {Array} Array of completed sales for the week
   */
  function fetchWeekSales(weekId) {
    return DataService.getAll(CONFIG.SHEETS.SALES, {
      filters: { Week_ID: weekId, Status: "Completed" },
    });
  }

  /**
   * Calculate weekly metrics from sales data
   * @param {Array} sales - Array of sales records
   * @param {Object} itemsMap - Optional pre-built item lookup map
   * @returns {Object} Calculated metrics including revenue, cost, items sold, etc.
   */
  function calculateWeeklyMetrics(sales, itemsMap = null) {
    // Build item lookup map if not provided
    if (!itemsMap) {
      const itemIds = [...new Set(sales.map(s => s.Item_ID).filter(Boolean))];
      itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};
    }

    let totalRevenue = 0;
    let totalCost = 0;
    let itemsSold = 0;
    const categoryCounts = {};
    const itemCounts = {};

    sales.forEach((sale) => {
      totalRevenue += sale.Total || 0;
      itemsSold += sale.Quantity || 0;

      // Get item cost and track category/item counts
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item) {
          totalCost += (item.Cost || 0) * (sale.Quantity || 1);

          // Track category counts
          const catId = item.Category_ID || "Uncategorized";
          categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;

          // Track item counts
          itemCounts[sale.Item_ID] = {
            name: item.Name,
            count: (itemCounts[sale.Item_ID]?.count || 0) + (sale.Quantity || 1),
          };
        }
      }
    });

    return {
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      itemsSold,
      transactions: sales.length,
      avgTransaction: sales.length > 0 ? totalRevenue / sales.length : 0,
      categoryCounts,
      itemCounts,
    };
  }

  /**
   * Find top performing category and item from metrics
   * @param {Object} metrics - Metrics object from calculateWeeklyMetrics
   * @returns {Object} Top category and top item names
   */
  function findTopPerformers(metrics) {
    const { categoryCounts, itemCounts } = metrics;

    // Find top category
    const topCategoryId =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const categories = TaxonomyService.getCategoriesMap();
    const topCategory = categories[topCategoryId] || topCategoryId;

    // Find top item
    const topItemEntry = Object.entries(itemCounts).sort(
      (a, b) => b[1].count - a[1].count
    )[0];
    const topItem = topItemEntry ? topItemEntry[1].name : "";

    return { topCategory, topItem };
  }

  /**
   * Upsert weekly summary to sheet (insert or update)
   * @param {string} weekId - Week ID in YYYY-WW format
   * @param {Object} metrics - Metrics from calculateWeeklyMetrics
   * @param {Object} topPerformers - Top performers from findTopPerformers
   */
  function upsertWeeklySummary(weekId, metrics, topPerformers) {
    const weekDates = DataService.getWeekDates(weekId);

    const summaryData = {
      Week_ID: weekId,
      Week_Start: weekDates.start,
      Week_End: weekDates.end,
      Total_Revenue: metrics.totalRevenue,
      Total_Cost: metrics.totalCost,
      Gross_Profit: metrics.grossProfit,
      Items_Sold: metrics.itemsSold,
      Transactions: metrics.transactions,
      Avg_Transaction: metrics.avgTransaction,
      Top_Category: topPerformers.topCategory,
      Top_Item: topPerformers.topItem,
    };

    // Update or insert
    const existing = DataService.getAll(CONFIG.SHEETS.WEEKLY_SALES, {
      filters: { Week_ID: weekId },
    });

    if (existing.length > 0) {
      // Update existing row
      const sheet = DataService.getSheet(CONFIG.SHEETS.WEEKLY_SALES);
      const row = existing[0]._rowIndex;
      const rowData = CONFIG.SHEETS.WEEKLY_SALES.headers.map(
        (h) => summaryData[h] || ""
      );
      sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
      DataService.invalidateCache(CONFIG.SHEETS.WEEKLY_SALES.name);
    } else {
      DataService.insert(CONFIG.SHEETS.WEEKLY_SALES, summaryData);
    }
  }

  /**
   * Remove weekly summary entry for a week with no sales
   * @param {string} weekId - Week ID in YYYY-WW format
   */
  function removeWeeklySummary(weekId) {
    const existing = DataService.getAll(CONFIG.SHEETS.WEEKLY_SALES, {
      filters: { Week_ID: weekId },
    });
    if (existing.length > 0) {
      const sheet = DataService.getSheet(CONFIG.SHEETS.WEEKLY_SALES);
      sheet.deleteRow(existing[0]._rowIndex);
      DataService.invalidateCache(CONFIG.SHEETS.WEEKLY_SALES.name);
    }
  }

  /**
   * Update weekly sales summary for a specific week
   * Maintains the same external API while using decomposed helper functions
   */
  function updateWeeklySales(weekId) {
    const sales = fetchWeekSales(weekId);

    if (sales.length === 0) {
      removeWeeklySummary(weekId);
      return;
    }

    const metrics = calculateWeeklyMetrics(sales);
    const topPerformers = findTopPerformers(metrics);
    upsertWeeklySummary(weekId, metrics, topPerformers);
  }

  /**
   * Update weekly sales from pre-loaded sales data (avoids N+1)
   * @param {string} weekId - Week ID in YYYY-WW format
   * @param {Array} sales - Pre-loaded sales for this week
   * @param {Object} itemsMap - Pre-built item lookup map
   */
  function updateWeeklySalesFromData(weekId, sales, itemsMap) {
    if (!sales || sales.length === 0) {
      removeWeeklySummary(weekId);
      return;
    }

    const metrics = calculateWeeklyMetrics(sales, itemsMap);
    const topPerformers = findTopPerformers(metrics);
    upsertWeeklySummary(weekId, metrics, topPerformers);
  }

  /**
   * Group sales by week ID
   * @param {Array} sales - Array of sales records
   * @returns {Object} Sales grouped by Week_ID
   */
  function groupSalesByWeek(sales) {
    const salesByWeek = {};
    sales.forEach((sale) => {
      if (sale.Week_ID) {
        if (!salesByWeek[sale.Week_ID]) {
          salesByWeek[sale.Week_ID] = [];
        }
        salesByWeek[sale.Week_ID].push(sale);
      }
    });
    return salesByWeek;
  }

  /**
   * Rebuild all weekly sales summaries
   * Optimized to load all sales once and group by week in memory
   */
  function rebuildAllWeeklySales() {
    // Load all completed sales once (single query)
    const allSales = DataService.getAll(CONFIG.SHEETS.SALES, {
      filters: { Status: "Completed" },
    });

    // Group sales by week in memory
    const salesByWeek = groupSalesByWeek(allSales);
    const weekIds = Object.keys(salesByWeek);

    // Clear existing summaries
    const sheet = DataService.getSheet(CONFIG.SHEETS.WEEKLY_SALES);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    DataService.invalidateCache(CONFIG.SHEETS.WEEKLY_SALES.name);

    // Pre-build item lookup map for all items across all sales (single query)
    const allItemIds = [...new Set(allSales.map(s => s.Item_ID).filter(Boolean))];
    const itemsMap = allItemIds.length > 0
      ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, allItemIds)
      : {};

    // Process each week using pre-loaded data
    weekIds.forEach((weekId) => {
      updateWeeklySalesFromData(weekId, salesByWeek[weekId], itemsMap);
    });

    return weekIds.length;
  }

  /**
   * Get weekly sales summaries
   */
  function getWeeklySales(options = {}) {
    const { weeks = 12 } = options;

    const summaries = DataService.getAll(CONFIG.SHEETS.WEEKLY_SALES);

    // Sort by week ID descending
    summaries.sort((a, b) => b.Week_ID.localeCompare(a.Week_ID));

    return summaries.slice(0, weeks);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYTICS & REPORTING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get sales dashboard stats
   */
  function getDashboardStats(preloadedSales = null) {
    const today = new Date();
    const currentWeekId = DataService.getWeekId(today);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const lastWeekId = DataService.getWeekId(weekAgo);

    // Get weekly summaries
    const weeklySales = getWeeklySales({ weeks: 12 });
    const currentWeek = weeklySales.find((w) => w.Week_ID === currentWeekId);
    const lastWeek = weeklySales.find((w) => w.Week_ID === lastWeekId);

    // Get all sales (use preloaded if available)
    const allSales = preloadedSales || DataService.getAll(CONFIG.SHEETS.SALES);

    // Filter for completed sales
    const completedSales = allSales.filter(s => s.Status === "Completed");

    // Get today's sales
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const todaySales = completedSales.filter(sale => {
      const saleDate = new Date(sale.Date);
      return saleDate >= todayStart && saleDate <= today;
    });

    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.Total || 0), 0);

    // Calculate trends
    const revenueChange =
      lastWeek && lastWeek.Total_Revenue > 0
        ? (((currentWeek?.Total_Revenue || 0) - lastWeek.Total_Revenue) /
            lastWeek.Total_Revenue) *
          100
        : 0;

    const allTimeRevenue = completedSales.reduce((sum, s) => sum + (s.Total || 0), 0);
    const allTimeTransactions = completedSales.length;

    // Build sparkline data (last 12 weeks)
    const sparklineData = weeklySales
      .slice(0, 12)
      .reverse()
      .map((w) => w.Total_Revenue || 0);

    // Get recent sales with item names enriched
    // Pre-build item lookup map to avoid N+1 queries
    const recentSalesSubset = completedSales
      .sort((a, b) => new Date(b.Date) - new Date(a.Date))
      .slice(0, 10);

    const itemIds = [...new Set(recentSalesSubset.map(s => s.Item_ID).filter(Boolean))];
    const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

    const recentSales = recentSalesSubset.map((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        sale.Item_Name = item ? item.Name : "Unknown";
      }
      return sale;
    });

    return {
      today: {
        revenue: todayRevenue,
        transactions: todaySales.length,
      },
      currentWeek: {
        revenue: currentWeek?.Total_Revenue || 0,
        profit: currentWeek?.Gross_Profit || 0,
        itemsSold: currentWeek?.Items_Sold || 0,
        transactions: currentWeek?.Transactions || 0,
        avgTransaction: currentWeek?.Avg_Transaction || 0,
        topCategory: currentWeek?.Top_Category || "N/A",
        topItem: currentWeek?.Top_Item || "N/A",
      },
      comparison: {
        revenueChange: revenueChange.toFixed(1),
        isUp: revenueChange >= 0,
      },
      allTime: {
        revenue: allTimeRevenue,
        transactions: allTimeTransactions,
        avgTransaction:
          allTimeTransactions > 0 ? allTimeRevenue / allTimeTransactions : 0,
      },
      sparkline: sparklineData,
      recentWeeks: weeklySales.slice(0, 6),
      weeklyRevenue: currentWeek?.Total_Revenue || 0,
      recentSales: recentSales,
    };
  }

  /**
   * Get sales by category
   */
  function getSalesByCategory(startDate, endDate) {
    const sales = getSales({
      startDate,
      endDate,
      filters: { Status: "Completed" },
    });
    const categories = TaxonomyService.getCategoriesMap();
    const result = {};

    // Pre-build item lookup map to avoid N+1 queries
    const itemIds = [...new Set(sales.map(s => s.Item_ID).filter(Boolean))];
    const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

    sales.forEach((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        const catName = item
          ? categories[item.Category_ID] || "Uncategorized"
          : "Unknown";

        if (!result[catName]) {
          result[catName] = { revenue: 0, count: 0, quantity: 0 };
        }
        result[catName].revenue += sale.Total || 0;
        result[catName].count += 1;
        result[catName].quantity += sale.Quantity || 0;
      }
    });

    return Object.entries(result)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  /**
   * Get top selling items
   */
  function getTopSellingItems(limit = 10, startDate, endDate) {
    const sales = getSales({
      startDate,
      endDate,
      filters: { Status: "Completed" },
    });

    // Pre-build item lookup map to avoid N+1 queries
    const itemIds = [...new Set(sales.map(s => s.Item_ID).filter(Boolean))];
    const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

    const itemStats = {};

    sales.forEach((sale) => {
      if (sale.Item_ID) {
        if (!itemStats[sale.Item_ID]) {
          const item = itemsMap[sale.Item_ID];
          itemStats[sale.Item_ID] = {
            id: sale.Item_ID,
            name: item ? item.Name : "Unknown",
            revenue: 0,
            quantity: 0,
            transactions: 0,
          };
        }
        itemStats[sale.Item_ID].revenue += sale.Total || 0;
        itemStats[sale.Item_ID].quantity += sale.Quantity || 0;
        itemStats[sale.Item_ID].transactions += 1;
      }
    });

    return Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get customer purchase history
   */
  function getCustomerHistory(customerId) {
    const sales = getSales({
      filters: { Customer_ID: customerId, Status: "Completed" },
      enrichItems: true,
    });

    return sales.sort((a, b) => new Date(b.Date) - new Date(a.Date));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // V2 DASHBOARD ANALYTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get today's summary with comparison to last week
   */
  function getTodaySummary() {
    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Same day last week
    const lastWeekStart = new Date(todayStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 1);

    // Get today's sales
    const todaySales = getSales({
      startDate: todayStart,
      endDate: todayEnd,
      filters: { Status: "Completed" },
    });

    // Get last week same day sales
    const lastWeekSales = getSales({
      startDate: lastWeekStart,
      endDate: lastWeekEnd,
      filters: { Status: "Completed" },
    });

    // Calculate today's metrics
    const revenue = todaySales.reduce((sum, s) => sum + (s.Total || 0), 0);
    const itemsSold = todaySales.reduce((sum, s) => sum + (s.Quantity || 1), 0);

    // Calculate average margin from today's sales
    // Pre-build item lookup map to avoid N+1 queries
    const itemIds = [...new Set(todaySales.map(s => s.Item_ID).filter(Boolean))];
    const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

    let totalMargin = 0;
    let marginCount = 0;
    todaySales.forEach((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item && item.Cost > 0) {
          const margin = ((sale.Unit_Price - item.Cost) / item.Cost) * 100;
          totalMargin += margin;
          marginCount++;
        }
      }
    });
    const avgMargin = marginCount > 0 ? totalMargin / marginCount : 0;

    // Calculate comparison to last week
    const lastWeekRevenue = lastWeekSales.reduce(
      (sum, s) => sum + (s.Total || 0),
      0
    );
    const vsLastWeek =
      lastWeekRevenue > 0
        ? ((revenue - lastWeekRevenue) / lastWeekRevenue) * 100
        : revenue > 0
        ? 100
        : 0;

    return {
      revenue: revenue,
      itemsSold: itemsSold,
      avgMargin: parseFloat(avgMargin.toFixed(1)),
      vsLastWeek: parseFloat(vsLastWeek.toFixed(1)),
      transactions: todaySales.length,
    };
  }

  /**
   * Get category performance for last 30 days
   * Returns revenue by category with velocity trend
   */
  function getCategoryPerformance(options = {}) {
    const { preloadedSales = null, preloadedItems = null } = options;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get sales for both periods (use preloaded if available)
    let allSales;
    if (preloadedSales) {
      allSales = preloadedSales.filter(s => s.Status === "Completed");
    } else {
      allSales = getSales({ filters: { Status: "Completed" } });
    }

    const recentSales = allSales.filter(sale => {
      const saleDate = new Date(sale.Date);
      return saleDate >= thirtyDaysAgo && saleDate <= now;
    });

    const priorSales = allSales.filter(sale => {
      const saleDate = new Date(sale.Date);
      return saleDate >= sixtyDaysAgo && saleDate < thirtyDaysAgo;
    });

    const categories = TaxonomyService.getCategoriesMap();
    const inventory = preloadedItems || InventoryService.getItems();

    // Pre-build item lookup map to avoid N+1 queries
    const allItemIds = [...new Set([
      ...recentSales.map(s => s.Item_ID),
      ...priorSales.map(s => s.Item_ID)
    ].filter(Boolean))];
    const itemsMap = allItemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, allItemIds) : {};

    // Calculate recent period metrics
    const recentByCategory = {};
    recentSales.forEach((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item) {
          const catName = categories[item.Category_ID] || "Uncategorized";
          if (!recentByCategory[catName]) {
            recentByCategory[catName] = { revenue: 0, quantity: 0 };
          }
          recentByCategory[catName].revenue += sale.Total || 0;
          recentByCategory[catName].quantity += sale.Quantity || 1;
        }
      }
    });

    // Calculate prior period metrics for trend
    const priorByCategory = {};
    priorSales.forEach((sale) => {
      if (sale.Item_ID) {
        const item = itemsMap[sale.Item_ID];
        if (item) {
          const catName = categories[item.Category_ID] || "Uncategorized";
          if (!priorByCategory[catName]) {
            priorByCategory[catName] = { revenue: 0, quantity: 0 };
          }
          priorByCategory[catName].revenue += sale.Total || 0;
          priorByCategory[catName].quantity += sale.Quantity || 1;
        }
      }
    });

    // Count items by category
    const itemCountByCategory = {};
    inventory.forEach((item) => {
      if (item.Status === "Available") {
        const catName = categories[item.Category_ID] || "Uncategorized";
        itemCountByCategory[catName] = (itemCountByCategory[catName] || 0) + 1;
      }
    });

    // Build result
    const allCategories = new Set([
      ...Object.keys(recentByCategory),
      ...Object.keys(itemCountByCategory),
    ]);

    const result = [];
    allCategories.forEach((category) => {
      const recent = recentByCategory[category] || { revenue: 0, quantity: 0 };
      const prior = priorByCategory[category] || { revenue: 0, quantity: 0 };
      const itemCount = itemCountByCategory[category] || 0;

      // Calculate velocity (items sold per item in stock per 30 days)
      const velocity = itemCount > 0 ? recent.quantity / itemCount : 0;

      // Determine trend
      let velocityTrend = "stable";
      if (prior.quantity > 0) {
        const priorVelocity = itemCount > 0 ? prior.quantity / itemCount : 0;
        const change = ((velocity - priorVelocity) / priorVelocity) * 100;
        if (change > 10) velocityTrend = "up";
        else if (change < -10) velocityTrend = "down";
      } else if (recent.quantity > 0) {
        velocityTrend = "up";
      }

      result.push({
        category: category,
        revenue30d: recent.revenue,
        velocity: parseFloat(velocity.toFixed(2)),
        velocityTrend: velocityTrend,
        itemCount: itemCount,
      });
    });

    // Sort by revenue descending
    result.sort((a, b) => b.revenue30d - a.revenue30d);

    return result;
  }

  /**
   * Get weekly revenue for specified number of weeks
   */
  function getWeeklyRevenue(weeks = 12) {
    const weeklySales = getWeeklySales({ weeks });

    return weeklySales
      .map((week) => ({
        week: week.Week_ID,
        weekStart: week.Week_Start,
        revenue: week.Total_Revenue || 0,
        itemsSold: week.Items_Sold || 0,
      }))
      .reverse(); // Oldest to newest for chart display
  }


  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Sales
    recordSale,
    getSales,
    getSale,
    updateSale,
    cancelSale,

    // Weekly
    updateWeeklySales,
    rebuildAllWeeklySales,
    getWeeklySales,

    // Analytics
    getDashboardStats,
    getSalesByCategory,
    getTopSellingItems,
    getCustomerHistory,

    // V2 Dashboard
    getTodaySummary,
    getCategoryPerformance,
    getWeeklyRevenue,

    // Customers (delegated to CustomerService for backwards compatibility)
    getCustomers: () => CustomerService.getCustomers(),
    getCustomer: (customerId) => CustomerService.getCustomer(customerId),
    createCustomer: (data) => CustomerService.createCustomer(data),
    updateCustomer: (customerId, updates) => CustomerService.updateCustomer(customerId, updates),
  };
})();
