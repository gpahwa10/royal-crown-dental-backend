import { z } from "zod";
import { PAYMENT_METHODS } from "../billing/billing.constants";
import {
    MEMBERSHIP_DISCOUNT_TYPES,
    PATIENT_MEMBERSHIP_STATUSES,
} from "./membership.constants";

export const membershipPlanIdParamSchema = z.object({
    id: z.uuid(),
});

export const membershipBenefitParamsSchema = z.object({
    id: z.uuid(),
    benefitId: z.uuid(),
});

export const patientMembershipIdParamSchema = z.object({
    id: z.uuid(),
});

export const createMembershipPlanSchema = z.object({
    planCode: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((value) => value.toUpperCase()),
    planName: z.string().trim().min(1),
    description: z.string().trim().optional(),
    price: z.coerce.number().int().min(0),
    validityDays: z.coerce.number().int().min(1),
});

export const updateMembershipPlanSchema = z
    .object({
        planName: z.string().trim().min(1).optional(),
        description: z.string().trim().nullable().optional(),
        price: z.coerce.number().int().min(0).optional(),
        validityDays: z.coerce.number().int().min(1).optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const createMembershipBenefitSchema = z.object({
    serviceCode: z
        .string()
        .trim()
        .min(1)
        .max(50)
        .transform((value) => value.toUpperCase()),
    discountType: z.enum(MEMBERSHIP_DISCOUNT_TYPES),
    discountValue: z.coerce.number().int().min(0),
});

export const updateMembershipBenefitSchema = createMembershipBenefitSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field is required",
    });

export const purchasePatientMembershipSchema = z.object({
    patientId: z.uuid(),
    membershipPlanId: z.uuid(),
});

export const completeMembershipPaymentSchema = z.object({
    amount: z.coerce.number().int().positive(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentReference: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
});

export const membershipPlanListQuerySchema = z.object({
    status: z.enum(PATIENT_MEMBERSHIP_STATUSES).optional(),
});
