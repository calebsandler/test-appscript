/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Bulk Operations
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles bulk create, update, delete operations for inventory and sales.
 * Includes CSV import/export and batch processing utilities.
 */

const BulkOperations = (function() {

  // ─────────────────────────────────────────────────────────────────────────
  // BULK INVENTORY OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bulk create inventory items
   * SAFETY: Includes duplicate checking and rollback tracking
   */
  function bulkCreateItems(items) {
    // Validate batch size
    if (items.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      skipped: [],
      total: items.length,
      processedIds: [] // Track for rollback
    };

    // Check for duplicates if items have Name and SKU
    const existingItems = DataService.getAll(CONFIG.SHEETS.INVENTORY);
    const existingKeys = new Set(
      existingItems
        .filter(item => item.Name && item.SKU)
        .map(item => `${item.Name}|||${item.SKU}`)
    );

    const validItems = items.filter(item => {
      if (!item.Name) {
        results.errors.push({ item, error: 'Name is required' });
        return false;
      }

      // Check for duplicates (Name + SKU combination)
      if (item.SKU) {
        const key = `${item.Name}|||${item.SKU}`;
        if (existingKeys.has(key)) {
          results.skipped.push({
            item,
            reason: `Duplicate detected: Item with Name "${item.Name}" and SKU "${item.SKU}" already exists`
          });
          return false;
        }
      }

      return true;
    });

    // Use batch insert for valid items
    try {
      const ids = DataService.batchInsert(CONFIG.SHEETS.INVENTORY, validItems.map(item => {
        try {
          return {
            Name: Utils.sanitizeString(item.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH),
            Description: Utils.sanitizeString(item.Description || '', CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH),
            Category_ID: item.Category_ID || '',
            Parent_ID: item.Parent_ID || '',
            SKU: Utils.sanitizeString(item.SKU || ''),
            Condition: item.Condition || CONFIG.DEFAULTS.CONDITION,
            Era: item.Era || '',
            Price: Utils.validatePositiveNumber(item.Price || 0, 'Price', CONFIG.VALIDATION.MAX_PRICE),
            Cost: Utils.validatePositiveNumber(item.Cost || 0, 'Cost', CONFIG.VALIDATION.MAX_PRICE),
            Quantity: Utils.validatePositiveInteger(item.Quantity || 1, 'Quantity', CONFIG.VALIDATION.MAX_QUANTITY),
            Location_ID: item.Location_ID || '',
            Status: item.Status || CONFIG.DEFAULTS.STATUS,
            Notes: Utils.sanitizeString(item.Notes || '', CONFIG.VALIDATION.MAX_NOTES_LENGTH)
          };
        } catch (validationError) {
          throw new Error(`Validation failed for item "${item.Name}": ${validationError.message}`);
        }
      }));

      ids.forEach((id, index) => {
        results.success.push({ id, item: validItems[index] });
        results.processedIds.push(id); // Track for rollback
      });
    } catch (e) {
      // Log partial success for rollback
      if (results.processedIds.length > 0) {
        console.warn(`Bulk create failed mid-batch. Successfully processed ${results.processedIds.length} items before error.`);
        console.warn('Processed IDs:', results.processedIds);
      }
      results.errors.push({
        error: e.message,
        items: validItems,
        partialSuccess: results.processedIds.length > 0,
        successfulIds: results.processedIds
      });
    }

    return results;
  }

  /**
   * Bulk update inventory items
   * SAFETY: Includes rollback tracking
   */
  function bulkUpdateItems(updates) {
    // updates: [{ id: 'INV-123', changes: { Status: 'Sold', ... } }, ...]

    // Validate batch size
    if (updates.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many updates. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: updates.length,
      processedIds: [] // Track for rollback
    };

    updates.forEach((update, index) => {
      try {
        const result = DataService.update(CONFIG.SHEETS.INVENTORY, update.id, update.changes);
        results.success.push({ id: update.id, result });
        results.processedIds.push(update.id);
      } catch (e) {
        // Log partial success if error occurs mid-batch
        if (results.processedIds.length > 0) {
          console.warn(`Bulk update failed at item ${index + 1}/${updates.length}. Successfully processed ${results.processedIds.length} items.`);
        }
        results.errors.push({
          id: update.id,
          error: e.message,
          partialSuccess: results.processedIds.length > 0,
          successfulIds: results.processedIds
        });
      }
    });

    return results;
  }

  /**
   * Bulk update field for multiple items
   */
  function bulkUpdateField(itemIds, field, value) {
    const updates = itemIds.map(id => ({
      id,
      changes: { [field]: value }
    }));
    return bulkUpdateItems(updates);
  }

  /**
   * Bulk delete/archive items
   * SAFETY: Includes batch size validation and rollback tracking
   */
  function bulkDeleteItems(itemIds, hardDelete = false) {
    // Validate batch size
    if (itemIds.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items to delete. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: itemIds.length,
      processedIds: [] // Track for rollback
    };

    // Batch fetch all items at once to eliminate N+1 queries
    const itemsMap = DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds);

    // Sort by row index descending for safe deletion
    const items = itemIds.map(id => {
      const item = itemsMap[id];
      return item ? { id, rowIndex: item._rowIndex } : null;
    }).filter(Boolean);

    items.sort((a, b) => b.rowIndex - a.rowIndex);

    items.forEach(({ id }, index) => {
      try {
        DataService.remove(CONFIG.SHEETS.INVENTORY, id, hardDelete);
        results.success.push(id);
        results.processedIds.push(id);
      } catch (e) {
        // Log partial success if error occurs mid-batch
        if (results.processedIds.length > 0) {
          console.warn(`Bulk delete failed at item ${index + 1}/${items.length}. Successfully processed ${results.processedIds.length} items.`);
        }
        results.errors.push({
          id,
          error: e.message,
          partialSuccess: results.processedIds.length > 0,
          successfulIds: results.processedIds
        });
      }
    });

    return results;
  }

  /**
   * Bulk move items to location
   */
  function bulkMoveToLocation(itemIds, locationId) {
    return bulkUpdateField(itemIds, 'Location_ID', locationId);
  }

  /**
   * Bulk change category
   */
  function bulkChangeCategory(itemIds, categoryId) {
    return bulkUpdateField(itemIds, 'Category_ID', categoryId);
  }

  /**
   * Bulk apply price adjustment
   * SAFETY: Includes batch size validation and rollback tracking
   */
  function bulkAdjustPrice(itemIds, adjustment, isPercentage = false) {
    // Validate batch size
    if (itemIds.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: itemIds.length,
      processedIds: [] // Track for rollback
    };

    // Batch fetch all items at once to eliminate N+1 queries
    const itemsMap = DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds);

    // Prepare all updates upfront
    const updates = [];
    const updateDetails = []; // Track details for success reporting

    itemIds.forEach((id) => {
      try {
        const item = itemsMap[id];
        if (!item) throw new Error('Item not found');

        let newPrice;
        if (isPercentage) {
          newPrice = item.Price * (1 + adjustment / 100);
        } else {
          newPrice = item.Price + adjustment;
        }
        newPrice = Math.max(0, Math.round(newPrice * 100) / 100); // Round to 2 decimals

        updates.push({ id, changes: { Price: newPrice } });
        updateDetails.push({ id, oldPrice: item.Price, newPrice });
      } catch (e) {
        results.errors.push({
          id,
          error: e.message,
          partialSuccess: false,
          successfulIds: []
        });
      }
    });

    // Perform batch update for all valid items
    if (updates.length > 0) {
      try {
        const batchResults = DataService.batchUpdate(CONFIG.SHEETS.INVENTORY, updates);

        batchResults.forEach((result, index) => {
          if (result.success) {
            const detail = updateDetails[index];
            results.success.push(detail);
            results.processedIds.push(detail.id);
          } else {
            results.errors.push({
              id: result.id,
              error: result.error,
              partialSuccess: results.processedIds.length > 0,
              successfulIds: [...results.processedIds]
            });
          }
        });
      } catch (e) {
        // If batch update fails entirely, log all items as errors
        if (results.processedIds.length > 0) {
          console.warn(`Bulk price adjust batch failed. Successfully processed ${results.processedIds.length} items before error.`);
        }
        updates.forEach(({ id }) => {
          results.errors.push({
            id,
            error: e.message,
            partialSuccess: results.processedIds.length > 0,
            successfulIds: [...results.processedIds]
          });
        });
      }
    }

    return results;
  }

  /**
   * Bulk add tags to items
   * SAFETY: Includes batch size validation and rollback tracking
   */
  function bulkAddTags(itemIds, tagIds) {
    const totalOperations = itemIds.length * tagIds.length;

    // Validate batch size
    if (totalOperations > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many tag operations (${totalOperations}). Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: totalOperations,
      processedPairs: [] // Track for rollback
    };

    itemIds.forEach((itemId, itemIndex) => {
      tagIds.forEach((tagId, tagIndex) => {
        try {
          InventoryService.tagItem(itemId, tagId);
          results.success.push({ itemId, tagId });
          results.processedPairs.push({ itemId, tagId });
        } catch (e) {
          // Log partial success if error occurs mid-batch
          if (results.processedPairs.length > 0) {
            console.warn(`Bulk tag operation failed. Successfully processed ${results.processedPairs.length} tag assignments.`);
          }
          results.errors.push({
            itemId,
            tagId,
            error: e.message,
            partialSuccess: results.processedPairs.length > 0,
            successfulPairs: results.processedPairs
          });
        }
      });
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CSV IMPORT/EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Parse CSV string to array of objects
   */
  function parseCSV(csvString) {
    const lines = csvString.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      rows.push(obj);
    }

    return rows;
  }

  /**
   * Parse a single CSV line (handles quoted values)
   */
  function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Import inventory items from CSV string
   */
  function importInventoryFromCSV(csvString) {
    // Validate CSV size
    if (!csvString || csvString.length === 0) {
      throw new Error('CSV data is empty');
    }
    if (csvString.length > CONFIG.VALIDATION.MAX_CSV_SIZE_BYTES) {
      throw new Error(`CSV file too large. Maximum size is ${CONFIG.VALIDATION.MAX_CSV_SIZE_BYTES / 1024 / 1024}MB`);
    }

    const rows = parseCSV(csvString);
    if (rows.length === 0) {
      return { success: [], errors: [{ error: 'No data found in CSV' }], total: 0 };
    }

    // Validate batch size
    if (rows.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    // Map CSV headers to our fields
    const mapped = rows.map(row => ({
      Name: row.Name || row.name || row.Item || row.item || '',
      Description: row.Description || row.description || row.Desc || '',
      Category_ID: row.Category_ID || row.Category || row.category || '',
      SKU: row.SKU || row.sku || row.ItemCode || '',
      Condition: row.Condition || row.condition || CONFIG.DEFAULTS.CONDITION,
      Era: row.Era || row.era || row.Period || '',
      Price: row.Price || row.price || row.SalePrice || 0,
      Cost: row.Cost || row.cost || row.PurchasePrice || 0,
      Quantity: row.Quantity || row.quantity || row.Qty || 1,
      Location_ID: row.Location_ID || row.Location || row.location || '',
      Status: row.Status || row.status || CONFIG.DEFAULTS.STATUS,
      Notes: row.Notes || row.notes || ''
    }));

    return bulkCreateItems(mapped);
  }

  /**
   * Export inventory to CSV string
   */
  function exportInventoryToCSV(filters = {}) {
    const items = InventoryService.getItems({ filters });
    const headers = ['Item_ID', 'Name', 'Description', 'Category_ID', 'SKU',
      'Condition', 'Era', 'Price', 'Cost', 'Quantity', 'Location_ID', 'Status', 'Notes'];

    const csvLines = [headers.join(',')];

    items.forEach(item => {
      const values = headers.map(h => {
        let val = item[h] || '';
        // Escape quotes and wrap in quotes if contains comma
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      });
      csvLines.push(values.join(','));
    });

    return csvLines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BULK SALES OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Bulk record sales
   * SAFETY: Includes rollback tracking
   */
  function bulkRecordSales(sales) {
    // Validate batch size
    if (sales.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many sales. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: sales.length,
      processedIds: [] // Track for rollback
    };

    sales.forEach((sale, index) => {
      try {
        const saleId = SalesService.recordSale(sale);
        results.success.push({ id: saleId, sale });
        results.processedIds.push(saleId);
      } catch (e) {
        // Log partial success if error occurs mid-batch
        if (results.processedIds.length > 0) {
          console.warn(`Bulk sales recording failed at sale ${index + 1}/${sales.length}. Successfully processed ${results.processedIds.length} sales.`);
        }
        results.errors.push({
          sale,
          error: e.message,
          partialSuccess: results.processedIds.length > 0,
          successfulIds: results.processedIds
        });
      }
    });

    return results;
  }

  /**
   * Quick sale for selected items (mark as sold)
   * SAFETY: Includes batch size validation and rollback tracking
   */
  function quickSaleItems(itemIds, options = {}) {
    // Validate batch size
    if (itemIds.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const { customerId, paymentMethod = 'Cash', date = new Date() } = options;
    const results = {
      success: [],
      errors: [],
      total: itemIds.length,
      processedIds: [] // Track for rollback
    };

    itemIds.forEach((itemId, index) => {
      try {
        const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
        if (!item) throw new Error('Item not found');
        if (item.Status === 'Sold') throw new Error('Item already sold');

        const saleId = SalesService.recordSale({
          Date: date,
          Item_ID: itemId,
          Customer_ID: customerId || '',
          Quantity: 1,
          Unit_Price: item.Price,
          Payment_Method: paymentMethod,
          Status: 'Completed'
        });

        results.success.push({ saleId, itemId, amount: item.Price });
        results.processedIds.push(saleId);
      } catch (e) {
        // Log partial success if error occurs mid-batch
        if (results.processedIds.length > 0) {
          console.warn(`Quick sale failed at item ${index + 1}/${itemIds.length}. Successfully processed ${results.processedIds.length} sales.`);
        }
        results.errors.push({
          itemId,
          error: e.message,
          partialSuccess: results.processedIds.length > 0,
          successfulIds: results.processedIds
        });
      }
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DUPLICATE & CLONE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Duplicate an item (creates copy with new ID)
   */
  function duplicateItem(itemId, options = {}) {
    const { quantity = 1, appendCopy = true } = options;

    const original = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
    if (!original) throw new Error('Item not found');

    const newIds = [];

    for (let i = 0; i < quantity; i++) {
      const newItem = {
        Name: appendCopy ? `${original.Name} (Copy${quantity > 1 ? ` ${i + 1}` : ''})` : original.Name,
        Description: original.Description,
        Category_ID: original.Category_ID,
        Parent_ID: original.Parent_ID,
        SKU: '', // Clear SKU to avoid duplicates
        Condition: original.Condition,
        Era: original.Era,
        Price: original.Price,
        Cost: original.Cost,
        Quantity: original.Quantity,
        Location_ID: original.Location_ID,
        Status: 'Available',
        Notes: original.Notes
      };

      const newId = DataService.insert(CONFIG.SHEETS.INVENTORY, newItem);
      newIds.push(newId);
    }

    return newIds;
  }

  /**
   * Bulk duplicate items
   * SAFETY: Includes batch size validation and rollback tracking
   */
  function bulkDuplicateItems(itemIds) {
    // Validate batch size
    if (itemIds.length > CONFIG.VALIDATION.MAX_BATCH_SIZE) {
      throw new Error(`Too many items to duplicate. Maximum batch size is ${CONFIG.VALIDATION.MAX_BATCH_SIZE}`);
    }

    const results = {
      success: [],
      errors: [],
      total: itemIds.length,
      processedIds: [] // Track all new IDs for rollback
    };

    itemIds.forEach((id, index) => {
      try {
        const newIds = duplicateItem(id);
        results.success.push({ originalId: id, newIds });
        results.processedIds.push(...newIds);
      } catch (e) {
        // Log partial success if error occurs mid-batch
        if (results.processedIds.length > 0) {
          console.warn(`Bulk duplicate failed at item ${index + 1}/${itemIds.length}. Successfully created ${results.processedIds.length} duplicates.`);
        }
        results.errors.push({
          id,
          error: e.message,
          partialSuccess: results.processedIds.length > 0,
          successfulIds: results.processedIds
        });
      }
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OPERATION QUEUE (for UI progress tracking)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Process operations with progress callback
   * This enables the UI to show progress for long operations
   */
  function processWithProgress(items, processor, chunkSize = 10) {
    const results = {
      processed: 0,
      success: [],
      errors: [],
      total: items.length
    };

    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }

    chunks.forEach((chunk, chunkIndex) => {
      chunk.forEach((item, itemIndex) => {
        try {
          const result = processor(item);
          results.success.push(result);
        } catch (e) {
          results.errors.push({ item, error: e.message });
        }
        results.processed++;
      });
    });

    return results;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UNDO SUPPORT
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Store undo information for bulk operations
   * Returns an undo token that can be used to reverse the operation
   */
  function createUndoSnapshot(operation, affectedIds, previousStates) {
    const undoData = {
      operation,
      timestamp: new Date().toISOString(),
      affectedIds,
      previousStates
    };

    // Store in Properties (persists across sessions)
    const props = PropertiesService.getScriptProperties();
    const undoStack = JSON.parse(props.getProperty('undoStack') || '[]');

    undoStack.push(undoData);

    // Keep only last N operations
    while (undoStack.length > CONFIG.PERFORMANCE.MAX_UNDO_STACK) {
      undoStack.shift();
    }

    props.setProperty('undoStack', JSON.stringify(undoStack));

    return undoStack.length - 1; // Return index as token
  }

  /**
   * Undo last bulk operation
   */
  function undoLastOperation() {
    const props = PropertiesService.getScriptProperties();
    const undoStack = JSON.parse(props.getProperty('undoStack') || '[]');

    if (undoStack.length === 0) {
      throw new Error('Nothing to undo');
    }

    const lastOp = undoStack.pop();
    props.setProperty('undoStack', JSON.stringify(undoStack));

    // Restore previous states
    const results = {
      operation: lastOp.operation,
      restored: [],
      errors: []
    };

    lastOp.previousStates.forEach(state => {
      try {
        DataService.update(CONFIG.SHEETS.INVENTORY, state.Item_ID, state);
        results.restored.push(state.Item_ID);
      } catch (e) {
        results.errors.push({ id: state.Item_ID, error: e.message });
      }
    });

    return results;
  }

  /**
   * Get undo history
   */
  function getUndoHistory() {
    const props = PropertiesService.getScriptProperties();
    return JSON.parse(props.getProperty('undoStack') || '[]');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Inventory
    bulkCreateItems,
    bulkUpdateItems,
    bulkUpdateField,
    bulkDeleteItems,
    bulkMoveToLocation,
    bulkChangeCategory,
    bulkAdjustPrice,
    bulkAddTags,

    // CSV
    parseCSV,
    importInventoryFromCSV,
    exportInventoryToCSV,

    // Sales
    bulkRecordSales,
    quickSaleItems,

    // Duplicate
    duplicateItem,
    bulkDuplicateItems,

    // Progress & Undo
    processWithProgress,
    createUndoSnapshot,
    undoLastOperation,
    getUndoHistory
  };
})();
