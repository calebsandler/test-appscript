# Rosewood Antiques v2 - Architecture Documentation

> **Last Updated:** December 2024 (Post-Refactoring)
> **Version:** 2.1.0
> **Runtime:** V8
> **Timezone:** America/New_York
> **Refactoring Status:** Complete (P0-P3)

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
│                       │                      │                          │
│  ✓ All use <?!= include('SharedStyles/Scripts') ?>                      │
│  ✓ ARIA accessibility attributes on all navigation                      │
│  ✓ Skeleton loaders for loading states                                  │
│  ✓ Request cancellation to prevent race conditions                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │ google.script.run
                              │ (all calls have .withFailureHandler)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Main.gs)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  • Web App Entry Points (doGet)                                         │
│  • Menu Handlers                                                         │
│  • UI Launchers (dialogs, sidebar)                                      │
│  • Frontend API Functions (wrapped with Utils.wrapApiCall)              │
│  • All responses use sanitizeForClient()                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       ACCESS CONTROL LAYER                              │
├─────────────────────────────────────────────────────────────────────────┤
│  AccessControlService.gs (NEW - extracted from Main.gs)                 │
│  • Owner check (script owner always has access)                         │
│  • Domain check (@calebsandler.com always allowed)                      │
│  • Passphrase system (static or daily rotating)                         │
│  • Session management with configurable expiry                          │
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
│ ✓ FK validation  │ ✓ FK validation  │                  │                │
├──────────────────┴──────────────────┴──────────────────┴────────────────┤
│ InventoryAnalyticsService  │  DashboardCacheService  │  BulkOperations  │
│ • calculateHealthScore      │  • getMetric/setMetric  │  • bulkCreate   │
│ • getAgingDistribution      │  • refreshAllMetrics    │  • bulkUpdate   │
│ • getActionItems           │  • batchSetMetrics      │  • CSV import   │
│                            │  ✓ Single setValues call │  ✓ Flush points │
│                            │  ✓ TTLs in Config.gs    │  ✓ No N+1 queries│
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
│  • Activity logging (✓ with buffering - flushes every 50 entries)       │
│  • ✓ Lock scope fixed - chunked processing with lock/unlock cycles      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION & UTILITIES                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Config.gs                    │           Utils.gs                       │
│  • Sheet definitions          │  • Validation functions                  │
│  • Enums (status, condition)  │  • Date utilities                        │
│  • UI tokens                  │  • Formatting helpers                    │
│  • Business rules             │  • Response builders                     │
│  • Performance settings       │  • Lookup map builders                   │
│  • ✓ Cache TTLs (moved here)  │  • ✓ wrapApiCall (standardized errors)  │
│                               │  • ✓ Logger utility (debug/info/warn/err)│
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

| File | Purpose | Post-Refactoring Changes |
|------|---------|--------------------------|
| `Main.gs` | Entry points, API functions | Reduced size, uses wrapApiCall, sanitizeForClient |
| `AccessControlService.gs` | **NEW** - Access control | Extracted from Main.gs, handles owner/domain/passphrase |
| `SalesService.gs` | Sales transactions and analytics | updateWeeklySales decomposed, FK validation |
| `BulkOperations.gs` | Batch operations, CSV import/export | Fixed N+1 queries, added flush points |
| `DataService.gs` | Low-level data access with caching | Activity log buffering, fixed lock scope |
| `InventoryService.gs` | Core inventory CRUD | Added FK validation for Category/Location |
| `DashboardCacheService.gs` | Pre-computed metrics caching | TTLs moved to Config, single setValues call |
| `Utils.gs` | Shared utilities | Added wrapApiCall, Logger utility |
| `Config.gs` | Central configuration | Added cache TTLs, performance settings |
| `InventoryAnalyticsService.gs` | Health scoring and analytics | Decomposed refreshAllMetrics |
| `TaxonomyService.gs` | Categories, locations, tags | No changes |
| `CustomerService.gs` | Customer management | No changes |
| `TestDataGenerator.gs` | Test data generation with guards | No changes |

### Client-Side Files (.html)

| File | Purpose | Post-Refactoring Changes |
|------|---------|--------------------------|
| `WebApp.html` | Standalone web application | SharedStyles/Scripts includes, ARIA, skeletons, request cancellation |
| `ControlCenter.html` | Full-viewport control center modal | Same as above, plus passphrase settings UI |
| `Sidebar.html` | Google Sheets sidebar panel | Same as above |
| `Dialogs.html` | Modal dialogs (Add Item/Sale/Customer) | Form labels with for/id, client-side validation |
| `SharedStyles.html` | Common CSS variables and styles | Canonical source, included by all files |
| `SharedScripts.html` | Common JavaScript utilities | Canonical source, included by all files |

---

## Dependency Graph

