import {
    and,
    count,
    desc,
    eq,
    ilike,
    or,
} from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinics } from "../../db/schema/clinic";
import { consultations } from "../../db/schema/consultations";
import { patientConsents } from "../../db/schema/patientConsents";
import { patientMedicalProfiles } from "../../db/schema/patientMedicalProfiles";
import { patients } from "../../db/schema/patients";
import { listConsultationsByPatientId } from "../consultations/consultations.service";
import {
    DentalLabOrderPatientSummary,
    getDentalLabTimelineEventsForPatient,
    listDentalLabOrdersByPatientId,
} from "../dental-lab/dentalLab.service";
import {
    getFinancialTimelineEventsForPatient,
    getPatientOutstandingBalance,
    InvoiceDetails,
    listInvoicesByPatientId,
} from "../billing/billing.service";
import {
    getActivePatientMembership,
    listPatientMemberships,
} from "../membership/membership.service";
import {
    getLabRequestTimelineEventsForPatient,
    LabRequestPatientSummary,
    listLabRequestsByPatientId,
} from "../lab-requests/labRequests.service";
import {
    listPrescriptionsByPatientId,
    PrescriptionWithItems,
} from "../prescriptions/prescriptions.service";
import {
    getClinicVisitTimelineEventsForPatient,
    listClinicVisitsByPatientId,
    ClinicVisitPatientSummary,
} from "../clinic-visits/clinicVisit.service";
import {
    getRadiographTimelineEventsForPatient,
    listRadiographsByPatientId,
    RadiographPatientSummary,
} from "../radiographs/radiographs.service";
import {
    DentalAnxietyLevel,
    PatientType,
    PregnancyStatus,
} from "./patients.constants";
import { createPatientSchema } from "./patients.validation";
import {
    assertPatientClinicAccess,
    generatePatientCode,
    getPagination,
    normalizeBulkPatientRow,
    toDate,
} from "./patients.utils";

export interface RegisterPatientInput {
    clinicId: string;
    patientType: PatientType;
    name: string;
    phone: string;
    email?: string;
    gender: string;
    dateOfBirth: Date | string;
    address?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    allergies?: string[];
    currentMedications?: string[];
    chronicConditions?: string[];
    pregnancyStatus: PregnancyStatus;
    dentalAnxiety: DentalAnxietyLevel;
    lastDentalVisit?: Date | string;
    lastXrayDate?: Date | string;
    primaryPhysicianName?: string;
    primaryPhysicianPhone?: string;
    initialChiefComplaint?: string;
    treatmentConsentSigned: boolean;
    privacyAccepted: boolean;
}

export interface ListPatientsOptions {
    page?: number;
    limit?: number;
    search?: string;
    clinicId?: string;
    isBlackListed?: boolean;
}

export interface UpdatePatientBasicDetailsInput {
    name?: string;
    phone?: string;
    email?: string | null;
    gender?: string;
    dateOfBirth?: Date | string;
    address?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    patientType?: PatientType;
}

export interface UpdatePatientMedicalProfileInput {
    allergies?: string[];
    currentMedications?: string[];
    chronicConditions?: string[];
    pregnancyStatus?: PregnancyStatus;
    dentalAnxiety?: DentalAnxietyLevel;
    lastDentalVisit?: Date | string | null;
    lastXrayDate?: Date | string | null;
    primaryPhysicianName?: string | null;
    primaryPhysicianPhone?: string | null;
    initialChiefComplaint?: string | null;
}

export interface UpdatePatientInput
    extends UpdatePatientBasicDetailsInput,
        UpdatePatientMedicalProfileInput {}

export type PatientRegistrationResult = {
    patient: typeof patients.$inferSelect;
    medicalProfile: typeof patientMedicalProfiles.$inferSelect;
    consents: typeof patientConsents.$inferSelect;
};

export type PatientTimelineEvent = {
    type: string;
    date: string;
};

export type PatientDetailsResult = {
    patient: typeof patients.$inferSelect;
    medicalProfile: typeof patientMedicalProfiles.$inferSelect | null;
    consents: typeof patientConsents.$inferSelect | null;
    appointments: (typeof appointments.$inferSelect)[];
    consultations: (typeof consultations.$inferSelect)[];
    prescriptions: PrescriptionWithItems[];
    labRequests: LabRequestPatientSummary[];
    dentalLabOrders: DentalLabOrderPatientSummary[];
    membership: Awaited<ReturnType<typeof getActivePatientMembership>>;
    membershipHistory: Awaited<ReturnType<typeof listPatientMemberships>>;
    invoices: InvoiceDetails[];
    outstandingBalance: number;
    radiographs: RadiographPatientSummary[];
    clinicVisits: ClinicVisitPatientSummary[];
    timeline: PatientTimelineEvent[];
};

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, isActive: clinics.isActive })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    if (!clinic.isActive) {
        throw new Error("Clinic is not active");
    }
};

