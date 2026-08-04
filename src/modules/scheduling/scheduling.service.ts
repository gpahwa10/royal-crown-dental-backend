import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { db } from "../../db/client";
import { appointments } from "../../db/schema/appointments";
import { clinicWorkingHours } from "../../db/schema/clinicWorkingHours";
import { clinics } from "../../db/schema/clinic";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employeeWorkingHours } from "../../db/schema/employeeWorkingHours";
import { employees } from "../../db/schema/employees";
import { employeeRoles } from "../../db/schema/roles";
import { ROLE_DOCTOR } from "../auth/auth.constants";
import {
    CLINIC_TIMEZONE,
    DEFAULT_APPOINTMENT_DURATION_MINUTES,
} from "./scheduling.constants";
import {
    addMinutesToHHmm,
    assertHHmm,
    isRangeWithinWindow,
    normalizeHHmm,
    rangesOverlap,
    wallClockPartsInTz,
} from "./scheduling.utils";

export type ClinicDayHours = {
    dayOfWeek: number;
    openTime: string | null;
    closeTime: string | null;
    isClosed: boolean;
};

export type EmployeeDayHours = {
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isOff: boolean;
};

const formatClinicDay = (
    row: typeof clinicWorkingHours.$inferSelect
): ClinicDayHours => ({
    dayOfWeek: row.dayOfWeek,
    openTime: normalizeHHmm(row.openTime),
    closeTime: normalizeHHmm(row.closeTime),
    isClosed: row.isClosed,
});

const formatEmployeeDay = (
    row: typeof employeeWorkingHours.$inferSelect
): EmployeeDayHours => ({
    dayOfWeek: row.dayOfWeek,
    startTime: normalizeHHmm(row.startTime),
    endTime: normalizeHHmm(row.endTime),
    isOff: row.isOff,
});

export const getClinicWorkingHours = async (
    clinicId: string
): Promise<ClinicDayHours[]> => {
    const rows = await db
        .select()
        .from(clinicWorkingHours)
        .where(eq(clinicWorkingHours.clinicId, clinicId))
        .orderBy(clinicWorkingHours.dayOfWeek);

    return rows.map(formatClinicDay);
};

export const getEmployeeWorkingHours = async (
    employeeId: string
): Promise<EmployeeDayHours[]> => {
    const rows = await db
        .select()
        .from(employeeWorkingHours)
        .where(eq(employeeWorkingHours.employeeId, employeeId))
        .orderBy(employeeWorkingHours.dayOfWeek);

    return rows.map(formatEmployeeDay);
};

export const getClinicWorkingHoursByClinicIds = async (
    clinicIds: string[]
): Promise<Map<string, ClinicDayHours[]>> => {
    const map = new Map<string, ClinicDayHours[]>();
    if (clinicIds.length === 0) {
        return map;
    }

    const rows = await db
        .select()
        .from(clinicWorkingHours)
        .where(inArray(clinicWorkingHours.clinicId, clinicIds));

    for (const row of rows) {
        const list = map.get(row.clinicId) ?? [];
        list.push(formatClinicDay(row));
        map.set(row.clinicId, list);
    }

    for (const [id, list] of map) {
        list.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        map.set(id, list);
    }

    return map;
};

export const getEmployeeWorkingHoursByEmployeeIds = async (
    employeeIds: string[]
): Promise<Map<string, EmployeeDayHours[]>> => {
    const map = new Map<string, EmployeeDayHours[]>();
    if (employeeIds.length === 0) {
        return map;
    }

    const rows = await db
        .select()
        .from(employeeWorkingHours)
        .where(inArray(employeeWorkingHours.employeeId, employeeIds));

    for (const row of rows) {
        const list = map.get(row.employeeId) ?? [];
        list.push(formatEmployeeDay(row));
        map.set(row.employeeId, list);
    }

    for (const [id, list] of map) {
        list.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
        map.set(id, list);
    }

    return map;
};

