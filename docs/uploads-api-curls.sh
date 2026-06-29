#!/usr/bin/env bash
# =============================================================================
# Dental Backend — S3 Uploads API cURLs (presigned upload flow)
# =============================================================================
#
# Uploads base:   http://localhost:4000/api/uploads
# Patients base:  http://localhost:4000/api/patients
# Lab requests:   http://localhost:4000/api/lab-requests
# Auth:           All routes require Authorization: Bearer <token>
#
# Architecture (backend never receives file bytes):
#   1. POST /api/uploads/presign        → presigned PUT URL + pending file record
#   2. PUT  <uploadUrl>                 → browser / frontend uploads directly to S3
#   3. POST /api/uploads/:id/register   → confirm upload, mark file as uploaded
#   4. Attach fileId to module          → e.g. POST /api/lab-requests/:id/report
#
# Required environment variables (server):
#   AWS_REGION
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   S3_BUCKET_NAME
#   S3_PRESIGN_EXPIRES_IN_SECONDS   (optional, default 900)
#
# Setup (run once per session):
#   export BASE_URL="http://localhost:4000"
#   export TOKEN="<jwt-from-login>"
#   export PATIENT_ID="<patient-uuid>"
#   export FILE_ID="<file-uuid-from-presign>"
#   export LAB_REQUEST_ID="<lab-request-uuid>"
#   export LOCAL_FILE="./sample-report.pdf"
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
# -----------------------------------------------------------------------------
# File object (files table)
# -----------------------------------------------------------------------------
#
# {
#   "id": "uuid",
#   "patientId": "uuid",
#   "clinicId": "uuid",
#   "documentType": "lab_report | radiograph | prescription | invoice | consent | treatment | patient_document | other",
#   "originalFileName": "CBC_Report.pdf",
#   "objectKey": "clinics/{clinicId}/patients/{patientId}/lab_report/{fileId}/CBC_Report.pdf",
#   "bucket": "your-bucket-name",
#   "contentType": "application/pdf",
#   "fileSize": 245760,
#   "status": "pending_upload | uploaded | archived",
#   "uploadedBy": "employee-uuid | null",
#   "createdAt": "2026-06-07T10:00:00.000Z",
#   "updatedAt": "2026-06-07T10:01:00.000Z"
# }
#
# Allowed content types:
#   application/pdf, image/jpeg, image/png, image/webp, image/gif,
#   image/tiff, application/dicom, application/octet-stream
#
# Max file size: 50 MB
#
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:4000}"
TOKEN="${TOKEN:-YOUR_JWT_TOKEN}"

AUTH_HEADER="Authorization: Bearer ${TOKEN}"
JSON_HEADER="Content-Type: application/json"
UPLOADS="${BASE_URL}/api/uploads"
PATIENTS="${BASE_URL}/api/patients"
LAB_REQUESTS="${BASE_URL}/api/lab-requests"


# =============================================================================
# STEP 0 — LOGIN
# =============================================================================

curl -X POST "${BASE_URL}/api/auth/login" \
  -H "${JSON_HEADER}" \
  -d '{
    "email": "doctor@yourvcare.com",
    "password": "YourPassword123"
  }'


# =============================================================================
# STEP 1 — GENERATE PRESIGNED UPLOAD URL
# =============================================================================
#
# POST /api/uploads/presign
#
# Creates a pending file record owned by the patient.
# Returns a presigned PUT URL for direct S3 upload.
#
# Request:
# {
#   "patientId": "<uuid>",
#   "documentType": "lab_report",
#   "fileName": "CBC_Report.pdf",
#   "contentType": "application/pdf",
#   "fileSize": 245760
# }
#
# Response (201):
# {
#   "success": true,
#   "data": {
#     "file": {
#       "id": "file-uuid",
#       "patientId": "patient-uuid",
#       "clinicId": "clinic-uuid",
#       "documentType": "lab_report",
#       "originalFileName": "CBC_Report.pdf",
#       "objectKey": "clinics/.../CBC_Report.pdf",
#       "bucket": "dental-emr-uploads",
#       "contentType": "application/pdf",
#       "fileSize": 245760,
#       "status": "pending_upload",
#       "uploadedBy": "employee-uuid",
#       "createdAt": "2026-06-07T10:00:00.000Z",
#       "updatedAt": "2026-06-07T10:00:00.000Z"
#     },
#     "uploadUrl": "https://dental-emr-uploads.s3.ap-south-1.amazonaws.com/...?X-Amz-...",
#     "expiresIn": 900,
#     "headers": {
#       "Content-Type": "application/pdf"
#     }
#   }
# }
#
# Error (404):
# { "success": false, "message": "Patient not found" }
#
# Error (403):
# { "success": false, "message": "You cannot access patients from another clinic" }

