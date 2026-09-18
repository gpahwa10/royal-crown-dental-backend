# Frontend: per-tooth odontogram notes

## Behavior

- Every tooth can have optional `notes` text.
- On hover (or long-press on mobile), show a notes popover with a textarea + Save / Clear.
- Saved notes appear when viewing the consultation odontogram and the patient odontogram (after consultation completion).

## Data model

Notes live on each tooth object inside `statusChart`:

```json
{
  "statusChart": {
    "16": {
      "condition": "caries",
      "notes": "Distal lesion; monitor at next visit"
    },
    "36": {
      "notes": "Sensitivity reported"
    }
  },
  "chartVersion": 3
}
```

- Field name: `notes` (string, max 2000 chars)
- Clear notes by sending `null` or `""` (backend stores as removed/`null`)

## API

### Save / update / clear one tooth’s notes

```http
PATCH /api/consultations/:consultationId/odontogram/teeth/:toothNumber/notes
```

Also available as:

```http
PATCH /api/odontograms/consultations/:consultationId/odontogram/teeth/:toothNumber/notes
```

Request:

```json
{
  "notes": "Distal lesion; monitor",
  "version": 3
}
```

Clear:

```json
{
  "notes": null,
  "version": 3
}
```

Response:

```json
{
  "success": true,
  "odontogram": { /* full chart with bumped chartVersion */ },
  "tooth": {
    "toothNumber": "16",
    "notes": "Distal lesion; monitor"
  }
}
```

Use optimistic locking: always send the current `odontogram.chartVersion`. On `409`, reload the chart and retry.

### Read notes when viewing

- Consultation: `GET /api/consultations/:id/odontogram` → `odontogram.statusChart[tooth].notes`
- Patient: `GET /api/patients/:patientId/odontogram` → same shape

No separate notes GET is needed.

### Full chart save still works

`PUT .../odontogram` can include `notes` on any tooth in `statusChart`; the PATCH endpoint is for hover-save without rewriting the whole chart.

## UI checklist

1. Tooth hover → popover anchored to the tooth.
2. Prefill textarea from `statusChart[toothNumber]?.notes ?? ""`.
3. Show a small indicator (dot/icon) on teeth that have notes.
4. Save calls PATCH with current `chartVersion`; update local chart from response.
5. Read-only mode (completed/cancelled or patient history): show notes, hide Save.
6. Keep popover open until Save/Clear/outside click so users can type without losing focus on hover flicker (prefer click-to-open on desktop if hover is too flaky).
