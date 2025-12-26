/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Inventory Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles core inventory management including items CRUD, variants, and bundles.
 * Taxonomy (categories, locations, tags) -> TaxonomyService
 * Analytics (health score, aging) -> InventoryAnalyticsService
 */

const InventoryService = (function() {

  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY ITEMS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all inventory items with optional enrichment
   */
  function getItems(options = {}) {
    const { includeVariants = false, includeCategory = false, filters = {} } = options;

    let items = DataService.getAll(CONFIG.SHEETS.INVENTORY, { filters });

    // Enrich with category names
    if (includeCategory) {
      const categories = TaxonomyService.getCategoriesMap();
      items = items.map(item => ({
        ...item,
        Category_Name: categories[item.Category_ID] || 'Uncategorized'
      }));
    }

    // Group variants under parent items using lookup map (avoids N+1 filter)
    if (includeVariants) {
      const variants = DataService.getAll(CONFIG.SHEETS.VARIANTS);
      // Build map of parent ID -> array of variants
      const variantsByParent = {};
      variants.forEach(v => {
        if (v.Parent_Item_ID) {
          if (!variantsByParent[v.Parent_Item_ID]) {
            variantsByParent[v.Parent_Item_ID] = [];
          }
          variantsByParent[v.Parent_Item_ID].push(v);
        }
      });
      items = items.map(item => ({
        ...item,
        Variants: variantsByParent[item.Item_ID] || []
      }));
    }

    return items;
  }

  /**
   * Get a single item with full details
   * Optimized to minimize sheet reads using preloaded lookup maps
   */
  function getItem(itemId, options = {}) {
    const {
      categoriesMap = null,
      locationsMap = null,
      tagsMap = null
    } = options;

    const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
    if (!item) return null;

    // Get variants (single read, filtered in memory by DataService cache)
    item.Variants = DataService.getAll(CONFIG.SHEETS.VARIANTS, {
      filters: { Parent_Item_ID: itemId }
    });

    // Get category name - use preloaded map if available
    if (categoriesMap) {
      item.Category_Name = categoriesMap[item.Category_ID] || CONFIG.DEFAULTS.CATEGORY_NAME;
    } else {
      const category = DataService.getById(CONFIG.SHEETS.CATEGORIES, item.Category_ID);
      item.Category_Name = category ? category.Name : CONFIG.DEFAULTS.CATEGORY_NAME;
    }

    // Get location name - use preloaded map if available
    if (locationsMap) {
      item.Location_Name = locationsMap[item.Location_ID] || CONFIG.DEFAULTS.LOCATION_NAME;
    } else {
      const location = DataService.getById(CONFIG.SHEETS.LOCATIONS, item.Location_ID);
      item.Location_Name = location ? location.Name : CONFIG.DEFAULTS.LOCATION_NAME;
    }

    // Get tags - use preloaded map if available
    const itemTags = DataService.getAll(CONFIG.SHEETS.ITEM_TAGS, {
      filters: { Item_ID: itemId }
    });
    if (tagsMap) {
      item.Tags = itemTags.map(it => tagsMap[it.Tag_ID]).filter(Boolean);
    } else {
      const allTags = DataService.getAll(CONFIG.SHEETS.TAGS);
      const tagsLookup = Utils.buildLookupMap(allTags, 'Tag_ID');
      item.Tags = itemTags.map(it => tagsLookup[it.Tag_ID]).filter(Boolean);
    }

    // Get child items (if this is a parent)
    item.Children = DataService.getAll(CONFIG.SHEETS.INVENTORY, {
      filters: { Parent_ID: itemId }
    });

    return item;
  }

  /**
   * Create a new inventory item
   */
  function createItem(data) {
    // Validate required fields
    if (!data.Name) {
      throw new Error('Item name is required');
    }

    // Sanitize and validate inputs using Utils
    const sanitizedData = {
      Name: Utils.sanitizeString(data.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH),
      Description: Utils.sanitizeString(data.Description || '', CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH),
      Category_ID: data.Category_ID || '',
      Parent_ID: data.Parent_ID || '',
      SKU: Utils.sanitizeString(data.SKU || ''),
      Condition: data.Condition || CONFIG.DEFAULTS.CONDITION,
      Era: data.Era || '',
      Price: Utils.validatePositiveNumber(data.Price || 0, 'Price', CONFIG.VALIDATION.MAX_PRICE),
      Cost: Utils.validatePositiveNumber(data.Cost || 0, 'Cost', CONFIG.VALIDATION.MAX_PRICE),
      Quantity: Utils.validatePositiveInteger(data.Quantity || 1, 'Quantity', CONFIG.VALIDATION.MAX_QUANTITY),
      Location_ID: data.Location_ID || '',
      Status: data.Status || CONFIG.DEFAULTS.STATUS,
      Notes: Utils.sanitizeString(data.Notes || '', CONFIG.VALIDATION.MAX_NOTES_LENGTH)
    };

    // Validate enums
    Utils.validateEnum(sanitizedData.Status, CONFIG.VALIDATION.ALLOWED_STATUSES, 'Status');
    Utils.validateEnum(sanitizedData.Condition, CONFIG.VALIDATION.ALLOWED_CONDITIONS, 'Condition');

    const itemId = DataService.insert(CONFIG.SHEETS.INVENTORY, sanitizedData);

    // Handle tags if provided
    if (data.Tags && data.Tags.length > 0) {
      data.Tags.forEach(tagId => {
        DataService.insert(CONFIG.SHEETS.ITEM_TAGS, {
          Item_ID: itemId,
          Tag_ID: tagId
        });
      });
    }

    // Update location count
    if (sanitizedData.Location_ID) {
      TaxonomyService.updateLocationCount(sanitizedData.Location_ID);
    }

    return itemId;
  }

  /**
   * Update an existing item
   */
  function updateItem(itemId, updates) {
    const existing = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
    if (!existing) throw new Error('Item not found');

    // Sanitize and validate string fields
    if (updates.Name !== undefined) {
      updates.Name = Utils.sanitizeString(updates.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH);
    }
    if (updates.Description !== undefined) {
      updates.Description = Utils.sanitizeString(updates.Description, CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH);
    }
    if (updates.SKU !== undefined) {
      updates.SKU = Utils.sanitizeString(updates.SKU);
    }
    if (updates.Notes !== undefined) {
      updates.Notes = Utils.sanitizeString(updates.Notes, CONFIG.VALIDATION.MAX_NOTES_LENGTH);
    }

    // Validate numeric fields
    if (updates.Price !== undefined) {
      updates.Price = Utils.validatePositiveNumber(updates.Price, 'Price', CONFIG.VALIDATION.MAX_PRICE);
    }
    if (updates.Cost !== undefined) {
      updates.Cost = Utils.validatePositiveNumber(updates.Cost, 'Cost', CONFIG.VALIDATION.MAX_PRICE);
    }
    if (updates.Quantity !== undefined) {
      updates.Quantity = Utils.validatePositiveInteger(updates.Quantity, 'Quantity', CONFIG.VALIDATION.MAX_QUANTITY);
    }

    // Validate enums
    if (updates.Status !== undefined) {
      Utils.validateEnum(updates.Status, CONFIG.VALIDATION.ALLOWED_STATUSES, 'Status');
    }
    if (updates.Condition !== undefined) {
      Utils.validateEnum(updates.Condition, CONFIG.VALIDATION.ALLOWED_CONDITIONS, 'Condition');
    }

    const result = DataService.update(CONFIG.SHEETS.INVENTORY, itemId, updates);

    // Update location counts if location changed
    if (updates.Location_ID && updates.Location_ID !== existing.Location_ID) {
      if (existing.Location_ID) TaxonomyService.updateLocationCount(existing.Location_ID);
      TaxonomyService.updateLocationCount(updates.Location_ID);
    }

    return result;
  }

  /**
   * Delete an item (soft delete)
   */
  function deleteItem(itemId, hardDelete = false) {
    const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
    if (!item) throw new Error('Item not found');

    // Check for child items
    const children = DataService.getAll(CONFIG.SHEETS.INVENTORY, {
      filters: { Parent_ID: itemId }
    });

    if (children.length > 0 && hardDelete) {
      throw new Error('Cannot hard delete item with children. Delete children first or use soft delete.');
    }

    // Delete variants
    const variants = DataService.getAll(CONFIG.SHEETS.VARIANTS, {
      filters: { Parent_Item_ID: itemId }
    });
    variants.forEach(v => DataService.remove(CONFIG.SHEETS.VARIANTS, v.Variant_ID, hardDelete));

    // Delete tag associations
    const itemTags = DataService.getAll(CONFIG.SHEETS.ITEM_TAGS, {
      filters: { Item_ID: itemId }
    });
    itemTags.forEach(it => {
      const sheet = DataService.getSheet(CONFIG.SHEETS.ITEM_TAGS);
      sheet.deleteRow(it._rowIndex);
    });

    // Delete the item
    DataService.remove(CONFIG.SHEETS.INVENTORY, itemId, hardDelete);

    // Update location count
    if (item.Location_ID) TaxonomyService.updateLocationCount(item.Location_ID);

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VARIANTS (Size/Color Matrix)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a variant to an item
   */
  function addVariant(parentItemId, variantData) {
    const parent = DataService.getById(CONFIG.SHEETS.INVENTORY, parentItemId);
    if (!parent) throw new Error('Parent item not found');

    const data = {
      Parent_Item_ID: parentItemId,
      Variant_Type: variantData.Variant_Type || 'Size',
      Variant_Value: variantData.Variant_Value || '',
      SKU_Suffix: variantData.SKU_Suffix || '',
      Price_Modifier: parseFloat(variantData.Price_Modifier) || 0,
      Quantity: parseInt(variantData.Quantity) || 1,
      Status: variantData.Status || 'Available'
    };

    return DataService.insert(CONFIG.SHEETS.VARIANTS, data);
  }

  /**
   * Bulk add variants (e.g., generate size matrix)
   */
  function addVariantMatrix(parentItemId, options) {
    const { types, values, priceModifiers = {} } = options;
    // types: ['Size', 'Color']
    // values: { Size: ['S', 'M', 'L'], Color: ['Red', 'Blue'] }

    const variants = [];

    if (types.length === 1) {
      // Single dimension
      const type = types[0];
      values[type].forEach(val => {
        variants.push({
          Parent_Item_ID: parentItemId,
          Variant_Type: type,
          Variant_Value: val,
          SKU_Suffix: `-${val}`,
          Price_Modifier: priceModifiers[val] || 0,
          Quantity: 1,
          Status: 'Available'
        });
      });
    } else if (types.length === 2) {
      // Two dimensions (e.g., Size x Color)
      values[types[0]].forEach(val1 => {
        values[types[1]].forEach(val2 => {
          variants.push({
            Parent_Item_ID: parentItemId,
            Variant_Type: `${types[0]}/${types[1]}`,
            Variant_Value: `${val1}/${val2}`,
            SKU_Suffix: `-${val1}-${val2}`,
            Price_Modifier: (priceModifiers[val1] || 0) + (priceModifiers[val2] || 0),
            Quantity: 1,
            Status: 'Available'
          });
        });
      });
    }

    return DataService.batchInsert(CONFIG.SHEETS.VARIANTS, variants);
  }

  /**
   * Get variants for an item
   */
  function getVariants(parentItemId) {
    return DataService.getAll(CONFIG.SHEETS.VARIANTS, {
      filters: { Parent_Item_ID: parentItemId }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUNDLES / KITS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a new bundle
   */
  function createBundle(bundleData, items = []) {
    const data = {
      Name: bundleData.Name,
      Description: bundleData.Description || '',
      Bundle_Price: parseFloat(bundleData.Bundle_Price) || 0,
      Discount_Percent: parseFloat(bundleData.Discount_Percent) || 0,
      Status: bundleData.Status || 'Available',
      Date_Created: new Date()
    };

    const bundleId = DataService.insert(CONFIG.SHEETS.BUNDLES, data);

    // Add items to bundle
    if (items.length > 0) {
      items.forEach(item => {
        DataService.insert(CONFIG.SHEETS.BUNDLE_ITEMS, {
          Bundle_ID: bundleId,
          Item_ID: item.Item_ID,
          Quantity: item.Quantity || 1
        });
      });
    }

    return bundleId;
  }

  /**
   * Get bundle with items
   */
  function getBundle(bundleId) {
    const bundle = DataService.getById(CONFIG.SHEETS.BUNDLES, bundleId);
    if (!bundle) return null;

    const bundleItems = DataService.getAll(CONFIG.SHEETS.BUNDLE_ITEMS, {
      filters: { Bundle_ID: bundleId }
    });

    // Pre-build item lookup map to avoid N+1 queries
    const itemIds = bundleItems.map(bi => bi.Item_ID).filter(Boolean);
    const itemsMap = itemIds.length > 0 ? DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds) : {};

    bundle.Items = bundleItems.map(bi => {
      const item = itemsMap[bi.Item_ID];
      return {
        ...bi,
        Item: item
      };
    });

    // Calculate bundle value
    bundle.Total_Value = bundle.Items.reduce((sum, bi) => {
      return sum + ((bi.Item?.Price || 0) * bi.Quantity);
    }, 0);

    return bundle;
  }

  /**
   * Get all bundles with error recovery for individual bundle failures
   * @returns {Array} Array of bundle objects (failed bundles are filtered out)
   */
  function getBundles() {
    const bundles = DataService.getAll(CONFIG.SHEETS.BUNDLES);
    return bundles.map(b => {
      try {
        return getBundle(b.Bundle_ID);
      } catch (error) {
        console.warn(`[InventoryService] Failed to load bundle ${b.Bundle_ID}: ${error.message}`);
        return null;
      }
    }).filter(Boolean);
  }

  /**
   * Add item to bundle
   */
  function addItemToBundle(bundleId, itemId, quantity = 1) {
    // Check if already in bundle
    const existing = DataService.getAll(CONFIG.SHEETS.BUNDLE_ITEMS, {
      filters: { Bundle_ID: bundleId, Item_ID: itemId }
    });

    if (existing.length > 0) {
      // Update quantity instead
      const sheet = DataService.getSheet(CONFIG.SHEETS.BUNDLE_ITEMS);
      const row = existing[0]._rowIndex;
      const currentQty = existing[0].Quantity;
      sheet.getRange(row, 3).setValue(currentQty + quantity);
      DataService.invalidateCache(CONFIG.SHEETS.BUNDLE_ITEMS.name);
      return true;
    }

    return DataService.insert(CONFIG.SHEETS.BUNDLE_ITEMS, {
      Bundle_ID: bundleId,
      Item_ID: itemId,
      Quantity: quantity
    });
  }


  // ─────────────────────────────────────────────────────────────────────────
  // INVENTORY STATS & DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get inventory dashboard stats
   */
  function getDashboardStats() {
    const items = getItems();
    const categories = TaxonomyService.getCategoriesMap();

    const stats = {
      totalItems: items.length,
      totalValue: 0,
      totalCost: 0,
      byStatus: {},
      byCategory: {},
      byCondition: {},
      lowStock: [],
      recentItems: [],
      availableItems: 0
    };

    items.forEach(item => {
      // Value calculations
      stats.totalValue += (item.Price || 0) * (item.Quantity || 1);
      stats.totalCost += (item.Cost || 0) * (item.Quantity || 1);

      // Group by status
      const status = item.Status || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Group by category
      const catName = categories[item.Category_ID] || 'Uncategorized';
      stats.byCategory[catName] = (stats.byCategory[catName] || 0) + 1;

      // Group by condition
      const condition = item.Condition || 'Unknown';
      stats.byCondition[condition] = (stats.byCondition[condition] || 0) + 1;

      // Low stock (quantity <= 2)
      if (item.Quantity <= 2 && item.Status === 'Available') {
        stats.lowStock.push(item);
      }
    });

    // Calculate profit margin
    stats.potentialProfit = stats.totalValue - stats.totalCost;
    stats.profitMargin = stats.totalCost > 0
      ? ((stats.totalValue - stats.totalCost) / stats.totalCost * 100).toFixed(1)
      : 0;

    // Count available items
    stats.availableItems = stats.byStatus['Available'] || 0;

    // Recently added (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    stats.recentItems = items
      .filter(i => new Date(i.Date_Added) > weekAgo)
      .sort((a, b) => new Date(b.Date_Added) - new Date(a.Date_Added))
      .slice(0, 10);

    return stats;
  }

  /**
   * Search inventory
   */
  function searchItems(query) {
    return DataService.search(CONFIG.SHEETS.INVENTORY, query, [
      'Name', 'Description', 'SKU', 'Notes'
    ]);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Items
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    searchItems,

    // Variants
    addVariant,
    addVariantMatrix,
    getVariants,

    // Bundles
    createBundle,
    getBundle,
    getBundles,
    addItemToBundle,

    // Dashboard
    getDashboardStats
  };
})();