const assertDuplicatePhone = async (phone: string, clinicId: string) => {
    const [existing] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.phone, phone), eq(patients.clinicId, clinicId)));

    if (existing) {
        throw new Error("A patient with this phone already exists in this clinic");
    }
};

const findPatientByPhoneInClinic = async (phone: string, clinicId: string) => {
    const [existing] = await db
        .select({
            id: patients.id,
            patientCode: patients.patientCode,
            name: patients.name,
            phone: patients.phone,
        })
        .from(patients)
        .where(and(eq(patients.phone, phone), eq(patients.clinicId, clinicId)));

    return existing ?? null;
};

const getPatientRecord = async (id: string) => {
    const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, id));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

/** Lightweight patient lookup for access checks and simple updates. */
export const getPatientById = async (id: string) => getPatientRecord(id);

const getMedicalProfileByPatientId = async (patientId: string) => {
    const [profile] = await db
        .select()
        .from(patientMedicalProfiles)
        .where(eq(patientMedicalProfiles.patientId, patientId));

    return profile ?? null;
};

const getConsentsByPatientId = async (patientId: string) => {
    const [consent] = await db
        .select()
        .from(patientConsents)
        .where(eq(patientConsents.patientId, patientId));

    return consent ?? null;
};

const buildTimeline = (
    patient: typeof patients.$inferSelect,
    consent: typeof patientConsents.$inferSelect | null,
    appointmentRows: (typeof appointments.$inferSelect)[],
    consultationRows: (typeof consultations.$inferSelect)[],
    labRequestEvents: PatientTimelineEvent[],
    dentalLabEvents: PatientTimelineEvent[],
    radiographEvents: PatientTimelineEvent[],
    clinicVisitEvents: PatientTimelineEvent[],
    financialEvents: PatientTimelineEvent[]
): PatientTimelineEvent[] => {
    const timeline: PatientTimelineEvent[] = [
        {
            type: "patient_registered",
            date: patient.createdAt.toISOString(),
        },
    ];

    if (consent?.acceptedAt) {
        timeline.push({
            type: "consent_signed",
            date: consent.acceptedAt.toISOString(),
        });
    }

    for (const appointment of appointmentRows) {
        timeline.push({
            type: "appointment_scheduled",
            date: appointment.scheduledAt.toISOString(),
        });
    }

    for (const consultation of consultationRows) {
        timeline.push({
            type: `consultation_${consultation.status}`,
            date: consultation.createdAt.toISOString(),
        });
    }

    timeline.push(...labRequestEvents);
    timeline.push(...dentalLabEvents);
    timeline.push(...radiographEvents);
    timeline.push(...clinicVisitEvents);
    timeline.push(...financialEvents);

    return timeline.sort(
        (left, right) =>
            new Date(left.date).getTime() - new Date(right.date).getTime()
    );
};

export const registerPatient = async (input: RegisterPatientInput) => {
    await assertClinicExists(input.clinicId);
    await assertDuplicatePhone(input.phone, input.clinicId);

    if (input.email) {
        const [existingEmail] = await db
            .select({ id: patients.id })
            .from(patients)
            .where(eq(patients.email, input.email));

        if (existingEmail) {
            throw new Error("A patient with this email already exists");
        }
    }

    const acceptedAt = new Date();

    const result = await db.transaction(async (tx) => {
        const patientCode = await generatePatientCode(tx);

        const [patient] = await tx
            .insert(patients)
            .values({
                patientCode,
                clinicId: input.clinicId,
                patientType: input.patientType,
                name: input.name,
                phone: input.phone,
                email: input.email,
                gender: input.gender,
                dateOfBirth: toDate(input.dateOfBirth)!,
                address: input.address,
                emergencyContactName: input.emergencyContactName,
                emergencyContactPhone: input.emergencyContactPhone,
                emergencyContactRelation: input.emergencyContactRelation,
            })
            .returning();

        const [medicalProfile] = await tx
            .insert(patientMedicalProfiles)
            .values({
                patientId: patient.id,
                allergies: input.allergies ?? [],
                currentMedications: input.currentMedications ?? [],
                chronicConditions: input.chronicConditions ?? [],
                pregnancyStatus: input.pregnancyStatus,
                dentalAnxiety: input.dentalAnxiety,
                lastDentalVisit: toDate(input.lastDentalVisit),
                lastXrayDate: toDate(input.lastXrayDate),
                primaryPhysicianName: input.primaryPhysicianName,
                primaryPhysicianPhone: input.primaryPhysicianPhone,
                initialChiefComplaint: input.initialChiefComplaint,
            })
            .returning();

        const [consents] = await tx
            .insert(patientConsents)
            .values({
                patientId: patient.id,
                treatmentConsentSigned: input.treatmentConsentSigned,
                privacyAccepted: input.privacyAccepted,
                acceptedAt,
            })
            .returning();

        return { patient, medicalProfile, consents };
    });

    return result;
};

