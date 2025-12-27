# Rosewood Antiques v2 - Architecture Documentation

> **Last Updated:** December 2024 (Post-Refactoring)
> **Version:** 2.1.0
> **Runtime:** Google Apps Script V8
> **Timezone:** America/New_York
> **Refactoring Status:** Complete (P0-P3)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Layer Deep Dive](#layer-deep-dive)
- [Data Flow Patterns](#data-flow-patterns)
- [Design Patterns](#design-patterns)
- [Service Dependencies](#service-dependencies)
- [Access Control](#access-control)
- [Caching Strategy](#caching-strategy)
- [Performance Optimizations](#performance-optimizations)

---

## Overview

This is a **container-bound** Google Apps Script application for antique inventory management. It operates as both a spreadsheet add-on (sidebar/dialogs) and a standalone web app.

### Technology Stack

```mermaid
graph LR
    subgraph "Frontend"
        HTML[HTML5]
        CSS[CSS3]
        JS[JavaScript ES6]
    end

    subgraph "Backend"
        GAS[Google Apps Script V8]
    end

    subgraph "Storage"
        SHEETS[(Google Sheets)]
        CACHE[(CacheService)]
        PROPS[(PropertiesService)]
    end

    subgraph "APIs"
        SHEETS_API[Sheets API v4]
        SESSION[Session API]
    end

    HTML & CSS & JS --> GAS
    GAS --> SHEETS & CACHE & PROPS
    GAS --> SHEETS_API & SESSION
```

---

## System Architecture

### Complete System Diagram

```mermaid
graph TB
    subgraph "🖥️ Client Layer"
        direction TB
        WA["<b>WebApp.html</b><br/>━━━━━━━━━━━━<br/>Standalone Web App<br/>Full viewport interface"]
        SB["<b>Sidebar.html</b><br/>━━━━━━━━━━━━<br/>Sheets Sidebar<br/>420px panel"]
        CC["<b>ControlCenter.html</b><br/>━━━━━━━━━━━━<br/>Full Modal<br/>1200x800 dialog"]
        DL["<b>Dialogs.html</b><br/>━━━━━━━━━━━━<br/>CRUD Forms<br/>550x650 modals"]
    end

    subgraph "🎨 Shared Resources"
        SS["SharedStyles.html<br/>CSS Design System"]
        SC["SharedScripts.html<br/>JS Utilities"]
    end

    subgraph "🔌 API Layer"
        MN["<b>Main.gs</b><br/>━━━━━━━━━━━━<br/>• doGet() entry point<br/>• Menu handlers<br/>• 40+ API functions<br/>• Response sanitization"]
    end

    subgraph "🔒 Security Layer"
        AC["<b>AccessControlService.gs</b><br/>━━━━━━━━━━━━<br/>• Owner detection<br/>• Domain whitelist<br/>• Passphrase auth<br/>• Session management"]
    end

    subgraph "💼 Business Layer"
        IS["<b>InventoryService</b><br/>Items, Variants, Bundles"]
        SS2["<b>SalesService</b><br/>Transactions, Weekly Agg"]
        CS["<b>CustomerService</b><br/>Customer CRUD"]
        TS["<b>TaxonomyService</b><br/>Categories, Locations, Tags"]
        IA["<b>InventoryAnalyticsService</b><br/>Health Score, Actions"]
        BO["<b>BulkOperations</b><br/>Batch Ops, CSV I/O"]
    end

    subgraph "💾 Data Layer"
        DS["<b>DataService.gs</b><br/>━━━━━━━━━━━━<br/>• CRUD operations<br/>• Batch processing<br/>• Cache management<br/>• Activity logging"]
        DC["<b>DashboardCacheService</b><br/>━━━━━━━━━━━━<br/>• Metric caching<br/>• TTL management<br/>• Batch refresh"]
    end

    subgraph "⚙️ Foundation Layer"
        CF["<b>Config.gs</b><br/>Business Rules & Constants"]
        UT["<b>Utils.gs</b><br/>Validation & Helpers"]
    end

    subgraph "📄 Persistence Layer"
        SH[("Google Sheets<br/>14 Sheets")]
        CA[("CacheService<br/>5-minute TTL")]
        PR[("PropertiesService<br/>Settings")]
    end

    %% Connections
    WA & SB & CC & DL -.->|include| SS & SC
    WA & SB & CC & DL -->|google.script.run| MN
    MN --> AC
    MN --> IS & SS2 & CS & TS & IA & BO
    IS & SS2 & CS --> DS
    TS & IA & BO --> DS
    DS <--> DC
    DS --> SH
    DS --> CA
    AC --> PR
    IS & SS2 & CS & TS & IA & BO -.-> CF & UT

    %% Styling
    classDef client fill:#e3f2fd,stroke:#1976d2
    classDef api fill:#fff3e0,stroke:#f57c00
    classDef service fill:#e8f5e9,stroke:#388e3c
    classDef data fill:#fce4ec,stroke:#c2185b
    classDef foundation fill:#f3e5f5,stroke:#7b1fa2

    class WA,SB,CC,DL client
    class MN api
    class IS,SS2,CS,TS,IA,BO service
    class DS,DC data
    class CF,UT foundation
```

---

## Layer Deep Dive

### 1. Client Layer

```mermaid
graph TB
    subgraph "Entry Points"
        WEB[doGet - Web App]
        MENU[onOpen - Sheets Menu]
    end

    subgraph "UI Components"
        WA[WebApp.html]
        SB[Sidebar.html]
        CC[ControlCenter.html]
        DL[Dialogs.html]
    end

    subgraph "Shared"
        STYLES[SharedStyles.html]
        SCRIPTS[SharedScripts.html]
    end

    WEB --> WA
    MENU --> SB
    MENU --> CC
    MENU --> DL

    WA & SB & CC & DL --> STYLES
    WA & SB & CC & DL --> SCRIPTS
```

#### UI File Details

| File | Purpose | Size | Key Features |
|------|---------|------|--------------|
| **WebApp.html** | Standalone app | ~3,100 lines | Full dashboard, inventory, sales panels |
| **Sidebar.html** | Sheets sidebar | ~2,540 lines | Compact 5-panel interface |
| **ControlCenter.html** | Enhanced modal | ~3,125 lines | Admin settings, bulk operations |
| **Dialogs.html** | CRUD forms | ~1,005 lines | Add Item, Record Sale, Add Customer |
| **SharedStyles.html** | CSS system | ~335 lines | Design tokens, component styles |
| **SharedScripts.html** | JS utilities | ~110 lines | formatNumber, escapeHtml, etc. |

### 2. API Layer (Main.gs)

```mermaid
flowchart LR
    subgraph "Request Flow"
        REQ[Request] --> WRAP[wrapApiCall]
        WRAP --> SVC[Service Call]
        SVC --> SAN[sanitizeForClient]
        SAN --> RES[Response]
    end

    subgraph "Response Types"
        SUCCESS["{success: true, data: ...}"]
        ERROR["{success: false, error: ...}"]
    end

    RES --> SUCCESS
    RES --> ERROR
```

#### API Categories

| Category | Functions | Examples |
|----------|-----------|----------|
| **Dashboard** | 7 | getDashboardV2, getQuickStats, getChartData |
| **Inventory** | 8 | getInventory, createItem, updateItem, deleteItem |
| **Sales** | 6 | getSales, recordSale, getWeeklySales |
| **Customers** | 4 | getCustomers, createCustomer |
| **Taxonomy** | 5 | getCategories, getLocations, getTags |
| **Bulk Ops** | 6 | bulkUpdateStatus, bulkMoveItems, exportCSV |
| **Access** | 8 | getCurrentUser, verifyPassphrase |

### 3. Business Layer

```mermaid
graph TB
    subgraph "Domain Services"
        IS[InventoryService]
        SS[SalesService]
        CS[CustomerService]
        TS[TaxonomyService]
    end

    subgraph "Cross-Cutting Services"
        IA[InventoryAnalyticsService]
        BO[BulkOperations]
        DC[DashboardCacheService]
    end

    IS --> TS
    SS --> IS
    SS --> CS
    IA --> IS
    IA --> SS
    BO --> IS
    BO --> SS
    DC --> IA
    DC --> SS
```

### 4. Data Layer

```mermaid
graph LR
    subgraph "DataService Operations"
        direction TB
        CRUD["CRUD<br/>getAll, getById, insert, update, remove"]
        BATCH["Batch<br/>batchInsert, batchUpdate, batchDelete"]
        QUERY["Query<br/>search, getPaginated, getStats"]
        CACHE["Cache<br/>getFromCache, setCache, invalidate"]
        LOG["Logging<br/>logActivity, flushActivityLog"]
    end

    subgraph "Storage"
        SHEETS[(Sheets)]
        CACHE_SVC[(CacheService)]
    end

    CRUD & BATCH & QUERY --> SHEETS
    CACHE --> CACHE_SVC
    LOG --> SHEETS
```

---

## Data Flow Patterns

### Dashboard Load Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant API as Main.gs
    participant DCS as DashboardCacheService
    participant DS as DataService
    participant SH as Sheets

    U->>UI: Open Dashboard
    UI->>API: getDashboardV2()

    API->>DCS: getMetricsByCategory("quick_stats")

    alt Cache Hit
        DCS-->>API: Cached metrics
        API-->>UI: Return cached data
    else Cache Miss
        DCS-->>API: null
        API->>DS: getAll(INVENTORY)
        DS->>SH: getDataRange()
        SH-->>DS: Raw data
        DS-->>API: Inventory items
        API->>API: computeFreshDashboard()
        API->>DCS: batchSetMetrics()
        DCS->>SH: setValues()
        API-->>UI: Fresh data
    end

    UI->>U: Render Dashboard
```

### Sale Recording Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Dialogs
    participant API as Main.gs
    participant SS as SalesService
    participant IS as InventoryService
    participant CS as CustomerService
    participant DS as DataService

    U->>UI: Submit Sale Form
    UI->>API: recordSale(data)

    API->>SS: recordSale(data)

    Note over SS: Validate FK references
    SS->>DS: getById(INVENTORY, itemId)
    SS->>DS: getById(CUSTOMERS, customerId)

    SS->>DS: insert(SALES, saleData)
    DS-->>SS: Sale_ID

    SS->>SS: updateInventoryAfterSale()
    SS->>DS: update(INVENTORY, {Quantity: newQty})

    SS->>CS: updateCustomerStats()
    CS->>DS: update(CUSTOMERS, {Total_Purchases})

    SS->>SS: updateWeeklySales(weekId)

    SS-->>API: Sale result
    API-->>UI: Success response
    UI-->>U: Show confirmation
```

### Bulk Operation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as ControlCenter
    participant API as Main.gs
    participant BO as BulkOperations
    participant DS as DataService
    participant SH as Sheets

    U->>UI: Select items & action
    UI->>API: bulkUpdateStatus(ids, status)

    API->>BO: bulkUpdateField(ids, "Status", status)

    Note over BO: Batch load all items
    BO->>DS: getByIds(INVENTORY, ids)
    DS->>SH: getDataRange()
    SH-->>DS: All data
    DS-->>BO: Items map

    loop Every 50 items
        BO->>DS: update(item)
        DS->>SH: setValues()
        BO->>BO: SpreadsheetApp.flush()
    end

    BO-->>API: {success: [], errors: []}
    API-->>UI: Results
    UI-->>U: Show summary
```

---

## Design Patterns

### 1. IIFE Module Pattern

```mermaid
graph TB
    subgraph "Module Structure"
        IIFE["(function() { ... })()"]
        PRIVATE["Private State & Functions"]
        PUBLIC["Public API Object"]
        FREEZE["Object.freeze()"]
    end

    IIFE --> PRIVATE
    PRIVATE --> PUBLIC
    PUBLIC --> FREEZE
```

```javascript
const ServiceName = (function() {
  // Private state
  let cache = {};

  // Private functions
  function helper() { /* ... */ }

  // Public API
  return Object.freeze({
    publicMethod: function() { /* ... */ }
  });
})();
```

### 2. Standardized Error Handling

```mermaid
graph TB
    subgraph "Error Flow"
        API[API Function]
        WRAP[Utils.wrapApiCall]
        TRY[Try Block]
        CATCH[Catch Block]
        SUCCESS[Success Response]
        ERROR[Error Response]
    end

    API --> WRAP
    WRAP --> TRY
    TRY -->|Success| SUCCESS
    TRY -->|Exception| CATCH
    CATCH --> ERROR
```

### 3. Cache-First Strategy

```mermaid
flowchart TD
    REQ[Request Data] --> CHECK{Cache Valid?}
    CHECK -->|Yes| HIT[Return Cached]
    CHECK -->|No| MISS[Fetch Fresh]
    MISS --> STORE[Update Cache]
    STORE --> RETURN[Return Data]
    HIT --> RETURN
```

### 4. Event Delegation

```mermaid
graph LR
    subgraph "DOM Events"
        BODY[document.body]
        CLICK[Click Event]
        ACTION[data-action attribute]
        HANDLER[Action Handler]
    end

    BODY -->|addEventListener| CLICK
    CLICK -->|e.target.dataset.action| ACTION
    ACTION -->|handlers[action]| HANDLER
```

### 5. Request Cancellation

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Frontend
    participant V as Version Counter
    participant API as Server

    U->>UI: Click Tab A
    UI->>V: ++requestVersion (v1)
    UI->>API: getData() [v1]

    U->>UI: Click Tab B (before response)
    UI->>V: ++requestVersion (v2)
    UI->>API: getData() [v2]

    API-->>UI: Response [v1]
    UI->>V: Check version
    Note over UI: v1 !== v2, discard

    API-->>UI: Response [v2]
    UI->>V: Check version
    Note over UI: v2 === v2, render
```

### 6. N+1 Query Prevention

```mermaid
graph TB
    subgraph "❌ Anti-Pattern: N+1"
        LOOP1[Loop 100 items]
        Q1[Query 1]
        Q2[Query 2]
        QN[Query 100]
        LOOP1 --> Q1 & Q2 & QN
    end

    subgraph "✅ Pattern: Lookup Map"
        BATCH[Batch Load All]
        MAP[Build Lookup Map]
        LOOP2[Loop with O(1) Lookup]
        BATCH --> MAP --> LOOP2
    end
```

---

## Service Dependencies

### Dependency Graph

```mermaid
graph BT
    subgraph "Foundation"
        CONFIG[Config.gs]
        UTILS[Utils.gs]
    end

    subgraph "Data"
        DS[DataService.gs]
        DCS[DashboardCacheService.gs]
    end

    subgraph "Domain"
        IS[InventoryService]
        SS[SalesService]
        CS[CustomerService]
        TS[TaxonomyService]
        IA[InventoryAnalyticsService]
    end

    subgraph "Cross-Cutting"
        BO[BulkOperations]
        AC[AccessControlService]
    end

    subgraph "API"
        MAIN[Main.gs]
    end

    DS --> CONFIG & UTILS
    DCS --> DS
    IS & SS & CS & TS --> DS
    IA --> IS & SS
    BO --> IS & SS & DS
    AC --> CONFIG
    MAIN --> IS & SS & CS & TS & IA & BO & AC & DCS
```

### Service Responsibilities

```mermaid
mindmap
  root((Services))
    InventoryService
      Item CRUD
      Variant Management
      Bundle Management
      Dashboard Stats
    SalesService
      Transaction Recording
      Weekly Aggregation
      Sales Analytics
      Customer History
    CustomerService
      Customer CRUD
      Stats Tracking
    TaxonomyService
      Categories
      Locations
      Tags
    InventoryAnalyticsService
      Health Score
      Aging Analysis
      Action Items
    BulkOperations
      Batch CRUD
      CSV Import/Export
      Price Adjustments
```

---

## Access Control

### Authentication Flow

```mermaid
flowchart TD
    START([User Access]) --> GET_USER[Get Active User Email]
    GET_USER --> CHECK_OWNER{Is Script Owner?}

    CHECK_OWNER -->|Yes| ADMIN[Grant Admin Access]
    CHECK_OWNER -->|No| CHECK_DOMAIN{Is @calebsandler.com?}

    CHECK_DOMAIN -->|Yes| USER[Grant User Access]
    CHECK_DOMAIN -->|No| CHECK_SESSION{Valid Session?}

    CHECK_SESSION -->|Yes| USER
    CHECK_SESSION -->|No| PROMPT[Show Passphrase Prompt]

    PROMPT --> VERIFY{Verify Passphrase}
    VERIFY -->|Valid| CREATE[Create Session]
    CREATE --> USER
    VERIFY -->|Invalid| PROMPT

    ADMIN --> APP([Application])
    USER --> APP

    style ADMIN fill:#c8e6c9
    style USER fill:#c8e6c9
    style PROMPT fill:#fff9c4
```

### Passphrase Generation

```mermaid
flowchart LR
    subgraph "Static Mode"
        S1[Admin Sets] --> S2[Fixed Passphrase]
    end

    subgraph "Daily Mode"
        D1[Seed + Date] --> D2[Hash Function]
        D2 --> D3[Word + Number + Word]
    end

    S2 --> VERIFY[Verification]
    D3 --> VERIFY
```

---

## Caching Strategy

### Multi-Level Cache Architecture

```mermaid
graph TB
    subgraph "Level 1: Execution Memory"
        L1[Module Variables]
        L1TTL[TTL: 5 seconds]
    end

    subgraph "Level 2: CacheService"
        L2[Script Cache]
        L2TTL[TTL: 60-300 seconds]
    end

    subgraph "Level 3: Dashboard_Cache Sheet"
        L3[Persistent Cache]
        L3TTL[TTL: Configurable]
    end

    L1 --> L2 --> L3
```

### Cache TTL Configuration

```mermaid
pie title Cache TTL Distribution (seconds)
    "Quick Stats (120s)" : 120
    "Today Summary (60s)" : 60
    "Health Metrics (300s)" : 300
    "Chart Data (300s)" : 300
    "Recent Activity (60s)" : 60
```

| Category | TTL | Metrics |
|----------|-----|---------|
| **quick_stats** | 120s | total_items, available_count, total_value, weekly_revenue |
| **today** | 60s | today_revenue, today_items_sold, vs_last_week |
| **health** | 300s | health_score, turnover_rate, aging_count, margin |
| **charts** | 300s | category_performance, weekly_revenue_chart |
| **recent** | 60s | recent_sales, recent_items |
| **actions** | 300s | action_items JSON |

---

## Performance Optimizations

### Optimization Summary

```mermaid
graph LR
    subgraph "Before"
        B1[N+1 Queries]
        B2[Individual Writes]
        B3[No Buffering]
        B4[Long Locks]
    end

    subgraph "After"
        A1[Batch Lookups]
        A2[Batch Writes]
        A3[50-Entry Buffer]
        A4[Chunked Locks]
    end

    B1 -->|Fixed| A1
    B2 -->|Fixed| A2
    B3 -->|Fixed| A3
    B4 -->|Fixed| A4
```

### Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Dashboard (cached) | N/A | 50-200ms | Baseline |
| Dashboard (fresh) | 5-10s | 2-5s | 50% faster |
| Bulk delete (100) | 30s+ | 3-8s | 75% faster |
| Weekly rebuild | 60s+ | 3-8s | 85% faster |
| Activity logging | N ops | 1 op/50 | 98% fewer |

### Batch Processing Strategy

```mermaid
graph TB
    subgraph "Chunked Processing"
        INPUT[1000 Items]
        CHUNK1[Chunk 1: 50]
        CHUNK2[Chunk 2: 50]
        CHUNKN[Chunk 20: 50]
        FLUSH[SpreadsheetApp.flush]
    end

    INPUT --> CHUNK1
    CHUNK1 --> FLUSH
    FLUSH --> CHUNK2
    CHUNK2 --> FLUSH
    FLUSH --> CHUNKN
```

---

## OAuth Scopes

```mermaid
graph LR
    subgraph "Required Scopes"
        S1[spreadsheets<br/>Read/write sheets]
        S2[userinfo.email<br/>Get user email]
        S3[script.scriptapp<br/>Script execution]
        S4[script.container.ui<br/>Sidebar/dialogs]
    end
```

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

## Triggers

```mermaid
gantt
    title Trigger Schedule
    dateFormat  HH:mm
    axisFormat %H:%M

    section Time-Driven
    Cache Refresh (every 5 min) :crit, 00:00, 00:05
    Cache Refresh :crit, 00:05, 00:10
    Cache Refresh :crit, 00:10, 00:15

    section Event-Driven
    onOpen (menu creation) :done, 00:00, 00:01
```

| Trigger | Function | Frequency | Purpose |
|---------|----------|-----------|---------|
| Time-driven | `refreshDashboardCache` | Every 5 minutes | Keep cache warm |
| onOpen | Menu creation | On spreadsheet open | Create Rosewood menu |
| onInstall | Initial setup | On add-on install | First-time configuration |

---

## Refactoring Summary (December 2024)

### Phase Overview

```mermaid
timeline
    title Refactoring Phases

    Phase 0 (P0) : Critical Fixes
                 : SharedStyles/Scripts includes
                 : Missing failure handlers
                 : N+1 query fixes

    Phase 1 (P1) : Performance
                 : Cache TTL consolidation
                 : Batch writes
                 : Activity log buffering

    Phase 2 (P2) : Code Quality
                 : Error handling standardization
                 : Function decomposition
                 : FK validation

    Phase 3 (P3) : UX Improvements
                 : Accessibility (ARIA)
                 : Skeleton loaders
                 : Request cancellation
```

### Completion Status

| Phase | Priority | Items | Status |
|-------|----------|-------|--------|
| P0 | Critical | 4 | ✅ Complete |
| P1 | High | 6 | ✅ Complete |
| P2 | Medium | 10 | ✅ Complete |
| P3 | Low | 6 | ✅ Complete |
| **Total** | | **26** | **✅ All Complete** |
