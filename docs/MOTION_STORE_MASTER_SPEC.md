# MOTION STORE — MASTER SPECIFICATION

Version: 1.0.0
Status: Approved Business Foundation

## 1. PRODUCT

Motion Store is a multi-tenant retail ERP/POS platform.

First customer:
Jacky Store

Motion Store is the product/SaaS brand.
Jacky Store is the first customer/tenant.

Customer-specific information such as company name, logo, address, tax data, reports and invoices must be configurable and must never be hard-coded.

## 2. MULTI-TENANT ARCHITECTURE

The system must be multi-tenant from day one.

Conceptual structure:

Tenant
  └── Companies
       └── Branches
            ├── Warehouses
            ├── Stores
            └── POS Terminals

Tenant data must be isolated.

Jacky Store must not be hard-coded into business logic.

The architecture must support future customers, companies, branches, warehouses, stores, POS terminals and users.

## 3. COMPANY PROFILE

Each company must support configurable:

- Arabic name
- English name
- Trade name
- Logo
- Address
- Country
- Governorate
- City
- Phone
- Email
- Tax number
- Commercial registration
- Currency
- Invoice settings
- Report settings
- Contact information

Company information must appear on applicable reports, invoices and receipts.

## 4. USERS AND PERMISSIONS

Initial conceptual roles:

- Owner
- General Manager
- Accountant
- Store Manager
- Warehouse User
- Cashier
- Auditor

Authorization must be permission-based rather than relying only on role names.

Sensitive operations must require explicit permissions.

Examples:

- sales.create
- sales.return
- sales.discount
- sales.price_override
- purchases.create
- purchases.approve
- inventory.transfer
- inventory.adjust
- inventory.count
- inventory.waste
- accounting.journal.create
- accounting.journal.post
- reports.sales
- reports.inventory
- reports.accounting
- reports.audit

## 5. PRODUCT MODEL

The system must NOT require a separate SKU for every individual clothing piece.

The initial conceptual product model is:

Product
Category
Season
Grade / Quality
Optional Brand

Examples:

- Trousers
- Blouses
- Jackets
- Bags
- Shoes
- Perfumes

Product is separate from Inventory Lot.

## 6. INVENTORY LOT

An Inventory Lot represents a specific received inventory source.

Example:

Product:
Trousers

Lot:
- Supplier X
- Bale
- Summer
- 50 KG
- Purchase cost EGP 5,000

Another lot may have a different supplier, season, quantity, weight and cost.

Lot-level traceability must be preserved.

## 7. BALES

A bale is a received clothing unit/container containing mixed clothing items.

A bale may contain:

- Bale number
- Supplier
- Purchase reference
- Purchase date
- Season
- Bale grade
- Received weight
- Received quantity where available
- Purchase cost
- Warehouse
- Status
- Notes

Typical weights may include:

- 40 KG
- 45 KG
- 50 KG

The system must not assume a fixed bale weight.

Initial configurable bale grades may include:

- Super Cream
- Cream
- One in Cream
- No.1
- السحبة

## 8. STOCK RECEIVING

Stock is another receiving type.

It may arrive as:

- Sack
- Carton
- Other container

Stock weight is not necessarily fixed.

A stock receipt must support:

- Supplier
- Receipt reference
- Purchase document
- Container information
- Quantity
- Weight
- Cost
- Season
- Warehouse
- Date
- Notes

## 9. SEASONS

Initial seasons:

- Summer
- Winter

Seasons must be configurable.

Season affects purchasing, inventory, sorting, sales, waste and profitability analysis.

## 10. INVENTORY CORE

Inventory is based on two primary physical measures:

1. Quantity
2. Weight

For relevant inventory transactions, both must be tracked.

Inventory must be transaction/ledger based.

Current stock should be derived from inventory movements rather than relying only on manually modified balance fields.

## 11. INVENTORY MOVEMENTS

Conceptual movement types:

- Opening
- Purchase Receipt
- Sorting
- Warehouse Transfer
- Store Receipt
- Sale
- Sales Return
- Purchase Return
- Adjustment
- Damage
- Waste
- Stock Count
- Stock Count Adjustment

