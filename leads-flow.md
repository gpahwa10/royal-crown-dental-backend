# Leads Flow: Creation to Appointment Booking

This document describes how prospective patients (leads) are created, managed, and progressed through appointment booking in the dental platform frontend.

> **Important:** The leads system is currently **frontend-only** — dummy seed data, React component state, and browser `localStorage`. Booking a lead does **not** create a row on the **Appointments** page or call a leads API.

---

## High-level overview

```mermaid
flowchart TD
  subgraph create [Lead creation]
    A[Seed data LEADS in dummy.ts]
    B[Staff: New Query on /leads]
    C[Patient: Quick enquiry on /patient-intake]
    D[localStorage queue]
    C --> D
    D --> E[Staff: Import queue to leads]
    A --> F[leads state]
    B --> F
    E --> F
  end

  subgraph pipeline [Lead pipeline Kanban]
    F --> G[new_query]
    G --> H[appointment_booked]
    H --> I[follow_up]
    I --> J[clinic_visited]
    G --> K[no_show]
  end

  subgraph booking [Appointment on lead]
    H --> L[Book Appointment dialog]
    L --> M[appointmentDate / Time / Doctor stored ON lead]
  end

  subgraph separate [Separate system]
    N[/appointments page]
    O[Requires registered PATIENT]
    N --> O
  end

  M -.->|NOT connected| N
```

---

## Key files

| Area | Path |
|------|------|
| Leads page | `src/pages/leads.tsx` |
| Public intake | `src/pages/public-patient-intake.tsx` |
| Intake queue (localStorage) | `src/lib/public-intake-queue.ts` |
| Seed data | `src/data/dummy.ts` (`LEADS`, `CLINICS`, `DOCTORS`) |
| Appointments (separate) | `src/pages/appointments.tsx` |
| Clinic filter context | `src/context/clinic-context.tsx` |

---

## 1. How leads are created

There are **three** ways a lead enters the system.

### A. Seed / demo data (page load)

On `/leads`, state initializes from `LEADS` in `src/data/dummy.ts`:

```ts
const [leads, setLeads] = useState<Lead[]>(() => LEADS as Lead[]);
```

Nothing is persisted to a server. Refreshing the page resets to seed data unless changes exist only in memory.

### B. Staff creates a lead manually (“New Query”)

Reception opens **New Query** on the Leads page, fills in:

- Name (required)
- Phone (required)
- Query source (call, WhatsApp, website, walk-in, referral, etc.)
- Symptoms (optional)

`saveQuery()` builds a lead with:

- `status: "new_query"`
- `clinicId` / `clinicName` from the **currently selected clinic** in the header (`selectedLegacyClinicId`), or the first clinic if “all” is selected
- `source` from the dropdown
- `id: Date.now()` (client-generated)

The new lead is prepended to local React state.

### C. Public self-check-in → queue → import

**Route:** `/patient-intake` (no login required).

Patient uses the **Quick enquiry** tab:

1. Enters name, phone, optional email, clinic, symptoms
2. Accepts the privacy notice
3. Submits

`submitLead()` calls `enqueuePublicLead()`, which writes to **browser `localStorage`** under key `yourvcare-public-intake-leads-v1`.

Staff on `/leads` see a banner showing the pending queue count. **Import queue to leads** runs `pullPublicLeadsQueue()` (reads and clears localStorage) and maps each submission to a lead:

- `status: "new_query"`
- `source: "qr_self"`
- `notes: "Imported from public self-check-in."`

**Known issue:** The queue stores API clinic UUIDs as `clinicId: string`, while the `Lead` type expects `clinicId: number` (legacy dummy clinics). This mismatch can break clinic filtering until types and data are aligned.

### D. Full registration (related, not a lead)

The **Full registration** tab on `/patient-intake` calls `patientService.create()` and creates a **patient** in the backend. That path does **not** automatically create a lead; it is a separate onboarding flow.

---

## 2. Lead model and pipeline (Kanban)

### Lead shape

```ts
type LeadStatus =
  | "new_query"
  | "appointment_booked"
  | "follow_up"
  | "clinic_visited"
  | "no_show";

type Lead = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  status: LeadStatus;
  clinicId: number;
  clinicName: string;
  createdAt: string;
  notes: string;
  symptoms?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentDoctorId?: number;
  appointmentDoctorName?: string;
};
```

### Kanban stages

| Status | Label | Meaning in UI |
|--------|--------|----------------|
| `new_query` | New Query | Fresh enquiry |
| `appointment_booked` | Appointment Booked | Slot assigned on the lead |
| `follow_up` | Follow-up | Post-booking follow-up |
| `clinic_visited` | Clinic Visited | Patient came in |
| `no_show` | Not Visited | Did not show |

