export const ROLE_DIRECTOR = "Director";

export const ROLE_DOCTOR = "Doctor";
export const ROLE_ASSISTANT = "Assistant";
export const ROLE_RECEPTION = "Reception";
export const ROLE_HR_HEAD = "HR Head";
export const ROLE_HR_ASSISTANT = "HR Assistant";
export const ROLE_LAB_TECHNICIAN = "Lab Technician";
export const ROLE_PHLEBOTOMIST = "Phlebotomist";

export const EMPLOYEE_ROLES = [
    ROLE_DOCTOR,
    ROLE_ASSISTANT,
    ROLE_RECEPTION,
    ROLE_HR_HEAD,
    ROLE_HR_ASSISTANT,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
    ROLE_DIRECTOR,
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Maps legacy designation labels to one or more role names. */
export const DESIGNATION_TO_ROLES: Record<string, readonly string[]> = {
    [ROLE_DOCTOR]: [ROLE_DOCTOR],
    [ROLE_ASSISTANT]: [ROLE_ASSISTANT],
    [ROLE_RECEPTION]: [ROLE_RECEPTION],
    [ROLE_HR_HEAD]: [ROLE_HR_HEAD],
    [ROLE_HR_ASSISTANT]: [ROLE_HR_ASSISTANT],
    [ROLE_LAB_TECHNICIAN]: [ROLE_LAB_TECHNICIAN],
    [ROLE_PHLEBOTOMIST]: [ROLE_PHLEBOTOMIST],
    "Assistant & Reception": [ROLE_ASSISTANT, ROLE_RECEPTION],
};

export const resolveRolesFromDesignation = (designation: string): string[] => {
    const roles = DESIGNATION_TO_ROLES[designation];
    if (!roles) {
        throw new Error(`Designation "${designation}" is not mapped to roles`);
    }
    return [...roles];
};

/** Roles that can register clinic staff (HR Head, HR Assistant). */
export const HR_ROLES = [ROLE_HR_HEAD, ROLE_HR_ASSISTANT] as const;

export type HRRole = (typeof HR_ROLES)[number];

/** Non-HR clinic roles assignable via staff registration. */
export const CLINIC_STAFF_ROLES = [
    ROLE_DOCTOR,
    ROLE_ASSISTANT,
    ROLE_RECEPTION,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
] as const;

export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLES)[number];

export const isHRRole = (role: string): role is HRRole =>
    (HR_ROLES as readonly string[]).includes(role);

export const isClinicStaffRole = (role: string): role is ClinicStaffRole =>
    (CLINIC_STAFF_ROLES as readonly string[]).includes(role);

/** Employee roles with the same access level as a super admin account. */
export const PLATFORM_ADMIN_ROLES = [ROLE_DIRECTOR] as const;

export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

export const hasPlatformAdminAccess = (user?: {
    isSuperAdmin?: boolean;
    roles?: string[];
}) => {
    if (!user) {
        return false;
    }
    if (user.isSuperAdmin) {
        return true;
    }
    return (user.roles ?? []).some((role) =>
        (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role)
    );
};

/** Super admin account or Director employee. */
export const isSuperAdminOrDirector = hasPlatformAdminAccess;

/** Clinic roles that can view the employee/doctor list (in addition to HR and platform admins). */
export const EMPLOYEE_LIST_VIEW_ROLES = [
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
] as const;

/** HR Head, HR Assistant, Director, super admin, Lab Technician, or Phlebotomist — can list employees. */
export const canListEmployees = (user?: {
    isSuperAdmin?: boolean;
    roles?: string[];
}) => {
    if (!user) {
        return false;
    }
    if (hasPlatformAdminAccess(user)) {
        return true;
    }
    const roles = user.roles ?? [];
    return (
        roles.some((role) =>
            (HR_ROLES as readonly string[]).includes(role)
        ) ||
        roles.some((role) =>
            (EMPLOYEE_LIST_VIEW_ROLES as readonly string[]).includes(role)
        )
    );
};

/** HR Head, HR Assistant, Director, or super admin — can create staff accounts. */
export const canRegisterStaff = (user?: {
    isSuperAdmin?: boolean;
    roles?: string[];
}) => {
    if (!user) {
        return false;
    }
    if (hasPlatformAdminAccess(user)) {
        return true;
    }
    return (user.roles ?? []).some((role) =>
        (HR_ROLES as readonly string[]).includes(role)
    );
};

/** Director or super admin only — can create HR accounts. */
export const canRegisterHR = hasPlatformAdminAccess;

/** Clinic roles that can list patients when creating or managing consultations. */
export const CONSULTATION_PATIENT_LIST_ROLES = [
    ROLE_DOCTOR,
    ROLE_ASSISTANT,
    ROLE_RECEPTION,
] as const;

export const canAccessConsultationPatientList = (user?: {
    isSuperAdmin?: boolean;
    roles?: string[];
}) => {
    if (!user) {
        return false;
    }
    if (hasPlatformAdminAccess(user)) {
        return true;
    }
    return (user.roles ?? []).some((role) =>
        (CONSULTATION_PATIENT_LIST_ROLES as readonly string[]).includes(role)
    );
};

export const SALT_ROUNDS = 10;
