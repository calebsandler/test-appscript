# Database Schema Documentation

> **Version:** 2.1.0
> **Last Updated:** December 2024
> **Storage:** Google Sheets (14 sheets)

---

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Sheet Definitions](#sheet-definitions)
- [Data Types & Validation](#data-types--validation)
- [Foreign Key Relationships](#foreign-key-relationships)
- [Business Rules](#business-rules)
- [ID Generation](#id-generation)

---

## Overview

The Rosewood Antiques system uses Google Sheets as its database, with 14 sheets organized into logical domains.

### Sheet Categories

```mermaid
mindmap
  root((Sheets))
    Core Entities
      Inventory
      Variants
      Bundles
      Bundle_Items
    Taxonomy
      Categories
      Locations
      Tags
      Item_Tags
    Transactions
      Sales
      Weekly_Sales
      Customers
    System
      Settings
      Activity_Log
      Dashboard_Cache
```

---

## Entity Relationship Diagram

### Complete ER Diagram

```mermaid
erDiagram
    INVENTORY ||--o{ VARIANTS : "has variants"
    INVENTORY ||--o{ ITEM_TAGS : "tagged with"
    INVENTORY ||--o{ BUNDLE_ITEMS : "included in"
    INVENTORY ||--o{ SALES : "sold as"
    INVENTORY }o--|| CATEGORIES : "belongs to"
    INVENTORY }o--|| LOCATIONS : "stored in"
    INVENTORY }o--o| INVENTORY : "parent of"

    BUNDLES ||--o{ BUNDLE_ITEMS : "contains"
    BUNDLES ||--o{ SALES : "sold as"

    TAGS ||--o{ ITEM_TAGS : "applied to"

    CATEGORIES }o--o| CATEGORIES : "child of"

    CUSTOMERS ||--o{ SALES : "purchases"

    SALES }o--|| WEEKLY_SALES : "aggregated in"
    SALES }o--o| VARIANTS : "variant sold"

    INVENTORY {
        string Item_ID PK "INV-timestamp-random"
        string Name "Required, max 200 chars"
        string Description "max 2000 chars"
        string Category_ID FK "References Categories"
        string Parent_ID FK "Self-reference for hierarchical items"
        string SKU "Stock Keeping Unit"
        string Condition "Enum: Mint, Excellent, etc."
        string Era "Enum: Pre-1800, 1800-1850, etc."
        number Price "max 1,000,000"
        number Cost "max 1,000,000"
        number Quantity "max 100,000"
        string Location_ID FK "References Locations"
        string Status "Enum: Available, Sold, etc."
        datetime Date_Added "Auto-set on create"
        datetime Date_Modified "Auto-set on update"
        string Notes "max 5000 chars"
    }

    VARIANTS {
        string Variant_ID PK "VAR-timestamp-random"
        string Parent_Item_ID FK "Required, references Inventory"
        string Variant_Type "Enum: Size, Color, etc."
        string Variant_Value "e.g., Large, Red"
        string SKU_Suffix "Appended to parent SKU"
        number Price_Modifier "Added to parent price"
        number Quantity "Stock for this variant"
        string Status "Enum: Available, Sold, etc."
    }

    BUNDLES {
        string Bundle_ID PK "BND-timestamp-random"
        string Name "Bundle name"
        string Description "max 2000 chars"
        number Bundle_Price "Total bundle price"
        number Discount_Percent "Bundle discount"
        string Status "Enum: Available, Sold, etc."
        datetime Date_Created "Auto-set"
    }

    BUNDLE_ITEMS {
        string Bundle_ID FK "References Bundles"
        string Item_ID FK "References Inventory"
        number Quantity "Quantity in bundle"
    }

    CATEGORIES {
        string Category_ID PK "CAT-timestamp-random"
        string Name "Required, max 200 chars"
        string Parent_Category_ID FK "Self-reference for hierarchy"
        string Description "max 2000 chars"
        number Sort_Order "UI ordering"
    }

    LOCATIONS {
        string Location_ID PK "LOC-timestamp-random"
        string Name "Required, max 200 chars"
        string Description "max 2000 chars"
        number Capacity "max 9999"
        number Current_Count "Computed field"
    }

    TAGS {
        string Tag_ID PK "TAG-timestamp-random"
        string Name "Tag label"
        string Color "Hex color, default #00D9FF"
    }

    ITEM_TAGS {
        string Item_ID FK "References Inventory"
        string Tag_ID FK "References Tags"
    }

    SALES {
        string Sale_ID PK "SLE-timestamp-random"
        datetime Date "Transaction date"
        string Week_ID "YYYY-WNN format"
        string Customer_ID FK "References Customers"
        string Item_ID FK "References Inventory"
        string Variant_ID FK "References Variants"
        string Bundle_ID FK "References Bundles"
        number Quantity "Items sold"
        number Unit_Price "Price per item"
        number Total "Quantity * Unit_Price - Discount"
        string Payment_Method "Enum: Cash, Credit Card, etc."
        string Status "Enum: Completed, Pending, etc."
        string Notes "max 5000 chars"
    }

    WEEKLY_SALES {
        string Week_ID PK "YYYY-WNN format"
        date Week_Start "First day of week"
        date Week_End "Last day of week"
        number Total_Revenue "Sum of sales totals"
        number Total_Cost "Sum of item costs"
        number Gross_Profit "Revenue minus Cost"
        number Items_Sold "Total quantity"
        number Transactions "Number of sales"
        number Avg_Transaction "Revenue / Transactions"
        string Top_Category "Best selling category"
        string Top_Item "Best selling item"
    }

    CUSTOMERS {
        string Customer_ID PK "CUS-timestamp-random"
        string Name "Required, max 200 chars"
        string Email "Email address"
        string Phone "Phone number"
        string Address "max 2000 chars"
        string Preferred_Contact "Enum: Email, Phone"
        number Total_Purchases "Lifetime spend"
        datetime Last_Purchase "Most recent purchase"
        string Notes "max 5000 chars"
    }

    SETTINGS {
        string Key PK "Setting name"
        string Value "Setting value"
        string Description "Explanation"
    }

    ACTIVITY_LOG {
        datetime Timestamp "Auto-set"
        string Action "CREATE, UPDATE, DELETE, etc."
        string Entity_Type "Sheet name"
        string Entity_ID "Record ID"
        string Details "JSON of changes"
        string User "Email of user"
    }

    DASHBOARD_CACHE {
        string Metric_Key PK "Unique cache key"
        string Value "Cached value (JSON if object)"
        datetime Last_Updated "Cache timestamp"
        number Expiry_Seconds "TTL in seconds"
        string Category "Metric category"
    }
```

---

## Sheet Definitions

### Core Entities

#### Inventory Sheet

The primary entity storing all inventory items.

```mermaid
graph LR
    subgraph "Inventory Fields"
        PK[Item_ID<br/>Primary Key]
        REQ[Required<br/>Name]
        FK1[Category_ID<br/>Foreign Key]
        FK2[Location_ID<br/>Foreign Key]
        FK3[Parent_ID<br/>Self-Reference]
        ENUM[Enums<br/>Status, Condition, Era]
        NUM[Numbers<br/>Price, Cost, Quantity]
        META[Metadata<br/>Date_Added, Date_Modified]
    end
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Item_ID** | string | PK, Auto | Format: INV-{timestamp}-{random} |
| **Name** | string | Required, max 200 | Item name |
| **Description** | string | max 2000 | Detailed description |
| **Category_ID** | string | FK → Categories | Category reference |
| **Parent_ID** | string | FK → Inventory | For hierarchical items |
| **SKU** | string | - | Stock keeping unit |
| **Condition** | enum | Validation | Mint, Excellent, Very Good, Good, Fair, Poor, For Parts |
| **Era** | enum | Validation | Pre-1800, 1800-1850, 1850-1900, 1900-1950, 1950-1980, Modern |
| **Price** | number | max 1,000,000 | Selling price |
| **Cost** | number | max 1,000,000 | Acquisition cost |
| **Quantity** | number | max 100,000 | Stock quantity |
| **Location_ID** | string | FK → Locations | Storage location |
| **Status** | enum | Validation | Available, Reserved, Sold, On Hold, Damaged, Archived |
| **Date_Added** | datetime | Auto | Creation timestamp |
| **Date_Modified** | datetime | Auto | Last update timestamp |
| **Notes** | string | max 5000 | Additional notes |

#### Variants Sheet

Size/color/material variations of inventory items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Variant_ID** | string | PK, Auto | Format: VAR-{timestamp}-{random} |
| **Parent_Item_ID** | string | FK → Inventory, Required | Parent item |
| **Variant_Type** | enum | Validation | Size, Color, Material, Finish, Style |
| **Variant_Value** | string | - | Specific value (e.g., "Large", "Red") |
| **SKU_Suffix** | string | - | Appended to parent SKU |
| **Price_Modifier** | number | - | Added to parent price |
| **Quantity** | number | max 100,000 | Stock for variant |
| **Status** | enum | Validation | Available, Reserved, Sold, etc. |

#### Bundles & Bundle_Items

Product bundles (kits, sets) with component items.

**Bundles:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Bundle_ID** | string | PK, Auto | Format: BND-{timestamp}-{random} |
| **Name** | string | Required | Bundle name |
| **Description** | string | max 2000 | Bundle description |
| **Bundle_Price** | number | - | Total bundle price |
| **Discount_Percent** | number | 0-100 | Bundle discount |
| **Status** | enum | Validation | Available, Sold, etc. |
| **Date_Created** | datetime | Auto | Creation timestamp |

**Bundle_Items (Junction Table):**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Bundle_ID** | string | FK → Bundles | Bundle reference |
| **Item_ID** | string | FK → Inventory | Item reference |
| **Quantity** | number | Positive int | Quantity in bundle |

---

### Taxonomy

#### Categories Sheet (Hierarchical)

```mermaid
graph TD
    ROOT[Root Categories]

    subgraph "Furniture"
        F[Furniture]
        F1[Seating]
        F2[Tables]
        F3[Storage]
        F --> F1 & F2 & F3
    end

    subgraph "Decorative Arts"
        D[Decorative Arts]
        D1[Ceramics]
        D2[Glass]
        D3[Metalwork]
        D --> D1 & D2 & D3
    end

    ROOT --> F & D
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Category_ID** | string | PK, Auto | Format: CAT-{timestamp}-{random} |
| **Name** | string | Required, max 200 | Category name |
| **Parent_Category_ID** | string | FK → Categories | Parent for hierarchy |
| **Description** | string | max 2000 | Category description |
| **Sort_Order** | number | Positive int | UI display order |

#### Locations Sheet

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Location_ID** | string | PK, Auto | Format: LOC-{timestamp}-{random} |
| **Name** | string | Required, max 200 | Location name |
| **Description** | string | max 2000 | Location details |
| **Capacity** | number | max 9999 | Maximum items |
| **Current_Count** | number | Computed | Items with Status=Available |

#### Tags & Item_Tags

**Tags:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Tag_ID** | string | PK, Auto | Format: TAG-{timestamp}-{random} |
| **Name** | string | Required | Tag label |
| **Color** | string | Hex color | Display color (default: #00D9FF) |

**Item_Tags (Many-to-Many Junction):**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Item_ID** | string | FK → Inventory | Item reference |
| **Tag_ID** | string | FK → Tags | Tag reference |

---

### Transactions

#### Sales Sheet

```mermaid
graph LR
    subgraph "Sale References"
        SALE[Sale]
        ITEM[Item_ID]
        VAR[Variant_ID]
        BUNDLE[Bundle_ID]
        CUST[Customer_ID]
        WEEK[Week_ID]
    end

    SALE --> ITEM & VAR & BUNDLE & CUST & WEEK

    style SALE fill:#e3f2fd
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Sale_ID** | string | PK, Auto | Format: SLE-{timestamp}-{random} |
| **Date** | datetime | Required | Transaction date |
| **Week_ID** | string | Computed | Format: YYYY-WNN |
| **Customer_ID** | string | FK → Customers | Customer reference |
| **Item_ID** | string | FK → Inventory | Item sold |
| **Variant_ID** | string | FK → Variants | Variant sold (optional) |
| **Bundle_ID** | string | FK → Bundles | Bundle sold (optional) |
| **Quantity** | number | Positive int | Quantity sold |
| **Unit_Price** | number | Positive | Price per unit |
| **Total** | number | Computed | Quantity × Unit_Price |
| **Payment_Method** | enum | Validation | Cash, Credit Card, Debit, Check, PayPal, Venmo, Other |
| **Status** | enum | Validation | Completed, Pending, Refunded, Cancelled |
| **Notes** | string | max 5000 | Transaction notes |

#### Weekly_Sales Sheet (Aggregation)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Week_ID** | string | PK | Format: YYYY-WNN (e.g., 2024-W52) |
| **Week_Start** | date | - | First day of week |
| **Week_End** | date | - | Last day of week |
| **Total_Revenue** | number | Computed | Sum of sale totals |
| **Total_Cost** | number | Computed | Sum of item costs |
| **Gross_Profit** | number | Computed | Revenue - Cost |
| **Items_Sold** | number | Computed | Total quantity |
| **Transactions** | number | Computed | Sale count |
| **Avg_Transaction** | number | Computed | Revenue / Transactions |
| **Top_Category** | string | Computed | Best selling category |
| **Top_Item** | string | Computed | Best selling item |

#### Customers Sheet

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| **Customer_ID** | string | PK, Auto | Format: CUS-{timestamp}-{random} |
| **Name** | string | Required, max 200 | Customer name |
| **Email** | string | - | Email address |
| **Phone** | string | - | Phone number |
| **Address** | string | max 2000 | Full address |
| **Preferred_Contact** | enum | Validation | Email, Phone |
| **Total_Purchases** | number | Computed | Lifetime spend |
| **Last_Purchase** | datetime | Computed | Most recent sale |
| **Notes** | string | max 5000 | Customer notes |

---

### System

#### Settings Sheet

| Column | Type | Description |
|--------|------|-------------|
| **Key** | string | Unique setting name |
| **Value** | string | Setting value |
| **Description** | string | Setting explanation |

#### Activity_Log Sheet

| Column | Type | Description |
|--------|------|-------------|
| **Timestamp** | datetime | Auto-set on entry |
| **Action** | string | CREATE, UPDATE, DELETE, BATCH_CREATE, etc. |
| **Entity_Type** | string | Sheet name being modified |
| **Entity_ID** | string | Record ID affected |
| **Details** | string | JSON of operation details |
| **User** | string | Email of user performing action |

#### Dashboard_Cache Sheet

| Column | Type | Description |
|--------|------|-------------|
| **Metric_Key** | string | Unique cache identifier |
| **Value** | string | Cached value (JSON for objects) |
| **Last_Updated** | datetime | Cache timestamp |
| **Expiry_Seconds** | number | TTL in seconds |
| **Category** | string | Metric grouping (quick_stats, health, etc.) |

---

## Data Types & Validation

### String Validation

```mermaid
graph LR
    INPUT[Input String]
    TRIM[Trim Whitespace]
    LIMIT[Apply Max Length]
    SANITIZE[Remove < and >]
    OUTPUT[Clean String]

    INPUT --> TRIM --> LIMIT --> SANITIZE --> OUTPUT
```

| Type | Max Length | Validation |
|------|------------|------------|
| Name | 200 | Required, sanitized |
| Description | 2,000 | Sanitized |
| Notes | 5,000 | Sanitized |
| SKU | 200 | Sanitized |

### Numeric Validation

| Type | Min | Max | Validation |
|------|-----|-----|------------|
| Price | 0 | 1,000,000 | Positive number |
| Cost | 0 | 1,000,000 | Positive number |
| Quantity | 0 | 100,000 | Positive integer |
| Capacity | 0 | 9,999 | Positive integer |

### Enum Values

```mermaid
graph TB
    subgraph "Item Status"
        S1[Available]
        S2[Reserved]
        S3[Sold]
        S4[On Hold]
        S5[Damaged]
        S6[Archived]
    end

    subgraph "Sale Status"
        SS1[Completed]
        SS2[Pending]
        SS3[Refunded]
        SS4[Cancelled]
    end

    subgraph "Condition"
        C1[Mint]
        C2[Excellent]
        C3[Very Good]
        C4[Good]
        C5[Fair]
        C6[Poor]
        C7[For Parts]
    end
```

---

## Foreign Key Relationships

### Relationship Map

```mermaid
graph TB
    subgraph "Primary Keys"
        INV_PK[Inventory.Item_ID]
        CAT_PK[Categories.Category_ID]
        LOC_PK[Locations.Location_ID]
        TAG_PK[Tags.Tag_ID]
        CUS_PK[Customers.Customer_ID]
        BND_PK[Bundles.Bundle_ID]
        VAR_PK[Variants.Variant_ID]
    end

    subgraph "Foreign Keys"
        INV_CAT[Inventory.Category_ID]
        INV_LOC[Inventory.Location_ID]
        INV_PAR[Inventory.Parent_ID]
        VAR_PAR[Variants.Parent_Item_ID]
        ITAG_I[Item_Tags.Item_ID]
        ITAG_T[Item_Tags.Tag_ID]
        BI_B[Bundle_Items.Bundle_ID]
        BI_I[Bundle_Items.Item_ID]
        SALE_I[Sales.Item_ID]
        SALE_V[Sales.Variant_ID]
        SALE_B[Sales.Bundle_ID]
        SALE_C[Sales.Customer_ID]
        CAT_P[Categories.Parent_Category_ID]
    end

    INV_CAT --> CAT_PK
    INV_LOC --> LOC_PK
    INV_PAR --> INV_PK
    VAR_PAR --> INV_PK
    ITAG_I --> INV_PK
    ITAG_T --> TAG_PK
    BI_B --> BND_PK
    BI_I --> INV_PK
    SALE_I --> INV_PK
    SALE_V --> VAR_PK
    SALE_B --> BND_PK
    SALE_C --> CUS_PK
    CAT_P --> CAT_PK
```

### Validation Rules

| Foreign Key | Validated On | Error Message |
|-------------|--------------|---------------|
| Inventory.Category_ID | createItem, updateItem | "Invalid Category_ID: {id}" |
| Inventory.Location_ID | createItem, updateItem | "Invalid Location_ID: {id}" |
| Inventory.Parent_ID | createItem | "Invalid Parent_ID: {id}" |
| Sales.Item_ID | recordSale | "Invalid Item_ID: {id}" |
| Sales.Customer_ID | recordSale | "Invalid Customer_ID: {id}" |
| Variants.Parent_Item_ID | addVariant | "Invalid Parent_Item_ID: {id}" |

---

## Business Rules

### Inventory Aging

```mermaid
graph LR
    subgraph "Age Buckets"
        FRESH[Fresh<br/>0-30 days]
        NORMAL[Normal<br/>31-90 days]
        AGING[Aging<br/>91-180 days]
        STALE[Stale<br/>181+ days]
    end

    FRESH -->|30 days| NORMAL
    NORMAL -->|90 days| AGING
    AGING -->|180 days| STALE

    style FRESH fill:#c8e6c9
    style NORMAL fill:#fff9c4
    style AGING fill:#ffe0b2
    style STALE fill:#ffcdd2
```

### Health Score Calculation

```mermaid
pie title Health Score Weights
    "Turnover Rate" : 25
    "Aging Analysis" : 30
    "Margin Analysis" : 25
    "Velocity" : 20
```

### Action Item Thresholds

| Alert Type | Criteria | Priority |
|------------|----------|----------|
| **Stale High-Value** | 180+ days AND Price ≥ $200 | High |
| **Aging Inventory** | 90+ days listed | Medium |
| **Slow Categories** | 5+ items, 0 sales in 90 days | Medium |
| **Low Margin** | Margin < 30% AND 60+ days | Low |

### Cascading Operations

```mermaid
flowchart TD
    DELETE_ITEM[Delete Item]

    DELETE_ITEM --> DEL_VARIANTS[Delete Variants]
    DELETE_ITEM --> DEL_TAGS[Delete Item_Tags]
    DELETE_ITEM --> CHECK_BUNDLES{In Bundles?}
    DELETE_ITEM --> UPDATE_LOC[Update Location Count]

    CHECK_BUNDLES -->|Yes| BLOCK[Block Hard Delete]
    CHECK_BUNDLES -->|No| ALLOW[Allow Delete]
```

---

## ID Generation

### Format

All auto-generated IDs follow this pattern:

```
{PREFIX}-{TIMESTAMP}-{RANDOM}
```

| Entity | Prefix | Example |
|--------|--------|---------|
| Inventory | INV | INV-1703894400000-abc123 |
| Variants | VAR | VAR-1703894400000-def456 |
| Bundles | BND | BND-1703894400000-ghi789 |
| Categories | CAT | CAT-1703894400000-jkl012 |
| Locations | LOC | LOC-1703894400000-mno345 |
| Tags | TAG | TAG-1703894400000-pqr678 |
| Sales | SLE | SLE-1703894400000-stu901 |
| Customers | CUS | CUS-1703894400000-vwx234 |

### Generation Code

```javascript
function generateId(prefix) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
```

---

## Computed Fields

### Location.Current_Count

Calculated as count of items where:
- `Location_ID` matches the location
- `Status` = "Available"

Updated on:
- Item creation
- Item deletion
- Item location change
- Item status change

### Customer.Total_Purchases

Sum of all `Sales.Total` where:
- `Customer_ID` matches the customer
- `Status` = "Completed"

Updated on:
- Sale creation
- Sale cancellation/refund

### Customer.Last_Purchase

Most recent `Sales.Date` where:
- `Customer_ID` matches the customer
- `Status` = "Completed"

### Weekly_Sales (All Fields)

Aggregated from Sales records:
- Grouped by `Week_ID`
- Filtered by `Status` = "Completed"
- Computed nightly or on-demand

---

## Index Strategy

While Google Sheets doesn't support traditional database indexes, the following optimization patterns are used:

### Lookup Maps

```javascript
// Build once, use many times
const itemsMap = Utils.buildLookupMap(items, 'Item_ID');

// O(1) lookup instead of O(n) filter
const item = itemsMap[itemId];
```

### Caching

```javascript
// Cache full sheet data with TTL
const cached = cache.get('RS_Inventory');
if (cached) return JSON.parse(cached);
```

### Pagination

```javascript
// Read only needed rows
const startRow = 2 + (page - 1) * pageSize;
sheet.getRange(startRow, 1, pageSize, cols).getValues();
```
