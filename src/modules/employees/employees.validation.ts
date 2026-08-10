import { z } from "zod";
import {
    CLINIC_STAFF_ROLES,
    DESIGNATION_TO_ROLES,
    HR_ROLES,
    resolveRolesFromDesignation,
    ROLE_DIRECTOR,
    ROLE_HR_HEAD,
    ROLE_RECEPTION,
    ROLE_RETAIL_HEAD,
} from "../auth/auth.constants";

const optionalUuid = z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.uuid().optional()
);

/** Accepts role name, designation label, role UUID, or { name | id } objects. */
export const roleInputSchema = z.preprocess(
    (value) => {
        if (typeof value === "string") {
            return value.trim();
        }

        if (typeof value === "object" && value !== null) {
            const record = value as Record<string, unknown>;
            if (typeof record.name === "string") {
                return record.name.trim();
            }
            if (typeof record.id === "string") {
                return record.id.trim();
            }
        }

        return value;
    },
    z.string().min(1)
);

const expandDesignationRoles = (roles: string[] | undefined) => {
    if (!roles) {
        return undefined;
    }

    const expanded: string[] = [];

    for (const role of roles) {
        if (role in DESIGNATION_TO_ROLES) {
            expanded.push(...DESIGNATION_TO_ROLES[role]);
        } else {
            expanded.push(role);
        }
    }

    return [...new Set(expanded)];
};

const registerBaseSchema = z.object({
    clinicId: optionalUuid,
    name: z.string().min(1),
    email: z.email(),
    /** Password is optional — defaults to the platform's initial employee password. */
    password: z.string().min(6).optional(),
    phone: z.string().min(1).optional(),
    designation: z.string().min(1).optional(),
    timings: z.string().min(1).optional(),
});

export const registerStaffSchema = registerBaseSchema
    .extend({
        roles: z.array(z.enum(CLINIC_STAFF_ROLES)).min(1).optional(),
    })
    .superRefine((data, ctx) => {
        const hasRoles = Boolean(data.roles?.length);
        const hasDesignation =
            data.designation != null &&
            data.designation in DESIGNATION_TO_ROLES;

        if (!hasRoles && !hasDesignation) {
            ctx.addIssue({
                code: "custom",
                message:
                    "Provide roles (e.g. [\"Doctor\"]) or a valid designation",
                path: ["roles"],
            });
        }
    })
    .transform((data) => {
        const roles =
            data.roles ??
            (data.designation
                ? [...resolveRolesFromDesignation(data.designation)]
                : []);

        const designation =
            data.designation ??
            (roles.length === 1
                ? roles[0]
                : roles.includes("Assistant") &&
                    (roles.includes(ROLE_RECEPTION) || roles.includes("Reception"))
                  ? "Assistant & FDE"
                  : roles[0]);

        return {
            ...data,
            roles,
            designation,
        };
    });

const REGISTERABLE_LEADERSHIP_ROLES = [
    ...HR_ROLES,
    ROLE_DIRECTOR,
    ROLE_RETAIL_HEAD,
] as const;

export const registerHRSchema = registerBaseSchema
    .extend({
        clinicId: z.uuid(),
        roles: z
            .array(z.enum(REGISTERABLE_LEADERSHIP_ROLES))
            .min(1)
            .default([ROLE_HR_HEAD]),
    })
    .transform((data) => ({
        ...data,
        designation: data.designation ?? data.roles[0],
        roles: data.roles ?? [ROLE_HR_HEAD],
    }));

export const listEmployeesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    clinicId: z.uuid().optional(),
    role: z.string().trim().optional(),
    status: z.enum(["active", "inactive", "all"]).optional(),
});

export const editEmployeeParamsSchema = z.object({
    id: z.uuid(),
});

export const editEmployeeSchema = z
    .object({
        name: z.string().min(1).optional(),
        email: z.email().optional(),
        phone: z.string().min(1).optional(),
        designation: z.string().min(1).optional(),
        timings: z.string().min(1).optional(),
        roles: z
            .array(roleInputSchema)
            .min(1)
            .optional()
            .transform(expandDesignationRoles),
    })
    .refine(
        (data) =>
            Object.values(data).some((value) => value !== undefined),
        { message: "At least one field is required to update" }
    );

    export const blockEmployeeParamsSchema = z.object({
        id: z.uuid(),
    });
    
    export const blockEmployeeSchema = z.object({
        isBlocked: z.boolean(),
    });

    export const suspendEmployeeParamsSchema = z.object({
        id: z.uuid(),
    });

    export const suspendEmployeeSchema = z.object({
        isSuspended: z.boolean(),
    });

    export const activateEmployeeParamsSchema = z.object({
        id: z.uuid(),
    });
const hhmmSchema = z
    .string()
    .regex(/^\d{2}:\d{2}$/, "must be HH:mm")
    .nullable()
    .optional();

export const employeeDayHoursSchema = z
    .object({
        dayOfWeek: z.number().int().min(0).max(6),
        isOff: z.boolean().optional(),
        startTime: hhmmSchema,
        endTime: hhmmSchema,
    })
    .superRefine((day, ctx) => {
        if (day.isOff === true) {
            return;
        }
        if (!day.startTime || !day.endTime) {
            ctx.addIssue({
                code: "custom",
                message: "startTime and endTime are required when not off",
            });
        }
    });

export const replaceEmployeeWorkingHoursSchema = z.object({
    days: z.array(employeeDayHoursSchema).min(1).max(7),
});

export const employeeIdParamSchema = z.object({
    id: z.uuid(),
});
