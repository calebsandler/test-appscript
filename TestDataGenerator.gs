/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Test Data Generator
 * ═══════════════════════════════════════════════════════════════════════════
 * Generates realistic test data for demonstration and testing.
 * Accessible via menu: Rosewood > Test Data > Generate...
 */

const TestDataGenerator = (function() {

  // ─────────────────────────────────────────────────────────────────────────
  // SAMPLE DATA POOLS
  // ─────────────────────────────────────────────────────────────────────────

  const ANTIQUE_NAMES = {
    furniture: [
      'Victorian Mahogany Writing Desk', 'Art Deco Walnut Sideboard',
      'Georgian Oak Bookcase', 'Edwardian Marble Top Washstand',
      'Louis XV Style Armchair', 'Chippendale Corner Cabinet',
      'Queen Anne Tea Table', 'Regency Rosewood Card Table',
      'Federal Period Chest of Drawers', 'Empire Style Settee',
      'Sheraton Pembroke Table', 'Windsor Armchair',
      'Jacobean Oak Coffer', 'Campaign Writing Box'
    ],
    decor: [
      'Tiffany Style Table Lamp', 'Art Nouveau Bronze Sculpture',
      'Sevres Porcelain Vase', 'Meissen Figurine Group',
      'Cloisonne Enamel Vase', 'Crystal Chandelier',
      'Gilt Framed Mirror', 'Chinese Export Porcelain Bowl',
      'Persian Silk Rug', 'Venetian Glass Decanter Set',
      'Bronze Candelabra Pair', 'Marble Bust',
      'Sterling Silver Tea Service', 'Limoges Dinner Set'
    ],
    jewelry: [
      'Art Deco Diamond Ring', 'Victorian Cameo Brooch',
      'Edwardian Pearl Necklace', 'Antique Gold Pocket Watch',
      'Georgian Mourning Ring', 'Vintage Cartier Bracelet',
      'Art Nouveau Enamel Pendant', 'Belle Epoque Diamond Tiara',
      'Retro Ruby Cocktail Ring', 'Vintage Rolex Datejust'
    ],
    art: [
      'Oil Painting - Landscape', 'Watercolor - Still Life',
      'Bronze Sculpture - Figure', 'Antique Map - Americas',
      'Japanese Woodblock Print', 'Etching - Architectural',
      'Miniature Portrait', 'Folk Art Weathervane',
      'Vintage Movie Poster', 'Signed Lithograph'
    ],
    collectibles: [
      'First Edition Book', 'Vintage Wine Collection',
      'Antique Music Box', 'Vintage Fountain Pen',
      'Antique Clock', 'Vintage Camera',
      'Antique Scientific Instrument', 'Vintage Toy Train',
      'Antique Globe', 'Vintage Typewriter'
    ]
  };

  const CUSTOMER_FIRST_NAMES = [
    'James', 'Elizabeth', 'William', 'Margaret', 'Robert', 'Dorothy',
    'Michael', 'Patricia', 'David', 'Barbara', 'Richard', 'Susan',
    'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
    'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty'
  ];

  const CUSTOMER_LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia',
    'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor',
    'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson',
    'White', 'Lopez', 'Lee', 'Gonzalez', 'Harris', 'Clark'
  ];

  const LOCATIONS = [
    { name: 'Main Showroom', desc: 'Primary display area', capacity: 100 },
    { name: 'Gallery A', desc: 'Fine art and paintings', capacity: 50 },
    { name: 'Gallery B', desc: 'Furniture display', capacity: 30 },
    { name: 'Jewelry Case', desc: 'Secured jewelry display', capacity: 200 },
    { name: 'Storage Room 1', desc: 'Climate controlled storage', capacity: 150 },
    { name: 'Storage Room 2', desc: 'General storage', capacity: 200 },
    { name: 'Restoration Workshop', desc: 'Items being restored', capacity: 25 },
    { name: 'Consignment Area', desc: 'Consigned items', capacity: 75 }
  ];

  const CATEGORIES = [
    { name: 'Furniture', children: ['Seating', 'Tables', 'Storage', 'Desks'] },
    { name: 'Decorative Arts', children: ['Ceramics', 'Glass', 'Metalwork', 'Textiles'] },
    { name: 'Fine Art', children: ['Paintings', 'Sculpture', 'Prints', 'Photography'] },
    { name: 'Jewelry', children: ['Rings', 'Necklaces', 'Brooches', 'Watches'] },
    { name: 'Collectibles', children: ['Books', 'Coins', 'Toys', 'Ephemera'] }
  ];

  const TAGS = [
    { name: 'Featured', color: '#00D9FF' },
    { name: 'New Arrival', color: '#10B981' },
    { name: 'Sale', color: '#EF4444' },
    { name: 'Rare', color: '#7C3AED' },
    { name: 'Museum Quality', color: '#F59E0B' },
    { name: 'Investment Piece', color: '#3B82F6' },
    { name: 'Estate Sale', color: '#6366F1' },
    { name: 'Needs Restoration', color: '#64748B' }
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomPrice(min, max) {
    return Math.round(randomInt(min * 100, max * 100)) / 100;
  }

  function randomDate(daysBack) {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(0, daysBack));
    return date;
  }

  function generateEmail(firstName, lastName) {
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'aol.com', 'icloud.com'];
    return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${randomElement(domains)}`;
  }

  function generatePhone() {
    return `(${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA GENERATORS
  // ─────────────────────────────────────────────────────────────────────────

  function generateCategories() {
    const categoryIds = {};

    CATEGORIES.forEach((cat, index) => {
      // Create parent category
      const parentId = DataService.insert(CONFIG.SHEETS.CATEGORIES, {
        Name: cat.name,
        Parent_Category_ID: '',
        Description: `${cat.name} collection`,
        Sort_Order: index * 10
      });
      categoryIds[cat.name] = parentId;

      // Create child categories
      cat.children.forEach((child, childIndex) => {
        const childId = DataService.insert(CONFIG.SHEETS.CATEGORIES, {
          Name: child,
          Parent_Category_ID: parentId,
          Description: `${child} subcategory`,
          Sort_Order: childIndex
        });
        categoryIds[child] = childId;
      });
    });

    return categoryIds;
  }

  function generateLocations() {
    const locationIds = {};

    LOCATIONS.forEach(loc => {
      const id = DataService.insert(CONFIG.SHEETS.LOCATIONS, {
        Name: loc.name,
        Description: loc.desc,
        Capacity: loc.capacity,
        Current_Count: 0
      });
      locationIds[loc.name] = id;
    });

    return locationIds;
  }

  function generateTags() {
    const tagIds = {};

    TAGS.forEach(tag => {
      const id = DataService.insert(CONFIG.SHEETS.TAGS, {
        Name: tag.name,
        Color: tag.color
      });
      tagIds[tag.name] = id;
    });

    return tagIds;
  }

  function generateCustomers(count) {
    const customerIds = [];

    for (let i = 0; i < count; i++) {
      const firstName = randomElement(CUSTOMER_FIRST_NAMES);
      const lastName = randomElement(CUSTOMER_LAST_NAMES);

      const id = DataService.insert(CONFIG.SHEETS.CUSTOMERS, {
        Name: `${firstName} ${lastName}`,
        Email: generateEmail(firstName, lastName),
        Phone: generatePhone(),
        Address: `${randomInt(100, 9999)} ${randomElement(['Main', 'Oak', 'Maple', 'Cedar', 'Park'])} ${randomElement(['St', 'Ave', 'Blvd', 'Dr', 'Ln'])}`,
        Preferred_Contact: randomElement(['Email', 'Phone', 'Text']),
        Total_Purchases: 0,
        Last_Purchase: '',
        Notes: ''
      });

      customerIds.push(id);
    }

    return customerIds;
  }

  function generateInventoryItems(count, categoryIds, locationIds, tagIds) {
    const itemIds = [];
    const categories = Object.keys(categoryIds);
    const locations = Object.keys(locationIds);
    const tags = Object.keys(tagIds);

    // Flatten antique names
    const allNames = Object.values(ANTIQUE_NAMES).flat();

    for (let i = 0; i < count; i++) {
      const name = randomElement(allNames);
      const condition = randomElement(CONFIG.CONDITIONS);
      const era = randomElement(CONFIG.ERAS);
      const categoryKey = randomElement(categories);
      const locationKey = randomElement(locations);

      // Price based on condition
      const conditionMultiplier = {
        'Mint': 1.5, 'Excellent': 1.3, 'Very Good': 1.1,
        'Good': 1.0, 'Fair': 0.7, 'Poor': 0.4, 'For Parts': 0.2
      };

      const basePrice = randomPrice(50, 5000);
      const price = Math.round(basePrice * conditionMultiplier[condition] * 100) / 100;
      const cost = Math.round(price * randomPrice(0.3, 0.6) * 100) / 100;

      const id = DataService.insert(CONFIG.SHEETS.INVENTORY, {
        Name: name,
        Description: `Beautiful ${era} ${name.toLowerCase()} in ${condition.toLowerCase()} condition.`,
        Category_ID: categoryIds[categoryKey],
        Parent_ID: '',
        SKU: `RSW-${String(i + 1).padStart(4, '0')}`,
        Condition: condition,
        Era: era,
        Price: price,
        Cost: cost,
        Quantity: randomInt(1, 3),
        Location_ID: locationIds[locationKey],
        Status: randomElement(['Available', 'Available', 'Available', 'Reserved', 'On Hold']),
        Notes: '[TEST] Generated test inventory item'
      });

      itemIds.push(id);

      // Add random tags (30% chance per tag)
      tags.forEach(tagName => {
        if (Math.random() < 0.3) {
          DataService.insert(CONFIG.SHEETS.ITEM_TAGS, {
            Item_ID: id,
            Tag_ID: tagIds[tagName]
          });
        }
      });
    }

    return itemIds;
  }

  function generateSales(count, itemIds, customerIds) {
    const saleIds = [];

    for (let i = 0; i < count; i++) {
      const itemId = randomElement(itemIds);
      const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);

      if (!item || item.Status === 'Sold') continue;

      const saleDate = randomDate(90); // Last 90 days
      const weekId = DataService.getWeekId(saleDate);

      const id = DataService.insert(CONFIG.SHEETS.SALES, {
        Date: saleDate,
        Week_ID: weekId,
        Customer_ID: Math.random() > 0.3 ? randomElement(customerIds) : '',
        Item_ID: itemId,
        Variant_ID: '',
        Bundle_ID: '',
        Quantity: 1,
        Unit_Price: item.Price,
        Total: item.Price,
        Payment_Method: randomElement(CONFIG.PAYMENT_METHODS),
        Status: 'Completed',
        Notes: '[TEST] Generated test sale'
      });

      saleIds.push(id);

      // Mark item as sold
      DataService.update(CONFIG.SHEETS.INVENTORY, itemId, {
        Status: 'Sold',
        Quantity: 0
      });
    }

    return saleIds;
  }

  function generateVariants(itemIds) {
    const variantIds = [];

    // Add variants to ~20% of items
    itemIds.forEach(itemId => {
      if (Math.random() > 0.2) return;

      const variantType = randomElement(['Size', 'Color', 'Finish']);
      let values;

      switch (variantType) {
        case 'Size':
          values = ['Small', 'Medium', 'Large'];
          break;
        case 'Color':
          values = ['Natural', 'Dark Stain', 'Painted'];
          break;
        case 'Finish':
          values = ['Original', 'Restored', 'As-Is'];
          break;
      }

      values.forEach(value => {
        const id = DataService.insert(CONFIG.SHEETS.VARIANTS, {
          Parent_Item_ID: itemId,
          Variant_Type: variantType,
          Variant_Value: value,
          SKU_Suffix: `-${value.substring(0, 3).toUpperCase()}`,
          Price_Modifier: randomInt(-100, 200),
          Quantity: randomInt(1, 3),
          Status: 'Available'
        });
        variantIds.push(id);
      });
    });

    return variantIds;
  }

  function generateBundles(itemIds) {
    const bundleIds = [];

    // Create 3-5 bundles
    const bundleCount = randomInt(3, 5);

    for (let i = 0; i < bundleCount; i++) {
      const bundleItems = [];
      const itemCount = randomInt(2, 5);

      // Select random items for bundle
      const shuffled = [...itemIds].sort(() => Math.random() - 0.5);
      for (let j = 0; j < Math.min(itemCount, shuffled.length); j++) {
        bundleItems.push(shuffled[j]);
      }

      // Calculate bundle price (10-20% discount)
      let totalValue = 0;
      bundleItems.forEach(itemId => {
        const item = DataService.getById(CONFIG.SHEETS.INVENTORY, itemId);
        if (item) totalValue += item.Price;
      });

      const discount = randomInt(10, 20);
      const bundlePrice = Math.round(totalValue * (1 - discount / 100) * 100) / 100;

      const bundleId = DataService.insert(CONFIG.SHEETS.BUNDLES, {
        Name: `Curated Collection ${i + 1}`,
        Description: `Hand-picked collection of ${bundleItems.length} premium antiques`,
        Bundle_Price: bundlePrice,
        Discount_Percent: discount,
        Status: 'Available',
        Date_Created: new Date()
      });

      // Add items to bundle
      bundleItems.forEach(itemId => {
        DataService.insert(CONFIG.SHEETS.BUNDLE_ITEMS, {
          Bundle_ID: bundleId,
          Item_ID: itemId,
          Quantity: 1
        });
      });

      bundleIds.push(bundleId);
    }

    return bundleIds;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN GENERATION FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate minimal test data (5-10 items)
   */
  function generateMinimal() {
    return generateData({
      items: 10,
      customers: 5,
      sales: 3
    });
  }

  /**
   * Generate medium test data (50-100 items)
   */
  function generateMedium() {
    return generateData({
      items: 75,
      customers: 25,
      sales: 30
    });
  }

  /**
   * Generate full test data (500+ items)
   */
  function generateFull() {
    return generateData({
      items: 200,
      customers: 50,
      sales: 100
    });
  }

  /**
   * Main data generation function
   */
  function generateData(options) {
    const { items = 50, customers = 20, sales = 20 } = options;

    const results = {
      categories: 0,
      locations: 0,
      tags: 0,
      customers: 0,
      items: 0,
      variants: 0,
      bundles: 0,
      sales: 0
    };

    try {
      // Generate foundation data
      const categoryIds = generateCategories();
      results.categories = Object.keys(categoryIds).length;

      const locationIds = generateLocations();
      results.locations = Object.keys(locationIds).length;

      const tagIds = generateTags();
      results.tags = Object.keys(tagIds).length;

      // Generate customers
      const customerIds = generateCustomers(customers);
      results.customers = customerIds.length;

      // Generate inventory
      const itemIds = generateInventoryItems(items, categoryIds, locationIds, tagIds);
      results.items = itemIds.length;

      // Generate variants
      const variantIds = generateVariants(itemIds);
      results.variants = variantIds.length;

      // Generate bundles
      const bundleIds = generateBundles(itemIds);
      results.bundles = bundleIds.length;

      // Generate sales (this marks some items as sold)
      const saleIds = generateSales(sales, itemIds, customerIds);
      results.sales = saleIds.length;

      // Rebuild weekly sales summaries
      SalesService.rebuildAllWeeklySales();

      // Update location counts
      Object.values(locationIds).forEach(locId => {
        TaxonomyService.updateLocationCount(locId);
      });

      // Clear caches
      DataService.clearAllCaches();

      return {
        success: true,
        results
      };

    } catch (e) {
      return {
        success: false,
        error: e.message,
        results
      };
    }
  }

  /**
   * Clear all test data (reset to empty state)
   * SAFETY: Protected against accidental production data deletion
   */
  function clearAllData() {
    // Production guard - prevent clearing data in production mode
    if (CONFIG.ENVIRONMENT.MODE === 'production') {
      throw new Error('Cannot clear all data in production mode. Change ENVIRONMENT.MODE to "development" first via Script Properties.');
    }

    // Log warning before clearing
    console.warn('⚠️ CLEARING ALL DATA - This action will delete all sheets and data!');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    // Delete all sheets except the first one
    sheets.forEach((sheet, index) => {
      if (index > 0) {
        ss.deleteSheet(sheet);
      }
    });

    // Rename first sheet
    sheets[0].setName('Readme');
    sheets[0].clear();
    sheets[0].getRange('A1').setValue('Rosewood Antiques v2\n\nUse the menu to generate test data or open the manager.');

    // Clear caches and properties
    DataService.clearAllCaches();
    PropertiesService.getScriptProperties().deleteAllProperties();

    // Reinitialize sheets
    DataService.initializeAllSheets();

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MASSIVE SALES DATA GENERATOR
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate lots of historical sales data for testing dashboards and charts
   * @param {Object} options - Configuration options
   * @param {number} options.salesCount - Total number of sales to generate (default: 500)
   * @param {number} options.daysBack - How far back to generate sales (default: 365)
   * @param {boolean} options.createItems - Whether to create inventory items if none exist (default: true)
   */
  function generateMassiveSales(options = {}) {
    const {
      salesCount = 500,
      daysBack = 365,
      createItems = true
    } = options;

    const results = {
      salesCreated: 0,
      itemsCreated: 0,
      customersCreated: 0,
      weeksRebuilt: 0
    };

    try {
      // Check for existing inventory
      let items = DataService.getAll(CONFIG.SHEETS.INVENTORY);
      let customers = DataService.getAll(CONFIG.SHEETS.CUSTOMERS);
      let categories = DataService.getAll(CONFIG.SHEETS.CATEGORIES);

      // Create foundation data if needed
      if (categories.length === 0) {
        const categoryIds = generateCategories();
        results.categoriesCreated = Object.keys(categoryIds).length;
        categories = DataService.getAll(CONFIG.SHEETS.CATEGORIES);
      }

      if (customers.length === 0) {
        const customerIds = generateCustomers(30);
        results.customersCreated = customerIds.length;
        customers = DataService.getAll(CONFIG.SHEETS.CUSTOMERS);
      }

      // Create items specifically for sales history (marked as Sold)
      if (createItems || items.length < salesCount) {
        const itemsNeeded = Math.max(salesCount - items.length, 100);
        const newItemIds = generateSoldItems(itemsNeeded, categories);
        results.itemsCreated = newItemIds.length;
        items = DataService.getAll(CONFIG.SHEETS.INVENTORY);
      }

      // Get only sold items or available items we can "sell"
      const soldItems = items.filter(item => item.Status === 'Sold');
      const availableItems = items.filter(item => item.Status === 'Available');

      // Generate sales data
      const salesData = [];
      const now = new Date();

      for (let i = 0; i < salesCount; i++) {
        // Pick a random date with realistic distribution
        // More recent dates are more likely (exponential decay)
        const daysAgo = Math.floor(Math.pow(Math.random(), 0.7) * daysBack);
        const saleDate = new Date(now);
        saleDate.setDate(saleDate.getDate() - daysAgo);

        // Add some time variation
        saleDate.setHours(randomInt(9, 18));
        saleDate.setMinutes(randomInt(0, 59));

        // Weekend boost (more sales on weekends)
        const dayOfWeek = saleDate.getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && Math.random() < 0.3) {
          // 30% chance to add another sale on weekends
          i--; // Don't count this iteration, we'll add extra
        }

        // Pick an item - prefer sold items, but can use available ones
        let item;
        if (soldItems.length > 0 && Math.random() < 0.7) {
          item = randomElement(soldItems);
        } else if (availableItems.length > 0) {
          item = randomElement(availableItems);
        } else {
          continue; // Skip if no items available
        }

        // Calculate sale price with some variation
        const basePrice = item.Price || randomPrice(100, 2000);
        const priceVariation = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation
        const salePrice = Math.round(basePrice * priceVariation * 100) / 100;

        // Pick customer (70% have customer, 30% walk-ins)
        const customer = Math.random() < 0.7 && customers.length > 0
          ? randomElement(customers)
          : null;

        const weekId = DataService.getWeekId(saleDate);

        salesData.push({
          Date: saleDate,
          Week_ID: weekId,
          Customer_ID: customer ? customer.Customer_ID : '',
          Item_ID: item.Item_ID,
          Variant_ID: '',
          Bundle_ID: '',
          Quantity: 1,
          Unit_Price: salePrice,
          Total: salePrice,
          Payment_Method: randomElement(CONFIG.PAYMENT_METHODS),
          Status: 'Completed',
          Notes: '[TEST] Generated historical sale'
        });
      }

      // Sort by date (oldest first) for proper insertion
      salesData.sort((a, b) => a.Date - b.Date);

      // Batch insert sales
      salesData.forEach(sale => {
        DataService.insert(CONFIG.SHEETS.SALES, sale);
        results.salesCreated++;
      });

      // Rebuild weekly sales summaries
      results.weeksRebuilt = SalesService.rebuildAllWeeklySales();

      // Clear caches
      DataService.clearAllCaches();

      return {
        success: true,
        results
      };

    } catch (e) {
      return {
        success: false,
        error: e.message,
        results
      };
    }
  }

  /**
   * Generate items that are already sold (for historical sales data)
   */
  function generateSoldItems(count, categories) {
    const itemIds = [];
    const allNames = Object.values(ANTIQUE_NAMES).flat();
    const categoryList = categories.map(c => c.Category_ID);

    for (let i = 0; i < count; i++) {
      const name = randomElement(allNames);
      const condition = randomElement(CONFIG.CONDITIONS);
      const era = randomElement(CONFIG.ERAS);

      const conditionMultiplier = {
        'Mint': 1.5, 'Excellent': 1.3, 'Very Good': 1.1,
        'Good': 1.0, 'Fair': 0.7, 'Poor': 0.4, 'For Parts': 0.2
      };

      const basePrice = randomPrice(50, 5000);
      const price = Math.round(basePrice * conditionMultiplier[condition] * 100) / 100;
      const cost = Math.round(price * randomPrice(0.3, 0.6) * 100) / 100;

      const id = DataService.insert(CONFIG.SHEETS.INVENTORY, {
        Name: name,
        Description: `${era} ${name.toLowerCase()} in ${condition.toLowerCase()} condition.`,
        Category_ID: categoryList.length > 0 ? randomElement(categoryList) : '',
        Parent_ID: '',
        SKU: `RSW-H${String(i + 1).padStart(4, '0')}`,
        Condition: condition,
        Era: era,
        Price: price,
        Cost: cost,
        Quantity: 0,
        Location_ID: '',
        Status: 'Sold',
        Notes: '[TEST] Generated historical item'
      });

      itemIds.push(id);
    }

    return itemIds;
  }

  /**
   * Quick function to add sales to existing data
   * Call from menu: Rosewood > Test Data > Add 100 Sales
   */
  function addQuickSales(count = 100) {
    return generateMassiveSales({
      salesCount: count,
      daysBack: 90,
      createItems: true
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────
  return {
    generateMinimal,
    generateMedium,
    generateFull,
    generateData,
    clearAllData,
    generateMassiveSales,
    addQuickSales
  };
})();