const validateClinicDayInput = (day: {
    dayOfWeek: number;
    isClosed?: boolean;
    openTime?: string | null;
    closeTime?: string | null;
}) => {
    if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new Error("dayOfWeek must be between 0 and 6");
    }

    const isClosed = day.isClosed === true;
    if (isClosed) {
        return {
            dayOfWeek: day.dayOfWeek,
            isClosed: true,
            openTime: null as string | null,
            closeTime: null as string | null,
        };
    }

    if (!day.openTime || !day.closeTime) {
        throw new Error(
            `openTime and closeTime are required for day ${day.dayOfWeek}`
        );
    }

    const openTime = assertHHmm(day.openTime, "openTime");
    const closeTime = assertHHmm(day.closeTime, "closeTime");
    if (openTime >= closeTime) {
        throw new Error("openTime must be before closeTime");
    }

    return { dayOfWeek: day.dayOfWeek, isClosed: false, openTime, closeTime };
};

const validateEmployeeDayInput = (day: {
    dayOfWeek: number;
    isOff?: boolean;
    startTime?: string | null;
    endTime?: string | null;
}) => {
    if (day.dayOfWeek < 0 || day.dayOfWeek > 6) {
        throw new Error("dayOfWeek must be between 0 and 6");
    }

    const isOff = day.isOff === true;
    if (isOff) {
        return {
            dayOfWeek: day.dayOfWeek,
            isOff: true,
            startTime: null as string | null,
            endTime: null as string | null,
        };
    }

    if (!day.startTime || !day.endTime) {
        throw new Error(
            `startTime and endTime are required for day ${day.dayOfWeek}`
        );
    }

    const startTime = assertHHmm(day.startTime, "startTime");
    const endTime = assertHHmm(day.endTime, "endTime");
    if (startTime >= endTime) {
        throw new Error("startTime must be before endTime");
    }

    return { dayOfWeek: day.dayOfWeek, isOff: false, startTime, endTime };
};

export const replaceClinicWorkingHours = async (
    clinicId: string,
    days: Array<{
        dayOfWeek: number;
        isClosed?: boolean;
        openTime?: string | null;
        closeTime?: string | null;
    }>
) => {
    const [clinic] = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    const normalized = days.map(validateClinicDayInput);
    const daySet = new Set(normalized.map((d) => d.dayOfWeek));
    if (daySet.size !== normalized.length) {
        throw new Error("Duplicate dayOfWeek in working hours");
    }

    await db.transaction(async (tx) => {
        await tx
            .delete(clinicWorkingHours)
            .where(eq(clinicWorkingHours.clinicId, clinicId));

        if (normalized.length === 0) {
            return;
        }

        await tx.insert(clinicWorkingHours).values(
            normalized.map((day) => ({
                clinicId,
                dayOfWeek: day.dayOfWeek,
                openTime: day.openTime,
                closeTime: day.closeTime,
                isClosed: day.isClosed,
            }))
        );
    });

    return getClinicWorkingHours(clinicId);
};

export const replaceEmployeeWorkingHours = async (
    employeeId: string,
    days: Array<{
        dayOfWeek: number;
        isOff?: boolean;
        startTime?: string | null;
        endTime?: string | null;
    }>
) => {
    const [employee] = await db
        .select({ id: employees.id, clinicId: employees.clinicId })
        .from(employees)
        .where(eq(employees.id, employeeId));

    if (!employee) {
        throw new Error("Employee not found");
    }

    const normalized = days.map(validateEmployeeDayInput);
    const daySet = new Set(normalized.map((d) => d.dayOfWeek));
    if (daySet.size !== normalized.length) {
        throw new Error("Duplicate dayOfWeek in working hours");
    }

    const clinicHours = await getClinicWorkingHours(employee.clinicId);
    const clinicByDay = new Map(clinicHours.map((d) => [d.dayOfWeek, d]));

    for (const day of normalized) {
        if (day.isOff) {
            continue;
        }

        const clinicDay = clinicByDay.get(day.dayOfWeek);
        if (!clinicDay || clinicDay.isClosed || !clinicDay.openTime || !clinicDay.closeTime) {
            throw new Error(
                `Employee hours for day ${day.dayOfWeek} must fall within clinic open hours (clinic is closed)`
            );
        }

        if (
            !isRangeWithinWindow(
                day.startTime!,
                day.endTime!,
                clinicDay.openTime,
                clinicDay.closeTime
            )
        ) {
            throw new Error(
                `Employee hours for day ${day.dayOfWeek} must fall within clinic open hours`
            );
        }
    }

    await db.transaction(async (tx) => {
        await tx
            .delete(employeeWorkingHours)
            .where(eq(employeeWorkingHours.employeeId, employeeId));

        if (normalized.length === 0) {
            return;
        }

        await tx.insert(employeeWorkingHours).values(
            normalized.map((day) => ({
                employeeId,
                dayOfWeek: day.dayOfWeek,
                startTime: day.startTime,
                endTime: day.endTime,
                isOff: day.isOff,
            }))
        );
    });

    return getEmployeeWorkingHours(employeeId);
};

