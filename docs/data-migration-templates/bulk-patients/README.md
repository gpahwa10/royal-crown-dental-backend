# Bulk Patient Upload CSV Templates

Use with `POST /api/patients/bulk` after the frontend parses the CSV into a JSON array.

## Files

| File | Who | Difference |
|------|-----|------------|
| `patients_bulk_staff.csv` | Reception / Clinic staff | No `clinicId` — backend uses logged-in user's clinic |
| `patients_bulk_admin.csv` | Director / Super Admin | Requires `clinicId` (UUID) on every row |

## Column guide

| Column | Required | Notes |
|--------|----------|--------|
| `clinicId` | Admin only | Clinic UUID |
| `patientType` | Yes | `new` or `existing` |
| `name` | Yes | Full name |
| `phone` | Yes | Unique per clinic |
| `email` | No | Globally unique if provided |
| `gender` | Yes | e.g. `Male`, `Female`, `Other` |
| `dateOfBirth` | Yes | `YYYY-MM-DD` |
| `address` | No | |
| `emergencyContactName` | No | |
| `emergencyContactPhone` | No | |
| `emergencyContactRelation` | No | |
| `allergies` | No | Separate multiple with `\|` |
| `currentMedications` | No | Separate multiple with `\|` |
| `chronicConditions` | No | Separate multiple with `\|` |
| `pregnancyStatus` | No | `Not Applicable` \| `Pregnant` \| `Not Pregnant` (default: Not Applicable) |
| `dentalAnxiety` | No | `none` \| `mild` \| `moderate` \| `severe` (default: none) |
| `lastDentalVisit` | No | `YYYY-MM-DD` |
| `lastXrayDate` | No | `YYYY-MM-DD` |
| `primaryPhysicianName` | No | |
| `primaryPhysicianPhone` | No | |
| `initialChiefComplaint` | No | |
| `treatmentConsentSigned` | Yes | `true` or `false` (must be `true`) |
| `privacyAccepted` | Yes | `true` or `false` (must be `true`) |

## Frontend mapping tips

1. Keep the header row exactly as given.
2. Split `allergies` / `currentMedications` / `chronicConditions` on `|` into string arrays.
3. Parse `true` / `false` as booleans.
4. Staff upload: set `clinicId` from the logged-in session when building the payload (or omit — backend forces it).
5. Admin upload: keep `clinicId` from each CSV row.
6. Delete sample rows before uploading real data.
7. Max 500 patients per request.
