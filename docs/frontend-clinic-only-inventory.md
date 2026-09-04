# Frontend plan: clinic-only inventory

Inventory is now **one clinic’s stock**. There is no warehouse, location, transfer, or transaction history API.

## Remove from UI / routes / API client

| Remove | Old endpoint |
|---|---|
| Locations pages / pickers | `GET/POST/PUT/DELETE /api/inventory/locations*` |
| Transfer flow | `POST /api/inventory/transfer` |
| Transactions / movement log | `GET /api/inventory/transactions*` |
| Item history | `GET /api/inventory/items/:id/history` |
| Warehouse stock / dashboard | `GET /api/inventory/stock/warehouse`, `GET /api/inventory/dashboard/warehouse` |

Nav: drop **Locations**, **Transfer**, **Transactions**, and any **Warehouse** tab.

## Keep (clinic-scoped by auth / `CLINIC_ID`)

- Items, variants, categories — unchanged overall shape
- Stock list / low / out / summary / dashboard
- Purchase, consume, adjust

Do **not** send `clinicId` or `locationId` for writes. The backend uses the deployment clinic from token/context (`CLINIC_ID`).

## Request body changes

**Purchase / consume / adjust** — drop `locationId`:

```ts
// BEFORE
{ variantId, locationId, quantity }

// AFTER
{ variantId, quantity }           // purchase / consume
{ variantId, adjustment, reason } // adjust
```

Optional fields still supported:

- Purchase: `referenceNumber?`, `notes?`
- Consume: `notes?`
- Adjust: `reason` (required), `adjustment` must be non-zero

You may still send `itemId` instead of `variantId` when the item has a single variant.

## Response shape changes

Stock rows no longer include `location`. They include `clinicId` on the stock record:

```ts
{
  stock: {
    id: string
    variantId: string
    clinicId: string
    inStock: number
    reservedStock: number
    requiredStock: number
    updatedAt: string
  }
  variant: { /* ... */ }
  item: { /* ... */ }
  category: { /* ... */ }
}
```

Item detail `variants[].stock[]` is the same: clinic stock rows, no nested `location`.

Dashboard no longer returns `recentTransfers`, `recentPurchases`, or `totalClinics`. Prefer:

```ts
{
  totalInventoryItems: number
  totalStockRecords: number
  lowStockItems: number
  outOfStockItems: number
  clinicId: string | null
}
```

## Endpoints to use

| Action | Method + path |
|---|---|
| List items | `GET /api/inventory/items` |
| Get item | `GET /api/inventory/items/:id` |
| Create / update / delete item | `POST/PUT/DELETE /api/inventory/items` / `/:id` |
| Variants | `POST/PUT/DELETE /api/inventory/variants` |
| Categories | `GET/POST/PUT/DELETE /api/inventory/categories` |
| Stock list | `GET /api/inventory/stock` |
| Low stock | `GET /api/inventory/stock/low` |
| Out of stock | `GET /api/inventory/stock/out` |
| Stock summary | `GET /api/inventory/stock/summary` |
| Purchase | `POST /api/inventory/purchase` |
| Consume | `POST /api/inventory/consume` |
| Adjust | `POST /api/inventory/adjust` |
| Dashboard | `GET /api/inventory/dashboard` |

## Optional aliases (redundant)

These still work but are redundant with the clinic-scoped defaults:

- `GET /api/inventory/stock/clinic/:clinicId`
- `GET /api/inventory/dashboard/clinic/:clinicId`
- `GET /api/inventory/items/clinic/:clinicId`

Prefer the non-path versions unless you already depend on the `:clinicId` URLs.

## Implementation checklist

1. Delete location / transfer / transactions / warehouse feature modules and routes.
2. Remove `locationId` from purchase / consume / adjust forms and types.
3. Point stock views at `GET /api/inventory/stock` (or `/stock/low`, `/stock/out`) only.
4. Use `GET /api/inventory/dashboard` for the inventory home.
5. Update TypeScript types:
   - remove `InventoryLocation`, `InventoryTransaction`, `locationId`
   - add `clinicId` on stock
6. Remove any selected warehouse / location from local/global state.
7. Smoke-test purchase, consume, adjust, stock list, low stock, and dashboard against the updated backend.

## Backend dependency

Apply migration before relying on the new API against an existing database:

```bash
psql "$DATABASE_URL" -f drizzle/0003_clinic_only_inventory.sql
```

This migrates `inventory_stock` to `clinic_id`, then drops `inventory_location` and `inventory_transaction`.
