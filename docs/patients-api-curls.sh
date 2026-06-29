#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Patients API cURLs (Phase 1, flow order)
# =============================================================================
#
# Base URL:  http://localhost:4000/api/patients
# Auth:      All routes require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export PATIENT_ID="<patient-uuid>"
#
# Flow:
#   Login → Register patient → List (paginated) → Get details
#   → Update → Blacklist
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
#   200 — OK (read / update / blacklist)
#   201 — Created (register patient)
#   400 — Validation or business rule error
#   401 — Missing or invalid JWT
#   403 — Clinic access denied
#   404 — Patient / clinic / medical profile not found
#   409 — Duplicate email or phone in clinic
#
# -----------------------------------------------------------------------------
# Patient object (identity — patients table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "patientCode": "PAT000001",
#   "clinicId": "uuid",
#   "patientType": "new | existing",
#   "name": "Jane Doe",
#   "phone": "9876543210",
#   "email": "jane@example.com | null",
#   "gender": "Female",
#   "dateOfBirth": "1990-05-15T00:00:00.000Z",
#   "address": "123 Main St, Delhi | null",
#   "emergencyContactName": "John Doe | null",
#   "emergencyContactPhone": "9876543211 | null",
#   "emergencyContactRelation": "Spouse | null",
#   "isPremiumMember": false,
#   "isBlackListed": false,
#   "blackListedReason": null,
#   "lastVisitAt": null,
#   "isActive": true,
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:00:00.000Z"
# }
#
# -----------------------------------------------------------------------------
# Medical profile object (patient_medical_profiles table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "patientId": "uuid",
#   "allergies": ["Penicillin"],
#   "currentMedications": ["Metformin"],
#   "chronicConditions": ["Diabetes"],
#   "pregnancyStatus": "Not Applicable | Pregnant | Not Pregnant",
#   "dentalAnxiety": "none | mild | moderate | severe",
#   "lastDentalVisit": "2025-01-10T00:00:00.000Z | null",
#   "lastXrayDate": "2024-06-01T00:00:00.000Z | null",
#   "primaryPhysicianName": "Dr. Smith | null",
#   "primaryPhysicianPhone": "9876500000 | null",
#   "initialChiefComplaint": "Severe tooth pain | null",
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:00:00.000Z"
# }
#
# -----------------------------------------------------------------------------
# Consents object (patient_consents table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "patientId": "uuid",
#   "treatmentConsentSigned": true,
#   "privacyAccepted": true,
#   "acceptedAt": "2026-06-07T10:00:00.000Z",
#   "createdAt": "2026-06-07T10:00:00.000Z"
# }
#
# -----------------------------------------------------------------------------
# Register response — POST /api/patients
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "patient": { <Patient> },
#     "medicalProfile": { <MedicalProfile> },
#     "consents": { <Consents> }
#   }
# }
#
# -----------------------------------------------------------------------------
# List response — GET /api/patients and GET /api/patients/clinic/:clinicId
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "items": [ <Patient>, ... ],
#     "total": 42,
#     "page": 1,
#     "limit": 20
#   }
# }
#
# Query params:
#   page           — default 1
#   limit          — default 20, max 100
#   search         — matches patientCode, name, phone, email
#   clinicId       — filter by clinic (Director / super admin)
#   isBlackListed  — true | false
#
# -----------------------------------------------------------------------------
# Patient details response — GET /api/patients/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "patient": { <Patient> },
#     "medicalProfile": { <MedicalProfile> | null },
#     "consents": { <Consents> | null },
#     "appointments": [ ... ],
#     "consultations": [],
#     "prescriptions": [],
#     "labRequests": [],
#     "radiographs": [],
#     "invoices": [],
#     "timeline": [
#       { "type": "patient_registered", "date": "2026-06-07T10:00:00.000Z" },
#       { "type": "consent_signed", "date": "2026-06-07T10:00:00.000Z" },
#       { "type": "appointment_scheduled", "date": "2026-06-10T09:00:00.000Z" }
#     ]
#   }
# }
#
# -----------------------------------------------------------------------------
# Update response — PUT /api/patients/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "patient": { <Patient> },
#     "medicalProfile": { <MedicalProfile> | null },
#     "consents": { <Consents> | null }
#   }
# }
#
# Not updatable: patientCode, clinicId, patientType
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
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
# STEP 1 — REGISTER PATIENT (full registration flow)
# =============================================================================
#
# Response (201):
# { "success": true, "data": { "patient": {}, "medicalProfile": {}, "consents": {} } }
#
# Notes:
#   - patientCode auto-generated (PAT000001, PAT000002, ...)
#   - treatmentConsentSigned and privacyAccepted must both be true
#   - Non-admin staff: clinicId taken from JWT if omitted
#   - Director / super admin: must pass clinicId in body
#
# patientType: new | existing
# pregnancyStatus: Not Applicable | Pregnant | Not Pregnant
# dentalAnxiety: none | mild | moderate | severe
#
# Error (409) — duplicate phone in clinic:
# { "success": false, "message": "A patient with this phone already exists in this clinic" }
#
# Error (409) — duplicate email:
# { "success": false, "message": "A patient with this email already exists" }

