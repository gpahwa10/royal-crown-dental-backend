#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Consultations & Prescriptions API cURLs (flow order)
# =============================================================================
#
# Consultations base:  http://localhost:4000/api/consultations
# Prescriptions base:  http://localhost:4000/api/prescriptions
# Patient routes:      http://localhost:4000/api/patients
# Auth:                All routes require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export PATIENT_ID="<patient-uuid>"
#   export DOCTOR_ID="<employee-uuid-with-doctor-role>"
#   export APPOINTMENT_ID="<appointment-uuid>"
#   export CONSULTATION_ID="<consultation-uuid>"
#   export PRESCRIPTION_ID="<prescription-uuid>"
#
# Business rule:
#   Consultations MUST reference patientId only (never leadId).
#   Flow: Lead → Appointment → Patient Registration → Patient → Consultation
#
# Flow:
#   Login → List patients (doctor / reception / assistant)
#   → Create consultation (walk-in or from appointment)
#   → Start → Update (diagnosis, notes, consent) → Complete
#   → Create prescription → Update prescription
#   → View via patient details / patient consultations / prescriptions
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
#   200 — OK
#   201 — Created
#   400 — Validation or business rule error
#   401 — Missing or invalid JWT
#   403 — Clinic access denied
#   404 — Patient, doctor, clinic, consultation, prescription, or appointment not found
#   409 — Prescription already exists for consultation
#
# -----------------------------------------------------------------------------
# Consultation object
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "consultationCode": "CON000001",
#   "clinicId": "uuid",
#   "patientId": "uuid",
#   "doctorId": "uuid",
#   "appointmentId": "uuid | null",
#   "chiefComplaint": "Severe tooth pain",
#   "diagnosis": "Dental caries | null",
#   "treatmentPlan": "Root canal | null",
#   "clinicalNotes": "Patient anxious | null",
#   "nextVisitDate": "2026-07-01T00:00:00.000Z | null",
#   "status": "draft | in_progress | completed | cancelled",
#   "consentRequired": false,
#   "consentSigned": false,
#   "consentSignatureUrl": null,
#   "consentSignedAt": null,
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:30:00.000Z"
# }
#
# Status lifecycle:
#   draft → in_progress (POST /start)
#   in_progress → completed (POST /complete)
#
# -----------------------------------------------------------------------------
# Prescription object (with items)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "consultationId": "uuid",
#   "patientId": "uuid",
#   "doctorId": "uuid",
#   "notes": "Take after food | null",
#   "createdAt": "2026-06-07T11:00:00.000Z",
#   "updatedAt": "2026-06-07T11:00:00.000Z",
#   "items": [
#     {
#       "id": "uuid",
#       "prescriptionId": "uuid",
#       "medicineName": "Amoxicillin",
#       "dosage": "500mg",
#       "frequency": "Twice Daily",
#       "duration": "5 Days",
#       "instructions": "After Food",
#       "createdAt": "2026-06-07T11:00:00.000Z"
#     }
#   ]
# }
#
# -----------------------------------------------------------------------------
# GET consultation response — GET /api/consultations/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "consultation": { <Consultation> },
#     "prescriptions": [ <Prescription with items>, ... ]
#   }
# }
#
# -----------------------------------------------------------------------------
# Patient details (consultations section) — GET /api/patients/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "patient": {},
#     "medicalProfile": {},
#     "consents": {},
#     "appointments": [],
#     "consultations": [ <Consultation>, ... ],
#     "prescriptions": [ <Prescription with items>, ... ],
#     "labRequests": [],
#     "radiographs": [],
#     "invoices": [],
#     "timeline": [
#       { "type": "patient_registered", "date": "..." },
#       { "type": "consultation_draft", "date": "..." },
#       { "type": "consultation_completed", "date": "..." }
#     ]
#   }
# }
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
CONSULTATIONS="${BASE_URL}/api/consultations"
PRESCRIPTIONS="${BASE_URL}/api/prescriptions"
PATIENTS="${BASE_URL}/api/patients"


# =============================================================================
# STEP 0 — LOGIN (get JWT)
# =============================================================================
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "token": "<jwt>",
#     "roles": ["Doctor"],
#     "isSuperAdmin": false,
#     "hasPlatformAdminAccess": false,
#     "clinicId": "<clinic-uuid>"
#   }
# }

curl -X POST "${BASE_URL}/api/auth/login" \
  -H "${JSON_HEADER}" \
  -d '{
    "email": "doctor@yourvcare.com",
    "password": "YourPassword123"
  }'


# =============================================================================
# STEP 0.5 — LIST PATIENTS (consultation picker)
# =============================================================================
#
# GET /api/consultations/patients
#
# Access: Doctor, Assistant, Reception, Director, super admin
# Clinic staff see patients for their JWT clinicId only.
# Directors / super admins may pass ?clinicId=<uuid>.
#
# Query: page, limit, search, clinicId (admin only), isBlackListed (true|false)
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "items": [ { "id", "patientCode", "name", "phone", ... } ],
#     "pagination": { "page", "limit", "total", "totalPages" }
#   }
# }
#
# Error (403):
# { "success": false, "message": "You are not allowed to list patients for consultations" }

