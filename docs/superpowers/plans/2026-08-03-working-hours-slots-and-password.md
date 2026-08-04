# Backend: Working Hours, Doctor Availability & Password Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Companion:** Frontend plan lives in `dental-platform/docs/superpowers/plans/2026-08-03-frontend-slots-hours-password.md`. The **15‑minute slot grid is owned by the frontend** — this backend plan does **not** expose `/appointments/slots` or enforce a 15‑minute boundary.

**Goal:** Persist clinic/staff working hours, validate appointment times against those hours + doctor availability/overlap, and add change-password + forgot-password (OTP) APIs.

**Architecture:** Weekly hours tables for clinics and employees. Appointment create/update checks wall-clock time (Asia/Kolkata) falls inside clinic hours and, if a doctor is set, inside that doctor’s hours without overlapping another visit. `GET /appointments/available-doctors` returns doctors covering a requested datetime. Auth adds change-password and OTP reset; email via SES or dev console log.

**Tech Stack:** Express 5, Drizzle ORM, PostgreSQL, Zod, bcrypt, JWT, AWS SES (`@aws-sdk/client-ses`), timezone `Asia/Kolkata`.

## Global Constraints

- **No backend slot grid.** Frontend generates 15‑minute choices from clinic hours.
- Backend accepts any `HH:mm` / `scheduledAt` that fits inside clinic open–close for that weekday (and duration fits before close).
- Doctor list for a datetime = doctors at clinic whose hours cover `[start, start + duration)`.
- Doctor on create remains **optional**; if provided, must pass hours + overlap checks.
- Overlap: same `employee_id`, statuses not in `cancelled` / `no_show`, ranges intersect.
- Times stored as PostgreSQL `time`; appointment instants remain `timestamptz`; wall-clock **`Asia/Kolkata`**.
- `day_of_week`: `0 = Sunday` … `6 = Saturday`.
- Forgot-password responses must **not** reveal whether the email exists.
- Verify with `npm run build` + curl; utils via `src/scripts/verify-scheduling-utils.ts`.

## Locked product decisions

| Decision | Value |
|---|---|
| 15‑min grid | **Frontend only** |
| Backend time validation | Inside clinic/doctor hours + duration fits; **not** snapped to :00/:15/:30/:45 |
| Default seed hours | Mon–Sat `10:00`–`21:00`, Sunday closed |
| CSV timings | `10-7` → `10:00`–`19:00`; `12-9` → `12:00`–`21:00`; `8-2` → `08:00`–`14:00`; `2-9` → `14:00`–`21:00` |
| Forgot password | 6-digit OTP, SES if `SES_FROM_EMAIL` set; else `console.info` |
| Super Admin | Included in change + forgot/reset |

## Scope note

- **Part A (Tasks 1–5):** working hours + available doctors + appointment enforcement + seed  
- **Part B (Tasks 6–8):** change password + forgot/reset  

## File structure

| File | Responsibility |
|---|---|
| `src/db/schema/clinicWorkingHours.ts` | Clinic weekly hours |
| `src/db/schema/employeeWorkingHours.ts` | Employee weekly hours |
| `src/db/schema/passwordResetTokens.ts` | OTP storage |
| `drizzle/0024_working_hours.sql` | Hours migration |
| `drizzle/0025_password_reset_tokens.sql` | Reset tokens migration |
| `src/modules/scheduling/scheduling.constants.ts` | TZ, default duration |
| `src/modules/scheduling/scheduling.utils.ts` | Coverage, overlap, CSV parse, wall-clock parts |
| `src/modules/scheduling/scheduling.service.ts` | Hours load helpers, available doctors |
| Clinics / employees modules | `GET/PUT .../working-hours` |
| `appointments.routes.ts` | `GET /available-doctors` **before** `/:id` (no `/slots`) |
| Auth module | change / forgot / reset |
| `src/utils/email.ts` | SES or dev log |

---

### Task 1: Schema + migrations for working hours

**Files:**
- Create: `src/db/schema/clinicWorkingHours.ts`
- Create: `src/db/schema/employeeWorkingHours.ts`
- Create: `drizzle/0024_working_hours.sql`
- Modify: `src/db/schema/index.ts`

**Interfaces:**
- Produces: `clinicWorkingHours`, `employeeWorkingHours` with unique `(entityId, dayOfWeek)`

- [ ] **Step 1: Add Drizzle schemas** (same shape as prior plan: `dayOfWeek`, `openTime`/`closeTime`/`isClosed` for clinics; `startTime`/`endTime`/`isOff` for employees)

- [ ] **Step 2: Write + apply `drizzle/0024_working_hours.sql`**

