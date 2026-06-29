#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Leads API cURLs (flow order)
# =============================================================================
#
# Base URL:  http://localhost:4000/api/leads
# Auth:      All routes except POST /public require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export LEAD_ID="<lead-uuid>"
#   export DOCTOR_ID="<employee-uuid-with-doctor-role>"
#   export PATIENT_ID="<patient-uuid>"
#
# Flow:
#   Login → Public intake OR Staff create lead → List / Get lead
#   → Book appointment → Update status (Kanban) → Edit lead
#   → Convert to patient (on clinic visit)
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
#   200 — OK (read / update / book / convert)
#   201 — Created (create lead)
#   400 — Validation or business rule error
#   401 — Missing or invalid JWT
#   403 — Clinic access denied
#   404 — Lead, clinic, employee, or patient not found
#   409 — Conflict (e.g. duplicate)
#
# -----------------------------------------------------------------------------
# Lead object (LeadWithDetails) — returned by create, get, update, book, convert
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "clinicId": "uuid",
#   "clinicName": "Rohini Clinic",
#   "patientId": "uuid | null",
#   "name": "Jane Doe",
#   "email": "jane@example.com | null",
#   "phone": "9876543210",
#   "source": "call | whatsapp | website | walk_in | referral | qr_self",
#   "status": "new_query | appointment_booked | follow_up | clinic_visited | no_show",
#   "symptoms": "Tooth pain | null",
#   "notes": "Walk-in enquiry | null",
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:30:00.000Z",
#   "appointment": null | {
#     "id": "uuid",
#     "scheduledAt": "2026-06-10T09:00:00.000Z",
#     "status": "scheduled | completed | cancelled | no_show",
#     "employeeId": "uuid | null",
#     "employeeName": "Dr. Smith | null",
#     "clinicId": "uuid",
#     "symptoms": "Tooth pain | null"
#   }
# }
#
# -----------------------------------------------------------------------------
# List leads response — GET /api/leads
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "items": [ <LeadWithDetails>, ... ],
#     "pagination": {
#       "page": 1,
#       "limit": 10,
#       "total": 42,
#       "totalPages": 5
#     }
#   }
# }
#
# Query params:
#   page      — default 1
#   limit     — default 10, max 100
#   clinicId  — filter by clinic (required implicitly for non-admin staff via JWT)
#   status    — new_query | appointment_booked | follow_up | clinic_visited | no_show
#   search    — matches name or phone (partial)
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
LEADS="${BASE_URL}/api/leads"


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
# STEP 1 — PUBLIC INTAKE (no auth)
# Replaces frontend localStorage queue at /patient-intake
# =============================================================================
#
# Response (201):
# { "success": true, "data": <LeadWithDetails> }
#
# Notes:
#   - source is automatically set to "qr_self"
#   - notes is automatically set to "Imported from public self-check-in."
#   - status defaults to "new_query"
#   - appointment is null until booked

curl -X POST "${LEADS}/public" \
  -H "${JSON_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "name": "John Public",
    "phone": "9876543210",
    "email": "john@example.com",
    "symptoms": "Sensitivity in lower molar"
  }'


# =============================================================================
# STEP 2 — STAFF CREATE LEAD ("New Query")
# =============================================================================
#
# Response (201):
# { "success": true, "data": <LeadWithDetails> }
#
# Notes:
#   - Non-admin staff: clinicId is taken from JWT (body clinicId optional)
#   - Director / super admin: must pass clinicId in body if JWT has no clinicId
#   - status defaults to "new_query"
#
# source values: call | whatsapp | website | walk_in | referral | qr_self

curl -X POST "${LEADS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Jane Doe",
    "phone": "9123456789",
    "email": "jane@example.com",
    "source": "call",
    "symptoms": "Tooth pain since 2 days",
    "notes": "Walk-in enquiry at reception"
  }'

# Staff create with explicit clinicId (Director / super admin)
curl -X POST "${LEADS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "name": "Ravi Kumar",
    "phone": "9988776655",
    "source": "walk_in",
    "symptoms": "Bleeding gums"
  }'


# =============================================================================
# STEP 3 — LIST LEADS (Kanban / table)
# =============================================================================
#
# Response (200):
# { "success": true, "data": { "items": [...], "pagination": {...} } }

# List all leads for caller's clinic (default page 1, limit 10)
curl -X GET "${LEADS}/" \
  -H "${AUTH_HEADER}"

# List with filters
curl -X GET "${LEADS}/?page=1&limit=20&status=new_query&search=jane" \
  -H "${AUTH_HEADER}"

# Director / super admin — filter by clinic
curl -X GET "${LEADS}/?clinicId=${CLINIC_ID}&status=appointment_booked" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 4 — GET LEAD BY ID
# =============================================================================
#
# Response (200):
# { "success": true, "data": <LeadWithDetails> }
#
# Error (404):
# { "success": false, "message": "Lead not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access leads from another clinic" }

curl -X GET "${LEADS}/${LEAD_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 5 — BOOK APPOINTMENT ON LEAD
# Opens when moving lead to "appointment_booked" in the UI
# =============================================================================
#
# Response (200):
# { "success": true, "data": <LeadWithDetails with appointment populated> }
#
# Notes:
#   - Creates a new appointments row OR updates existing scheduled appointment
#   - Sets lead status to "appointment_booked"
#   - Provide either scheduledAt (ISO datetime) OR appointmentDate + appointmentTime
#   - employeeId must be an active employee with Doctor role in the same clinic
#
# Error (400) — use book endpoint instead of PATCH status:
# { "success": false, "message": "Use the book-appointment endpoint to move a lead to appointment_booked" }

