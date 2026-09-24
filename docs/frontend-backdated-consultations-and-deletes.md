# Frontend: backdated consultations and hard deletes

## Backdated consultations

Use `consultedAt` as the visit date. Do not overwrite `createdAt`.

### Create a historical consultation

```http
POST /api/consultations
```

```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "chiefComplaint": "Pain in 26",
  "consultedAt": "2024-11-03T10:30:00.000Z",
  "diagnosis": "Irreversible pulpitis",
  "treatmentPlan": "RCT 26",
  "clinicalNotes": "Entered from paper record",
  "nextVisitDate": "2024-11-17T09:00:00.000Z",
  "markCompleted": true
}
```

Rules:

- `consultedAt` is optional. Default is now.
- `consultedAt` cannot be in the future.
- `markCompleted: true` creates the record as `completed` instead of `draft`.
- `diagnosis` is required when `markCompleted` is true.
- Patient list / history should sort by `consultation.consultedAt` (backend already does).

### Edit the visit date later

```http
PUT /api/consultations/:id
```

```json
{
  "consultedAt": "2024-10-21T14:00:00.000Z"
}
```

Show a date/time picker labeled **Consultation date** on create and edit. Keep the live “start consultation” flow unchanged for same-day visits.

## Delete endpoints

All deletes are hard deletes, clinic-scoped, and return `{ success: true, data: { id } }`.

Confirm in the UI before calling any of these.

| Resource | Method |
| --- | --- |
| Billing invoice | `DELETE /api/invoices/:id` |
| Appointment | `DELETE /api/appointments/:id` |
| Consultation | `DELETE /api/consultations/:id` |
| Prescription | `DELETE /api/prescriptions/:id` |
| Radiograph | `DELETE /api/radiographs/:id` |
| Dental lab order | `DELETE /api/dental-lab-orders/:id` |
| Patient | `DELETE /api/patients/:id` |
| Lead | `DELETE /api/leads/:id` |
| Visit history | `DELETE /api/clinic-visits/:id` |
| Lab request | `DELETE /api/lab-requests/:id` |

Notes:

- Invoice delete requires the same financial write access as create/update (doctors are read-only). It also removes payments and any membership purchased with that invoice.
- Patient delete removes that patient’s clinical and billing records (consultations, prescriptions, invoices, files, visits, lab work, appointments).
- Radiograph list items can be `source: "record"` or `source: "upload"`. Use the row `id` for both; upload rows are file IDs.
- Linked records are detached, not left as broken FKs (for example deleting an appointment unlinks it from consultations and visits).
