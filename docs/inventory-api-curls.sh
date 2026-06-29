#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Inventory API cURLs (system flow order)
# =============================================================================
#
# Base URL:  http://localhost:4000/api/v1/inventory
# Auth:      All inventory routes require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export CATEGORY_ID="<category-uuid>"
#   export WAREHOUSE_LOCATION_ID="<warehouse-location-uuid>"
#   export CLINIC_LOCATION_ID="<clinic-location-uuid>"
#   export ITEM_ID="<inventory-item-uuid>"
#   export VARIANT_ID="<variant-uuid>"
#
# Flow:
#   Login → Categories & Locations → Create Items → Purchase (warehouse)
#   → View Stock → Transfer to Clinic → Clinic Inventory → Consume
#   → Adjust → Transactions & History → Dashboard
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
INV="${BASE_URL}/api/inventory"


# =============================================================================
# STEP 1 — SETUP: CATEGORIES
# =============================================================================

# 1.1 Create category
curl -X POST "${INV}/categories" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Endodontics",
    "description": "Root canal materials"
  }'

# 1.2 List all categories
curl -X GET "${INV}/categories" \
  -H "${AUTH_HEADER}"

# 1.3 Get single category
curl -X GET "${INV}/categories/${CATEGORY_ID}" \
  -H "${AUTH_HEADER}"

# 1.4 Update category
curl -X PUT "${INV}/categories/${CATEGORY_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Endodontics & Files",
    "description": "Updated description"
  }'

# 1.5 Delete category (soft delete)
curl -X DELETE "${INV}/categories/${CATEGORY_ID}" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 2 — SETUP: LOCATIONS (warehouse + clinic)
# =============================================================================

# 2.1 Create warehouse location
curl -X POST "${INV}/locations" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Central Warehouse",
    "type": "warehouse",
    "city": "Delhi",
    "address": "Industrial Area, Sector 5"
  }'

# 2.2 Create clinic location (link to clinic)
curl -X POST "${INV}/locations" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Rohini Clinic",
    "type": "clinic",
    "city": "Delhi",
    "address": "Sector 8",
    "clinicId": "'"${CLINIC_ID}"'"
  }'

# 2.3 List all locations
curl -X GET "${INV}/locations" \
  -H "${AUTH_HEADER}"

# 2.4 Get single location
curl -X GET "${INV}/locations/${WAREHOUSE_LOCATION_ID}" \
  -H "${AUTH_HEADER}"

# 2.5 Update location
curl -X PUT "${INV}/locations/${CLINIC_LOCATION_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Rohini Clinic - Updated",
    "address": "Sector 8, Rohini"
  }'

# 2.6 Delete location (soft delete)
curl -X DELETE "${INV}/locations/${CLINIC_LOCATION_ID}" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 3 — CREATE INVENTORY ITEMS
# =============================================================================

# 3.1 Create item WITHOUT variants (auto-creates Default variant + currentStock: 0)
curl -X POST "${INV}/items" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "categoryId": "'"${CATEGORY_ID}"'",
    "name": "Gloves",
    "unit": "pcs",
    "sku": "GLV-001",
    "minimumStockLevel": 100,
    "description": "Nitrile gloves"
  }'

# 3.2 Create item WITH variants
curl -X POST "${INV}/items" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "categoryId": "'"${CATEGORY_ID}"'",
    "name": "Protaper Files",
    "unit": "pcs",
    "minimumStockLevel": 50,
    "description": "Endodontic files",
    "variants": [
      { "name": "21mm", "sku": "PT-21" },
      { "name": "25mm", "sku": "PT-25" }
    ]
  }'

# 3.3 Create shared/global item (no clinicId — warehouse catalog)
curl -X POST "${INV}/items" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "categoryId": "'"${CATEGORY_ID}"'",
    "name": "Universal Bond",
    "unit": "bottle",
    "minimumStockLevel": 20,
    "description": "Shared across all clinics"
  }'

