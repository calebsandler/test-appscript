/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Customer Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles customer CRUD operations and customer statistics management.
 */

const CustomerService = (function() {
  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all customers
   */
  function getCustomers() {
    return DataService.getAll(CONFIG.SHEETS.CUSTOMERS);
  }

  /**
   * Get customer by ID
   */
  function getCustomer(customerId) {
    return DataService.getById(CONFIG.SHEETS.CUSTOMERS, customerId);
  }

  /**
   * Create a new customer
   */
  function createCustomer(data) {
    // Validate required fields
    if (!data.Name) {
      throw new Error('Customer name is required');
    }

    return DataService.insert(CONFIG.SHEETS.CUSTOMERS, {
      Name: Utils.sanitizeString(data.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH),
      Email: Utils.sanitizeString(data.Email || ""),
      Phone: Utils.sanitizeString(data.Phone || ""),
      Address: Utils.sanitizeString(data.Address || "", CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH),
      Preferred_Contact: data.Preferred_Contact || "Email",
      Total_Purchases: 0,
      Last_Purchase: "",
      Notes: Utils.sanitizeString(data.Notes || "", CONFIG.VALIDATION.MAX_NOTES_LENGTH),
    });
  }

  /**
   * Update customer
   */
  function updateCustomer(customerId, updates) {
    return DataService.update(CONFIG.SHEETS.CUSTOMERS, customerId, updates);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CUSTOMER STATISTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update customer purchase stats (internal helper)
   * @param {string} customerId - The customer ID
   * @param {number} amount - The amount to add (can be negative for refunds)
   * @returns {Object} Result with success flag and updated totals
   */
  function updateCustomerStats(customerId, amount) {
    if (!customerId) {
      return { success: false, error: 'Customer ID is required' };
    }

    try {
      const customer = DataService.getById(CONFIG.SHEETS.CUSTOMERS, customerId);
      if (!customer) {
        console.warn(`[CustomerService] Customer not found: ${customerId}`);
        return { success: false, error: 'Customer not found', customerId };
      }

      const newTotal = Math.max(0, (customer.Total_Purchases || 0) + amount);
      const updates = {
        Total_Purchases: newTotal,
      };

      // Only update Last_Purchase if adding a purchase (not refunding)
      if (amount > 0) {
        updates.Last_Purchase = new Date();
      }

      const result = DataService.update(CONFIG.SHEETS.CUSTOMERS, customerId, updates);
      if (!result) {
        return { success: false, error: 'Failed to update customer', customerId };
      }

      return { success: true, customerId, newTotal, amountChanged: amount };
    } catch (error) {
      console.error(`[CustomerService] Error updating customer stats: ${error.message}`);
      return { success: false, error: error.message, customerId };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    updateCustomerStats,
  };
})();