Run: `psql "$DATABASE_URL" -f drizzle/0024_working_hours.sql`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: add clinic and employee working hours tables"
```

---

### Task 2: Scheduling utils (no slot generator required for API)

**Files:**
- Create: `src/modules/scheduling/scheduling.constants.ts`
- Create: `src/modules/scheduling/scheduling.utils.ts`
- Create: `src/scripts/verify-scheduling-utils.ts`

**Interfaces:**
- Produces:
  - `CLINIC_TIMEZONE = "Asia/Kolkata"`
  - `DEFAULT_APPOINTMENT_DURATION_MINUTES = 30`
  - `parseLegacyTiming(raw: string): { start: string; end: string } | null`
  - `isRangeWithinWindow(startHHmm, endHHmm, windowStart, windowEnd): boolean`
  - `rangesOverlap(aStart, aEnd, bStart, bEnd): boolean`
  - `wallClockPartsInTz(instant: Date, timeZone: string): { date: string; time: string; dayOfWeek: number }`

Optional internal helper `generateSlotStarts` may exist for seed/tests but **must not** be exposed as an HTTP endpoint.

- [ ] **Step 1: Implement utils + verify script** (assert coverage + overlap + legacy parse)

- [ ] **Step 2: Run** `npx ts-node-dev --transpile-only src/scripts/verify-scheduling-utils.ts` → `scheduling utils OK`

- [ ] **Step 3: Commit** `feat: add scheduling time helpers`

---

### Task 3: Working-hours CRUD

**Files:** clinics + employees validation/service/controller/routes

**Interfaces:**
- `GET/PUT /api/clinics/:id/working-hours`
- `GET/PUT /api/employees/:id/working-hours`
- Full-week replace; employee hours must sit inside clinic hours when clinic is open

- [ ] **Step 1: Implement + wire routes**
- [ ] **Step 2: `npm run build`**
- [ ] **Step 3: Commit** `feat: CRUD clinic and employee working hours`

---

### Task 4: Available doctors API

**Files:**
- Create/modify scheduling service; appointments validation/controller/routes
- Create: `docs/curl/scheduling.curl`

**Interfaces:**
- `GET /api/appointments/available-doctors?clinicId=&date=YYYY-MM-DD&time=HH:mm&durationMinutes?`
- Returns `{ id, name, email, designation }[]` for doctors covering that window and free of overlap

```ts
router.get("/available-doctors", listAvailableDoctorsHandler);
// NO router.get("/slots", ...)
router.get("/:id", getAppointmentByIdHandler);
```

- [ ] **Step 1: Implement**
- [ ] **Step 2: Curl smoke**
- [ ] **Step 3: Commit** `feat: list doctors available for a datetime`

---

### Task 5: Enforce hours + overlap on create/update + seed

**Files:**
- Modify: `appointments.service.ts`
- Create: `src/scripts/seed-working-hours.ts`
- Modify: `package.json` → `seed:working-hours`

**Validation (no 15‑min check):**
1. Wall-clock in Asia/Kolkata
2. Inside clinic hours for full `[start, start+duration)`
3. If doctor: inside doctor hours + no overlap

Errors:
- `"Selected time is outside clinic working hours"`
- `"Doctor is not available at the selected time"`
- `"Doctor already has an overlapping appointment"`

- [ ] **Step 1: Wire `assertAppointmentScheduleValid` into create/update**
- [ ] **Step 2: Seed script + run**
- [ ] **Step 3: Commit**

---

### Task 6: Password reset schema + email util

**Files:** `passwordResetTokens` schema, `drizzle/0025_password_reset_tokens.sql`, `src/utils/email.ts`, `@aws-sdk/client-ses`

- [ ] **Step 1–4:** Schema, migration, email util, commit `feat: add password reset tokens and email helper`

---

### Task 7: Change password

**Route:** `POST /api/auth/change-password` (authenticate)  
**Body:** `{ currentPassword, newPassword }` (min 8)

- [ ] Implement + curl + commit `feat: add authenticated change-password`

---

### Task 8: Forgot + reset OTP

**Routes:** `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`  
Generic success message; 15‑minute OTP expiry; employee + super_admin

- [ ] Implement + curl + commit `feat: add forgot-password and OTP reset`

---

## Backend ↔ frontend contract

| Frontend needs | Backend provides |
|---|---|
| Build 15‑min dropdown | `GET /clinics/:id/working-hours` |
| Filter doctors for selected slot | `GET /appointments/available-doctors?clinicId&date&time` |
| Book | `POST /appointments` with `appointmentDate` + `appointmentTime` or `scheduledAt` |
| Change password | `POST /auth/change-password` |
| Forgot / reset | `POST /auth/forgot-password`, `POST /auth/reset-password` |

## Self-review

| Requirement | Task |
|---|---|
| Clinic/staff hours schema | 1, 3 |
| 15‑min grid | **Out of backend scope (frontend)** |
| Match doctors by hours | 4, 5 |
| Enforce on book | 5 |
| Passwords | 6–8 |
