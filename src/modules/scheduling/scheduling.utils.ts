import { CLINIC_TIMEZONE } from "./scheduling.constants";

export const zonedYmd = (timeZone: string, reference = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(reference);

    return {
        year: Number(parts.find((p) => p.type === "year")?.value),
        month: Number(parts.find((p) => p.type === "month")?.value),
        day: Number(parts.find((p) => p.type === "day")?.value),
    };
};

export const startOfZonedDay = (
    timeZone: string = CLINIC_TIMEZONE,
    reference = new Date()
) => {
    const { year, month, day } = zonedYmd(timeZone, reference);
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
            timeZone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
            .formatToParts(utcNoon)
            .filter((p) => p.type !== "literal")
            .map((p) => [p.type, p.value])
    );

    const msFromMidnight =
        ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 +
            Number(parts.second)) *
        1000;

    return new Date(utcNoon.getTime() - msFromMidnight);
};

export const endOfZonedDay = (
    timeZone: string = CLINIC_TIMEZONE,
    reference = new Date()
) => {
    const start = startOfZonedDay(timeZone, reference);
    return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

/**
 * YYYY-MM-DD query params coerce to UTC midnight. Treat that Y-M-D as a
 * clinic-local calendar day (Asia/Kolkata), not a UTC instant.
 */
export const clinicCalendarDayStart = (date: Date) => {
    const calendarNoon = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            12,
            0,
            0
        )
    );
    return startOfZonedDay(CLINIC_TIMEZONE, calendarNoon);
};

export const clinicCalendarDayEnd = (date: Date) => {
    const calendarNoon = new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            12,
            0,
            0
        )
    );
    return endOfZonedDay(CLINIC_TIMEZONE, calendarNoon);
};

const HHMM_RE = /^\d{2}:\d{2}$/;

export const normalizeHHmm = (value: string | null | undefined): string | null => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
        return null;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59
    ) {
        return null;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

export const assertHHmm = (value: string, fieldName: string): string => {
    const normalized = normalizeHHmm(value);
    if (!normalized || !HHMM_RE.test(normalized)) {
        throw new Error(`${fieldName} must be HH:mm`);
    }
    return normalized;
};

export const timeToMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
};

export const addMinutesToHHmm = (hhmm: string, minutes: number): string => {
    const total = timeToMinutes(hhmm) + minutes;
    if (total < 0 || total > 24 * 60) {
        throw new Error("Time out of range");
    }
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** True when [start, end) is fully inside [windowStart, windowEnd]. */
export const isRangeWithinWindow = (
    startHHmm: string,
    endHHmm: string,
    windowStart: string,
    windowEnd: string
): boolean => {
    const start = timeToMinutes(startHHmm);
    const end = timeToMinutes(endHHmm);
    const open = timeToMinutes(windowStart);
    const close = timeToMinutes(windowEnd);
    return start >= open && end <= close && start < end;
};

export const rangesOverlap = (
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date
): boolean => aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();

export type WallClockParts = {
    date: string;
    time: string;
    dayOfWeek: number;
};

/** Wall-clock parts for an instant in the clinic timezone. */
export const wallClockPartsInTz = (
    instant: Date,
    timeZone: string = CLINIC_TIMEZONE
): WallClockParts => {
    const dateFmt = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const weekdayFmt = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
    });

    const date = dateFmt.format(instant);
    let time = timeFmt.format(instant);
    // en-GB can return "24:xx" for midnight in some engines — normalize
    if (time.startsWith("24:")) {
        time = `00:${time.slice(3)}`;
    }
    time = normalizeHHmm(time) ?? time;

    const weekday = weekdayFmt.format(instant);
    const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    const dayOfWeek = map[weekday];
    if (dayOfWeek === undefined) {
        throw new Error(`Unable to resolve weekday for ${instant.toISOString()}`);
    }

    return { date, time, dayOfWeek };
};

/**
 * Parse legacy sheet timings like "10-7", "12-9", "8-2", "2-9".
 */
export const parseLegacyTiming = (
    raw: string
): { start: string; end: string } | null => {
    const cleaned = raw.trim().replace(/\s+/g, "");
    const match = cleaned.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!match) {
        return null;
    }

    const startH = Number(match[1]);
    const endH = Number(match[2]);
    if (
        !Number.isFinite(startH) ||
        !Number.isFinite(endH) ||
        startH < 1 ||
        startH > 12 ||
        endH < 1 ||
        endH > 12
    ) {
        return null;
    }

    // Known CSV patterns (12h-style hour-only labels).
    const known: Record<string, { start: string; end: string }> = {
        "10-7": { start: "10:00", end: "19:00" },
        "12-9": { start: "12:00", end: "21:00" },
        "8-2": { start: "08:00", end: "14:00" },
        "2-9": { start: "14:00", end: "21:00" },
    };

    const key = `${startH}-${endH}`;
    if (known[key]) {
        return known[key];
    }

    const start24 = startH === 12 ? 12 : startH < 8 ? startH + 12 : startH;
    let end24 = endH === 12 ? 12 : endH <= 9 ? endH + 12 : endH;
    if (end24 <= start24) {
        end24 += 12;
    }
    if (end24 > 23) {
        return null;
    }

    return {
        start: `${String(start24).padStart(2, "0")}:00`,
        end: `${String(end24).padStart(2, "0")}:00`,
    };
};
