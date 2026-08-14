import { z } from "zod";
import { LEAD_SOURCES, LEAD_STATUSES } from "./leads.constants";
import { normalizePhone } from "./leads.utils";

const phoneSchema = z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform(normalizePhone);

const optionalEmail = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.email().optional());

export const leadParamsSchema = z.object({
    id: z.uuid(),
});

export const createLeadSchema = z.object({
    clinicId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    name: z.string().trim().min(1),
    email: optionalEmail,
    phone: phoneSchema,
    source: z.enum(LEAD_SOURCES),
    symptoms: z.string().trim().optional(),
    notes: z.string().trim().optional(),
});

export const createPublicLeadSchema = z.object({
    clinicId: z.uuid(),
    name: z.string().trim().min(1),
    email: optionalEmail,
    phone: phoneSchema,
    symptoms: z.string().trim().optional(),
});

export const listLeadsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    clinicId: z.uuid().optional(),
    status: z.enum(LEAD_STATUSES).optional(),
    search: z.string().trim().optional(),
});

export const updateLeadStatusSchema = z.object({
    status: z.enum(LEAD_STATUSES),
});

export const updateLeadSchema = z
    .object({
        name: z.string().trim().min(1).optional(),
        email: optionalEmail.nullable(),
        phone: phoneSchema.optional(),
        source: z.enum(LEAD_SOURCES).optional(),
        symptoms: z.string().trim().nullable().optional(),
        notes: z.string().trim().nullable().optional(),
        clinicId: z.uuid().optional(),
        patientId: z.uuid().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const bookLeadAppointmentSchema = z
    .object({
        clinicId: z.uuid().optional(),
        scheduledAt: z.coerce.date().optional(),
        appointmentDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "appointmentDate must be YYYY-MM-DD")
            .optional(),
        appointmentTime: z
            .string()
            .regex(/^\d{2}:\d{2}$/, "appointmentTime must be HH:mm")
            .optional(),
        employeeId: z.uuid().optional(),
        symptoms: z.string().trim().optional(),
    })
    .refine(
        (data) =>
            data.scheduledAt !== undefined ||
            (data.appointmentDate !== undefined &&
                data.appointmentTime !== undefined),
        {
            message:
                "Provide scheduledAt or both appointmentDate and appointmentTime",
        }
    );

export const convertLeadToPatientSchema = z.object({
    patientId: z.uuid().optional(),
});
