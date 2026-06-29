import { z } from "zod";
import { PAYMENT_METHODS } from "../billing/billing.constants";
import {
    DENTAL_ANXIETY_LEVELS,
    PATIENT_TYPES,
    PREGNANCY_STATUSES,
} from "../patients/patients.constants";
import {
    CLINIC_VISIT_OUTCOMES,
    CLINIC_VISIT_PURPOSES,
    CLINIC_VISIT_STATUSES,
} from "./clinicVisit.constants";

export const clinicVisitIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

const optionalEmail = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email().optional());

const stringArray = z.array(z.string().trim().min(1)).optional().default([]);

export const createClinicVisitSchema = z.object({
    clinicId: z.uuid().optional(),
    visitorName: z.string().trim().min(1),
    visitorPhone: z.string().trim().min(1).max(20),
    visitorEmail: optionalEmail,
    patientId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    appointmentId: z.uuid().optional(),
    doctorId: z.uuid().optional(),
    purpose: z.enum(CLINIC_VISIT_PURPOSES),
    notes: z.string().trim().optional(),
    visitDate: z.coerce.date().optional(),
});

export const updateClinicVisitSchema = z
    .object({
        purpose: z.enum(CLINIC_VISIT_PURPOSES).optional(),
        doctorId: z.uuid().nullable().optional(),
        outcome: z.enum(CLINIC_VISIT_OUTCOMES).nullable().optional(),
        notes: z.string().trim().nullable().optional(),
        treatmentPerformed: z.string().trim().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const clinicVisitListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    clinicId: z.uuid().optional(),
    doctorId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    purpose: z.enum(CLINIC_VISIT_PURPOSES).optional(),
    outcome: z.enum(CLINIC_VISIT_OUTCOMES).optional(),
    status: z.enum(CLINIC_VISIT_STATUSES).optional(),
    isRegistered: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
            value === undefined ? undefined : value === "true"
        ),
    treatmentPerformed: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
            value === undefined ? undefined : value === "true"
        ),
    search: z.string().trim().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});

export const registerPatientFromVisitSchema = z
    .object({
        patientType: z.enum(PATIENT_TYPES).default("new"),
        name: z.string().trim().min(1).optional(),
        phone: z.string().trim().min(1).max(20).optional(),
        email: optionalEmail,
        gender: z.string().trim().min(1).max(50),
        dateOfBirth: z.coerce.date(),
        address: z.string().trim().optional(),
        emergencyContactName: z.string().trim().optional(),
        emergencyContactPhone: z.string().trim().max(20).optional(),
        emergencyContactRelation: z.string().trim().max(100).optional(),
        allergies: stringArray,
        currentMedications: stringArray,
        chronicConditions: stringArray,
        pregnancyStatus: z.enum(PREGNANCY_STATUSES).default("Not Applicable"),
        dentalAnxiety: z.enum(DENTAL_ANXIETY_LEVELS).default("none"),
        lastDentalVisit: z.coerce.date().optional(),
        lastXrayDate: z.coerce.date().optional(),
        primaryPhysicianName: z.string().trim().optional(),
        primaryPhysicianPhone: z.string().trim().max(20).optional(),
        initialChiefComplaint: z.string().trim().optional(),
        treatmentConsentSigned: z.boolean(),
        privacyAccepted: z.boolean(),
    })
    .superRefine((data, ctx) => {
        if (!data.treatmentConsentSigned) {
            ctx.addIssue({
                code: "custom",
                message: "Treatment consent must be signed",
                path: ["treatmentConsentSigned"],
            });
        }

        if (!data.privacyAccepted) {
            ctx.addIssue({
                code: "custom",
                message: "Privacy policy must be accepted",
                path: ["privacyAccepted"],
            });
        }
    });

export const startConsultationFromVisitSchema = z.object({
    doctorId: z.uuid().optional(),
    chiefComplaint: z.string().trim().min(1),
    appointmentId: z.uuid().optional(),
});

const scheduledAtFields = {
    scheduledAt: z.coerce.date().optional(),
    appointmentDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "appointmentDate must be YYYY-MM-DD")
        .optional(),
    appointmentTime: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "appointmentTime must be HH:mm")
        .optional(),
};

export const createAppointmentFromVisitSchema = z
    .object({
        employeeId: z.uuid().optional(),
        symptoms: z.string().trim().optional(),
        ...scheduledAtFields,
    })
    .superRefine((data, ctx) => {
        const hasScheduledAt = data.scheduledAt !== undefined;
        const hasDateParts =
            data.appointmentDate !== undefined &&
            data.appointmentTime !== undefined;

        if (!hasScheduledAt && !hasDateParts) {
            ctx.addIssue({
                code: "custom",
                message:
                    "Provide scheduledAt or both appointmentDate and appointmentTime",
            });
        }
    });

export const createMembershipFromVisitSchema = z.object({
    membershipPlanId: z.uuid(),
    payment: z
        .object({
            amount: z.coerce.number().int().positive(),
            paymentMethod: z.enum(PAYMENT_METHODS),
            paymentReference: z.string().trim().optional(),
            paymentDate: z.coerce.date().optional(),
            notes: z.string().trim().optional(),
        })
        .optional(),
});

export const attachMedicalRecordSchema = z.object({
    fileId: z.uuid(),
});

export const clinicVisitDashboardQuerySchema = z.object({
    clinicId: z.uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
});
