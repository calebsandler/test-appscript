# Rosewood Antiques v2 - Architecture Documentation

> **Last Updated:** December 2024
> **Version:** 2.0.0
> **Runtime:** V8
> **Timezone:** America/New_York

## Overview

This is a **container-bound** Google Apps Script application for antique inventory management. It operates as both a spreadsheet add-on (sidebar/dialogs) and a standalone web app.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  WebApp.html          │  Sidebar.html        │  ControlCenter.html      │
│  (Standalone App)     │  (Sheets Sidebar)    │  (Full Modal)            │
│                       │                      │                          │
│  Dialogs.html         │  SharedStyles.html   │  SharedScripts.html      │
│  (Add Item/Sale/Cust) │  (CSS Variables)     │  (JS Utilities)          │
└─────────────────────────────────────────────────────────────────────────┘
                              │ google.script.run
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Main.gs)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  • Web App Entry Points (doGet)                                         │
│  • Access Control (passphrase, email whitelist)                         │
│  • Menu Handlers                                                         │
│  • Frontend API Functions (getInventory, recordSale, etc.)              │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                                   │
├──────────────────┬──────────────────┬──────────────────┬────────────────┤
│ InventoryService │   SalesService   │ CustomerService  │TaxonomyService │
│ • getItems       │ • recordSale     │ • getCustomers   │ • getCategories│
│ • createItem     │ • getSales       │ • createCustomer │ • getLocations │
│ • updateItem     │ • updateWeekly   │ • updateStats    │ • getTags      │
│ • deleteItem     │ • getDashboard   │                  │ • getCategoryTr│
│ • addVariant     │ • cancelSale     │                  │                │
├──────────────────┴──────────────────┴──────────────────┴────────────────┤
│ InventoryAnalyticsService  │  DashboardCacheService  │  BulkOperations  │
│ • calculateHealthScore      │  • getMetric/setMetric  │  • bulkCreate   │ 
│ • getAgingDistribution      │  • refreshAllMetrics    │  • bulkUpdate   │
│ • getActionItems           │  • batchSetMetrics       │  • CSV import   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA ACCESS LAYER                                │
├─────────────────────────────────────────────────────────────────────────┤
│                         DataService.gs                                   │
│  • CRUD operations (getAll, getById, insert, update, remove)            │
│  • Batch operations (batchInsert, batchUpdate, batchDelete)             │
│  • Caching layer (CacheService with TTL)                                │
│  • Pagination support (getPaginated)                                    │
│  • Activity logging                                                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION LAYER                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Config.gs                    │           Utils.gs                       │
│  • Sheet definitions          │  • Validation functions                  │
│  • Enums (status, condition)  │  • Date utilities                        │
│  • UI tokens                  │  • Formatting helpers                    │
│  • Business rules             │  • Response builders                     │
│  • Performance settings       │  • Lookup map builders                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE SHEETS (15 Sheets)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Inventory │ Variants │ Bundles │ Bundle_Items │ Categories │ Locations │
│  Tags │ Item_Tags │ Sales │ Weekly_Sales │ Customers │ Settings         │
│  Activity_Log │ Dashboard_Cache                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Server-Side Files (.gs)

| File | Size | Purpose |
|------|------|---------|
| `Main.gs` | 43.6 KB | Entry points, API functions, access control |
| `SalesService.gs` | 29.2 KB | Sales transactions and analytics |
| `TestDataGenerator.gs` | 26.4 KB | Test data generation with guards |
| `BulkOperations.gs` | 25.8 KB | Batch operations, CSV import/export |
| `DataService.gs` | 21.6 KB | Low-level data access with caching |
| `InventoryService.gs` | 18.9 KB | Core inventory CRUD |
| `DashboardCacheService.gs` | 14.9 KB | Pre-computed metrics caching |
| `Utils.gs` | 13.7 KB | Shared utilities |
| `Config.gs` | 12.9 KB | Central configuration |
| `InventoryAnalyticsService.gs` | 10.9 KB | Health scoring and analytics |
| `TaxonomyService.gs` | 9.6 KB | Categories, locations, tags |
| `CustomerService.gs` | 4.8 KB | Customer management |

### Client-Side Files (.html)

| File | Size | Purpose |
|------|------|---------|
| `WebApp.html` | 93.0 KB | Standalone web application |
| `ControlCenter.html` | 85.6 KB | Full-viewport control center modal |
| `Sidebar.html` | 81.6 KB | Google Sheets sidebar panel |
| `Dialogs.html` | 33.7 KB | Modal dialogs (Add Item/Sale/Customer) |
| `SharedStyles.html` | 6.5 KB | Common CSS variables and styles |
| `SharedScripts.html` | 2.9 KB | Common JavaScript utilities |

**Total Codebase Size:** ~545 KB

---

## Dependency Graph

```
                                    ┌─────────────┐
                                    │   CONFIG    │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │    Utils    │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │ DataService │
                                    └──────┬──────┘
                                           │
        ┌──────────────┬───────────────────┼───────────────────┬──────────────┐
        │              │                   │                   │              │
        ▼              ▼                   ▼                   ▼              ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐
│InventoryServ │ │ TaxonomyServ  │ │ CustomerServ  │ │ DashboardCa- │ │ TestDataGenerator   │
└───────┬───────┘ └───────────────┘ └───────────────┘ │ cheService   │ └─────────────────────┘
        │                                             └──────────────┘
        │
┌───────▼───────────────┐
│InventoryAnalyticsServ │
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│     SalesService      │ ──────► CustomerService (for stats updates)
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│   BulkOperations      │ ──────► InventoryService, SalesService
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│       Main.gs         │ ──────► All Services (API layer)
└───────────────────────┘
```

