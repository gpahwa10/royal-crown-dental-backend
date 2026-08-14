import { z } from "zod";
import { APPOINTMENT_STATUSES } from "./appointments.constants";

const scheduledAtInputRefine = (
    data: {
        scheduledAt?: Date;
        appointmentDate?: string;
        appointmentTime?: string;
    },
    ctx: z.RefinementCtx
) => {
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
};

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

export const appointmentParamsSchema = z.object({
    id: z.uuid(),
});

export const createAppointmentSchema = z
    .object({
        clinicId: z.uuid().optional(),
        patientId: z.uuid().optional(),
        leadId: z.uuid().optional(),
        employeeId: z.uuid().optional(),
        symptoms: z.string().trim().optional(),
        ...scheduledAtFields,
    })
    .superRefine((data, ctx) => {
        if (!data.patientId && !data.leadId) {
            ctx.addIssue({
                code: "custom",
                message: "patientId or leadId is required",
                path: ["patientId"],
            });
        }
        scheduledAtInputRefine(data, ctx);
    });

export const listAppointmentsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    clinicId: z.uuid().optional(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    employeeId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    search: z.string().trim().optional(),
});

export const updateAppointmentSchema = z
    .object({
        clinicId: z.uuid().optional(),
        employeeId: z.uuid().nullable().optional(),
        patientId: z.uuid().nullable().optional(),
        leadId: z.uuid().nullable().optional(),
        symptoms: z.string().trim().nullable().optional(),
        ...scheduledAtFields,
    })
    .superRefine((data, ctx) => {
        const hasScheduleInput =
            data.scheduledAt !== undefined ||
            data.appointmentDate !== undefined ||
            data.appointmentTime !== undefined;

        if (hasScheduleInput) {
            scheduledAtInputRefine(data, ctx);
        }

        if (Object.keys(data).length === 0) {
            ctx.addIssue({
                code: "custom",
                message: "At least one field is required",
            });
        }
    });

export const updateAppointmentStatusSchema = z.object({
    status: z.enum(APPOINTMENT_STATUSES),
});

export const shiftAppointmentClinicSchema = z.object({
    newClinicId: z.uuid(),
});

export const availableDoctorsQuerySchema = z.object({
    clinicId: z.uuid().optional(),
    date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:mm"),
    durationMinutes: z.coerce.number().int().positive().max(480).optional(),
});