Every movement must preserve traceability.

A movement conceptually contains:

- Tenant
- Company
- Branch
- Source
- Destination
- Product
- Lot
- Quantity
- Weight
- Movement type
- Reference document
- Date/time
- User
- Reason where applicable

Exact database schema will be determined during architecture review.

## 12. SORTING

After receiving, warehouse inventory can be sorted into:

### 100% Good

- New Collection
- وسط

### Minor Defect / Light Waste

- تصفيات

### 100% Waste

- Seasonal waste / non-sellable stock

Sorting must reference the original receiving source/lot.

## 13. SORTING RECONCILIATION

Sorting must preserve source quantity and weight.

Example:

Received:
500 pieces / 500 KG

Sorted:

250 pieces / 250 KG
New Collection

200 pieces / 200 KG
وسط

50 pieces / 50 KG
Waste

Total:
500 pieces / 500 KG

The system must not silently lose quantity or weight.

Any difference must be:

- Visible
- Explained
- Authorized where required
- Recorded in the audit trail

## 14. WASTE

Waste remains part of the economic cost of purchased inventory.

Example:

Purchase:
500 pieces
EGP 5,000

Economic cost:
EGP 10 per piece

If 50 pieces become waste:

Waste economic cost:
EGP 500

The system must not simply remove the waste from inventory without recognizing its economic effect.

The exact accounting treatment will be defined in the accounting and inventory costing design.

## 15. CLEARANCE / MINOR DEFECT

تصفيات / minor-defect inventory remains identifiable inventory.

The system must support:

A. Keeping original cost

or

B. Approved revaluation

The exact revaluation method will be finalized during accounting/costing design.

## 16. WAREHOUSE TO STORE TRANSFER

Warehouse-to-store movement is a formal stock transfer.

Conceptual flow:

Warehouse
  ↓
Transfer
  ↓
Store Receipt

The transfer must identify:

- Source
- Destination
- Product
- Lot
- Quantity
- Weight
- Date
- User
- Status
- Reference

Discrepancies must remain visible.

Example:

Sent:
250 pieces / 250 KG

Received:
248 pieces / 249 KG

The difference must not be silently overwritten.

## 17. CORE TRACEABILITY

The fundamental business chain is:

Supplier
↓
Purchase
↓
Receipt
↓
Inventory Lot
↓
Sorting
↓
Quality / Section
↓
Warehouse
↓
Transfer
↓
Store
↓
POS Sale
↓
Payment
↓
Treasury / Bank
↓
Accounting
↓
Profitability

The architecture must preserve traceability across this chain.

## 18. NON-NEGOTIABLE BUSINESS RULES

1. Motion Store is multi-tenant from day one.
2. Jacky Store must not be hard-coded.
3. Product is separate from Inventory Lot.
4. Inventory is transaction/ledger based.
5. Quantity and weight are core inventory dimensions.
6. Receiving must preserve quantity/weight information.
7. Sorting must reconcile against its source.
8. Unexplained inventory differences must not be silently ignored.
9. Waste has economic cost.
10. Warehouse-to-store movement is a formal transfer.
11. Sensitive operations are permission controlled.
12. Company branding is configurable.
13. Accounting must integrate with operational transactions.
14. Auditability is a core requirement.
15. The architecture must remain ready for future API/mobile clients.

## 19. DECISIONS NOT YET FINALIZED

The implementation agent must not invent these prematurely:

- Backend framework
- Frontend framework
- Database engine
- ORM
- API architecture
- Authentication implementation
- Authorization implementation details
- Inventory costing method
- Accounting posting engine
- POS printing implementation
- Backup implementation
- Subscription billing implementation
- Deployment architecture

These must be evaluated during Architecture Review.

## 20. NEXT PHASE

This document defines the initial approved business/domain foundation.

Next phase:

ARCHITECTURE REVIEW

The architecture review must:

1. Analyze this specification.
2. Identify architectural implications.
3. Propose technical architecture.
4. Identify unresolved decisions.
5. Identify risks.
6. Define module boundaries.
7. Propose the domain/data model.
8. Propose API boundaries.
9. Define implementation phases.

No large-scale coding should begin before architecture review.