# 3.4 Bulk create items
curl -X POST "${INV}/items/bulk" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '[
    {
      "clinicId": "'"${CLINIC_ID}"'",
      "categoryId": "'"${CATEGORY_ID}"'",
      "name": "Masks",
      "unit": "pcs",
      "minimumStockLevel": 200
    },
    {
      "clinicId": "'"${CLINIC_ID}"'",
      "categoryId": "'"${CATEGORY_ID}"'",
      "name": "Syringes",
      "unit": "pcs",
      "minimumStockLevel": 50,
      "variants": [
        { "name": "5ml" },
        { "name": "10ml" }
      ]
    }
  ]'

# 3.5 Add variant to existing item (optional — only if item has multiple sizes)
curl -X POST "${INV}/variants" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "inventoryItemId": "'"${ITEM_ID}"'",
    "name": "F1",
    "sku": "PT-F1"
  }'

# 3.6 Update variant
curl -X PUT "${INV}/variants/${VARIANT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "F1 Pro",
    "sku": "PT-F1-PRO"
  }'

# 3.7 Delete variant (soft delete)
curl -X DELETE "${INV}/variants/${VARIANT_ID}" \
  -H "${AUTH_HEADER}"

# 3.8 Update inventory item
curl -X PUT "${INV}/items/${ITEM_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Updated Gloves",
    "minimumStockLevel": 200
  }'

# 3.9 Delete inventory item (soft delete)
curl -X DELETE "${INV}/items/${ITEM_ID}" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 4 — PURCHASE STOCK (warehouse stock increases)
# Stock is NEVER edited directly — only via purchase / transfer / consume / adjust
# =============================================================================

# 4.1 Purchase using itemId (works when item has single/default variant)
curl -X POST "${INV}/purchase" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "itemId": "'"${ITEM_ID}"'",
    "locationId": "'"${WAREHOUSE_LOCATION_ID}"'",
    "quantity": 100,
    "referenceNumber": "INV-001",
    "notes": "Vendor purchase"
  }'

# 4.2 Purchase using variantId (required when item has multiple variants)
curl -X POST "${INV}/purchase" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "variantId": "'"${VARIANT_ID}"'",
    "locationId": "'"${WAREHOUSE_LOCATION_ID}"'",
    "quantity": 100,
    "referenceNumber": "INV-002",
    "notes": "Vendor purchase"
  }'

# =============================================================================
# STEP 5 — VIEW STOCK (read-only)
# =============================================================================

# 5.1 List all items with currentStock
curl -X GET "${INV}/items?page=1&limit=10&search=gloves&categoryId=${CATEGORY_ID}&isActive=true" \
  -H "${AUTH_HEADER}"

# 5.2 Get single item with stock breakdown (all locations)
curl -X GET "${INV}/items/${ITEM_ID}" \
  -H "${AUTH_HEADER}"

# 5.3 Get single item — clinic-scoped stock only
curl -X GET "${INV}/items/${ITEM_ID}?clinicId=${CLINIC_ID}" \
  -H "${AUTH_HEADER}"

# 5.4 List all stock records
curl -X GET "${INV}/stock?page=1&limit=20&search=&categoryId=${CATEGORY_ID}&locationId=${WAREHOUSE_LOCATION_ID}" \
  -H "${AUTH_HEADER}"

# 5.5 Warehouse stock only
curl -X GET "${INV}/stock/warehouse?page=1&limit=20" \
  -H "${AUTH_HEADER}"

# 5.6 Stock summary
curl -X GET "${INV}/stock/summary" \
  -H "${AUTH_HEADER}"

# 5.7 Low stock items (inStock < requiredStock)
curl -X GET "${INV}/stock/low?page=1&limit=20&clinicId=${CLINIC_ID}" \
  -H "${AUTH_HEADER}"

# 5.8 Out of stock items
curl -X GET "${INV}/stock/out?page=1&limit=20" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 6 — TRANSFER (warehouse → clinic)
# =============================================================================

curl -X POST "${INV}/transfer" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "variantId": "'"${VARIANT_ID}"'",
    "fromLocationId": "'"${WAREHOUSE_LOCATION_ID}"'",
    "toLocationId": "'"${CLINIC_LOCATION_ID}"'",
    "quantity": 50,
    "notes": "Monthly clinic refill"
  }'

