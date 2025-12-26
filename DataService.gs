/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Data Service Layer
 * ═══════════════════════════════════════════════════════════════════════════
 * Low-level data operations with caching, batch processing, and error handling.
 * All sheet interactions go through this service.
 */

const DataService = (function () {
  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Cache Management
  // ─────────────────────────────────────────────────────────────────────────
  const cache = CacheService.getScriptCache();

  function getCacheKey(sheetName, suffix = "") {
    return `RS_${sheetName}${suffix ? "_" + suffix : ""}`;
  }

  function getFromCache(key) {
    try {
      const cached = cache.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn(`[CACHE] Get failed for ${key}: ${e.message}`);
      return null;
    }
  }

  function setCache(key, data, ttl = CONFIG.PERFORMANCE.CACHE_TTL) {
    try {
      cache.put(key, JSON.stringify(data), ttl);
    } catch (e) {
      // Cache full or other error - continue without caching
      console.warn(`[CACHE] Set failed for ${key}: ${e.message}`);
    }
  }

  function invalidateCache(sheetName) {
    try {
      cache.remove(getCacheKey(sheetName));
      cache.remove(getCacheKey(sheetName, "stats"));
    } catch (e) {
      console.warn(`[CACHE] Invalidation failed for ${sheetName}: ${e.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: Sheet Management
  // ─────────────────────────────────────────────────────────────────────────
  function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  function getSheet(sheetConfig) {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(sheetConfig.name);

    if (!sheet) {
      sheet = ss.insertSheet(sheetConfig.name);
      // Set headers
      if (sheetConfig.headers && sheetConfig.headers.length > 0) {
        sheet
          .getRange(1, 1, 1, sheetConfig.headers.length)
          .setValues([sheetConfig.headers])
          .setFontWeight("bold")
          .setBackground(CONFIG.COLORS.BG_SECONDARY)
          .setFontColor(CONFIG.COLORS.TEXT_PRIMARY);
        sheet.setFrozenRows(1);
      }
    }

    return sheet;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE: ID Generation
  // ─────────────────────────────────────────────────────────────────────────
  function generateId(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Core CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all rows from a sheet as objects (with caching)
   */
  function getAll(sheetConfig, options = {}) {
    const { useCache = true, filters = {} } = options;
    const cacheKey = getCacheKey(sheetConfig.name);

    // Check cache first
    if (useCache) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        return applyFilters(cached, filters);
      }
    }

    const sheet = getSheet(sheetConfig);
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const rows = data.slice(1).map((row, index) => {
      const obj = { _rowIndex: index + 2 }; // 1-indexed + header
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });

    // Cache the full dataset
    if (useCache) {
      setCache(cacheKey, rows);
    }

    return applyFilters(rows, filters);
  }

  /**
   * Get count of rows in a sheet (efficient - doesn't load data)
   */
  function getCount(sheetConfig) {
    const sheet = getSheet(sheetConfig);
    return Math.max(0, sheet.getLastRow() - 1); // Subtract header row
  }

  /**
   * Get paginated rows from a sheet (efficient - only reads needed rows)
   * @param {Object} sheetConfig - Sheet configuration
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (1-indexed)
   * @param {number} options.pageSize - Number of items per page
   * @param {boolean} options.reverseOrder - If true, get newest first (bottom of sheet first)
   * @returns {Object} { items, total, page, pageSize, totalPages }
   */
  function getPaginated(sheetConfig, options = {}) {
    try {
      const { page = 1, pageSize = 20, reverseOrder = false } = options;

      const sheet = getSheet(sheetConfig);
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      const totalRows = lastRow - 1; // Exclude header

      console.log(
        "getPaginated:",
        sheetConfig.name,
        "totalRows:",
        totalRows,
        "page:",
        page,
        "pageSize:",
        pageSize
      );

      if (totalRows <= 0 || lastCol <= 0) {
        console.log("No data found in sheet");
        return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
      }

      const totalPages = Math.ceil(totalRows / pageSize);

      // Get headers
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      console.log("Headers:", headers);

      let startRow, numRowsToGet;

      if (reverseOrder) {
        // For newest first: calculate from the end
        const skip = (page - 1) * pageSize;
        startRow = Math.max(2, lastRow - skip - pageSize + 1);
        const maxEndRow = lastRow - skip;
        numRowsToGet = Math.min(pageSize, maxEndRow - startRow + 1);

        if (maxEndRow < 2 || numRowsToGet <= 0) {
          return { items: [], total: totalRows, page, pageSize, totalPages };
        }
      } else {
        // Normal order: start from top
        startRow = 2 + (page - 1) * pageSize;
        numRowsToGet = Math.min(pageSize, lastRow - startRow + 1);
      }

      console.log("Reading rows from:", startRow, "count:", numRowsToGet);

      if (numRowsToGet <= 0 || startRow > lastRow) {
        return { items: [], total: totalRows, page, pageSize, totalPages };
      }

      const data = sheet
        .getRange(startRow, 1, numRowsToGet, lastCol)
        .getValues();

      let items = data.map((row, index) => {
        const obj = { _rowIndex: startRow + index };
        headers.forEach((header, i) => {
          if (header) {
            // Only add if header is not empty
            obj[header] = row[i];
          }
        });
        return obj;
      });

      // Reverse the array if getting newest first
      if (reverseOrder) {
        items = items.reverse();
      }

      console.log("Returning", items.length, "items");

      return {
        items,
        total: totalRows,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      console.error("Error in getPaginated:", error);
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: options.pageSize || 20,
        totalPages: 0,
        error: error.message,
      };
    }
  }

  /**
   * Apply filters to a dataset
   */
  function applyFilters(data, filters) {
    if (!filters || Object.keys(filters).length === 0) return data;

    return data.filter((row) => {
      return Object.entries(filters).every(([key, value]) => {
        if (value === null || value === undefined || value === "") return true;
        return String(row[key])
          .toLowerCase()
          .includes(String(value).toLowerCase());
      });
    });
  }

  /**
   * Get a single row by ID
   * @param {Object} sheetConfig - Sheet configuration
   * @param {string} id - ID to fetch
   * @param {Object} preloadedMap - Optional pre-loaded map for O(1) lookup
   * @returns {Object|null} Record or null
   */
  function getById(sheetConfig, id, preloadedMap = null) {
    if (preloadedMap) {
      return preloadedMap[id] || null;
    }
    const all = getAll(sheetConfig);
    const idField = sheetConfig.headers[0]; // First header is always ID
    return all.find((row) => row[idField] === id) || null;
  }

  /**
   * Get multiple records by IDs in a single operation (eliminates N+1)
   * @param {Object} sheetConfig - Sheet configuration
   * @param {Array<string>} ids - Array of IDs to fetch
   * @returns {Object} Map of ID to record
   */
  function getByIds(sheetConfig, ids) {
    if (!ids || ids.length === 0) return {};
    const all = getAll(sheetConfig);
    const idField = sheetConfig.headers[0];
    const map = {};
    all.forEach((row) => {
      if (ids.includes(row[idField])) {
        map[row[idField]] = row;
      }
    });
    return map;
  }

  /**
   * Get all records as a Map for O(1) lookups
   * @param {Object} sheetConfig - Sheet configuration
   * @param {string} keyField - Field to use as key (default: first header/ID field)
   * @returns {Object} Map of key to record
   */
  function getAllAsMap(sheetConfig, keyField = null) {
    const all = getAll(sheetConfig);
    const key = keyField || sheetConfig.headers[0];
    return Utils.buildLookupMap(all, key);
  }

  /**
   * Insert a new row
   */
  function insert(sheetConfig, data) {
    const sheet = getSheet(sheetConfig);
    const idField = sheetConfig.headers[0];

    // Generate ID if needed
    if (sheetConfig.idPrefix && !data[idField]) {
      data[idField] = generateId(sheetConfig.idPrefix);
    }

    // Build row array in header order
    const rowData = sheetConfig.headers.map((header) => {
      if (data[header] !== undefined) return data[header];
      if (header.includes("Date") && header !== "Date_Modified")
        return new Date();
      return "";
    });

    sheet.appendRow(rowData);
    invalidateCache(sheetConfig.name);

    // Log activity
    logActivity("CREATE", sheetConfig.name, data[idField], data);

    return data[idField];
  }

  /**
   * Update an existing row
   */
  function update(sheetConfig, id, updates) {
    const sheet = getSheet(sheetConfig);
    const all = getAll(sheetConfig, { useCache: false });
    const idField = sheetConfig.headers[0];

    const rowIndex = all.findIndex((row) => row[idField] === id);
    if (rowIndex === -1) {
      throw new Error(`Record not found: ${id}`);
    }

    const actualRow = rowIndex + 2; // Account for header and 1-indexing
    const currentData = all[rowIndex];

    // Merge updates
    const newData = { ...currentData, ...updates };
    if (sheetConfig.headers.includes("Date_Modified")) {
      newData.Date_Modified = new Date();
    }

    // Build row array
    const rowData = sheetConfig.headers.map((header) => newData[header] || "");
    sheet.getRange(actualRow, 1, 1, rowData.length).setValues([rowData]);

    invalidateCache(sheetConfig.name);
    logActivity("UPDATE", sheetConfig.name, id, updates);

    return newData;
  }

  /**
   * Delete a row (soft delete by changing status, or hard delete)
   */
  function remove(sheetConfig, id, hardDelete = false) {
    const sheet = getSheet(sheetConfig);
    const all = getAll(sheetConfig, { useCache: false });
    const idField = sheetConfig.headers[0];

    const rowIndex = all.findIndex((row) => row[idField] === id);
    if (rowIndex === -1) {
      throw new Error(`Record not found: ${id}`);
    }

    const actualRow = rowIndex + 2;

    if (hardDelete) {
      sheet.deleteRow(actualRow);
    } else if (sheetConfig.headers.includes("Status")) {
      // Soft delete - set status to Archived
      const statusCol = sheetConfig.headers.indexOf("Status") + 1;
      sheet.getRange(actualRow, statusCol).setValue("Archived");
    }

    invalidateCache(sheetConfig.name);
    logActivity("DELETE", sheetConfig.name, id, { hardDelete });

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Batch Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Insert multiple rows at once
   */
  function batchInsert(sheetConfig, dataArray) {
    if (!dataArray || dataArray.length === 0) return [];

    const sheet = getSheet(sheetConfig);
    const idField = sheetConfig.headers[0];
    const ids = [];

    const rows = dataArray.map((data) => {
      // Generate ID if needed
      if (sheetConfig.idPrefix && !data[idField]) {
        data[idField] = generateId(sheetConfig.idPrefix);
      }
      ids.push(data[idField]);

      return sheetConfig.headers.map((header) => {
        if (data[header] !== undefined) return data[header];
        if (header.includes("Date") && header !== "Date_Modified")
          return new Date();
        return "";
      });
    });

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);

    invalidateCache(sheetConfig.name);
    logActivity("BATCH_CREATE", sheetConfig.name, null, {
      count: dataArray.length,
    });

    return ids;
  }

  /**
   * Update multiple rows at once
   */
  function batchUpdate(sheetConfig, updates) {
    // updates is array of { id, changes }
    const results = [];
    let lock = null;

    try {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);

      updates.forEach(({ id, changes }) => {
        try {
          const result = update(sheetConfig, id, changes);
          results.push({ id, success: true, data: result });
        } catch (e) {
          results.push({ id, success: false, error: e.message });
        }
      });
    } catch (e) {
      throw e;
    } finally {
      if (lock) {
        try {
          lock.releaseLock();
        } catch (e) {
          console.warn(`[LOCK] Failed to release lock in batchUpdate: ${e.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Delete multiple rows at once
   */
  function batchDelete(sheetConfig, ids, hardDelete = false) {
    const results = [];

    // Sort IDs by row index descending to avoid row shift issues
    const all = getAll(sheetConfig, { useCache: false });
    const idField = sheetConfig.headers[0];

    const sortedItems = ids
      .map((id) => {
        const idx = all.findIndex((row) => row[idField] === id);
        return { id, rowIndex: idx };
      })
      .filter((item) => item.rowIndex !== -1)
      .sort((a, b) => b.rowIndex - a.rowIndex);

    let lock = null;

    try {
      lock = LockService.getScriptLock();
      lock.waitLock(30000);

      sortedItems.forEach(({ id }) => {
        try {
          remove(sheetConfig, id, hardDelete);
          results.push({ id, success: true });
        } catch (e) {
          results.push({ id, success: false, error: e.message });
        }
      });
    } catch (e) {
      throw e;
    } finally {
      if (lock) {
        try {
          lock.releaseLock();
        } catch (e) {
          console.warn(`[LOCK] Failed to release lock in batchDelete: ${e.message}`);
        }
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Query Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Search across multiple fields
   */
  function search(sheetConfig, query, fields = []) {
    const all = getAll(sheetConfig);
    const searchFields = fields.length > 0 ? fields : sheetConfig.headers;
    const queryLower = query.toLowerCase();

    return all.filter((row) => {
      return searchFields.some((field) => {
        const value = row[field];
        return value && String(value).toLowerCase().includes(queryLower);
      });
    });
  }

  /**
   * Get aggregated stats for a sheet
   */
  function getStats(sheetConfig, options = {}) {
    const cacheKey = getCacheKey(sheetConfig.name, "stats");
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    const all = getAll(sheetConfig);
    const stats = {
      total: all.length,
      byStatus: {},
    };

    // Count by status if available
    if (sheetConfig.headers.includes("Status")) {
      all.forEach((row) => {
        const status = row.Status || "Unknown";
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      });
    }

    setCache(cacheKey, stats, 60); // 1 minute for stats
    return stats;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Activity Logging
  // ─────────────────────────────────────────────────────────────────────────

  function logActivity(action, entityType, entityId, details) {
    try {
      const sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
      sheet.appendRow([
        new Date(),
        action,
        entityType,
        entityId || "",
        JSON.stringify(details || {}),
        Session.getActiveUser().getEmail() || "system",
      ]);
    } catch (e) {
      // Don't let logging errors break operations
      console.log("Activity log error:", e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC: Utility Functions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize all sheets
   */
  function initializeAllSheets() {
    Object.values(CONFIG.SHEETS).forEach((sheetConfig) => {
      getSheet(sheetConfig);
    });
    return true;
  }

  /**
   * Clear all caches
   */
  function clearAllCaches() {
    Object.values(CONFIG.SHEETS).forEach((sheetConfig) => {
      invalidateCache(sheetConfig.name);
    });
  }

  // Week utilities - wrapper functions to delegate to Utils at runtime
  // (Can't use direct reference due to GAS file load order)
  function getWeekId(date) {
    return Utils.getWeekId(date);
  }

  function getWeekDates(weekId) {
    return Utils.getWeekDates(weekId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Core CRUD
    getAll,
    getById,
    getByIds,
    getAllAsMap,
    insert,
    update,
    remove,

    // Batch Operations
    batchInsert,
    batchUpdate,
    batchDelete,

    // Query Helpers
    search,
    getStats,
    applyFilters,
    getCount,
    getPaginated,

    // Utilities
    initializeAllSheets,
    clearAllCaches,
    invalidateCache,
    generateId,
    getWeekId,
    getWeekDates,
    logActivity,

    // Direct sheet access (for advanced operations)
    getSheet,
  };
})();