export type BulkRegisterPatientSuccess = {
    index: number;
    id: string;
    patientCode: string;
    name: string;
    phone: string;
};

export type BulkRegisterPatientFailure = {
    index: number;
    name?: string;
    phone?: string;
    message: string;
};

export type BulkRegisterPatientsResult = {
    summary: {
        total: number;
        created: number;
        failed: number;
    };
    created: BulkRegisterPatientSuccess[];
    failed: BulkRegisterPatientFailure[];
};

export const bulkRegisterPatients = async (
    rows: Record<string, unknown>[],
    options?: { forceClinicId?: string }
): Promise<BulkRegisterPatientsResult> => {
    const created: BulkRegisterPatientSuccess[] = [];
    const failed: BulkRegisterPatientFailure[] = [];
    /** Idempotent within one upload: clinicId:phone → first success row. */
    const seenPhones = new Map<string, BulkRegisterPatientSuccess>();

    for (const [index, row] of rows.entries()) {
        const normalized = {
            ...normalizeBulkPatientRow(row),
            // Staff bulk upload implies clinic acceptance; do not fail rows on missing CSV consent columns.
            treatmentConsentSigned: true,
            privacyAccepted: true,
        };
        const payload = options?.forceClinicId
            ? { ...normalized, clinicId: options.forceClinicId }
            : normalized;

        const parsed = createPatientSchema.safeParse(payload);

        if (!parsed.success) {
            failed.push({
                index,
                name:
                    typeof row.name === "string" ? row.name : undefined,
                phone:
                    typeof row.phone === "string" ? row.phone : undefined,
                message: parsed.error.issues
                    .map((issue) => {
                        const path = issue.path.length
                            ? `${issue.path.join(".")}: `
                            : "";
                        return `${path}${issue.message}`;
                    })
                    .join("; "),
            });
            continue;
        }

        if (!parsed.data.clinicId || !parsed.data.phone) {
            failed.push({
                index,
                name: parsed.data.name,
                phone: parsed.data.phone,
                message: "clinicId and phone are required",
            });
            continue;
        }

        const clinicId = parsed.data.clinicId;
        const phone = parsed.data.phone;
        const phoneKey = `${clinicId}:${phone}`;
        const alreadySeen = seenPhones.get(phoneKey);
        if (alreadySeen) {
            created.push({
                ...alreadySeen,
                index,
            });
            continue;
        }

        try {
            const existing = await findPatientByPhoneInClinic(phone, clinicId);

            if (existing) {
                const success: BulkRegisterPatientSuccess = {
                    index,
                    id: existing.id,
                    patientCode: existing.patientCode,
                    name: existing.name,
                    phone: existing.phone,
                };
                created.push(success);
                seenPhones.set(phoneKey, success);
                continue;
            }

            let result;
            try {
                result = await registerPatient({
                    ...parsed.data,
                    clinicId,
                    phone,
                });
            } catch (error) {
                // Email uniqueness is global — retry without email so phone-first migration can proceed.
                if (
                    error instanceof Error &&
                    error.message === "A patient with this email already exists" &&
                    parsed.data.email
                ) {
                    result = await registerPatient({
                        ...parsed.data,
                        clinicId,
                        phone,
                        email: undefined,
                    });
                } else {
                    throw error;
                }
            }

            const success: BulkRegisterPatientSuccess = {
                index,
                id: result.patient.id,
                patientCode: result.patient.patientCode,
                name: result.patient.name,
                phone: result.patient.phone,
            };
            created.push(success);
            seenPhones.set(phoneKey, success);
        } catch (error) {
            failed.push({
                index,
                name: parsed.data.name,
                phone: parsed.data.phone,
                message:
                    error instanceof Error
                        ? error.message
                        : "Something went wrong",
            });
        }
    }

    return {
        summary: {
            total: rows.length,
            created: created.length,
            failed: failed.length,
        },
        created,
        failed,
    };
};