curl -X POST "${PATIENTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientType": "new",
    "name": "Jane Doe",
    "phone": "9876543210",
    "email": "jane.doe@example.com",
    "gender": "Female",
    "dateOfBirth": "1990-05-15",
    "address": "123 Main St, Sector 8, Rohini, Delhi",
    "emergencyContactName": "John Doe",
    "emergencyContactPhone": "9876543211",
    "emergencyContactRelation": "Spouse",
    "allergies": ["Penicillin"],
    "currentMedications": ["Metformin"],
    "chronicConditions": ["Diabetes"],
    "pregnancyStatus": "Not Applicable",
    "dentalAnxiety": "mild",
    "lastDentalVisit": "2025-01-10",
    "lastXrayDate": "2024-06-01",
    "primaryPhysicianName": "Dr. Smith",
    "primaryPhysicianPhone": "9876500000",
    "initialChiefComplaint": "Severe tooth pain in lower left molar",
    "treatmentConsentSigned": true,
    "privacyAccepted": true
  }'

# Register existing patient type (returning patient)
curl -X POST "${PATIENTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "clinicId": "'"${CLINIC_ID}"'",
    "patientType": "existing",
    "name": "Ravi Kumar",
    "phone": "9123456789",
    "gender": "Male",
    "dateOfBirth": "1985-03-20",
    "treatmentConsentSigned": true,
    "privacyAccepted": true
  }'


# =============================================================================
# STEP 2 — LIST PATIENTS (paginated)
# =============================================================================
#
# Response (200):
# { "success": true, "data": { "items": [...], "total": 0, "page": 1, "limit": 20 } }

# Default list for caller's clinic
curl -X GET "${PATIENTS}/" \
  -H "${AUTH_HEADER}"

# Paginated with search
curl -X GET "${PATIENTS}/?page=1&limit=20&search=jane" \
  -H "${AUTH_HEADER}"

# Filter blacklisted patients
curl -X GET "${PATIENTS}/?isBlackListed=true" \
  -H "${AUTH_HEADER}"

# Director / super admin — filter by clinic
curl -X GET "${PATIENTS}/?clinicId=${CLINIC_ID}&page=1&limit=10" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 3 — LIST PATIENTS BY CLINIC
# =============================================================================
#
# Response (200):
# { "success": true, "data": { "items": [...], "total": 0, "page": 1, "limit": 20 } }
#
# Reuses the same list service as GET /api/patients

curl -X GET "${PATIENTS}/clinic/${CLINIC_ID}" \
  -H "${AUTH_HEADER}"

