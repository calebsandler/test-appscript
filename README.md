# Rosewood Antiques v2

A modern inventory management system for antique dealers, built with Google Apps Script.

## Features

- **Inventory Management**: Track items with variants, bundles, categories, locations, and tags
- **Sales Tracking**: Record sales, generate weekly summaries, analyze performance
- **Customer Management**: Maintain customer records and purchase history
- **Dashboard Analytics**: Real-time health scoring, action items, and performance charts
- **Bulk Operations**: Batch updates, imports, exports with safety guards

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  Sidebar.html    │  Dialogs.html   │  SharedStyles/Scripts.html │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Main.gs (API)                             │
│            Menu handlers, API functions for frontend             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ InventoryService │ │   SalesService   │ │ CustomerService  │
│   Items CRUD     │ │   Sales CRUD     │ │  Customer CRUD   │
│   Variants       │ │   Weekly Agg     │ │  Stats tracking  │
│   Bundles        │ │   Analytics      │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                   │
          ▼                   ▼
┌──────────────────┐ ┌──────────────────┐
│ TaxonomyService  │ │ InventoryAnalyt- │
│  Categories      │ │  icsService      │
│  Locations       │ │  Health Score    │
│  Tags            │ │  Action Items    │
└──────────────────┘ └──────────────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DataService                                 │
│     Sheet operations, caching, pagination, batch operations      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    Config.gs     │ │     Utils.gs     │ │ DashboardCache-  │
│  Business rules  │ │   Validation     │ │   Service        │
│  Sheet defs      │ │   Formatting     │ │  Metric caching  │
│  Defaults        │ │   Helpers        │ │  TTL management  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## File Structure

| File | Description |
|------|-------------|
| `Config.gs` | Business rules, sheet definitions, validation constants |
| `Utils.gs` | Validation, date formatting, string helpers |
| `DataService.gs` | Core data layer with caching, pagination, batch ops |
| `DashboardCacheService.gs` | Pre-computed dashboard metrics with TTL |
| `InventoryService.gs` | Item CRUD, variants, bundles, dashboard stats |
| `TaxonomyService.gs` | Categories, locations, tags management |
| `InventoryAnalyticsService.gs` | Health scoring, aging analysis, action items |
| `SalesService.gs` | Sales transactions, weekly aggregation, analytics |
| `CustomerService.gs` | Customer CRUD and stats tracking |
| `BulkOperations.gs` | Batch updates, imports, exports with safety guards |
| `TestDataGenerator.gs` | Test data generation with production guards |
| `Main.gs` | Menu handlers and API functions for frontend |
| `Sidebar.html` | Main manager UI with event delegation |
| `Dialogs.html` | Modal dialogs for item/sale/customer creation |
| `SharedStyles.html` | Common CSS variables and styles |
| `SharedScripts.html` | Common JavaScript utilities |

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (for clasp CLI)
- [clasp](https://github.com/google/clasp) - Google Apps Script CLI

### Installation

1. Install clasp globally:
   ```bash
   npm install -g @google/clasp
   ```

2. Login to clasp:
   ```bash
   clasp login
   ```

3. Clone this repository or create a new Apps Script project:
   ```bash
   clasp create --type sheets --title "Rosewood Antiques"
   ```

4. Push the code to Apps Script:
   ```bash
   clasp push
   ```

5. Open the spreadsheet and run `onOpen()` to create the menu.

### Development

- **Push changes**: `clasp push`
- **Pull changes**: `clasp pull`
- **Watch mode**: `clasp push --watch`
- **Open in browser**: `clasp open`

## Configuration

Edit `Config.gs` to customize:

- **Business Rules**: Aging thresholds, margin targets, batch limits
- **Validation**: Max lengths, price limits, allowed values
- **Defaults**: Default status, condition, payment method
- **UI**: Sidebar width, dialog dimensions

## Key Design Patterns

### Service Layer
Each domain has a dedicated service (Inventory, Sales, Customer, Taxonomy) with clear responsibilities.

### N+1 Query Prevention
Uses `DataService.getByIds()` and `Utils.buildLookupMap()` to batch lookups instead of individual queries.

### Event Delegation
Frontend uses centralized event handlers with `data-action` attributes instead of inline onclick handlers.

### Centralized State
Frontend state managed via `AppState` and `DialogState` objects instead of scattered global variables.

### Production Safety Guards
- Environment mode checking prevents destructive operations in production
- Batch size limits on bulk operations
- Duplicate detection and validation
- Rollback tracking for error recovery

## Sheets Structure

The system creates these sheets automatically:

- **Inventory**: Item records with categories, pricing, quantities
- **Variants**: Size/color matrix variations of items
- **Bundles**: Item groupings with bundle pricing
- **Bundle_Items**: Bundle-to-item relationships
- **Categories**: Hierarchical category tree
- **Locations**: Storage locations with item counts
- **Tags**: Flexible tagging system
- **Item_Tags**: Item-to-tag relationships
- **Sales**: Transaction records
- **Weekly_Sales**: Aggregated weekly summaries
- **Customers**: Customer records with lifetime stats
- **Dashboard_Cache**: Pre-computed metrics with TTL

## License

Private project - All rights reserved.
