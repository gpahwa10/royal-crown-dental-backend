export const ROLE_DOCTOR = "Doctor";
export const ROLE_ASSISTANT_RECEPTION = "Assistant Reception";
export const ROLE_HR_HEAD = "HR Head";
export const ROLE_HR_ASSISTANT = "HR Assistant";
export const ROLE_LAB_TECHNICIAN = "Lab Technician";
export const ROLE_PHLEBOTOMIST = "Phlebotomist";
export const ROLE_ASSISTANT_AND_RECEPTION = "Assistant & Reception";

export const EMPLOYEE_ROLES = [
    ROLE_DOCTOR,
    ROLE_ASSISTANT_RECEPTION,
    ROLE_HR_HEAD,
    ROLE_HR_ASSISTANT,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
    ROLE_ASSISTANT_AND_RECEPTION,
] as const;

export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Roles that can register clinic staff (HR Head, HR Assistant). */
export const HR_ROLES = [ROLE_HR_HEAD, ROLE_HR_ASSISTANT] as const;

export type HRRole = (typeof HR_ROLES)[number];

/** Non-HR clinic roles assignable via staff registration. */
export const CLINIC_STAFF_ROLES = [
    ROLE_DOCTOR,
    ROLE_ASSISTANT_RECEPTION,
    ROLE_LAB_TECHNICIAN,
    ROLE_PHLEBOTOMIST,
    ROLE_ASSISTANT_AND_RECEPTION,
] as const;

export type ClinicStaffRole = (typeof CLINIC_STAFF_ROLES)[number];

export const isHRRole = (role: string): role is HRRole =>
    (HR_ROLES as readonly string[]).includes(role);

export const isClinicStaffRole = (role: string): role is ClinicStaffRole =>
    (CLINIC_STAFF_ROLES as readonly string[]).includes(role);

export const SALT_ROUNDS = 10;
