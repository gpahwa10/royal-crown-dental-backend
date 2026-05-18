import { z } from "zod";
import {
    CLINIC_STAFF_ROLES,
    HR_ROLES,
    ROLE_HR_HEAD,
} from "./auth.constants";

const registerBaseSchema = z.object({
    clinicId: z.uuid().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
    password: z.string().min(6),
    phone: z.string().min(1),
    designation: z.string().min(1),
});

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});

export const registerStaffSchema = registerBaseSchema.extend({
    role: z.enum(CLINIC_STAFF_ROLES),
});

export const registerHRSchema = registerBaseSchema.extend({
    clinicId: z.uuid(),
    role: z.enum(HR_ROLES).default(ROLE_HR_HEAD),
});

export const createSuperAdminSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
    password: z.string().min(6),
});
