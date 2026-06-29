#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Appointments API cURLs (flow order)
# =============================================================================
#
# Base URL:  http://localhost:4000/api/appointments
# Auth:      All routes require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export APPOINTMENT_ID="<appointment-uuid>"
#   export PATIENT_ID="<patient-uuid>"
#   export LEAD_ID="<lead-uuid>"
#   export DOCTOR_ID="<employee-uuid-with-doctor-role>"
#   export NEW_CLINIC_ID="<destination-clinic-uuid>"
#
# Flow:
#   Login → Create appointment (patient or lead) → List calendar
#   → Get by ID → Reschedule (PUT) → Update status (complete/cancel/no-show)
#
# Related:
#   Lead booking also creates appointments via POST /api/leads/:id/book-appointment
#
# =============================================================================
# RESPONSE STRUCTURES
# =============================================================================
#
# All successful responses:
#   { "success": true, "data": <payload> }
#
# All error responses:
#   { "success": false, "message": "<error description>" }
#
# Common HTTP status codes:
#   200 — OK (read / update / status change)
#   201 — Created
#   400 — Validation or business rule error
#   401 — Missing or invalid JWT
#   403 — Clinic access denied
#   404 — Appointment, clinic, employee, patient, or lead not found
#
# -----------------------------------------------------------------------------
# Appointment object (AppointmentWithDetails)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "clinicId": "uuid",
#   "clinicName": "Rohini Clinic",
#   "employeeId": "uuid | null",
#   "employeeName": "Dr. Smith | null",
#   "patientId": "uuid | null",
#   "patientName": "Jane Doe | null",
#   "leadId": "uuid | null",
#   "leadName": "John Lead | null",
#   "scheduledAt": "2026-06-10T09:00:00.000Z",
#   "status": "scheduled | completed | cancelled | no_show",
#   "symptoms": "Tooth pain | null",
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:30:00.000Z"
# }
#
# -----------------------------------------------------------------------------
# List appointments response — GET /api/appointments
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "items": [ <AppointmentWithDetails>, ... ],
#     "pagination": {
#       "page": 1,
#       "limit": 10,
#       "total": 25,
#       "totalPages": 3
#     }
#   }
# }
#
# Query params:
#   page        — default 1
#   limit       — default 10, max 100
#   clinicId    — filter by clinic
#   status      — scheduled | completed | cancelled | no_show
#   employeeId  — filter by doctor
#   patientId   — filter by patient
#   leadId      — filter by lead
#   dateFrom    — ISO date, start of range (inclusive)
#   dateTo      — ISO date, end of range (inclusive, end of day)
#   search      — matches patient or lead name/phone
#
# Lead status sync (when appointment has leadId):
#   scheduled  → lead status appointment_booked
#   completed  → lead status clinic_visited
#   no_show    → lead status no_show
#   cancelled  → lead status unchanged
#
# Shift clinic (PATCH /api/appointments/:id/shift-clinic):
#   - Moves appointment to patient-requested clinic (no GPS; staff picks clinic)
#   - Only scheduled appointments can be shifted
#   - Clears employeeId (doctor must be reassigned at new clinic)
#   - Syncs linked lead.clinicId when present
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
APPTS="${BASE_URL}/api/appointments"


# =============================================================================
# STEP 0 — LOGIN (get JWT)
# =============================================================================
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "token": "<jwt>",
#     "roles": ["Reception"],
#     "isSuperAdmin": false,
#     "hasPlatformAdminAccess": false,
#     "clinicId": "<clinic-uuid>"
#   }
# }
#
# export TOKEN from data.token before running authenticated curls below.

curl -X POST "${BASE_URL}/api/auth/login" \
  -H "${JSON_HEADER}" \
  -d '{
    "email": "reception@yourvcare.com",
    "password": "YourPassword123"
  }'


# =============================================================================
# STEP 1 — CREATE APPOINTMENT (registered patient — /appointments page)
# =============================================================================
#
# Response (201):
# { "success": true, "data": <AppointmentWithDetails> }
#
# Rules:
#   - patientId OR leadId is required (patientId for calendar page flow)
#   - Provide scheduledAt OR appointmentDate + appointmentTime
#   - employeeId must be an active Doctor in the same clinic

# Option A: patient appointment with date + time
curl -X POST "${APPTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientId": "'"${PATIENT_ID}"'",
    "employeeId": "'"${DOCTOR_ID}"'",
    "appointmentDate": "2026-06-10",
    "appointmentTime": "09:00",
    "symptoms": "Routine checkup"
  }'

# Option B: ISO scheduledAt
curl -X POST "${APPTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientId": "'"${PATIENT_ID}"'",
    "scheduledAt": "2026-06-10T11:00:00.000Z",
    "symptoms": "Cleaning"
  }'

# Create from lead (also sets lead status → appointment_booked)
curl -X POST "${APPTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "leadId": "'"${LEAD_ID}"'",
    "employeeId": "'"${DOCTOR_ID}"'",
    "appointmentDate": "2026-06-12",
    "appointmentTime": "14:30",
    "symptoms": "Sensitivity"
  }'


# =============================================================================
# STEP 2 — LIST APPOINTMENTS (calendar / table)
# =============================================================================
#
# Response (200):
# { "success": true, "data": { "items": [...], "pagination": {...} } }