```
                                    ┌─────────────┐
                                    │   CONFIG    │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │    Utils    │
                                    │ (wrapApiCall│
                                    │  Logger)    │
                                    └──────┬──────┘
                                           │
                                    ┌──────▼──────┐
                                    │ DataService │
                                    │ (buffered   │
                                    │  logging)   │
                                    └──────┬──────┘
                                           │
        ┌──────────────┬───────────────────┼───────────────────┬──────────────┐
        │              │                   │                   │              │
        ▼              ▼                   ▼                   ▼              ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ ┌─────────────────────┐
│InventoryServ │ │ TaxonomyServ  │ │ CustomerServ  │ │ DashboardCa- │ │ AccessControlServ   │
│ (FK valid.)  │ │               │ │               │ │ cheService   │ │ (NEW)               │
└───────┬───────┘ └───────────────┘ └───────────────┘ └──────────────┘ └─────────────────────┘
        │
        │
┌───────▼───────────────┐
│InventoryAnalyticsServ │
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│     SalesService      │ ──────► CustomerService (for stats updates)
│   (FK validation)     │
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│   BulkOperations      │ ──────► InventoryService, SalesService
│ (no N+1, flush pts)   │
└───────┬───────────────┘
        │
┌───────▼───────────────┐
│       Main.gs         │ ──────► All Services (API layer)
│  (wrapApiCall,        │ ──────► AccessControlService
│   sanitizeForClient)  │
└───────────────────────┘
```

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
  VALIDATION: { /* max lengths, limits */ },
  PERFORMANCE: { /* cache TTLs, batch sizes */ }  // NEW
};
Object.freeze(CONFIG);
```

### 3. Standardized Error Handling (NEW)
All API functions use consistent error wrapping:
```javascript
function getInventory(options) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.getItems(options));
  }, 'getInventory');
}
```

### 4. Cache-First Strategy
Dashboard data served from cache with TTL, background refresh via triggers:
```javascript
const cached = DashboardCacheService.getMetric('quick_stats');
if (cached && !needsRefresh(cached)) {
  return cached;
}
// Compute fresh and cache
```

### 5. Event Delegation (Frontend)
Centralized event handling using data-action attributes:
```javascript
document.body.addEventListener('click', function(e) {
  const action = e.target.dataset.action;
  if (handlers[action]) handlers[action](e);
});
```

### 6. Request Cancellation (NEW)
Prevents race conditions when switching panels:
```javascript
var requestVersion = ++State.requestVersions.dashboard;
google.script.run
  .withSuccessHandler(function(data) {
    if (requestVersion !== State.requestVersions.dashboard) return; // Stale
    renderDashboard(data);
  })
  .getDashboardV2();
```

### 7. N+1 Query Prevention
Uses lookup maps and batch fetching:
```javascript
const itemsMap = Utils.buildLookupMap(items, 'Item_ID');
sales.forEach(sale => {
  sale.Item_Name = itemsMap[sale.Item_ID]?.Name || 'Unknown';
});
```

---

## Access Control

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Access Request                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Is script     │ Yes
                    │ owner?        │────────────────────┐
                    └───────┬───────┘                    │
                            │ No                         │
                            ▼                            │
                    ┌───────────────┐                    │
                    │ @calebsandler │ Yes                │
                    │ .com domain?  │────────────────────┤
                    └───────┬───────┘                    │
                            │ No                         │
                            ▼                            │
                    ┌───────────────┐                    │
                    │ Valid         │ Yes                │
                    │ passphrase?   │────────────────────┤
                    └───────┬───────┘                    │
                            │ No                         ▼
                            ▼                     ┌─────────────┐
                    ┌───────────────┐             │ ACCESS      │
                    │ Show          │             │ GRANTED     │
                    │ passphrase    │             └─────────────┘
                    │ prompt        │
                    └───────────────┘
```

### Passphrase Modes
1. **Static** - Admin sets a fixed passphrase
2. **Daily** - Auto-generated from seed + date (rotates daily)

### Web App Deployment
- **Execute as:** Deploying user (script owner)
- **Access:** Anyone (with owner/domain check or passphrase)

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
| Bulk operation (100 items) | 3-8s | Optimized batch processing |
| Full cache refresh | 3-8s | All metrics |

---

## Refactoring Summary (December 2024)

### Phase 0 (P0) - Critical Fixes
- [x] SharedStyles/SharedScripts includes in all HTML files
- [x] Removed ~2300 lines of duplicated CSS/JS
- [x] Added missing .withFailureHandler() calls
- [x] Fixed N+1 queries in BulkOperations.gs

### Phase 1 (P1) - Performance
- [x] Moved cache TTLs to Config.gs
- [x] Fixed batchSetMetrics to use single setValues call
- [x] Added activity log buffering (50 entry buffer)
- [x] Extracted AccessControlService.gs from Main.gs
- [x] Added SpreadsheetApp.flush() points in bulk ops
- [x] Fixed lock scope in batchUpdate (chunked processing)

### Phase 2 (P2) - Code Quality
- [x] Created Utils.wrapApiCall() for standardized errors
- [x] Applied wrapApiCall to all Main.gs API functions
- [x] Created Logger utility in Utils.gs
- [x] Added sanitizeForClient() to all API responses
- [x] Decomposed updateWeeklySales(), getDashboardV2(), refreshAllMetrics()
- [x] Added FK validation to createItem() and recordSale()
- [x] Optimized rebuildAllWeeklySales (single load, group in memory)

### Phase 3 (P3) - UX Improvements
- [x] Added ARIA attributes to navigation tabs
- [x] Associated form labels with inputs via for/id
- [x] Added client-side form validation
- [x] Added skeleton loaders to ControlCenter and WebApp
- [x] Simplified access control (owner + domain + passphrase)
- [x] Added request cancellation pattern for panel switches
