/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UTILS - Shared Utilities for Rosewood Antiques v2
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Centralized utility functions for validation, formatting, date operations,
 * data enrichment, and error handling. Used across all service modules.
 *
 * @module Utils
 * @version 2.0.0
 */

const Utils = (function() {

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validates a positive number within range
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name for error messages
   * @param {number} max - Maximum allowed value (default from CONFIG)
   * @returns {number} Validated number
   * @throws {Error} If validation fails
   */
  function validatePositiveNumber(value, fieldName, max = CONFIG.VALIDATION.MAX_PRICE) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`);
    }
    if (num < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
    if (num > max) {
      throw new Error(`${fieldName} exceeds maximum of ${max}`);
    }
    return num;
  }

  /**
   * Validates a positive integer
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name for error messages
   * @param {number} max - Maximum allowed value (default from CONFIG)
   * @returns {number} Validated integer
   * @throws {Error} If validation fails
   */
  function validatePositiveInteger(value, fieldName, max = CONFIG.VALIDATION.MAX_QUANTITY) {
    const num = parseInt(value, 10);
    if (isNaN(num) || !Number.isInteger(num)) {
      throw new Error(`${fieldName} must be a valid integer`);
    }
    if (num < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
    if (num > max) {
      throw new Error(`${fieldName} exceeds maximum of ${max}`);
    }
    return num;
  }

  /**
   * Validates and parses a date
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name for error messages
   * @returns {Date} Validated date object
   * @throws {Error} If validation fails
   */
  function validateDate(value, fieldName = 'Date') {
    if (!value) {
      throw new Error(`${fieldName} is required`);
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`${fieldName} is not a valid date`);
    }
    return date;
  }

  /**
   * Sanitizes string input (removes dangerous characters, trims, limits length)
   * @param {*} input - Input to sanitize
   * @param {number} maxLength - Maximum allowed length
   * @returns {string} Sanitized string
   */
  function sanitizeString(input, maxLength = CONFIG.VALIDATION.MAX_NAME_LENGTH) {
    if (input === null || input === undefined) return '';
    return String(input)
      .substring(0, maxLength)
      .replace(/[<>]/g, '')  // Remove potential HTML/formula injection
      .trim();
  }

  /**
   * Validates that a value is in an allowed list
   * @param {*} value - Value to validate
   * @param {Array} allowedValues - Array of allowed values
   * @param {string} fieldName - Name for error messages
   * @returns {*} Validated value
   * @throws {Error} If value not in allowed list
   */
  function validateEnum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
    return value;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DATE UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Check if a date is within a range
   * @param {Date|string} date - Date to check
   * @param {Date|string} startDate - Start of range (optional)
   * @param {Date|string} endDate - End of range (optional)
   * @returns {boolean} True if date is within range
   */
  function isInDateRange(date, startDate, endDate) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  }

  /**
   * Get week ID (YYYY-WNN format)
   * Moved from DataService for shared use
   * @param {Date|string} date - Date to convert
   * @returns {string} Week ID in YYYY-WNN format
   */
  function getWeekId(date) {
    const d = validateDate(date);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d - yearStart) / (24 * 60 * 60 * 1000));
    const weekNum = Math.ceil((days + yearStart.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Get week date boundaries
   * @param {string} weekId - Week ID in YYYY-WNN format
   * @returns {Object} Object with start and end Date objects
   */
  function getWeekDates(weekId) {
    const [year, weekPart] = weekId.split('-W');
    const weekNum = parseInt(weekPart, 10);
    const jan1 = new Date(parseInt(year, 10), 0, 1);
    const daysOffset = (weekNum - 1) * 7 - jan1.getDay();
    const weekStart = new Date(jan1);
    weekStart.setDate(jan1.getDate() + daysOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { start: weekStart, end: weekEnd };
  }

  /**
   * Get days between two dates
   * @param {Date|string} date1 - First date
   * @param {Date|string} date2 - Second date
   * @returns {number} Number of days between dates
   */
  function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor(Math.abs(d2 - d1) / (24 * 60 * 60 * 1000));
  }

  /**
   * Get date N days ago
   * @param {number} days - Number of days to go back
   * @returns {Date} Date object N days ago
   */
  function daysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FORMATTING UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Format number with commas and decimal places
   * Consolidated from Sidebar.html and Dialogs.html
   * @param {number} num - Number to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted number string
   */
  function formatNumber(num, decimals = 0) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  /**
   * Format currency
   * @param {number} amount - Amount to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted currency string
   */
  function formatCurrency(amount, decimals = 2) {
    return '$' + formatNumber(amount, decimals);
  }

  /**
   * Escape HTML for safe display
   * Consolidated from frontend files
   * @param {string} text - Text to escape
   * @returns {string} HTML-escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, c => map[c]);
  }

  /**
   * Round to specified decimal places
   * @param {number} num - Number to round
   * @param {number} decimals - Number of decimal places
   * @returns {number} Rounded number
   */
  function roundTo(num, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ENRICHMENT UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Enrich items with category names using a pre-built map
   * @param {Array} items - Items to enrich
   * @param {Object} categoriesMap - Map of Category_ID to category name
   * @returns {Array} Enriched items with Category_Name added
   */
  function enrichWithCategoryNames(items, categoriesMap) {
    return items.map(item => ({
      ...item,
      Category_Name: categoriesMap[item.Category_ID] || CONFIG.DEFAULTS.CATEGORY_NAME
    }));
  }

  /**
   * Enrich with location names using a pre-built map
   * @param {Array} items - Items to enrich
   * @param {Object} locationsMap - Map of Location_ID to location name
   * @returns {Array} Enriched items with Location_Name added
   */
  function enrichWithLocationNames(items, locationsMap) {
    return items.map(item => ({
      ...item,
      Location_Name: locationsMap[item.Location_ID] || CONFIG.DEFAULTS.LOCATION_NAME
    }));
  }

  /**
   * Build a lookup map from an array
   * @param {Array} array - Array of objects
   * @param {string} keyField - Field to use as key
   * @param {string} valueField - Field to use as value (optional, uses whole object if not specified)
   * @returns {Object} Lookup map
   */
  function buildLookupMap(array, keyField, valueField = null) {
    const map = {};
    array.forEach(item => {
      const key = item[keyField];
      map[key] = valueField ? item[valueField] : item;
    });
    return map;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ERROR HANDLING UTILITIES
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Create a standardized success response
   * @param {*} data - Data to include in response
   * @param {string} message - Optional success message
   * @returns {Object} Standardized success response
   */
  function successResponse(data, message = null) {
    return {
      success: true,
      data: data,
      message: message,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a standardized error response
   * @param {Error|string} error - Error object or message
   * @param {string} context - Optional context for the error
   * @returns {Object} Standardized error response
   */
  function errorResponse(error, context = null) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${context ? context + ': ' : ''}${message}`);
    return {
      success: false,
      error: message,
      context: context,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Safe wrapper for operations that might fail
   * @param {Function} operation - Function to execute
   * @param {*} fallback - Fallback value if operation fails
   * @param {string} context - Context description for logging
   * @returns {*} Operation result or fallback value
   */
  function safeExecute(operation, fallback = null, context = '') {
    try {
      return operation();
    } catch (e) {
      console.error(`[SAFE_EXECUTE] ${context}: ${e.message}`);
      return fallback;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  return {
    // Validation
    validatePositiveNumber,
    validatePositiveInteger,
    validateDate,
    sanitizeString,
    validateEnum,

    // Dates
    isInDateRange,
    getWeekId,
    getWeekDates,
    daysBetween,
    daysAgo,

    // Formatting
    formatNumber,
    formatCurrency,
    escapeHtml,
    roundTo,

    // Enrichment
    enrichWithCategoryNames,
    enrichWithLocationNames,
    buildLookupMap,

    // Error handling
    successResponse,
    errorResponse,
    safeExecute
  };

})();