# Default list for caller's clinic
curl -X GET "${APPTS}/" \
  -H "${AUTH_HEADER}"

# Calendar day range
curl -X GET "${APPTS}/?dateFrom=2026-06-10&dateTo=2026-06-10&status=scheduled" \
  -H "${AUTH_HEADER}"

# Filter by doctor
curl -X GET "${APPTS}/?employeeId=${DOCTOR_ID}&page=1&limit=20" \
  -H "${AUTH_HEADER}"

# Search by patient/lead name or phone
curl -X GET "${APPTS}/?search=jane" \
  -H "${AUTH_HEADER}"

# Director / super admin — filter by clinic
curl -X GET "${APPTS}/?clinicId=${CLINIC_ID}&status=scheduled" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 3 — GET APPOINTMENT BY ID
# =============================================================================
#
# Response (200):
# { "success": true, "data": <AppointmentWithDetails> }
#
# Error (404):
# { "success": false, "message": "Appointment not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access appointments from another clinic" }

curl -X GET "${APPTS}/${APPOINTMENT_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 4 — RESCHEDULE / UPDATE APPOINTMENT
# =============================================================================
#
# Response (200):
# { "success": true, "data": <AppointmentWithDetails> }
#
# At least one field is required.
# To clear doctor, pass "employeeId": null

curl -X PUT "${APPTS}/${APPOINTMENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "appointmentDate": "2026-06-11",
    "appointmentTime": "10:30",
    "employeeId": "'"${DOCTOR_ID}"'",
    "symptoms": "Updated symptoms"
  }'

# Change patient on appointment
curl -X PUT "${APPTS}/${APPOINTMENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'"
  }'

# Clear assigned doctor
curl -X PUT "${APPTS}/${APPOINTMENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "employeeId": null
  }'


# =============================================================================
# STEP 5 — UPDATE APPOINTMENT STATUS
# =============================================================================
#
# Response (200):
# { "success": true, "data": <AppointmentWithDetails> }
#
# status values: scheduled | completed | cancelled | no_show
#
# Linked lead status updates:
#   completed → clinic_visited
#   no_show   → no_show
#   scheduled → appointment_booked

# Mark completed (patient visited)
curl -X PATCH "${APPTS}/${APPOINTMENT_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "completed"
  }'

# Mark no-show
curl -X PATCH "${APPTS}/${APPOINTMENT_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "no_show"
  }'

# Cancel appointment
curl -X PATCH "${APPTS}/${APPOINTMENT_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "cancelled"
  }'

# Re-open as scheduled
curl -X PATCH "${APPTS}/${APPOINTMENT_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "scheduled"
  }'


# =============================================================================
# STEP 6 — SHIFT CLINIC (patient cannot visit original clinic)
# =============================================================================
#
# Response (200):
# { "success": true, "data": <AppointmentWithDetails with new clinicId/clinicName> }
#
# Body:
#   newClinicId — destination clinic UUID (patient picks nearest/convenient clinic)
#
# Rules:
#   - Only status "scheduled" appointments can be shifted
#   - newClinicId must differ from current clinicId
#   - Destination clinic must exist and be active
#   - Assigned doctor is cleared (reassign at new clinic via PUT)
#   - Linked lead.clinicId is updated to match
#
# Access:
#   - Director / super admin: any appointment
#   - Clinic staff: source clinic OR destination clinic
#
# Error (400) — not scheduled:
# { "success": false, "message": "Only scheduled appointments can be shifted to another clinic" }
#
# Error (400) — same clinic:
# { "success": false, "message": "Appointment is already at the requested clinic" }
#
# Error (403):
# { "success": false, "message": "You cannot shift appointments for another clinic" }

curl -X PATCH "${APPTS}/${APPOINTMENT_ID}/shift-clinic" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "newClinicId": "'"${NEW_CLINIC_ID}"'"
  }'

# After shift — assign a doctor at the new clinic
curl -X PUT "${APPTS}/${APPOINTMENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "employeeId": "'"${DOCTOR_ID}"'"
  }'


# =============================================================================
# EXAMPLE FULL FLOW
# =============================================================================
#
# 1. Login → export TOKEN
# 2. POST /api/appointments/          → save APPOINTMENT_ID from response.data.id
# 3. GET  /api/appointments/          → verify in calendar list
# 4. GET  /api/appointments/:id       → view detail
# 5. PUT  /api/appointments/:id       → reschedule
# 6. PATCH /api/appointments/:id/shift-clinic { "newClinicId": "..." }  (optional)
# 7. PATCH /api/appointments/:id/status { "status": "completed" }
#
# Alternative via leads:
#   POST /api/leads/:id/book-appointment → creates/updates linked appointment
#
# =============================================================================
# VALIDATION ERROR EXAMPLES
# =============================================================================
#
# Missing patientId and leadId (400):
# { "success": false, "message": "patientId: patientId or leadId is required" }
#
# Missing schedule (400):
# { "success": false, "message": "Provide scheduledAt or both appointmentDate and appointmentTime" }
#
# Patient wrong clinic (400):
# { "success": false, "message": "Patient does not belong to the selected clinic" }
#
# Doctor not in clinic (404):
# { "success": false, "message": "Employee not found" }
#
# =============================================================================
