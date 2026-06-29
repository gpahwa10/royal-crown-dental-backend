import { z } from "zod";
import {
    DENTAL_LAB_ITEM_TYPES,
    DENTAL_LAB_ORDER_STATUSES,
} from "./dentalLab.constants";

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

const scheduledAtRefine = (
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

export const dentalLabOrderIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});

export const dentalLabOrderFileParamsSchema = z.object({
    id: z.uuid(),
    fileId: z.uuid(),
});

export const createDentalLabOrderSchema = z.object({
    patientId: z.uuid(),
    consultationId: z.uuid().nullable().optional(),
    clinicId: z.uuid().optional(),
    measuredByDoctorId: z.uuid(),
    labName: z.string().trim().min(1),
    itemType: z.enum(DENTAL_LAB_ITEM_TYPES),
    toothNumber: z.string().trim().optional(),
    shade: z.string().trim().optional(),
    description: z.string().trim().optional(),
    estimatedDeliveryDate: z.coerce.date().optional(),
    orderedDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
});

export const deliverDentalLabOrderSchema = z
    .object({})
    .strict()
    .optional()
    .default({});

export const createCementationAppointmentSchema = z
    .object({
        employeeId: z.uuid(),
        symptoms: z.string().trim().optional(),
        ...scheduledAtFields,
    })
    .superRefine(scheduledAtRefine);

export const recordCementationSchema = z.object({
    cementationDoctorId: z.uuid(),
    cementationDate: z.coerce.date(),
    notes: z.string().trim().optional(),
});

export const attachDentalLabFileSchema = z.object({
    fileId: z.uuid(),
});

export const removeDentalLabFileSchema = z.object({
    fileId: z.uuid(),
});

export const dentalLabOrderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(DENTAL_LAB_ORDER_STATUSES).optional(),
    clinicId: z.uuid().optional(),
    doctorId: z.uuid().optional(),
    patientId: z.uuid().optional(),
    search: z.string().trim().optional(),
});
