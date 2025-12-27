/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ROSEWOOD ANTIQUES v2 - Configuration & Constants
 * ═══════════════════════════════════════════════════════════════════════════
 * Central configuration for the entire application.
 * All constants, sheet definitions, and design tokens live here.
 */

const CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // VERSION & META
  // ─────────────────────────────────────────────────────────────────────────
  VERSION: "2.0.0",
  APP_NAME: "Rosewood Antiques",

  // ─────────────────────────────────────────────────────────────────────────
  // SHEET DEFINITIONS
  // ─────────────────────────────────────────────────────────────────────────
  SHEETS: {
    INVENTORY: {
      name: "Inventory",
      headers: [
        "Item_ID",
        "Name",
        "Description",
        "Category_ID",
        "Parent_ID",
        "SKU",
        "Condition",
        "Era",
        "Price",
        "Cost",
        "Quantity",
        "Location_ID",
        "Status",
        "Date_Added",
        "Date_Modified",
        "Notes",
      ],
      idPrefix: "INV",
    },
    VARIANTS: {
      name: "Variants",
      headers: [
        "Variant_ID",
        "Parent_Item_ID",
        "Variant_Type",
        "Variant_Value",
        "SKU_Suffix",
        "Price_Modifier",
        "Quantity",
        "Status",
      ],
      idPrefix: "VAR",
    },
    BUNDLES: {
      name: "Bundles",
      headers: [
        "Bundle_ID",
        "Name",
        "Description",
        "Bundle_Price",
        "Discount_Percent",
        "Status",
        "Date_Created",
      ],
      idPrefix: "BND",
    },
    BUNDLE_ITEMS: {
      name: "Bundle_Items",
      headers: ["Bundle_ID", "Item_ID", "Quantity"],
    },
    CATEGORIES: {
      name: "Categories",
      headers: [
        "Category_ID",
        "Name",
        "Parent_Category_ID",
        "Description",
        "Sort_Order",
      ],
      idPrefix: "CAT",
    },
    SALES: {
      name: "Sales",
      headers: [
        "Sale_ID",
        "Date",
        "Week_ID",
        "Customer_ID",
        "Item_ID",
        "Variant_ID",
        "Bundle_ID",
        "Quantity",
        "Unit_Price",
        "Total",
        "Payment_Method",
        "Status",
        "Notes",
      ],
      idPrefix: "SLE",
    },
    WEEKLY_SALES: {
      name: "Weekly_Sales",
      headers: [
        "Week_ID",
        "Week_Start",
        "Week_End",
        "Total_Revenue",
        "Total_Cost",
        "Gross_Profit",
        "Items_Sold",
        "Transactions",
        "Avg_Transaction",
        "Top_Category",
        "Top_Item",
      ],
    },
    CUSTOMERS: {
      name: "Customers",
      headers: [
        "Customer_ID",
        "Name",
        "Email",
        "Phone",
        "Address",
        "Preferred_Contact",
        "Total_Purchases",
        "Last_Purchase",
        "Notes",
      ],
      idPrefix: "CUS",
    },
    LOCATIONS: {
      name: "Locations",
      headers: [
        "Location_ID",
        "Name",
        "Description",
        "Capacity",
        "Current_Count",
      ],
      idPrefix: "LOC",
    },
    TAGS: {
      name: "Tags",
      headers: ["Tag_ID", "Name", "Color"],
      idPrefix: "TAG",
    },
    ITEM_TAGS: {
      name: "Item_Tags",
      headers: ["Item_ID", "Tag_ID"],
    },
    SETTINGS: {
      name: "Settings",
      headers: ["Key", "Value", "Description"],
    },
    ACTIVITY_LOG: {
      name: "Activity_Log",
      headers: [
        "Timestamp",
        "Action",
        "Entity_Type",
        "Entity_ID",
        "Details",
        "User",
      ],
    },
    DASHBOARD_CACHE: {
      name: "Dashboard_Cache",
      headers: [
        "Metric_Key",
        "Value",
        "Last_Updated",
        "Expiry_Seconds",
        "Category",
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENUMS & OPTIONS
  // ─────────────────────────────────────────────────────────────────────────
  ITEM_STATUS: [
    "Available",
    "Reserved",
    "Sold",
    "On Hold",
    "Damaged",
    "Archived",
  ],
  SALE_STATUS: ["Completed", "Pending", "Refunded", "Cancelled"],
  CONDITIONS: [
    "Mint",
    "Excellent",
    "Very Good",
    "Good",
    "Fair",
    "Poor",
    "For Parts",
  ],
  ERAS: [
    "Pre-1800",
    "1800-1850",
    "1850-1900",
    "1900-1950",
    "1950-1980",
    "Modern",
  ],
  PAYMENT_METHODS: [
    "Cash",
    "Credit Card",
    "Debit",
    "Check",
    "PayPal",
    "Venmo",
    "Other",
  ],
  VARIANT_TYPES: ["Size", "Color", "Material", "Finish", "Style"],

  // ─────────────────────────────────────────────────────────────────────────
  // DESIGN TOKENS (Futuristic Dark Theme)
  // ─────────────────────────────────────────────────────────────────────────
  COLORS: {
    // Backgrounds
    BG_PRIMARY: "#0F1419",
    BG_SECONDARY: "#1A2332",
    BG_TERTIARY: "#242D3D",
    BG_HOVER: "#2D3748",

    // Accents
    ACCENT_CYAN: "#00D9FF",
    ACCENT_PURPLE: "#7C3AED",
    ACCENT_GRADIENT: "linear-gradient(135deg, #00D9FF 0%, #7C3AED 100%)",

    // Semantic
    SUCCESS: "#10B981",
    WARNING: "#F59E0B",
    ERROR: "#EF4444",
    INFO: "#3B82F6",

    // Text
    TEXT_PRIMARY: "#F1F5F9",
    TEXT_SECONDARY: "#94A3B8",
    TEXT_MUTED: "#64748B",

    // Borders & Dividers
    BORDER: "#334155",
    BORDER_FOCUS: "#00D9FF",

    // Glass effect
    GLASS_BG: "rgba(26, 35, 50, 0.8)",
    GLASS_BORDER: "rgba(255, 255, 255, 0.1)",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PERFORMANCE SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  PERFORMANCE: {
    CACHE_TTL: {
      quick_stats: 120,
      health: 300,
      today: 60,
      actions: 300,
      charts: 300,
      recent: 60,
      default: 300,
    },
    PAGE_SIZE: 30,
    DEBOUNCE_MS: 400,
    BATCH_SIZE: 100,
    MAX_UNDO_STACK: 20,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UI SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  UI: {
    SIDEBAR_WIDTH: 420,
    DIALOG_WIDTH: 550,
    DIALOG_HEIGHT: 650,
    CONTROL_CENTER_WIDTH: 1200,
    CONTROL_CENTER_HEIGHT: 800,
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 200,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BUSINESS RULES
  // ─────────────────────────────────────────────────────────────────────────
  BUSINESS_RULES: {
    AGING_THRESHOLDS: {
      FRESH: 30, // days - items added within this are "fresh"
      NORMAL: 90, // days
      AGING: 180, // days
      STALE: 365, // days - items older than this are "stale"
    },
    LOW_STOCK_THRESHOLD: 2,
    LOW_MARGIN_THRESHOLD: 30, // percent
    TARGET_TURNOVER_RATE: 0.5,
    TARGET_VELOCITY_DAYS: 30,
    HEALTH_SCORE_WEIGHTS: {
      TURNOVER: 0.25, // weight in health score
      AGING: 0.30, // weight in health score
      MARGIN: 0.25, // weight in health score
      VELOCITY: 0.20, // weight in health score
    },
    HEALTH_SCORE_MULTIPLIERS: {
      TURNOVER: 200, // multiplier for turnover score (0.5 turnover = 100)
      AGING: 200, // multiplier for aging ratio (0% = 100, 50%+ = 0)
      VELOCITY_BASE: 100, // base for velocity score
      VELOCITY_TARGET: 30, // target days for optimal velocity
    },
    ACTION_ITEM_THRESHOLDS: {
      HIGH_VALUE_STALE_DAYS: 180, // days before item is considered stale
      HIGH_VALUE_PRICE: 200, // minimum price for high-value alert
      AGING_DAYS: 90, // days before item needs attention
      LOW_MARGIN_DAYS: 60, // days listed before low margin becomes a concern
      SLOW_CATEGORY_DAYS: 90, // days without sales to flag category as slow
      MIN_ITEMS_FOR_SLOW: 5, // minimum items in category to trigger slow alert
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENVIRONMENT
  // ─────────────────────────────────────────────────────────────────────────
  ENVIRONMENT: {
    MODE:
      PropertiesService.getScriptProperties().getProperty("ENVIRONMENT") ||
      "development",
    DEBUG: PropertiesService.getScriptProperties().getProperty("DEBUG") === "true",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────
  VALIDATION: {
    MAX_NAME_LENGTH: 200,
    MAX_DESCRIPTION_LENGTH: 2000,
    MAX_NOTES_LENGTH: 5000,
    MAX_PRICE: 1000000,
    MAX_QUANTITY: 100000,
    MAX_BATCH_SIZE: 1000,
    MAX_CSV_SIZE_BYTES: 5 * 1024 * 1024, // 5MB
    ALLOWED_STATUSES: [
      "Available",
      "Sold",
      "Reserved",
      "Damaged",
      "Archived",
    ],
    ALLOWED_CONDITIONS: [
      "Mint",
      "Excellent",
      "Good",
      "Fair",
      "Poor",
      "For Parts",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DEFAULTS
  // ─────────────────────────────────────────────────────────────────────────
  DEFAULTS: {
    STATUS: "Available",
    CONDITION: "Good",
    QUANTITY: 1,
    PAYMENT_METHOD: "Cash",
    SALE_STATUS: "Completed",
    CATEGORY_NAME: "Uncategorized",
    LOCATION_NAME: "Unknown",
    ITEM_NAME: "Unknown",
  },
};

/**
 * Freeze CONFIG to prevent accidental mutations
 */
Object.freeze(CONFIG);
Object.keys(CONFIG).forEach((key) => {
  if (typeof CONFIG[key] === "object") {
    Object.freeze(CONFIG[key]);
    // Freeze nested objects (e.g., AGING_THRESHOLDS, HEALTH_SCORE_WEIGHTS)
    Object.keys(CONFIG[key]).forEach((nestedKey) => {
      if (typeof CONFIG[key][nestedKey] === "object") {
        Object.freeze(CONFIG[key][nestedKey]);
      }
    });
  }
});
