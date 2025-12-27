# Recommendations & Action Items

> **Priority Legend:**
> P0 = Critical (fix immediately)
> P1 = High (fix this sprint)
> P2 = Medium (plan for next sprint)
> P3 = Low (nice to have)

---

## Quick Wins (Low Effort, High Impact)

### 1. Use SharedStyles.html and SharedScripts.html Properly (P0)

**Current State:** These files exist but are NOT included in other HTML files.

**Fix:** Add includes to all HTML files:
```html
<!-- In Sidebar.html, ControlCenter.html, WebApp.html, Dialogs.html -->
<head>
  <?!= include('SharedStyles'); ?>
</head>
<body>
  <!-- ... content ... -->
  <?!= include('SharedScripts'); ?>
</body>
```

**Then:** Remove duplicated CSS `:root` blocks and JS utility functions from each file.

**Impact:** Eliminate ~2300 lines of duplication.

---

### 2. Add Missing Failure Handlers (P0)

**Files to fix:**
- `ControlCenter.html` - Lines 1843, 1857, 1893, 1909, 1964, 1979
- `WebApp.html` - Lines 2020, 2036, 2064, 2083

**Pattern:**
```javascript
google.script.run
  .withSuccessHandler(function(data) { /* ... */ })
  .withFailureHandler(handleError)  // ADD THIS
  .serverFunction();
```

---

### 3. Move Cache TTLs to Config (P1)

**Current:** Hardcoded in `DashboardCacheService.gs:17-26`
```javascript
const CACHE_TTL = {
  quick_stats: 120,
  today: 60,
  // ...
};
```

**Move to:** `Config.gs`
```javascript
PERFORMANCE: {
  CACHE_TTL: 300,
  CACHE_TTL_BY_CATEGORY: {
    quick_stats: 120,
    today: 60,
    health: 300,
    // ...
  }
}
```

---

## Performance Fixes

### 4. Fix N+1 in bulkAdjustPrice (P0)

**File:** `BulkOperations.gs:237-265`

**Current:**
```javascript
itemIds.forEach((id, index) => {
  const item = DataService.getById(CONFIG.SHEETS.INVENTORY, id);
  // ...
  DataService.update(CONFIG.SHEETS.INVENTORY, id, { Price: newPrice });
});
```

**Fix:**
```javascript
// Load all items at once
const itemsMap = DataService.getByIds(CONFIG.SHEETS.INVENTORY, itemIds);

// Prepare batch updates
const updates = [];
itemIds.forEach((id, index) => {
  const item = itemsMap[id];
  if (!item) return;

  const newPrice = calculateNewPrice(item.Price, adjustmentType, adjustmentValue);
  updates.push({ id, changes: { Price: newPrice } });
});

// Single batch update
DataService.batchUpdate(CONFIG.SHEETS.INVENTORY, updates);
```

---

### 5. Fix batchSetMetrics to Actually Batch (P1)

**File:** `DashboardCacheService.gs:270-272`

**Current:**
```javascript
updates.forEach(({ row, data }) => {
  sheet.getRange(row, 1, 1, data.length).setValues([data]);
});
```

**Fix:**
```javascript
// Group contiguous rows or write all at once
if (updates.length > 0) {
  const allData = updates.map(u => u.data);
  const startRow = Math.min(...updates.map(u => u.row));
  sheet.getRange(startRow, 1, allData.length, allData[0].length).setValues(allData);
}
```

---

### 6. Buffer Activity Log Writes (P1)

**File:** `DataService.gs:564-578`

**Add buffering:**
```javascript
const _logBuffer = [];
const LOG_BUFFER_SIZE = 50;

function logActivity(action, entityType, entityId, details) {
  _logBuffer.push([
    new Date(),
    action,
    entityType,
    entityId,
    JSON.stringify(details),
    Session.getActiveUser().getEmail()
  ]);

  if (_logBuffer.length >= LOG_BUFFER_SIZE) {
    flushActivityLog();
  }
}

function flushActivityLog() {
  if (_logBuffer.length === 0) return;

  const sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
  sheet.getRange(
    sheet.getLastRow() + 1,
    1,
    _logBuffer.length,
    _logBuffer[0].length
  ).setValues(_logBuffer);

  _logBuffer.length = 0;
}
```

