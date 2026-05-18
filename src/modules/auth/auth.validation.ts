import { z } from "zod";
import {
    CLINIC_STAFF_ROLES,
    HR_ROLES,
    ROLE_DIRECTOR,
    ROLE_HR_HEAD,
} from "./auth.constants";

const registerBaseSchema = z.object({
    clinicId: z.uuid().optional(),
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(6),
    phone: z.string().min(1).optional(),
    designation: z.string().min(1),
    timings: z.string().min(1).optional(),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});

export const registerStaffSchema = registerBaseSchema.extend({
    roles: z.array(z.enum(CLINIC_STAFF_ROLES)).min(1),
});

const REGISTERABLE_LEADERSHIP_ROLES = [...HR_ROLES, ROLE_DIRECTOR] as const;

export const registerHRSchema = registerBaseSchema.extend({
    clinicId: z.uuid(),
    roles: z
        .array(z.enum(REGISTERABLE_LEADERSHIP_ROLES))
        .min(1)
        .default([ROLE_HR_HEAD]),
});

export const createSuperAdminSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
    password: z.string().min(6),
});