---

## Data Model

### Entity Relationships

```
INVENTORY (Item_ID) ─────┬───────────────────► CATEGORIES (Category_ID)
                         │                     LOCATIONS (Location_ID)
                         │                     Parent_ID → INVENTORY (self-ref)
                         │
                         ├──◄ VARIANTS (Parent_Item_ID)
                         ├──◄ ITEM_TAGS (Item_ID) ►── TAGS (Tag_ID)
                         ├──◄ BUNDLE_ITEMS (Item_ID) ►── BUNDLES (Bundle_ID)
                         └──◄ SALES (Item_ID)
                                    │
                                    └───────────► CUSTOMERS (Customer_ID)
                                                  WEEKLY_SALES (Week_ID)
```

### Sheet Definitions

| Sheet | ID Prefix | Key Fields |
|-------|-----------|------------|
| `Inventory` | INV | Item_ID, Name, Category_ID, Location_ID, Price, Status |
| `Variants` | VAR | Variant_ID, Parent_Item_ID, Size, Color, Price_Modifier |
| `Bundles` | BND | Bundle_ID, Name, Bundle_Price, Items_Count |
| `Bundle_Items` | - | Bundle_ID, Item_ID, Quantity |
| `Categories` | CAT | Category_ID, Name, Parent_ID, Description |
| `Locations` | LOC | Location_ID, Name, Item_Count, Capacity |
| `Tags` | TAG | Tag_ID, Name, Color |
| `Item_Tags` | - | Item_ID, Tag_ID |
| `Sales` | SLE | Sale_ID, Item_ID, Customer_ID, Price, Date, Payment_Method |
| `Weekly_Sales` | - | Week_ID, Revenue, Items_Sold, Avg_Price |
| `Customers` | CUS | Customer_ID, Name, Email, Phone, Total_Purchases |
| `Settings` | - | Key, Value |
| `Activity_Log` | - | Timestamp, Action, Entity_Type, Entity_ID, Details |
| `Dashboard_Cache` | - | Metric_Key, Category, Value, Updated_At |

---

## Key Design Patterns

### 1. IIFE Module Pattern
All services use immediately-invoked function expressions returning public API objects:
```javascript
const InventoryService = (function() {
  // Private functions and state
  function privateHelper() { /* ... */ }

  // Public API
  return {
    getItems: function() { /* ... */ },
    createItem: function(data) { /* ... */ }
  };
})();
```

### 2. Centralized Configuration
All constants, sheet definitions, and business rules in frozen CONFIG object:
```javascript
const CONFIG = {
  SHEETS: { /* sheet definitions */ },
  ENUMS: { /* status, conditions, etc. */ },
  BUSINESS_RULES: { /* thresholds, weights */ },
  VALIDATION: { /* max lengths, limits */ }
};
Object.freeze(CONFIG);
```

### 3. Cache-First Strategy
Dashboard data served from cache with TTL, background refresh via triggers:
```javascript
const cached = DashboardCacheService.getMetric('quick_stats');
if (cached && !needsRefresh(cached)) {
  return cached;
}
// Compute fresh and cache
```

### 4. Event Delegation (Frontend)
Centralized event handling using data-action attributes:
```javascript
document.body.addEventListener('click', function(e) {
  const action = e.target.dataset.action;
  if (handlers[action]) handlers[action](e);
});
```

### 5. N+1 Query Prevention
Uses lookup maps and batch fetching:
```javascript
const itemsMap = Utils.buildLookupMap(items, 'Item_ID');
sales.forEach(sale => {
  sale.Item_Name = itemsMap[sale.Item_ID]?.Name || 'Unknown';
});
```

---

## Access Control

### Authentication Methods

1. **Email Whitelist** - `ALLOWED_EMAILS` array in Main.gs
2. **Passphrase System** - Daily rotating passphrase for public access
3. **Google OAuth** - Via `Session.getActiveUser().getEmail()`

### Web App Deployment

- **Execute as:** Deploying user
- **Access:** Anyone (with passphrase or email check)

---

## Triggers

| Trigger | Function | Frequency |
|---------|----------|-----------|
| Time-driven | `refreshDashboardCache` | Every 5 minutes |
| onOpen | Menu creation | On spreadsheet open |
| onInstall | Initial setup | On add-on install |

---

## OAuth Scopes Required

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.container.ui"
  ]
}
```

---

## Performance Characteristics

| Operation | Typical Duration | Notes |
|-----------|-----------------|-------|
| Dashboard load (cached) | 50-200ms | From CacheService |
| Dashboard load (fresh) | 2-5s | Full computation |
| Inventory page (100 items) | 300-800ms | Paginated read |
| Single item CRUD | 200-500ms | Single row operation |
| Bulk operation (100 items) | 5-15s | Batch processing |
| Full cache refresh | 3-8s | All metrics |

---

## Environment Modes

Configured via Script Properties:

- **production** - Safety guards enabled, no test data generation
- **development** - Test data allowed, verbose logging
- **debug** - Extended logging, cache bypass option