---

### 7. Add Flush Points in Bulk Operations (P2)

**File:** `BulkOperations.gs`

```javascript
const FLUSH_INTERVAL = 50;

updates.forEach((update, index) => {
  // ... process update

  if ((index + 1) % FLUSH_INTERVAL === 0) {
    SpreadsheetApp.flush();
  }
});
```

---

## Architecture Improvements

### 8. Extract AccessControlService (P1)

**Create:** `AccessControlService.gs`

Move from Main.gs (lines 22-448):
- `ALLOWED_EMAILS` array
- `checkUserAccess()`
- `getAllowedUsers()` / `addAllowedUser()` / `removeAllowedUser()`
- `verifyPassphrase()` / `generateDailyPassphrase()`
- `getPassphraseSettings()` / `setPassphraseSettings()`

**Result:** Main.gs reduced from 1455 to ~1000 lines.

---

### 9. Standardize Error Handling (P2)

**Create consistent pattern:**

```javascript
// In Utils.gs
function wrapApiCall(operation, context) {
  try {
    const result = operation();
    return { success: true, data: result };
  } catch (error) {
    console.error(`[${context}] ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Usage in Main.gs
function getInventory(options) {
  return Utils.wrapApiCall(() => {
    return sanitizeForClient(InventoryService.getItems(options));
  }, 'getInventory');
}
```

---

### 10. Add Structured Logging (P2)

**Create:** Logger utility in Utils.gs

```javascript
const Logger = {
  _log: function(level, tag, message, data) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}][${level}][${tag}] ${message}`;

    if (data) {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](logEntry, data);
    } else {
      console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](logEntry);
    }
  },

  debug: function(tag, message, data) {
    if (CONFIG.ENVIRONMENT.DEBUG) {
      this._log('DEBUG', tag, message, data);
    }
  },

  info: function(tag, message, data) {
    this._log('INFO', tag, message, data);
  },

  warn: function(tag, message, data) {
    this._log('WARN', tag, message, data);
  },

  error: function(tag, message, error) {
    this._log('ERROR', tag, message, error);
  }
};
```

---

### 11. Break Up Complex Functions (P2)

**updateWeeklySales()** in SalesService.gs:

```javascript
// Before: 97-line monolith
function updateWeeklySales(weekId) { /* everything */ }

// After: Decomposed
function updateWeeklySales(weekId) {
  const sales = fetchWeekSales(weekId);
  const metrics = calculateWeeklyMetrics(sales);
  const topPerformers = findTopPerformers(sales);
  return upsertWeeklySummary(weekId, metrics, topPerformers);
}

function fetchWeekSales(weekId) { /* ... */ }
function calculateWeeklyMetrics(sales) { /* ... */ }
function findTopPerformers(sales) { /* ... */ }
function upsertWeeklySummary(weekId, metrics, topPerformers) { /* ... */ }
```

---

## Frontend Improvements

### 12. Consolidate Frontend State Management (P2)

Create a single state module used by all HTML files:

```javascript
// In SharedScripts.html
const AppState = {
  config: null,
  currentPanel: 'dashboard',
  isLoading: false,
  inventory: { items: [], page: 1, total: 0 },
  sales: { items: [], page: 1, total: 0 },
  customers: { items: [], page: 1, total: 0 },

  // State update method
  update: function(path, value) {
    // Update nested state and trigger re-render
  }
};
```

---

### 13. Add Request Cancellation (P2)

Prevent race conditions on panel switch:

```javascript
let activeRequests = {};

function cancelPendingRequest(key) {
  if (activeRequests[key]) {
    activeRequests[key].cancelled = true;
  }
}

function loadInventory() {
  cancelPendingRequest('inventory');

  const requestId = Date.now();
  activeRequests['inventory'] = { id: requestId, cancelled: false };

  google.script.run
    .withSuccessHandler(function(result) {
      if (activeRequests['inventory']?.id !== requestId) return;  // Cancelled
      renderInventory(result);
    })
    .withFailureHandler(handleError)
    .getInventory(options);
}
```