const getClinicDayForParts = async (
    clinicId: string,
    dayOfWeek: number
): Promise<ClinicDayHours | null> => {
    const [row] = await db
        .select()
        .from(clinicWorkingHours)
        .where(
            and(
                eq(clinicWorkingHours.clinicId, clinicId),
                eq(clinicWorkingHours.dayOfWeek, dayOfWeek)
            )
        );

    return row ? formatClinicDay(row) : null;
};

const getEmployeeDayForParts = async (
    employeeId: string,
    dayOfWeek: number
): Promise<EmployeeDayHours | null> => {
    const [row] = await db
        .select()
        .from(employeeWorkingHours)
        .where(
            and(
                eq(employeeWorkingHours.employeeId, employeeId),
                eq(employeeWorkingHours.dayOfWeek, dayOfWeek)
            )
        );

    return row ? formatEmployeeDay(row) : null;
};

export const assertAppointmentScheduleValid = async (input: {
    clinicId: string;
    employeeId?: string | null;
    scheduledAt: Date;
    durationMinutes?: number;
    excludeAppointmentId?: string;
}) => {
    const duration =
        input.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
    const parts = wallClockPartsInTz(input.scheduledAt, CLINIC_TIMEZONE);
    const endTime = addMinutesToHHmm(parts.time, duration);

    const clinicDay = await getClinicDayForParts(
        input.clinicId,
        parts.dayOfWeek
    );

    if (
        !clinicDay ||
        clinicDay.isClosed ||
        !clinicDay.openTime ||
        !clinicDay.closeTime
    ) {
        throw new Error("Selected time is outside clinic working hours");
    }

    if (
        !isRangeWithinWindow(
            parts.time,
            endTime,
            clinicDay.openTime,
            clinicDay.closeTime
        )
    ) {
        throw new Error("Selected time is outside clinic working hours");
    }

    if (!input.employeeId) {
        return;
    }

    const employeeDay = await getEmployeeDayForParts(
        input.employeeId,
        parts.dayOfWeek
    );

    if (
        !employeeDay ||
        employeeDay.isOff ||
        !employeeDay.startTime ||
        !employeeDay.endTime ||
        !isRangeWithinWindow(
            parts.time,
            endTime,
            employeeDay.startTime,
            employeeDay.endTime
        )
    ) {
        throw new Error("Doctor is not available at the selected time");
    }

    const appointmentEnd = new Date(
        input.scheduledAt.getTime() + duration * 60_000
    );

    const overlapFilters = [
        eq(appointments.employeeId, input.employeeId),
        notInArray(appointments.status, ["cancelled", "no_show"]),
        input.excludeAppointmentId
            ? ne(appointments.id, input.excludeAppointmentId)
            : undefined,
    ].filter((f): f is NonNullable<typeof f> => Boolean(f));

    const existing = await db
        .select({
            id: appointments.id,
            scheduledAt: appointments.scheduledAt,
            durationMinutes: appointments.durationMinutes,
            status: appointments.status,
        })
        .from(appointments)
        .where(and(...overlapFilters));

    for (const row of existing) {
        const otherEnd = new Date(
            row.scheduledAt.getTime() +
                (row.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES) *
                    60_000
        );
        if (
            rangesOverlap(
                input.scheduledAt,
                appointmentEnd,
                row.scheduledAt,
                otherEnd
            )
        ) {
            throw new Error("Doctor already has an overlapping appointment");
        }
    }
};