curl -G "${CONSULTATIONS}/patients" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20" \
  --data-urlencode "search=john"

# Director / super admin — optional clinic filter
curl -G "${CONSULTATIONS}/patients" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "clinicId=${CLINIC_ID}" \
  --data-urlencode "search=98765"


# =============================================================================
# STEP 1 — CREATE CONSULTATION
# =============================================================================
#
# Response (201):
# { "success": true, "data": <Consultation with status "draft"> }
#
# Notes:
#   - patientId is required (registered patient only — never a lead)
#   - doctorId must be an active Doctor in the same clinic
#   - appointmentId is optional (walk-in allowed)
#   - If appointmentId provided: appointment.patientId must match patientId
#   - consultationCode auto-generated: CON000001, CON000002, ...
#
# Error (404):
# { "success": false, "message": "Patient not found" }
# { "success": false, "message": "Doctor not found" }
# { "success": false, "message": "Appointment does not belong to this patient" }

# Walk-in consultation (no appointment)
curl -X POST "${CONSULTATIONS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientId": "'"${PATIENT_ID}"'",
    "doctorId": "'"${DOCTOR_ID}"'",
    "chiefComplaint": "Severe pain in lower left molar since 3 days"
  }'

# Consultation linked to appointment
curl -X POST "${CONSULTATIONS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientId": "'"${PATIENT_ID}"'",
    "doctorId": "'"${DOCTOR_ID}"'",
    "appointmentId": "'"${APPOINTMENT_ID}"'",
    "chiefComplaint": "Follow-up for scheduled appointment"
  }'


# =============================================================================
# STEP 2 — GET CONSULTATION BY ID
# =============================================================================
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "consultation": { <Consultation> },
#     "prescriptions": []
#   }
# }
#
# Error (404):
# { "success": false, "message": "Consultation not found" }

curl -X GET "${CONSULTATIONS}/${CONSULTATION_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 3 — UPDATE CONSULTATION
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Consultation> }
#
# Allowed: chiefComplaint, diagnosis, treatmentPlan, clinicalNotes,
#          nextVisitDate, consentRequired, consentSigned, consentSignatureUrl
# Not allowed: patientId, doctorId, clinicId, consultationCode
#
# Error (400):
# { "success": false, "message": "Cannot update a cancelled consultation" }

curl -X PUT "${CONSULTATIONS}/${CONSULTATION_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "diagnosis": "Irreversible pulpitis — tooth #36",
    "treatmentPlan": "Root canal treatment in two sittings",
    "clinicalNotes": "Patient reports pain on hot/cold stimulus",
    "nextVisitDate": "2026-07-01",
    "consentRequired": true,
    "consentSigned": true,
    "consentSignatureUrl": "https://storage.example.com/signatures/abc123.png"
  }'

# Update chief complaint only
curl -X PUT "${CONSULTATIONS}/${CONSULTATION_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "chiefComplaint": "Updated complaint — sensitivity persists"
  }'


# =============================================================================
# STEP 4 — START CONSULTATION
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Consultation with status "in_progress"> }
#
# Flow: draft → in_progress
#
# Error (400):
# { "success": false, "message": "Only draft consultations can be started" }

curl -X POST "${CONSULTATIONS}/${CONSULTATION_ID}/start" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{}'


# =============================================================================
# STEP 5 — COMPLETE CONSULTATION
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Consultation with status "completed"> }
#
# Flow: in_progress → completed
#
# Requirements before completion:
#   - diagnosis must be set
#   - if consentRequired = true, consentSigned must be true
#
# Error (400):
# { "success": false, "message": "Diagnosis is required before completing consultation" }
# { "success": false, "message": "Consent required before completion" }
# { "success": false, "message": "Only in-progress consultations can be completed" }

curl -X POST "${CONSULTATIONS}/${CONSULTATION_ID}/complete" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{}'


# =============================================================================
# STEP 6 — CREATE PRESCRIPTION FOR CONSULTATION
# =============================================================================
#
# Response (201):
# { "success": true, "data": <Prescription with items> }
#
# Rules:
#   - One prescription per consultation (0..1)
#   - Consultation must not be cancelled
#   - items array requires at least one item
#   - Uses transaction (prescription + items created together)
#
# Error (409):
# { "success": false, "message": "Prescription already exists for this consultation" }
#
# Error (400):
# { "success": false, "message": "Cannot add prescription to a cancelled consultation" }

curl -X POST "${CONSULTATIONS}/${CONSULTATION_ID}/prescription" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "notes": "Take medicines after food. Complete full course.",
    "items": [
      {
        "medicineName": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "Twice Daily",
        "duration": "5 Days",
        "instructions": "After Food"
      },
      {
        "medicineName": "Ibuprofen",
        "dosage": "400mg",
        "frequency": "As Needed",
        "duration": "3 Days",
        "instructions": "For pain relief"
      }
    ]
  }'