# With search and pagination
curl -X GET "${PATIENTS}/clinic/${CLINIC_ID}?page=1&limit=20&search=PAT000" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 4 — GET PATIENT DETAILS (future-ready)
# =============================================================================
#
# Response (200):
# { "success": true, "data": { patient, medicalProfile, consents, appointments, ... } }
#
# Error (404):
# { "success": false, "message": "Patient not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access patients from another clinic" }

curl -X GET "${PATIENTS}/${PATIENT_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 5 — UPDATE PATIENT
# =============================================================================
#
# Response (200):
# { "success": true, "data": { "patient": {}, "medicalProfile": {}, "consents": {} } }
#
# Updates patients + patient_medical_profiles in a transaction.
# At least one field is required.
# Not allowed: patientCode, clinicId, patientType

curl -X PUT "${PATIENTS}/${PATIENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "name": "Jane Doe Updated",
    "phone": "9876543210",
    "address": "456 New Address, Delhi",
    "allergies": ["Penicillin", "Latex"],
    "currentMedications": [],
    "chronicConditions": ["Diabetes"],
    "pregnancyStatus": "Not Pregnant",
    "dentalAnxiety": "moderate",
    "initialChiefComplaint": "Follow-up for root canal"
  }'

# Update email only
curl -X PUT "${PATIENTS}/${PATIENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "email": "jane.updated@example.com"
  }'

# Clear optional fields
curl -X PUT "${PATIENTS}/${PATIENT_ID}" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "email": null,
    "primaryPhysicianName": null
  }'


# =============================================================================
# STEP 6 — BLACKLIST PATIENT
# =============================================================================
#
# Response (200):
# { "success": true, "data": <Patient> }
#
# Body:
#   isBlackListed — boolean (required)
#   reason        — string (optional, used when blacklisting)

# Blacklist a patient
curl -X PATCH "${PATIENTS}/${PATIENT_ID}/blacklist" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "isBlackListed": true,
    "reason": "Repeated no-shows without notice"
  }'

# Remove from blacklist
curl -X PATCH "${PATIENTS}/${PATIENT_ID}/blacklist" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "isBlackListed": false
  }'


# =============================================================================
# EXAMPLE FULL FLOW
# =============================================================================
#
# 1. Login → export TOKEN
# 2. POST /api/patients/              → save PATIENT_ID from response.data.patient.id
# 3. GET  /api/patients/              → verify in paginated list
# 4. GET  /api/patients/clinic/:clinicId → filter by clinic
# 5. GET  /api/patients/:id           → full details + timeline + placeholders
# 6. PUT  /api/patients/:id           → update identity + medical profile
# 7. PATCH /api/patients/:id/blacklist → blacklist if needed
#
# =============================================================================
# ROUTE REFERENCE
# =============================================================================
#
# | Method | Path                            | Auth | Purpose                    |
# |--------|---------------------------------|------|----------------------------|
# | POST   | /api/patients                   | Yes  | Register patient           |
# | GET    | /api/patients                   | Yes  | Paginated list             |
# | GET    | /api/patients/clinic/:clinicId  | Yes  | Paginated list by clinic   |
# | GET    | /api/patients/:id               | Yes  | Patient details (full)     |
# | PUT    | /api/patients/:id               | Yes  | Update patient + medical   |
# | PATCH  | /api/patients/:id/blacklist     | Yes  | Blacklist / unblacklist    |
#
# =============================================================================
# VALIDATION ERROR EXAMPLES
# =============================================================================
#
# Treatment consent not signed (400):
# { "success": false, "message": "treatmentConsentSigned: Treatment consent must be signed" }
#
# Duplicate phone in clinic (409):
# { "success": false, "message": "A patient with this phone already exists in this clinic" }
#
# Duplicate email (409):
# { "success": false, "message": "A patient with this email already exists" }
#
# Patient not found (404):
# { "success": false, "message": "Patient not found" }
#
# Clinic not found (404):
# { "success": false, "message": "Clinic not found" }
#
# At least one field required on update (400):
# { "success": false, "message": "At least one field is required" }
#
# =============================================================================
