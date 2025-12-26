/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Taxonomy Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Handles inventory taxonomy including categories, locations, and tags.
 * Extracted from InventoryService for better separation of concerns.
 */

const TaxonomyService = (function() {

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORIES (Hierarchical)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all categories as flat list
   */
  function getCategories() {
    return DataService.getAll(CONFIG.SHEETS.CATEGORIES);
  }

  /**
   * Get categories as hierarchical tree
   */
  function getCategoryTree() {
    const all = getCategories();
    const map = {};
    const tree = [];

    // First pass: create map
    all.forEach(cat => {
      map[cat.Category_ID] = { ...cat, children: [] };
    });

    // Second pass: build tree
    all.forEach(cat => {
      if (cat.Parent_Category_ID && map[cat.Parent_Category_ID]) {
        map[cat.Parent_Category_ID].children.push(map[cat.Category_ID]);
      } else {
        tree.push(map[cat.Category_ID]);
      }
    });

    // Sort by Sort_Order
    const sortTree = (nodes) => {
      nodes.sort((a, b) => (a.Sort_Order || 0) - (b.Sort_Order || 0));
      nodes.forEach(n => sortTree(n.children));
    };
    sortTree(tree);

    return tree;
  }

  /**
   * Get category ID to Name mapping
   */
  function getCategoriesMap() {
    const categories = getCategories();
    const map = {};
    categories.forEach(c => {
      map[c.Category_ID] = c.Name;
    });
    return map;
  }

  /**
   * Create a category
   * @param {Object} data - Category data with Name (required), Parent_Category_ID, Description, Sort_Order
   * @returns {string} New category ID
   * @throws {Error} If Name is missing or invalid
   */
  function createCategory(data) {
    // Validate required fields
    if (!data || !data.Name || typeof data.Name !== 'string' || data.Name.trim().length === 0) {
      throw new Error('Category name is required');
    }

    // Sanitize and validate inputs
    const sanitizedName = Utils.sanitizeString(data.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH);
    const sanitizedDescription = Utils.sanitizeString(data.Description || '', CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH);
    const sortOrder = Utils.validatePositiveInteger(data.Sort_Order || 0, 'Sort Order', 9999);

    return DataService.insert(CONFIG.SHEETS.CATEGORIES, {
      Name: sanitizedName,
      Parent_Category_ID: data.Parent_Category_ID || '',
      Description: sanitizedDescription,
      Sort_Order: sortOrder
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LOCATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all locations
   */
  function getLocations() {
    return DataService.getAll(CONFIG.SHEETS.LOCATIONS);
  }

  /**
   * Create a location
   * @param {Object} data - Location data with Name (required), Description, Capacity
   * @returns {string} New location ID
   * @throws {Error} If Name is missing or invalid
   */
  function createLocation(data) {
    // Validate required fields
    if (!data || !data.Name || typeof data.Name !== 'string' || data.Name.trim().length === 0) {
      throw new Error('Location name is required');
    }

    // Sanitize and validate inputs
    const sanitizedName = Utils.sanitizeString(data.Name, CONFIG.VALIDATION.MAX_NAME_LENGTH);
    const sanitizedDescription = Utils.sanitizeString(data.Description || '', CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH);
    const capacity = Utils.validatePositiveInteger(data.Capacity || 0, 'Capacity', 9999);

    return DataService.insert(CONFIG.SHEETS.LOCATIONS, {
      Name: sanitizedName,
      Description: sanitizedDescription,
      Capacity: capacity,
      Current_Count: 0
    });
  }

  /**
   * Update location item count
   * @param {string} locationId - Location ID to update
   * @returns {Object} Result with success flag and new count
   */
  function updateLocationCount(locationId) {
    if (!locationId) {
      return { success: false, error: 'Location ID is required' };
    }

    try {
      // Verify location exists
      const location = DataService.getById(CONFIG.SHEETS.LOCATIONS, locationId);
      if (!location) {
        console.warn(`[TaxonomyService] Location not found: ${locationId}`);
        return { success: false, error: 'Location not found', locationId };
      }

      const items = DataService.getAll(CONFIG.SHEETS.INVENTORY, {
        filters: { Location_ID: locationId, Status: 'Available' }
      });

      const result = DataService.update(CONFIG.SHEETS.LOCATIONS, locationId, {
        Current_Count: items.length
      });

      if (!result) {
        return { success: false, error: 'Failed to update location', locationId };
      }

      return { success: true, locationId, count: items.length };
    } catch (error) {
      console.error(`[TaxonomyService] Error updating location count: ${error.message}`);
      return { success: false, error: error.message, locationId };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAGS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get all tags
   */
  function getTags() {
    return DataService.getAll(CONFIG.SHEETS.TAGS);
  }

  /**
   * Create a tag
   */
  function createTag(name, color = '#00D9FF') {
    return DataService.insert(CONFIG.SHEETS.TAGS, {
      Name: name,
      Color: color
    });
  }

  /**
   * Add tag to item
   */
  function tagItem(itemId, tagId) {
    // Check if already tagged
    const existing = DataService.getAll(CONFIG.SHEETS.ITEM_TAGS, {
      filters: { Item_ID: itemId, Tag_ID: tagId }
    });

    if (existing.length > 0) return true;

    return DataService.insert(CONFIG.SHEETS.ITEM_TAGS, {
      Item_ID: itemId,
      Tag_ID: tagId
    });
  }

  /**
   * Remove tag from item
   * @param {string} itemId - Item ID to untag
   * @param {string} tagId - Tag ID to remove
   * @returns {Object} Result with success flag and details
   */
  function untagItem(itemId, tagId) {
    if (!itemId || !tagId) {
      return { success: false, error: 'Item ID and Tag ID are required' };
    }

    try {
      const itemTags = DataService.getAll(CONFIG.SHEETS.ITEM_TAGS, {
        filters: { Item_ID: itemId, Tag_ID: tagId }
      });

      if (itemTags.length === 0) {
        return { success: true, message: 'Tag not found on item', removed: 0 };
      }

      const sheet = DataService.getSheet(CONFIG.SHEETS.ITEM_TAGS);
      // Delete from bottom up to avoid row shift issues
      itemTags.sort((a, b) => b._rowIndex - a._rowIndex);

      let removed = 0;
      const errors = [];

      for (const it of itemTags) {
        try {
          sheet.deleteRow(it._rowIndex);
          removed++;
        } catch (rowError) {
          errors.push({ rowIndex: it._rowIndex, error: rowError.message });
        }
      }

      DataService.invalidateCache(CONFIG.SHEETS.ITEM_TAGS.name);

      if (errors.length > 0) {
        console.warn(`[TaxonomyService] Partial untag failure:`, errors);
        return { success: removed > 0, removed, errors, partial: true };
      }

      return { success: true, removed };
    } catch (error) {
      console.error(`[TaxonomyService] Error untagging item: ${error.message}`);
      return { success: false, error: error.message, itemId, tagId };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    // Categories
    getCategories,
    getCategoryTree,
    getCategoriesMap,
    createCategory,

    // Locations
    getLocations,
    createLocation,
    updateLocationCount,

    // Tags
    getTags,
    createTag,
    tagItem,
    untagItem
  };
})();