curl -X POST "${UPLOADS}/presign" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'",
    "documentType": "lab_report",
    "fileName": "CBC_Report.pdf",
    "contentType": "application/pdf",
    "fileSize": 245760
  }'

# Radiograph image example
curl -X POST "${UPLOADS}/presign" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'",
    "documentType": "radiograph",
    "fileName": "OPG_Scan.jpg",
    "contentType": "image/jpeg"
  }'

# Patient document example
curl -X POST "${UPLOADS}/presign" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "patientId": "'"${PATIENT_ID}"'",
    "documentType": "patient_document",
    "fileName": "ID_Proof.pdf",
    "contentType": "application/pdf"
  }'


# =============================================================================
# STEP 2 — UPLOAD FILE DIRECTLY TO S3 (frontend / client)
# =============================================================================
#
# PUT <uploadUrl from presign response>
#
# Use the exact Content-Type returned in data.headers.
# The backend does NOT accept multipart uploads or file bytes.
#
# Example (save uploadUrl from presign response first):
#   export UPLOAD_URL="<presigned-url-from-step-1>"
#
# Response from S3: HTTP 200 (empty body on success)

# curl -X PUT "${UPLOAD_URL}" \
#   -H "Content-Type: application/pdf" \
#   --data-binary @"${LOCAL_FILE}"


# =============================================================================
# STEP 3 — REGISTER UPLOADED FILE
# =============================================================================
#
# POST /api/uploads/:id/register
#
# Verifies the object exists in S3 and marks the file as uploaded.
#
# Request (optional body):
# {
#   "fileSize": 245760
# }
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "file": {
#       "id": "file-uuid",
#       "status": "uploaded",
#       "fileSize": 245760,
#       ...
#     },
#     "downloadUrl": "https://dental-emr-uploads.s3.ap-south-1.amazonaws.com/...?X-Amz-...",
#     "expiresIn": 900
#   }
# }
#
# Error (404):
# { "success": false, "message": "Upload not found in storage" }
#
# Error (400):
# { "success": false, "message": "File is already registered" }

curl -X POST "${UPLOADS}/${FILE_ID}/register" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "fileSize": 245760
  }'


# =============================================================================
# STEP 4 — GET FILE (with download URL)
# =============================================================================
#
# GET /api/uploads/:id
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "file": { <File object with status "uploaded"> },
#     "downloadUrl": "https://...",
#     "expiresIn": 900
#   }
# }
#
# Pending files return downloadUrl: null

curl -X GET "${UPLOADS}/${FILE_ID}" \
  -H "${AUTH_HEADER}"


# =============================================================================
# STEP 5 — LIST PATIENT UPLOADS
# =============================================================================
#
# GET /api/patients/:patientId/uploads
#
# Query: page, limit, documentType, status
#
# Response (200):
# {
#   "success": true,
#   "data": {
#     "items": [ <File object>, ... ],
#     "total": 3,
#     "page": 1,
#     "limit": 20
#   }
# }

curl -G "${PATIENTS}/${PATIENT_ID}/uploads" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=20"

curl -G "${PATIENTS}/${PATIENT_ID}/uploads" \
  -H "${AUTH_HEADER}" \
  --data-urlencode "documentType=lab_report" \
  --data-urlencode "status=uploaded"


# =============================================================================
# STEP 6 — ATTACH FILE TO LAB REQUEST (example)
# =============================================================================
#
# After lab request is delivered, attach the registered file:
#
# POST /api/lab-requests/:id/report
#
# Request:
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
#     "labRequestId": "lab-request-uuid",
#     "fileId": "file-uuid",
#     "reportName": "CBC_Report.pdf",
#     "reportUrl": "s3://dental-emr-uploads/clinics/.../CBC_Report.pdf",
#     "uploadedAt": "2026-06-10T11:00:00.000Z"
#   }
# }
#
# Error (400):
# { "success": false, "message": "File is not ready for attachment" }
# { "success": false, "message": "File must be of type lab_report" }
# { "success": false, "message": "File does not belong to this patient" }

curl -X POST "${LAB_REQUESTS}/${LAB_REQUEST_ID}/report" \
  -H "${JSON_HEADER}" \
  -H "${AUTH_HEADER}" \
  -d '{
    "fileId": "'"${FILE_ID}"'",
    "reportName": "CBC_Report.pdf"
  }'


# =============================================================================
# FULL FLOW SUMMARY
# =============================================================================
#
# Lab report:
#   presign (documentType: lab_report)
#   → PUT to S3
#   → register
#   → deliver lab request
#   → POST /lab-requests/:id/report { fileId }
#
# Radiograph (future module):
#   presign (documentType: radiograph)
#   → PUT to S3
#   → register
#   → attach fileId to radiograph record
#
# Document types:
#   lab_report, radiograph, prescription, invoice,
#   consent, treatment, patient_document, other
