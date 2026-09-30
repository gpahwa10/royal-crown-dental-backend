# Frontend: backdated billing

Use `billedAt` as the invoice business date. Do not overwrite `createdAt`.

## Create a historical invoice (previous consultation)

```http
POST /api/invoices
```

```json
{
  "patientId": "uuid",
  "sourceType": "consultation",
  "sourceId": "uuid-of-previous-consultation",
  "billedAt": "2024-11-03T10:30:00.000Z",
  "items": [
    { "serviceId": "uuid", "quantity": 1 }
  ]
}
```

Rules:

- `billedAt` is optional.
- If omitted and `sourceType` is `consultation` with a valid `sourceId`, backend defaults `billedAt` to that consultation’s `consultedAt`.
- Otherwise `billedAt` defaults to now.
- `billedAt` cannot be in the future.
- Invoice PDF date and list/timeline sorting use `billedAt`.

## Edit invoice date (pending only)

```http
PATCH /api/invoices/:id
```

```json
{
  "billedAt": "2024-10-21T14:00:00.000Z"
}
```

You can also send `items` / `manualDiscount` together with `billedAt`.

## Payment date

Payments already support a past date:

```http
POST /api/invoices/:id/payments
```

```json
{
  "amount": 1500,
  "paymentMethod": "cash",
  "paymentDate": "2024-11-03T11:00:00.000Z"
}
```

## UI

- On billing from a previous consultation, prefill `billedAt` from `consultation.consultedAt` (or omit and let the API default).
- Show a date picker labeled **Invoice date**.
- Display `invoice.billedAt` in lists and detail views (fall back to `createdAt` only if missing on old clients).