# Option A: date + time (matches frontend book dialog)
curl -X POST "${LEADS}/${LEAD_ID}/book-appointment" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "appointmentDate": "2026-06-10",
    "appointmentTime": "09:00",
    "employeeId": "'"${DOCTOR_ID}"'",
    "symptoms": "Tooth pain since 2 days"
  }'

# Option B: ISO scheduledAt
curl -X POST "${LEADS}/${LEAD_ID}/book-appointment" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "scheduledAt": "2026-06-10T09:00:00.000Z",
    "employeeId": "'"${DOCTOR_ID}"'"
  }'

# Rebook — updates existing scheduled appointment for the same lead
curl -X POST "${LEADS}/${LEAD_ID}/book-appointment" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "appointmentDate": "2026-06-11",
    "appointmentTime": "10:30",
    "employeeId": "'"${DOCTOR_ID}"'"
  }'


# =============================================================================
# STEP 6 — UPDATE LEAD STATUS (Kanban drag / "Move to…")
# =============================================================================
#
# Response (200):
# { "success": true, "data": <LeadWithDetails> }
#
# status values:
#   new_query | appointment_booked | follow_up | clinic_visited | no_show
#
# Rules:
#   - Do NOT use this endpoint for appointment_booked — use book-appointment
#   - Moving to clinic_visited sets linked scheduled appointment → completed
#   - Moving to no_show sets linked scheduled appointment → no_show
#
# Error (400):
# { "success": false, "message": "Use the book-appointment endpoint to move a lead to appointment_booked" }

# Move to follow-up (after booking)
curl -X PATCH "${LEADS}/${LEAD_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "follow_up"
  }'

# Mark clinic visited (terminal)
curl -X PATCH "${LEADS}/${LEAD_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "clinic_visited"
  }'

# Mark no-show (terminal)
curl -X PATCH "${LEADS}/${LEAD_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "no_show"
  }'

# Move back to new_query (manual override from card menu)
curl -X PATCH "${LEADS}/${LEAD_ID}/status" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "status": "new_query"
  }'


# =============================================================================
# STEP 7 — EDIT LEAD DETAILS
# =============================================================================
#
# Response (200):
# { "success": true, "data": <LeadWithDetails> }
#
# At least one field is required in the body.
#
# Error (400):
# { "success": false, "message": "At least one field is required" }

curl -X PUT "${LEADS}/${LEAD_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Jane Doe Updated",
    "phone": "9123456780",
    "email": "jane.updated@example.com",
    "symptoms": "Sharp pain in upper right molar",
    "notes": "Called back — prefers morning slot"
  }'

# Update source
curl -X PUT "${LEADS}/${LEAD_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "source": "whatsapp"
  }'

# Clear email (nullable)
curl -X PUT "${LEADS}/${LEAD_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "email": null
  }'


# =============================================================================
# STEP 8 — CONVERT LEAD TO PATIENT
# Link existing patient on first clinic visit
# =============================================================================
#
# Response (200):
# { "success": true, "data": <LeadWithDetails with patientId set> }
#
# Behavior:
#   - If lead already has patientId → returns lead unchanged
#   - If patientId provided → links that patient
#   - If no patientId → matches patient by phone + clinicId
#   - Also updates appointments.leadId rows with the patientId
#
# Error (404):
# { "success": false, "message": "Patient not found. Register the patient first or provide patientId" }

# Auto-match by phone within clinic
curl -X POST "${LEADS}/${LEAD_ID}/convert-to-patient" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{}'

# Link specific patient
curl -X POST "${LEADS}/${LEAD_ID}/convert-to-patient" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'"
  }'


# =============================================================================
# EXAMPLE FULL FLOW (copy-paste sequence)
# =============================================================================
#
# 1. Login → export TOKEN
# 2. POST /api/leads/public or POST /api/leads/        → save LEAD_ID from response.data.id
# 3. GET  /api/leads/                                   → verify in list
# 4. POST /api/leads/:id/book-appointment               → status becomes appointment_booked
# 5. PATCH /api/leads/:id/status  { "status": "follow_up" }
# 6. PATCH /api/leads/:id/status  { "status": "clinic_visited" }
# 7. POST /api/leads/:id/convert-to-patient             → link patient record
#
# =============================================================================
# VALIDATION ERROR EXAMPLES
# =============================================================================
#
# Missing required field (400):
# { "success": false, "message": "name: Invalid input: expected string, received undefined" }
#
# Invalid source (400):
# { "success": false, "message": "source: Invalid option: expected one of \"call\"|\"whatsapp\"|..." }
#
# Invalid UUID (400):
# { "success": false, "message": "id: Invalid UUID" }
#
# Book without date/time (400):
# { "success": false, "message": "Provide scheduledAt or both appointmentDate and appointmentTime" }
#
# Clinic not found (404):
# { "success": false, "message": "Clinic not found" }
#
# Doctor not in clinic (404):
# { "success": false, "message": "Employee not found" }
#
# =============================================================================