export const listPatients = async (options: ListPatientsOptions) => {
    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters = [];

    if (options.clinicId) {
        filters.push(eq(patients.clinicId, options.clinicId));
    }

    if (options.isBlackListed !== undefined) {
        filters.push(eq(patients.isBlackListed, options.isBlackListed));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(patients.patientCode, term),
                ilike(patients.name, term),
                ilike(patients.phone, term),
                ilike(patients.email, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(patients)
        .where(whereClause);

    const items = await db
        .select()
        .from(patients)
        .where(whereClause)
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        items,
        total: totalRow?.total ?? 0,
        page,
        limit,
    };
};

export const getPatientDetails = async (id: string) => {
    const patient = await getPatientRecord(id);

    const [
        medicalProfile,
        consents,
        appointmentRows,
        consultationRows,
        prescriptionRows,
        labRequestRows,
        labRequestTimelineEvents,
        dentalLabOrderRows,
        dentalLabTimelineEvents,
        radiographRows,
        radiographTimelineEvents,
        clinicVisitRows,
        clinicVisitTimelineEvents,
        financialTimelineEvents,
        activeMembership,
        membershipHistory,
        invoiceRows,
        outstandingBalance,
    ] = await Promise.all([
        getMedicalProfileByPatientId(patient.id),
        getConsentsByPatientId(patient.id),
        db
            .select()
            .from(appointments)
            .where(eq(appointments.patientId, patient.id))
            .orderBy(desc(appointments.scheduledAt)),
        listConsultationsByPatientId(patient.id),
        listPrescriptionsByPatientId(patient.id),
        listLabRequestsByPatientId(patient.id),
        getLabRequestTimelineEventsForPatient(patient.id),
        listDentalLabOrdersByPatientId(patient.id),
        getDentalLabTimelineEventsForPatient(patient.id),
        listRadiographsByPatientId(patient.id),
        getRadiographTimelineEventsForPatient(patient.id),
        listClinicVisitsByPatientId(patient.id),
        getClinicVisitTimelineEventsForPatient(patient.id),
        getFinancialTimelineEventsForPatient(patient.id),
        getActivePatientMembership(patient.id),
        listPatientMemberships(patient.id),
        listInvoicesByPatientId(patient.id),
        getPatientOutstandingBalance(patient.id),
    ]);

    return {
        patient,
        medicalProfile,
        consents,
        appointments: appointmentRows,
        consultations: consultationRows,
        prescriptions: prescriptionRows,
        labRequests: labRequestRows,
        dentalLabOrders: dentalLabOrderRows,
        membership: activeMembership,
        membershipHistory,
        invoices: invoiceRows,
        outstandingBalance,
        radiographs: radiographRows,
        clinicVisits: clinicVisitRows,
        timeline: buildTimeline(
            patient,
            consents,
            appointmentRows,
            consultationRows,
            labRequestTimelineEvents,
            dentalLabTimelineEvents,
            radiographTimelineEvents,
            clinicVisitTimelineEvents,
            financialTimelineEvents
        ),
    } satisfies PatientDetailsResult;
};

export const updatePatientBasicDetails = async (
    id: string,
    input: UpdatePatientBasicDetailsInput
) => {
    const patient = await getPatientRecord(id);

    if (input.phone && input.phone !== patient.phone) {
        await assertDuplicatePhone(input.phone, patient.clinicId);
    }

    if (input.email && input.email !== patient.email) {
        const [existingEmail] = await db
            .select({ id: patients.id })
            .from(patients)
            .where(eq(patients.email, input.email));

        if (existingEmail && existingEmail.id !== patient.id) {
            throw new Error("A patient with this email already exists");
        }
    }

    const [updatedPatient] = await db
        .update(patients)
        .set({
            ...(input.name !== undefined && { name: input.name }),
            ...(input.phone !== undefined && { phone: input.phone }),
            ...(input.email !== undefined && { email: input.email }),
            ...(input.gender !== undefined && { gender: input.gender }),
            ...(input.dateOfBirth !== undefined && {
                dateOfBirth: toDate(input.dateOfBirth) ?? patient.dateOfBirth,
            }),
            ...(input.address !== undefined && { address: input.address }),
            ...(input.emergencyContactName !== undefined && {
                emergencyContactName: input.emergencyContactName,
            }),
            ...(input.emergencyContactPhone !== undefined && {
                emergencyContactPhone: input.emergencyContactPhone,
            }),
            ...(input.emergencyContactRelation !== undefined && {
                emergencyContactRelation: input.emergencyContactRelation,
            }),
            ...(input.patientType !== undefined && {
                patientType: input.patientType,
            }),
            updatedAt: new Date(),
        })
        .where(eq(patients.id, patient.id))
        .returning();

    return {
        patient: updatedPatient,
        medicalProfile: await getMedicalProfileByPatientId(patient.id),
        consents: await getConsentsByPatientId(patient.id),
    };
};

export const updatePatientMedicalProfile = async (
    id: string,
    input: UpdatePatientMedicalProfileInput
) => {
    const patient = await getPatientRecord(id);
    const medicalProfile = await getMedicalProfileByPatientId(patient.id);

    if (!medicalProfile) {
        throw new Error("Medical profile not found");
    }

    const [updatedMedicalProfile] = await db
        .update(patientMedicalProfiles)
        .set({
            ...(input.allergies !== undefined && { allergies: input.allergies }),
            ...(input.currentMedications !== undefined && {
                currentMedications: input.currentMedications,
            }),
            ...(input.chronicConditions !== undefined && {
                chronicConditions: input.chronicConditions,
            }),
            ...(input.pregnancyStatus !== undefined && {
                pregnancyStatus: input.pregnancyStatus,
            }),
            ...(input.dentalAnxiety !== undefined && {
                dentalAnxiety: input.dentalAnxiety,
            }),
            ...(input.lastDentalVisit !== undefined && {
                lastDentalVisit: toDate(input.lastDentalVisit) ?? null,
            }),
            ...(input.lastXrayDate !== undefined && {
                lastXrayDate: toDate(input.lastXrayDate) ?? null,
            }),
            ...(input.primaryPhysicianName !== undefined && {
                primaryPhysicianName: input.primaryPhysicianName,
            }),
            ...(input.primaryPhysicianPhone !== undefined && {
                primaryPhysicianPhone: input.primaryPhysicianPhone,
            }),
            ...(input.initialChiefComplaint !== undefined && {
                initialChiefComplaint: input.initialChiefComplaint,
            }),
            updatedAt: new Date(),
        })
        .where(eq(patientMedicalProfiles.patientId, patient.id))
        .returning();

    return {
        patient,
        medicalProfile: updatedMedicalProfile,
        consents: await getConsentsByPatientId(patient.id),
    };
};

export const updatePatient = async (id: string, input: UpdatePatientInput) => {
    const {
        allergies,
        currentMedications,
        chronicConditions,
        pregnancyStatus,
        dentalAnxiety,
        lastDentalVisit,
        lastXrayDate,
        primaryPhysicianName,
        primaryPhysicianPhone,
        initialChiefComplaint,
        ...basicInput
    } = input;

    const hasBasicUpdates = Object.keys(basicInput).length > 0;
    const hasMedicalUpdates =
        allergies !== undefined ||
        currentMedications !== undefined ||
        chronicConditions !== undefined ||
        pregnancyStatus !== undefined ||
        dentalAnxiety !== undefined ||
        lastDentalVisit !== undefined ||
        lastXrayDate !== undefined ||
        primaryPhysicianName !== undefined ||
        primaryPhysicianPhone !== undefined ||
        initialChiefComplaint !== undefined;

    let result: PatientRegistrationResult | null = null;

    if (hasBasicUpdates) {
        result = await updatePatientBasicDetails(id, basicInput);
    }

    if (hasMedicalUpdates) {
        result = await updatePatientMedicalProfile(id, {
            allergies,
            currentMedications,
            chronicConditions,
            pregnancyStatus,
            dentalAnxiety,
            lastDentalVisit,
            lastXrayDate,
            primaryPhysicianName,
            primaryPhysicianPhone,
            initialChiefComplaint,
        });
    }

    if (!result) {
        throw new Error("At least one field is required");
    }

    return result;
};

export const blacklistPatient = async (
    id: string,
    isBlackListed: boolean,
    reason?: string
) => {
    const [patient] = await db
        .update(patients)
        .set({
            isBlackListed,
            blackListedReason: isBlackListed ? reason ?? null : null,
            updatedAt: new Date(),
        })
        .where(eq(patients.id, id))
        .returning();

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

export { assertPatientClinicAccess };
