import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { clinics } from "../db/schema/clinic";
import { clinicWorkingHours } from "../db/schema/clinicWorkingHours";
import { employeeWorkingHours } from "../db/schema/employeeWorkingHours";
import { employees } from "../db/schema/employees";
import { parseLegacyTiming } from "../modules/scheduling/scheduling.utils";

const DEFAULT_OPEN = "10:00";
const DEFAULT_CLOSE = "21:00";

const defaultClinicDays = () =>
    Array.from({ length: 7 }, (_, dayOfWeek) => {
        if (dayOfWeek === 0) {
            return {
                dayOfWeek,
                isClosed: true,
                openTime: null as string | null,
                closeTime: null as string | null,
            };
        }
        return {
            dayOfWeek,
            isClosed: false,
            openTime: DEFAULT_OPEN,
            closeTime: DEFAULT_CLOSE,
        };
    });

const seedClinicHours = async () => {
    const allClinics = await db.select({ id: clinics.id }).from(clinics);
    let created = 0;
    let skipped = 0;

    for (const clinic of allClinics) {
        const existing = await db
            .select({ id: clinicWorkingHours.id })
            .from(clinicWorkingHours)
            .where(eq(clinicWorkingHours.clinicId, clinic.id));

        if (existing.length > 0) {
            skipped += 1;
            continue;
        }

        await db.insert(clinicWorkingHours).values(
            defaultClinicDays().map((day) => ({
                clinicId: clinic.id,
                dayOfWeek: day.dayOfWeek,
                openTime: day.openTime,
                closeTime: day.closeTime,
                isClosed: day.isClosed,
            }))
        );
        created += 1;
    }

    return { created, skipped };
};

const seedEmployeeHours = async () => {
    const allEmployees = await db
        .select({
            id: employees.id,
            timings: employees.timings,
        })
        .from(employees);

    let created = 0;
    let skipped = 0;
    let unparsed = 0;

    for (const employee of allEmployees) {
        const existing = await db
            .select({ id: employeeWorkingHours.id })
            .from(employeeWorkingHours)
            .where(eq(employeeWorkingHours.employeeId, employee.id));

        if (existing.length > 0) {
            skipped += 1;
            continue;
        }

        const parsed = employee.timings
            ? parseLegacyTiming(employee.timings)
            : null;

        const startTime = parsed?.start ?? DEFAULT_OPEN;
        const endTime = parsed?.end ?? DEFAULT_CLOSE;
        if (employee.timings && !parsed) {
            unparsed += 1;
            console.warn(
                `Could not parse timings "${employee.timings}" for ${employee.id}; using ${DEFAULT_OPEN}-${DEFAULT_CLOSE}`
            );
        }

        await db.insert(employeeWorkingHours).values(
            Array.from({ length: 7 }, (_, dayOfWeek) => {
                if (dayOfWeek === 0) {
                    return {
                        employeeId: employee.id,
                        dayOfWeek,
                        isOff: true,
                        startTime: null,
                        endTime: null,
                    };
                }
                return {
                    employeeId: employee.id,
                    dayOfWeek,
                    isOff: false,
                    startTime,
                    endTime,
                };
            })
        );
        created += 1;
    }

    return { created, skipped, unparsed };
};

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    const clinicsResult = await seedClinicHours();
    const employeesResult = await seedEmployeeHours();

    console.log(
        `Clinic hours: created=${clinicsResult.created}, skipped=${clinicsResult.skipped}`
    );
    console.log(
        `Employee hours: created=${employeesResult.created}, skipped=${employeesResult.skipped}, unparsed=${employeesResult.unparsed}`
    );
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
