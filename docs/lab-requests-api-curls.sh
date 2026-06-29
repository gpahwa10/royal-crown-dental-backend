#!/usr/bin/env bash
# =============================================================================
# Dental Backend — Lab Requests & Lab Reports API cURLs (flow order)
# =============================================================================
#
# Lab requests base:  http://localhost:4000/api/lab-requests
# Patient routes:     http://localhost:4000/api/patients
# Auth:              All routes require Authorization: Bearer <token>
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export CLINIC_ID="<clinic-uuid>"
#   export PATIENT_ID="<patient-uuid>"
#   export DOCTOR_ID="<employee-uuid-with-doctor-role>"
#   export CONSULTATION_ID="<consultation-uuid>"   # optional
#   export LAB_REQUEST_ID="<lab-request-uuid>"
#
# Business rules:
#   - consultationId is optional (standalone request or during consultation)
#   - At least one test is required when creating a request
#   - Status transitions are forward-only (no skipping, no backwards)
#   - Report upload is independent — it does NOT change status
#
# Workflow:
#   Login
#   → Create request (status: sample_collected)
#   → PATCH /examination (status: under_examination)
#   → PATCH /deliver (status: delivered)
#   → POST /report (optional — attach report file)
#   → View via GET /:id, patient details, or patient lab-requests list
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
#   400 — Validation, invalid status transition, or business rule error
#   401 — Missing or invalid JWT
#   403 — Clinic access denied
#   404 — Lab request, patient, doctor, clinic, or consultation not found
#
# -----------------------------------------------------------------------------
# Lab request object (lab_requests table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "labRequestCode": "LAB000001",
#   "consultationId": "uuid | null",
#   "patientId": "uuid",
#   "doctorId": "uuid",
#   "clinicId": "uuid",
#   "externalLabName": "City Diagnostics | null",
#   "notes": "Fasting sample | null",
#   "status": "sample_collected | under_examination | delivered",
#   "collectedDate": "2026-06-07T10:00:00.000Z",
#   "underExaminationDate": "2026-06-08T09:00:00.000Z | null",
#   "deliveredDate": "2026-06-09T14:00:00.000Z | null",
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-09T14:00:00.000Z"
# }
#
# Status lifecycle:
#   sample_collected → under_examination  (PATCH /:id/examination)
#   under_examination → delivered         (PATCH /:id/deliver)
#   delivered → terminal                  (report upload does not change status)
#
# -----------------------------------------------------------------------------
# Lab request test object (lab_request_tests table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "labRequestId": "uuid",
#   "testName": "CBC"
# }
#
# -----------------------------------------------------------------------------
# Lab report object (lab_reports table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "labRequestId": "uuid",
#   "reportName": "CBC_Report.pdf",
#   "reportUrl": "https://storage.example.com/reports/cbc-report.pdf",
#   "uploadedAt": "2026-06-10T11:00:00.000Z"
# }
#
# -----------------------------------------------------------------------------
# Lab request details — GET /api/lab-requests/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "request": { <Lab request object> },
#     "tests": [ <Lab request test object>, ... ],
#     "report": <Lab report object> | null
#   }
# }
#
# -----------------------------------------------------------------------------
# Patient lab request summary — GET /api/patients/:patientId/lab-requests
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": [
#     {
#       "id": "uuid",
#       "labRequestCode": "LAB000001",
#       "status": "delivered",
#       "tests": [ <Lab request test object>, ... ],
#       "report": <Lab report object> | null
#     }
#   ]
# }
#
# Ordered newest first.
#
# -----------------------------------------------------------------------------
# Patient details (labRequests section) — GET /api/patients/:id
# -----------------------------------------------------------------------------
#
# {
#   "success": true,
#   "data": {
#     "patient": {},
#     "medicalProfile": {},
#     "consents": {},
#     "appointments": [],
#     "consultations": [],
#     "prescriptions": [],
#     "labRequests": [
#       {
#         "id": "uuid",
#         "labRequestCode": "LAB000001",
#         "status": "delivered",
#         "tests": [ <Lab request test object>, ... ],
#         "report": <Lab report object> | null
#       }
#     ],
#     "radiographs": [],
#     "invoices": [],
#     "timeline": [
#       { "type": "patient_registered", "date": "..." },
#       { "type": "lab_request_created", "date": "..." },
#       { "type": "lab_request_under_examination", "date": "..." },
#       { "type": "lab_request_delivered", "date": "..." },
#       { "type": "lab_report_uploaded", "date": "..." }
#     ]
#   }
# }
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
LAB_REQUESTS="${BASE_URL}/api/lab-requests"
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
# STEP 1 — CREATE LAB REQUEST
# =============================================================================
#
# POST /api/lab-requests
#
# Creates a lab request with status sample_collected.
# labRequestCode is auto-generated (LAB000001, LAB000002, ...).
# consultationId is optional — omit for standalone requests from Lab page.
#
# Request body:
# {
#   "patientId": "<uuid>",
#   "doctorId": "<uuid>",
#   "clinicId": "<uuid>",           // optional for clinic staff (uses JWT clinicId)
#   "consultationId": null,         // optional — link to active consultation
#   "externalLabName": "City Diagnostics",
#   "tests": ["CBC", "HbA1C"],
#   "notes": "Fasting sample required"
# }
#
# Response (201):
# {
#   "success": true,
#   "data": {
#     "request": {
#       "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#       "labRequestCode": "LAB000001",
#       "consultationId": null,
#       "patientId": "patient-uuid",
#       "doctorId": "doctor-uuid",
#       "clinicId": "clinic-uuid",
#       "externalLabName": "City Diagnostics",
#       "notes": "Fasting sample required",
#       "status": "sample_collected",
#       "collectedDate": "2026-06-07T10:00:00.000Z",
#       "underExaminationDate": null,
#       "deliveredDate": null,
#       "createdAt": "2026-06-07T10:00:00.000Z",
#       "updatedAt": "2026-06-07T10:00:00.000Z"
#     },
#     "tests": [
#       {
#         "id": "test-uuid-1",
#         "labRequestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#         "testName": "CBC"
#       },
#       {
#         "id": "test-uuid-2",
#         "labRequestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#         "testName": "HbA1C"
#       }
#     ],
#     "report": null
#   }
# }
#
# Error (400):
# { "success": false, "message": "At least one test required" }
#
# Error (404):
# { "success": false, "message": "Patient not found" }
# { "success": false, "message": "Doctor not found" }
# { "success": false, "message": "Clinic not found" }
# { "success": false, "message": "Consultation not found" }

