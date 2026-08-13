import { z } from "zod";
import {
    DENTAL_ANXIETY_LEVELS,
    PATIENT_TYPES,
    PREGNANCY_STATUSES,
} from "./patients.constants";

/** Email format check disabled for now — accept any trimmed string (or omit). */
const optionalEmail = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value));

/** Phone length/format checks disabled for now. */
const phoneField = z.coerce.string().trim();
const optionalPhone = z.coerce
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const stringArray = z.array(z.string().trim().min(1)).optional().default([]);

export const patientIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdRouteParamSchema = z.object({
    patientId: z.uuid(),
});

export const clinicIdParamSchema = z.object({
    clinicId: z.uuid(),
});

export const createPatientSchema = z
    .object({
        clinicId: z.uuid(),
        patientType: z.enum(PATIENT_TYPES),
        name: z.string().trim().min(1),
        phone: optionalPhone,
        email: optionalEmail,
        gender: z.string().trim().min(1).max(50),
        dateOfBirth: z.coerce.date(),
        address: z.string().trim().optional(),
        emergencyContactName: z.string().trim().optional(),
        emergencyContactPhone: optionalPhone,
        emergencyContactRelation: z.string().trim().max(100).optional(),
        allergies: stringArray,
        currentMedications: stringArray,
        chronicConditions: stringArray,
        pregnancyStatus: z.enum(PREGNANCY_STATUSES).default("Not Applicable"),
        dentalAnxiety: z.enum(DENTAL_ANXIETY_LEVELS).default("none"),
        lastDentalVisit: z.coerce.date().optional(),
        lastXrayDate: z.coerce.date().optional(),
        primaryPhysicianName: z.string().trim().optional(),
        primaryPhysicianPhone: optionalPhone,
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

export const updatePatientBasicDetailsSchema = z
    .object({
        name: z.string().trim().min(1).optional(),
        phone: optionalPhone,
        email: optionalEmail.nullable(),
        gender: z.string().trim().min(1).max(50).optional(),
        dateOfBirth: z.coerce.date().optional(),
        address: z.string().trim().nullable().optional(),
        emergencyContactName: z.string().trim().nullable().optional(),
        emergencyContactPhone: optionalPhone.nullable(),
        emergencyContactRelation: z.string().trim().max(100).nullable().optional(),
        patientType: z.enum(PATIENT_TYPES).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const updatePatientMedicalProfileSchema = z
    .object({
        allergies: z.array(z.string().trim().min(1)).optional(),
        currentMedications: z.array(z.string().trim().min(1)).optional(),
        chronicConditions: z.array(z.string().trim().min(1)).optional(),
        pregnancyStatus: z.enum(PREGNANCY_STATUSES).optional(),
        dentalAnxiety: z.enum(DENTAL_ANXIETY_LEVELS).optional(),
        lastDentalVisit: z.coerce.date().nullable().optional(),
        lastXrayDate: z.coerce.date().nullable().optional(),
        primaryPhysicianName: z.string().trim().nullable().optional(),
        primaryPhysicianPhone: optionalPhone.nullable(),
        initialChiefComplaint: z.string().trim().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const updatePatientSchema = z
    .object({
        name: z.string().trim().min(1).optional(),
        phone: optionalPhone,
        email: optionalEmail.nullable(),
        gender: z.string().trim().min(1).max(50).optional(),
        dateOfBirth: z.coerce.date().optional(),
        address: z.string().trim().nullable().optional(),
        emergencyContactName: z.string().trim().nullable().optional(),
        emergencyContactPhone: optionalPhone.nullable(),
        emergencyContactRelation: z.string().trim().max(100).nullable().optional(),
        patientType: z.enum(PATIENT_TYPES).optional(),
        allergies: z.array(z.string().trim().min(1)).optional(),
        currentMedications: z.array(z.string().trim().min(1)).optional(),
        chronicConditions: z.array(z.string().trim().min(1)).optional(),
        pregnancyStatus: z.enum(PREGNANCY_STATUSES).optional(),
        dentalAnxiety: z.enum(DENTAL_ANXIETY_LEVELS).optional(),
        lastDentalVisit: z.coerce.date().nullable().optional(),
        lastXrayDate: z.coerce.date().nullable().optional(),
        primaryPhysicianName: z.string().trim().nullable().optional(),
        primaryPhysicianPhone: optionalPhone.nullable(),
        initialChiefComplaint: z.string().trim().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const blacklistPatientSchema = z.object({
    isBlackListed: z.boolean(),
    reason: z.string().trim().optional(),
});

/** Bulk import body — row-level validation happens in the service for partial success. */
export const bulkCreatePatientsSchema = z.object({
    patients: z.array(z.record(z.string(), z.unknown())).min(1).max(600),
});

export const patientListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    clinicId: z.uuid().optional(),
    isBlackListed: z
        .enum(["true", "false"])
        .optional()
        .transform((value) =>
            value === undefined ? undefined : value === "true"
        ),
});