---

### 14. Add Form Validation (P3)

```javascript
function validateItemForm(form) {
  const errors = [];

  const price = parseFloat(form.elements['Price'].value);
  if (isNaN(price) || price < 0) {
    errors.push('Price must be a positive number');
  }

  const quantity = parseInt(form.elements['Quantity'].value);
  if (isNaN(quantity) || quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (errors.length > 0) {
    showToast(errors.join('; '), 'error');
    return false;
  }

  return true;
}
```

---

### 15. Add Accessibility Attributes (P3)

```html
<!-- Tab navigation -->
<button
  class="nav-tab"
  role="tab"
  aria-selected="true"
  aria-controls="dashboard-panel"
  data-panel="dashboard">
  Dashboard
</button>

<!-- Form labels -->
<label for="item-name" class="form-label">Item Name *</label>
<input type="text" id="item-name" name="Name" required>
```

---

## Data Layer Improvements

### 16. Add Foreign Key Validation (P2)

```javascript
// In InventoryService.createItem()
function createItem(data) {
  // Validate foreign keys exist
  if (data.Category_ID) {
    const category = DataService.getById(CONFIG.SHEETS.CATEGORIES, data.Category_ID);
    if (!category) {
      throw new Error(`Invalid Category_ID: ${data.Category_ID}`);
    }
  }

  if (data.Location_ID) {
    const location = DataService.getById(CONFIG.SHEETS.LOCATIONS, data.Location_ID);
    if (!location) {
      throw new Error(`Invalid Location_ID: ${data.Location_ID}`);
    }
  }

  // ... proceed with insert
}
```

---

### 17. Use Named Ranges for Dropdowns (P3)

Create named ranges for validation data sources:
- `Categories_List` - Category names for dropdowns
- `Locations_List` - Location names for dropdowns
- `Statuses_List` - Valid status values

---

## Action Item Summary

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Use SharedStyles/SharedScripts includes | Low | High |
| P0 | Add missing failure handlers | Low | High |
| P0 | Fix N+1 in bulkAdjustPrice | Medium | High |
| P1 | Move cache TTLs to Config | Low | Medium |
| P1 | Fix batchSetMetrics batching | Medium | High |
| P1 | Buffer activity log writes | Medium | High |
| P1 | Extract AccessControlService | Medium | High |
| P2 | Add flush points in bulk ops | Low | Medium |
| P2 | Standardize error handling | Medium | Medium |
| P2 | Add structured logging | Medium | Medium |
| P2 | Break up complex functions | High | Medium |
| P2 | Consolidate frontend state | High | Medium |
| P2 | Add request cancellation | Medium | Medium |
| P2 | Add foreign key validation | Medium | Medium |
| P3 | Add form validation | Low | Low |
| P3 | Add accessibility attributes | Medium | Low |
| P3 | Use named ranges | Low | Low |

---

## Google Apps Script Best Practices Reference

Based on [official Google documentation](https://developers.google.com/apps-script/guides/support/best-practices):

### Performance
1. **Batch operations** - Read/write in bulk, not row by row
2. **Minimize API calls** - Combine reads, cache results
3. **Use getDataRange()** - More efficient than getRange(1,1,lastRow,lastCol)
4. **Avoid loops over ranges** - Read to array, process, write back

### Code Organization
1. **Libraries sparingly** - Performance overhead on each call
2. **Dedicated script files** - Separate HTML/JS from server code
3. **Frozen config objects** - Prevent accidental mutation

### Triggers
1. **Time-driven for background work** - Cache refresh, cleanup
2. **Installable triggers** - More reliable than simple triggers
3. **Avoid rapid-fire triggers** - Throttle to prevent quota issues

### Security
1. **Use PropertiesService** - Never hardcode secrets
2. **Validate all inputs** - Especially from web app forms
3. **Principle of least privilege** - Request minimal OAuth scopes