# Standalone lab request (no consultation)
curl -X POST "${LAB_REQUESTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'",
    "doctorId": "'"${DOCTOR_ID}"'",
    "clinicId": "'"${CLINIC_ID}"'",
    "externalLabName": "City Diagnostics",
    "tests": ["CBC", "HbA1C"],
    "notes": "Fasting sample required"
  }'

# Lab request linked to a consultation
curl -X POST "${LAB_REQUESTS}/" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'",
    "doctorId": "'"${DOCTOR_ID}"'",
    "clinicId": "'"${CLINIC_ID}"'",
    "consultationId": "'"${CONSULTATION_ID}"'",
    "externalLabName": "Metro Path Lab",
    "tests": ["Blood Sugar Fasting", "Lipid Profile"],
    "notes": "Ordered during consultation"
  }'


# =============================================================================
# STEP 2 — LIST LAB REQUESTS
# =============================================================================
#
# GET /api/lab-requests
#
# Query params:
#   page       — default 1
#   limit      — default 20, max 100
#   search     — matches labRequestCode, patient name, externalLabName
#   clinicId   — filter by clinic (directors / super admins)
#   doctorId   — filter by ordering doctor
#   status     — sample_collected | under_examination | delivered
#
# Clinic staff are scoped to their JWT clinicId automatically.
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "items": [
#       {
#         "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#         "labRequestCode": "LAB000001",
#         "consultationId": null,
#         "patientId": "patient-uuid",
#         "doctorId": "doctor-uuid",
#         "clinicId": "clinic-uuid",
#         "externalLabName": "City Diagnostics",
#         "notes": "Fasting sample required",
#         "status": "sample_collected",
#         "collectedDate": "2026-06-07T10:00:00.000Z",
#         "underExaminationDate": null,
#         "deliveredDate": null,
#         "createdAt": "2026-06-07T10:00:00.000Z",
#         "updatedAt": "2026-06-07T10:00:00.000Z",
#         "tests": [
#           { "id": "test-uuid-1", "labRequestId": "...", "testName": "CBC" },
#           { "id": "test-uuid-2", "labRequestId": "...", "testName": "HbA1C" }
#         ],
#         "report": null
#       }
#     ],
#     "total": 1,
#     "page": 1,
#     "limit": 20
#   }
# }

curl -G "${LAB_REQUESTS}/" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20"

# Search by code, patient name, or external lab
curl -G "${LAB_REQUESTS}/" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "search=CBC" \
  --data-urlencode "status=sample_collected"

# Filter by doctor
curl -G "${LAB_REQUESTS}/" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "doctorId=${DOCTOR_ID}" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20"

# Director / super admin — filter by clinic
curl -G "${LAB_REQUESTS}/" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "clinicId=${CLINIC_ID}" \
  --data-urlencode "status=under_examination"


# =============================================================================
# STEP 3 — GET LAB REQUEST BY ID
# =============================================================================
#
# GET /api/lab-requests/:id
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "request": { <Lab request object> },
#     "tests": [ <Lab request test object>, ... ],
#     "report": null
#   }
# }
#
# Error (404):
# { "success": false, "message": "Lab request not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access lab requests from another clinic" }

curl -X GET "${LAB_REQUESTS}/${LAB_REQUEST_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 4 — MOVE TO UNDER EXAMINATION
# =============================================================================
#
# PATCH /api/lab-requests/:id/examination
#
# Transitions: sample_collected → under_examination
# Sets underExaminationDate to now().
#
# Request body: {} (empty object, or omit body)
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "request": {
#       "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#       "labRequestCode": "LAB000001",
#       "status": "under_examination",
#       "underExaminationDate": "2026-06-08T09:00:00.000Z",
#       ...
#     },
#     "tests": [ ... ],
#     "report": null
#   }
# }
#
# Error (400):
# { "success": false, "message": "Invalid status transition" }

curl -X PATCH "${LAB_REQUESTS}/${LAB_REQUEST_ID}/examination" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{}'


# =============================================================================
# STEP 5 — DELIVER LAB REQUEST
# =============================================================================
#
# PATCH /api/lab-requests/:id/deliver
#
# Transitions: under_examination → delivered
# Sets deliveredDate to now().
#
# Request body: {} (empty object, or omit body)
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "request": {
#       "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#       "labRequestCode": "LAB000001",
#       "status": "delivered",
#       "deliveredDate": "2026-06-09T14:00:00.000Z",
#       ...
#     },
#     "tests": [ ... ],
#     "report": null
#   }
# }
#
# Error (400):
# { "success": false, "message": "Invalid status transition" }

curl -X PATCH "${LAB_REQUESTS}/${LAB_REQUEST_ID}/deliver" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{}'


# =============================================================================
# STEP 6 — ATTACH LAB REPORT (via S3 upload fileId)
# =============================================================================
#
# POST /api/lab-requests/:id/report
#
# Attaches a registered S3 file after the request is delivered.
# Does NOT change request status. Backend never receives file bytes.
#
# Flow: POST /api/uploads/presign → PUT to S3 → POST /api/uploads/:id/register
# See docs/uploads-api-curls.sh for the full upload flow.
#
# Request body:
# {
#   "fileId": "<uploaded-file-uuid>",
#   "reportName": "CBC_Report.pdf"
# }
#
# reportName is optional — defaults to the file's originalFileName.
#
# Response (201):
# {
#   "success": true,
#   "data": {
#     "id": "report-uuid",
#     "labRequestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#     "fileId": "file-uuid",
#     "reportName": "CBC_Report.pdf",
#     "reportUrl": "s3://bucket/clinics/.../CBC_Report.pdf",
#     "uploadedAt": "2026-06-10T11:00:00.000Z"
#   }
# }
#
# Error (400):
# { "success": false, "message": "Report upload before delivery" }
# { "success": false, "message": "File is not ready for attachment" }
# { "success": false, "message": "File must be of type lab_report" }

curl -X POST "${LAB_REQUESTS}/${LAB_REQUEST_ID}/report" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "fileId": "'"${FILE_ID}"'",
    "reportName": "CBC_Report.pdf"
  }'


# =============================================================================
# STEP 7 — LIST PATIENT LAB REQUESTS
# =============================================================================
#
# GET /api/patients/:patientId/lab-requests
#
# Returns all lab requests for a patient, newest first.
#
# Response (200):
# {
#   "success": true,
#   "data": [
#     {
#       "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#       "labRequestCode": "LAB000001",
#       "status": "delivered",
#       "tests": [
#         { "id": "test-uuid-1", "labRequestId": "...", "testName": "CBC" },
#         { "id": "test-uuid-2", "labRequestId": "...", "testName": "HbA1C" }
#       ],
#       "report": {
#         "id": "report-uuid",
#         "labRequestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#         "reportName": "CBC_Report.pdf",
#         "reportUrl": "https://storage.example.com/reports/cbc-report.pdf",
#         "uploadedAt": "2026-06-10T11:00:00.000Z"
#       }
#     }
#   ]
# }
#
# Error (404):
# { "success": false, "message": "Patient not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access patients from another clinic" }

curl -X GET "${PATIENTS}/${PATIENT_ID}/lab-requests" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 8 — PATIENT DETAILS (includes labRequests + timeline)
# =============================================================================
#
# GET /api/patients/:id
#
# labRequests[] and timeline lab events are populated automatically.
# See RESPONSE STRUCTURES section above for full shape.
#
# Response (200) — labRequests excerpt:
# {
#   "success": true,
#   "data": {
#     "patient": { ... },
#     "labRequests": [
#       {
#         "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#         "labRequestCode": "LAB000001",
#         "status": "delivered",
#         "tests": [ ... ],
#         "report": { ... }
#       }
#     ],
#     "timeline": [
#       { "type": "lab_request_created", "date": "2026-06-07T10:00:00.000Z" },
#       { "type": "lab_request_under_examination", "date": "2026-06-08T09:00:00.000Z" },
#       { "type": "lab_request_delivered", "date": "2026-06-09T14:00:00.000Z" },
#       { "type": "lab_report_uploaded", "date": "2026-06-10T11:00:00.000Z" }
#     ]
#   }
# }

curl -X GET "${PATIENTS}/${PATIENT_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# ERROR REFERENCE
# =============================================================================
#
# | Message                              | Status | When                                    |
# |--------------------------------------|--------|-----------------------------------------|
# | Lab request not found                | 404    | Invalid :id                             |
# | Patient not found                    | 404    | Invalid patientId                       |
# | Doctor not found                     | 404    | Invalid or non-doctor employeeId        |
# | Clinic not found                     | 404    | Invalid clinicId                        |
# | Consultation not found               | 404    | Invalid consultationId                    |
# | At least one test required           | 400    | Empty tests array on create             |
# | Invalid status transition            | 400    | Wrong current status for PATCH          |
# | Report upload before delivery        | 400    | POST /report when status != delivered   |
# | You cannot access lab requests ...   | 403    | Cross-clinic access by employee         |
# | You cannot access patients ...       | 403    | Cross-clinic patient access             |
# | clinicId is required                 | 400    | Admin create without clinicId           |
#
# Invalid transition examples:
#   PATCH /examination when status is under_examination → 400
#   PATCH /deliver when status is sample_collected      → 400
#   POST /report when status is sample_collected        → 400
