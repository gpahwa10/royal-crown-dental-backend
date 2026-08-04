import { z } from "zod";

export const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});

export const createSuperAdminSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(6),
});

export const changePasswordSchema = z.object({
    /** Required after onboarding; optional on first forced change. */
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8),
});
