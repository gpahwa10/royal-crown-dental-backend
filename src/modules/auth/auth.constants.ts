export const ROLE_DOCTOR = "Doctor";
export const ROLE_CLINIC_HEAD = "Clinic Head";
export const ROLE_RECEPTION = "Reception";
export const ROLE_ASSISTANT = "Assistant";
export const ROLE_HELPER = "Helper";
export const ROLE_LAB_TECHNICIAN = "Lab Technician";
export const ROLE_PHLEBOTOMIST = "Phlebotomist";
export const ROLE_INVENTORY_MANAGER = "Inventory Manager";
export const ROLE_HR_HEAD = "HR Head";
export const ROLE_HR_ASSISTANT = "HR Assistant";
export const ROLE_DIRECTOR = "Director";
export const ROLE_RETAIL_HEAD = "Retail Head";

/** Canonical clinic employee roles (matches frontend ROLES list + Director). */
export const EMPLOYEE_ROLES = [
    ROLE_DOCTOR,
    ROLE_CLINIC_HEAD,
    ROLE_RECEPTION,
    ROLE_ASSISTANT,
    ROLE_HELPER,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
    ROLE_INVENTORY_MANAGER,
    ROLE_HR_HEAD,
    ROLE_HR_ASSISTANT,
    ROLE_DIRECTOR,
    ROLE_RETAIL_HEAD,
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Legacy or alternate role labels mapped to canonical names. */
export const ROLE_NAME_ALIASES: Record<string, EmployeeRole> = {
    "Inventory manager": ROLE_INVENTORY_MANAGER,
};

export const normalizeRoleName = (name: string): string =>
    ROLE_NAME_ALIASES[name] ?? name;

/** Maps legacy designation labels to one or more role names. */
export const DESIGNATION_TO_ROLES: Record<string, readonly string[]> = {
    [ROLE_DOCTOR]: [ROLE_DOCTOR],
    [ROLE_CLINIC_HEAD]: [ROLE_CLINIC_HEAD],
    [ROLE_RECEPTION]: [ROLE_RECEPTION],
    [ROLE_ASSISTANT]: [ROLE_ASSISTANT],
    [ROLE_HELPER]: [ROLE_HELPER],
    [ROLE_LAB_TECHNICIAN]: [ROLE_LAB_TECHNICIAN],
    [ROLE_PHLEBOTOMIST]: [ROLE_PHLEBOTOMIST],
    [ROLE_INVENTORY_MANAGER]: [ROLE_INVENTORY_MANAGER],
    [ROLE_HR_HEAD]: [ROLE_HR_HEAD],
    [ROLE_HR_ASSISTANT]: [ROLE_HR_ASSISTANT],
    [ROLE_DIRECTOR]: [ROLE_DIRECTOR],
    [ROLE_RETAIL_HEAD]: [ROLE_RETAIL_HEAD],
    "Assistant & Reception": [ROLE_ASSISTANT, ROLE_RECEPTION],
    "Inventory manager": [ROLE_INVENTORY_MANAGER],
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
    ROLE_CLINIC_HEAD,
    ROLE_RECEPTION,
    ROLE_ASSISTANT,
    ROLE_HELPER,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
    ROLE_INVENTORY_MANAGER,
] as const;

export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLES)[number];

export const isHRRole = (role: string): role is HRRole =>
    (HR_ROLES as readonly string[]).includes(role);

export const isClinicStaffRole = (role: string): role is ClinicStaffRole =>
    (CLINIC_STAFF_ROLES as readonly string[]).includes(role);

/** Employee roles with the same access level as a super admin account. */
export const PLATFORM_ADMIN_ROLES = [ROLE_DIRECTOR, ROLE_RETAIL_HEAD] as const;

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
        (PLATFORM_ADMIN_ROLES as readonly string[]).includes(
            normalizeRoleName(role)
        )
    );
};

/** Super admin account or platform-admin employee (Director / Retail Head). */
export const isSuperAdminOrDirector = hasPlatformAdminAccess;

/** Clinic roles that can view the employee/doctor list (in addition to HR and platform admins). */
export const EMPLOYEE_LIST_VIEW_ROLES = [
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
] as const;

/** Clinic staff who may list doctors in their assigned clinic (doctor picker). */
export const EMPLOYEE_DOCTOR_SELECT_ROLES = [
    ROLE_DOCTOR,
    ROLE_CLINIC_HEAD,
    ROLE_RECEPTION,
    ROLE_ASSISTANT,
    ROLE_HELPER,
    ROLE_INVENTORY_MANAGER,
] as const;

/** HR Head, HR Assistant, Director, super admin, Lab Technician, or Phlebotomist — full employee list. */
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
    const roles = (user.roles ?? []).map(normalizeRoleName);
    return (
        roles.some((role) =>
            (HR_ROLES as readonly string[]).includes(role)
        ) ||
        roles.some((role) =>
            (EMPLOYEE_LIST_VIEW_ROLES as readonly string[]).includes(role)
        )
    );
};

/** Clinic staff who may list doctors in their own clinic only. */
export const canSelectClinicDoctors = (user?: {
    roles?: string[];
}) => {
    if (!user) {
        return false;
    }
    const roles = (user.roles ?? []).map(normalizeRoleName);
    return roles.some((role) =>
        (EMPLOYEE_DOCTOR_SELECT_ROLES as readonly string[]).includes(role)
    );
};

/** Full employee list or clinic-scoped doctor picker. */
export const canAccessEmployeeList = (user?: {
    isSuperAdmin?: boolean;
    roles?: string[];
}) => canListEmployees(user) || canSelectClinicDoctors(user);

export const isDoctorEmployee = (user?: { roles?: string[] }) =>
    (user?.roles ?? []).some(
        (role) => normalizeRoleName(role) === ROLE_DOCTOR
    );

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
        (HR_ROLES as readonly string[]).includes(normalizeRoleName(role))
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
        (CONSULTATION_PATIENT_LIST_ROLES as readonly string[]).includes(
            normalizeRoleName(role)
        )
    );
};

/** Roles that can maintain inventory (create, update, delete, stock operations). */
export const INVENTORY_MANAGE_ROLES = [ROLE_INVENTORY_MANAGER] as const;

/** Super admin, Director, or Inventory Manager — can maintain inventory. */
export const canManageInventory = (user?: {
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
        (INVENTORY_MANAGE_ROLES as readonly string[]).includes(
            normalizeRoleName(role)
        )
    );
};

/** Any clinic employee role — can view inventory (read-only). */
export const canViewInventory = (user?: {
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
        (EMPLOYEE_ROLES as readonly string[]).includes(
            normalizeRoleName(role) as EmployeeRole
        )
    );
};

export const SALT_ROUNDS = 10;