export const listAvailableDoctors = async (input: {
    clinicId: string;
    date: string;
    time: string;
    durationMinutes?: number;
}) => {
    const duration =
        input.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
    const time = assertHHmm(input.time, "time");
    const endTime = addMinutesToHHmm(time, duration);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new Error("date must be YYYY-MM-DD");
    }

    // Construct as Asia/Kolkata wall clock via ISO with offset +05:30
    const scheduledAt = new Date(`${input.date}T${time}:00+05:30`);
    if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error("Invalid date or time");
    }

    const parts = wallClockPartsInTz(scheduledAt, CLINIC_TIMEZONE);
    const clinicDay = await getClinicDayForParts(
        input.clinicId,
        parts.dayOfWeek
    );

    if (
        !clinicDay ||
        clinicDay.isClosed ||
        !clinicDay.openTime ||
        !clinicDay.closeTime ||
        !isRangeWithinWindow(
            time,
            endTime,
            clinicDay.openTime,
            clinicDay.closeTime
        )
    ) {
        return [];
    }

    const doctors = await db
        .selectDistinct({
            id: employees.id,
            name: employees.name,
            email: employees.email,
            designation: employees.designation,
        })
        .from(employees)
        .innerJoin(
            employeeRoleAssignments,
            eq(employeeRoleAssignments.employeeId, employees.id)
        )
        .innerJoin(
            employeeRoles,
            eq(employeeRoleAssignments.roleId, employeeRoles.id)
        )
        .where(
            and(
                eq(employees.clinicId, input.clinicId),
                eq(employeeRoles.name, ROLE_DOCTOR),
                eq(employees.isActive, true),
                eq(employees.isBlocked, false),
                eq(employees.isSuspended, false)
            )
        );

    if (doctors.length === 0) {
        return [];
    }

    const hoursMap = await getEmployeeWorkingHoursByEmployeeIds(
        doctors.map((d) => d.id)
    );

    const appointmentEnd = new Date(
        scheduledAt.getTime() + duration * 60_000
    );

    const busyRows = await db
        .select({
            employeeId: appointments.employeeId,
            scheduledAt: appointments.scheduledAt,
            durationMinutes: appointments.durationMinutes,
        })
        .from(appointments)
        .where(
            and(
                eq(appointments.clinicId, input.clinicId),
                inArray(
                    appointments.employeeId,
                    doctors.map((d) => d.id)
                ),
                notInArray(appointments.status, ["cancelled", "no_show"])
            )
        );

    const available = [];

    for (const doctor of doctors) {
        const dayHours = (hoursMap.get(doctor.id) ?? []).find(
            (d) => d.dayOfWeek === parts.dayOfWeek
        );

        if (
            !dayHours ||
            dayHours.isOff ||
            !dayHours.startTime ||
            !dayHours.endTime ||
            !isRangeWithinWindow(
                time,
                endTime,
                dayHours.startTime,
                dayHours.endTime
            )
        ) {
            continue;
        }

        const overlaps = busyRows.some((row) => {
            if (row.employeeId !== doctor.id) {
                return false;
            }
            const otherEnd = new Date(
                row.scheduledAt.getTime() +
                    (row.durationMinutes ??
                        DEFAULT_APPOINTMENT_DURATION_MINUTES) *
                        60_000
            );
            return rangesOverlap(
                scheduledAt,
                appointmentEnd,
                row.scheduledAt,
                otherEnd
            );
        });

        if (!overlaps) {
            available.push(doctor);
        }
    }

    return available;
};