# Transfer using itemId (single variant only)
curl -X POST "${INV}/transfer" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "itemId": "'"${ITEM_ID}"'",
    "fromLocationId": "'"${WAREHOUSE_LOCATION_ID}"'",
    "toLocationId": "'"${CLINIC_LOCATION_ID}"'",
    "quantity": 30,
    "notes": "Clinic refill"
  }'

# =============================================================================
# STEP 7 — CLINIC INVENTORY (clinic-wise items + stock)
# =============================================================================

# 7.1 List clinic items (clinic-specific + shared global items, with currentStock)
curl -X GET "${INV}/items/clinic/${CLINIC_ID}?page=1&limit=10" \
  -H "${AUTH_HEADER}"

# 7.2 Clinic items only (exclude shared/global catalog)
curl -X GET "${INV}/items/clinic/${CLINIC_ID}?clinicOnly=true&page=1&limit=10" \
  -H "${AUTH_HEADER}"

# 7.3 Filter clinic items via query param
curl -X GET "${INV}/items?clinicId=${CLINIC_ID}&page=1&limit=10&search=gloves" \
  -H "${AUTH_HEADER}"

# 7.4 Clinic stock (stock at clinic locations for this clinic)
curl -X GET "${INV}/stock/clinic/${CLINIC_ID}?page=1&limit=20&lowStock=true" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 8 — CONSUME (clinic usage — stock reduces)
# =============================================================================

curl -X POST "${INV}/consume" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "itemId": "'"${ITEM_ID}"'",
    "locationId": "'"${CLINIC_LOCATION_ID}"'",
    "quantity": 5,
    "notes": "RCT Procedure"
  }'

# Consume using variantId
curl -X POST "${INV}/consume" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "variantId": "'"${VARIANT_ID}"'",
    "locationId": "'"${CLINIC_LOCATION_ID}"'",
    "quantity": 5,
    "notes": "RCT Procedure"
  }'

# =============================================================================
# STEP 9 — ADJUST (manual correction)
# =============================================================================

curl -X POST "${INV}/adjust" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "itemId": "'"${ITEM_ID}"'",
    "locationId": "'"${CLINIC_LOCATION_ID}"'",
    "adjustment": -2,
    "reason": "Damaged items"
  }'

# Positive adjustment (found extra stock)
curl -X POST "${INV}/adjust" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "variantId": "'"${VARIANT_ID}"'",
    "locationId": "'"${CLINIC_LOCATION_ID}"'",
    "adjustment": 3,
    "reason": "Stock count correction"
  }'

# =============================================================================
# STEP 10 — TRANSACTIONS & ITEM HISTORY (audit log)
# =============================================================================

# 10.1 List all transactions
curl -X GET "${INV}/transactions?page=1&limit=20&type=transfer&locationId=${CLINIC_LOCATION_ID}&variantId=${VARIANT_ID}&startDate=2026-01-01&endDate=2026-12-31" \
  -H "${AUTH_HEADER}"

# Transaction types: purchase | transfer | usage | adjustment | damaged | expired | return

# 10.2 Get single transaction
curl -X GET "${INV}/transactions/TRANSACTION_UUID" \
  -H "${AUTH_HEADER}"

# 10.3 Item history (purchases, transfers, usage, adjustments for one item)
curl -X GET "${INV}/items/${ITEM_ID}/history" \
  -H "${AUTH_HEADER}"

# =============================================================================
# STEP 11 — DASHBOARDS
# =============================================================================

# 11.1 Global inventory dashboard
curl -X GET "${INV}/dashboard" \
  -H "${AUTH_HEADER}"

# 11.2 Clinic inventory dashboard
curl -X GET "${INV}/dashboard/clinic/${CLINIC_ID}" \
  -H "${AUTH_HEADER}"

# 11.3 Warehouse dashboard
curl -X GET "${INV}/dashboard/warehouse" \
  -H "${AUTH_HEADER}"

# =============================================================================
# END OF FLOW
# =============================================================================
#
# Quick reference — typical happy path:
#   login → create category → create warehouse + clinic locations
#   → create item → purchase (warehouse) → transfer (warehouse → clinic)
#   → list clinic items/stock → consume (clinic) → view transactions/history
#
# =============================================================================