# =============================================================================
# STEP 7 — GET PRESCRIPTION BY ID
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Prescription with items> }
#
# Error (404):
# { "success": false, "message": "Prescription not found" }

curl -X GET "${PRESCRIPTIONS}/${PRESCRIPTION_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 8 — UPDATE PRESCRIPTION
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Prescription with items> }
#
# Rules:
#   - Editable unless consultation is cancelled
#   - Updating items replaces all existing items (transaction)
#   - At least one field required
#
# Error (400):
# { "success": false, "message": "Cannot update prescription for a cancelled consultation" }

curl -X PUT "${PRESCRIPTIONS}/${PRESCRIPTION_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "notes": "Updated: take with plenty of water",
    "items": [
      {
        "medicineName": "Amoxicillin",
        "dosage": "500mg",
        "frequency": "Three Times Daily",
        "duration": "7 Days",
        "instructions": "After Food"
      }
    ]
  }'

# Update notes only
curl -X PUT "${PRESCRIPTIONS}/${PRESCRIPTION_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "notes": "Patient allergic to penicillin — switched medication"
  }'


# =============================================================================
# STEP 9 — LIST PATIENT CONSULTATIONS
# =============================================================================
#
# Response (200):
# { "success": true, "data": [ <Consultation>, ... ] }

curl -X GET "${PATIENTS}/${PATIENT_ID}/consultations" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 10 — LIST PATIENT PRESCRIPTIONS
# =============================================================================
#
# Response (200):
# { "success": true, "data": [ <Prescription with items>, ... ] }

curl -X GET "${PATIENTS}/${PATIENT_ID}/prescriptions" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 11 — PATIENT DETAILS (includes consultations + prescriptions)
# =============================================================================
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "patient": {},
#     "medicalProfile": {},
#     "consents": {},
#     "appointments": [],
#     "consultations": [ <Consultation>, ... ],
#     "prescriptions": [ <Prescription with items>, ... ],
#     "labRequests": [],
#     "radiographs": [],
#     "invoices": [],
#     "timeline": []
#   }
# }

curl -X GET "${PATIENTS}/${PATIENT_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# EXAMPLE FULL FLOW
# =============================================================================
#
# Prerequisites:
#   - Registered patient (POST /api/patients)
#   - Optional: appointment with patientId set (POST /api/appointments)
#
# 1. Login → export TOKEN
# 2. POST /api/consultations/                    → save CONSULTATION_ID
# 3. POST /api/consultations/:id/start           → status: in_progress
# 4. PUT  /api/consultations/:id                → set diagnosis, treatment plan
# 5. POST /api/consultations/:id/prescription    → save PRESCRIPTION_ID
# 6. POST /api/consultations/:id/complete        → status: completed
# 7. GET  /api/consultations/:id                → view consultation + prescriptions
# 8. GET  /api/patients/:id                     → full patient profile
#
# Note: Create prescription BEFORE completing if you need to edit it.
#       Prescriptions are read-only once consultation is completed.
#
# =============================================================================
# ROUTE REFERENCE
# =============================================================================
#
# Consultations (/api/consultations):
# | Method | Path                        | Purpose                    |
# |--------|-----------------------------|----------------------------|
# | POST   | /                           | Create consultation        |
# | GET    | /:id                        | Get consultation + Rx      |
# | PUT    | /:id                        | Update consultation        |
# | POST   | /:id/start                  | Start (draft → in_progress)|
# | POST   | /:id/complete               | Complete consultation      |
# | POST   | /:id/prescription           | Create prescription        |
#
# Prescriptions (/api/prescriptions):
# | Method | Path    | Purpose              |
# |--------|---------|----------------------|
# | GET    | /:id    | Get prescription     |
# | PUT    | /:id    | Update prescription  |
#
# Patient integration (/api/patients):
# | Method | Path                        | Purpose                    |
# |--------|-----------------------------|----------------------------|
# | GET    | /:patientId/consultations   | List patient consultations |
# | GET    | /:patientId/prescriptions   | List patient prescriptions   |
# | GET    | /:id                        | Full details + timeline    |
#
# =============================================================================
# VALIDATION ERROR EXAMPLES
# =============================================================================
#
# Missing chiefComplaint (400):
# { "success": false, "message": "chiefComplaint: Invalid input: expected string, received undefined" }
#
# Appointment patient mismatch (400):
# { "success": false, "message": "Appointment does not belong to this patient" }
#
# Appointment without patient (400):
# { "success": false, "message": "Appointment must be linked to a registered patient before starting a consultation" }
#
# Start non-draft (400):
# { "success": false, "message": "Only draft consultations can be started" }
#
# Complete without diagnosis (400):
# { "success": false, "message": "Diagnosis is required before completing consultation" }
#
# Consent not signed (400):
# { "success": false, "message": "Consent required before completion" }
#
# Duplicate prescription (409):
# { "success": false, "message": "Prescription already exists for this consultation" }
#
# Clinic access denied (403):
# { "success": false, "message": "You cannot access consultations from another clinic" }
#
# =============================================================================
