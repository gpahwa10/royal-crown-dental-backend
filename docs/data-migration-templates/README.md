# Go-Live Data Migration Templates

Fill these CSV files and return them for system go-live import.

## How to fill

1. Open each file in Excel / Google Sheets.
2. Keep the **header row** exactly as-is.
3. Delete the sample row(s) before sending final data (or leave them and mark as sample).
4. Use **clinic_code** / **patient_code** / **employee_email** as reference keys across files (do not invent UUIDs).
5. Dates: use `YYYY-MM-DD` or `YYYY-MM-DD HH:mm:ss`.
6. Booleans: `true` / `false`.
7. Multi-value fields (arrays): separate with `|` e.g. `Penicillin|Latex`.
8. Leave optional columns blank if unknown.

## File order (dependencies)

| # | File | Depends on |
|---|------|------------|
| 1 | `01_clinics.csv` | — |
| 2 | `02_employees.csv` | clinics |
| 3 | `03_patients.csv` | clinics |
| 3b | `03b_patient_medical_profiles.csv` | patients |
| 4 | `04_prescriptions.csv` | patients, employees |
| 4b | `04b_prescription_items.csv` | prescriptions |
| 5a–5e | inventory CSVs | clinics (optional) |
| 6 | `06_medicines_package.csv` | — (master list; no FK) |
| 7a–7c | lab CSVs | patients, employees, clinics |
| 8 | `08_radiographs.csv` | patients, employees, clinics |
| 9 | `09_dental_lab_orders.csv` | patients, employees, clinics |

## Allowed values (enums)

### Employee roles (comma-separated in `roles`)
`Doctor`, `Clinic Head`, `Reception`, `Assistant`, `Helper`, `Lab Technician`, `Phlebotomist`, `Inventory Manager`, `HR Head`, `HR Assistant`, `Director`

### Patient
- `patient_type`: `new` | `existing`
- `gender`: free text (e.g. `Male`, `Female`, `Other`)
- `pregnancy_status`: `Not Applicable` | `Pregnant` | `Not Pregnant`
- `dental_anxiety`: `none` | `mild` | `moderate` | `severe`

### Inventory location `type`
`clinic` | `warehouse`

### Lab request `status`
`sample_collected` | `under_examination` | `delivered`

### Radiograph `status`
`scheduled` | `acquired` | `reported`

### Dental lab order `status`
`ordered` | `delivered` | `cementation_done`

### Dental lab `item_type`
`crown` | `bridge` | `veneer` | `denture` | `implant_crown` | `night_guard` | `orthodontic_retainer` | `custom_abutment` | `impression_tray`

## Notes

- System fields (`id`, `created_at`, `updated_at`) are **not** required from the client; they will be generated on import.
- Prescriptions in the DB require a consultation; for historical import provide `consultation_reference` (legacy id / date note) so we can link or create consultations.
- Lab reports / radiograph images: put file path or URL in `report_url` / `image_file_path` / `report_file_path`; binary files can be shared in a separate zip using the same reference codes.
- `06_medicines_package.csv` is a **master medicine catalog** for packages. There is no dedicated medicines table today; prescriptions store `medicine_name` as free text. This list will be used for package seeding / autocomplete.
