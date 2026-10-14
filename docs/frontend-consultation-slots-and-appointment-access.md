# Frontend: consultation slots, appointment visibility, patient chart

## 1. Consultation date + time slot books an appointment

On the consultation form, keep the consultation time and add a slot:

- `appointmentDate` — `YYYY-MM-DD`
- `appointmentTime` — `HH:mm`

Send both together on create or update. The backend books that slot with the **same attending doctor** and links `appointmentId`.

```http
POST /api/consultations
```

```json
{
  "patientId": "uuid",
  "doctorId": "uuid",
  "chiefComplaint": "Pain in 26",
  "consultedAt": "2026-10-15T04:30:00.000Z",
  "appointmentDate": "2026-10-15",
  "appointmentTime": "10:30"
}
```

`PUT /api/consultations/:id` accepts the same slot fields. If the consultation already has an appointment, that appointment is moved to the new slot. Response includes `appointment` when a slot was booked.

Do not send a slot when `appointmentId` is already chosen on create.

Use `GET /api/appointments/available-doctors?date=YYYY-MM-DD&time=HH:mm` to fill the slot list.

## 2. Super admin sees every doctor’s appointments

Same as FDE (`FDE` role):

```http
GET /api/appointments
```

Do **not** send `employeeId` for super admin or FDE. That list is every doctor in the clinic.

If the app currently sets `employeeId` to the logged-in super admin id, stop doing that. The API now ignores that self id for super admins. A real doctor id still filters the list.

Doctors still only receive their own appointments.

## 3. Patient details: chart only, read-only

`GET /api/patients/:id/odontogram` returns `readOnly: true`.

On patient details render only the tooth chart from `statusChart`:

- No section header, toolbar, condition picker, or tooth-selection chrome
- No save / edit controls
- Ignore pointer events so teeth cannot be selected

Do not load the consultation odontogram editor on this screen.

## 4. Patient list order

`GET /api/patients` is alphabetical by name, then patient code. Render the list in that order.

## 5. Super admin can change the attending doctor

```http
PUT /api/consultations/:id
```

```json
{ "doctorId": "uuid-of-another-doctor" }
```

Only a super admin (or Director / Retail Head) may change `doctorId`. Other roles get `403`. A linked appointment is moved to the new doctor.

Show a doctor dropdown on the consultation screen only when `user.isSuperAdmin` (or platform admin) is true.

## 6. Appointment dialog: cancel and delete

In the appointment dialog add:

- **Cancel appointment** — keeps the record

```http
PATCH /api/appointments/:id/status
```

```json
{ "status": "cancelled", "cancelledReason": "Patient requested" }
```

- **Delete appointment** — removes it

```http
DELETE /api/appointments/:id
```

Confirm before delete. Cancel is the softer action; delete is permanent.
