# Frontend: walk-in appointments

Scheduled bookings still use `POST /api/appointments` with a date and time.

Walk-ins skip the slot picker and go straight onto today’s clinic queue.

## Walk-in form

Required:

- Registered patient (`patientId`) **or** lead (`leadId`)

Optional:

- Doctor (`employeeId`)
- Symptoms
- Visit purpose (`consultation` default)
- Notes

Do **not** show date/time or available-doctors slot UI on this form.

```http
POST /api/appointments/walk-in
```

```json
{
  "patientId": "uuid",
  "employeeId": "uuid",
  "symptoms": "Tooth pain",
  "purpose": "consultation"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": "uuid",
      "appointmentType": "walk_in",
      "status": "checked_in",
      "scheduledAt": "2026-09-24T05:40:00.000Z",
      "checkedInAt": "2026-09-24T05:40:00.000Z"
    },
    "visit": {
      "id": "uuid",
      "visitNumber": "CV000123",
      "status": "checked_in",
      "purpose": "consultation"
    }
  }
}
```

`409 Duplicate check-in` means that phone already has an active visit today.

## Queue

The visit is already `checked_in`. Refresh the clinic queue with:

```http
GET /api/clinic-visits?status=checked_in
```

Active queue is `checked_in` + `in_progress`.

List appointments now include `appointmentType` and `checkedInAt`. Show a **Walk-in** badge when `appointmentType === "walk_in"`.