### Default progression

The Kanban card shortcut “next step” follows this linear path:

```
new_query → appointment_booked → follow_up → clinic_visited
```

`no_show` and `clinic_visited` are terminal states (no automatic next step). Staff can also **Move to …** any other column from the card or table menu.

### Filtering

Leads are filtered by:

- **Search** — name or phone
- **Selected clinic** — `selectedLegacyClinicId` from clinic context

---

## 3. How appointment booking works on a lead

Booking is **not** a separate appointments record. It only updates the **lead object** when status becomes `appointment_booked`.

### Trigger

`requestStageChange(lead, newStatus)`:

- If `newStatus === "appointment_booked"` → opens the **Book Appointment** dialog, prefilled with clinic and symptoms from the lead
- Any other status → updates `lead.status` immediately (no dialog)

Typical paths:

1. Kanban card link **“Appointment Booked →”** (from `new_query`)
2. Table or card menu **Move to Appointment Booked**

### Book Appointment dialog

Staff fills in:

| Field | Required | Notes |
|-------|----------|-------|
| Clinic | Yes | From dummy `CLINICS` |
| Date | Yes | HTML date input |
| Time | Yes | Fixed slots: `09:00` … `17:00` (30-min intervals) |
| Doctor | No | Filtered by selected clinic from dummy `DOCTORS` |
| Symptoms | No | Carried over from lead if present |

### Confirm booking

`saveBooking()` updates **only that lead** in React state:

- `status: "appointment_booked"`
- `appointmentDate`, `appointmentTime`
- `appointmentDoctorId`, `appointmentDoctorName`
- Updated `clinicId`, `clinicName`, `symptoms` if changed

The Kanban card then displays date/time and doctor when status is `appointment_booked`.

---

## 4. Post-booking progression (leads only)

After booking, staff can continue moving the lead through the pipeline:

1. **Follow-up** — status change only; no extra form
2. **Clinic Visited** — terminal success state
3. **Not Visited** (`no_show`) — can be set manually from the menu

There is **no** automatic conversion of a lead into a **patient** or **queue** entry in the current codebase.

---

## 5. Appointments page — separate system

`/appointments` is **not** wired to leads.

| Aspect | Leads “Book Appointment” | Appointments page |
|--------|--------------------------|-------------------|
| Data source | `LEADS` + local state | `APPOINTMENTS` + local state |
| Requires patient record? | No | Yes (`PATIENTS`) |
| Persists to API? | No | No (dummy) |
| Shows on calendar? | No (only on lead card) | Yes |
| Linked to each other? | **No** | **No** |

Creating an appointment on `/appointments` requires selecting an existing **patient**, doctor, clinic, date, time, type, and symptoms. `saveNew()` appends to appointments state only.

---

## 6. End-to-end user story (as implemented)

1. **Enquiry arrives**
   - Walk-in / call → staff uses **New Query**
   - Or patient submits **Quick enquiry** at `/patient-intake` → stored in localStorage → staff **Import queue to leads**

2. **Lead in New Query**
   - Visible on Kanban or table for the selected clinic

3. **Staff books appointment**
   - Move to **Appointment Booked** → dialog → pick date, time, doctor
   - Lead stores `appointmentDate`, `appointmentTime`, `appointmentDoctorName`

4. **Follow-up and outcome**
   - Staff moves to **Follow-up** → **Clinic Visited**, or marks **Not Visited**

5. **If a calendar appointment for a registered patient is needed**
   - Staff must separately use **Appointments**, after the person exists in **Patients**

---

## 7. Gaps vs a production flow

| Gap | Current behavior |
|-----|------------------|
| No leads API | Create, list, update, and book are all in-memory |
| Lead booking ≠ appointment entity | Booking only mutates the lead record |
| Public queue is per-browser | `localStorage` is not shared across devices or staff browsers |
| Clinic ID mismatch | Public intake uses API UUIDs; leads page uses legacy numeric `CLINICS` IDs |
| No persistence after refresh | Staff-created and imported leads are lost on reload |

---

## 8. Suggested integration path (future)

When wiring to the backend, a typical production flow would be:

1. `POST /leads` — create from staff form or public intake (replace localStorage queue)
2. `GET /leads` — list with pagination and `clinicId` filter
3. `PATCH /leads/:id` — update status, notes, symptoms
4. `POST /leads/:id/book` or `POST /appointments` — create a real appointment and link `leadId` → `appointmentId` → optional `patientId`
5. Convert lead to patient on first visit (`clinic_visited`) if not already registered

Until those APIs exist, treat the Leads page as a **UI prototype** for reception workflow, not the source of truth for scheduling.
