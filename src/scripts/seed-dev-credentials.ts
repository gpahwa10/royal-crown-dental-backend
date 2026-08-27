import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { clinicWorkingHours } from "../db/schema/clinicWorkingHours";
import { employeeRoleAssignments } from "../db/schema/employeeRoleAssignments";
import { employeeWorkingHours } from "../db/schema/employeeWorkingHours";
import { employees } from "../db/schema/employees";
import { employeeRoles } from "../db/schema/roles";
import { superAdmins } from "../db/schema/superAdmins";
import {
    EMPLOYEE_ROLES,
    ROLE_DOCTOR,
    SALT_ROUNDS,
} from "../modules/auth/auth.constants";
import { seedClinics } from "./seed/seed-clinics";

export const DEV_CREDENTIALS = {
    superAdmin: {
        email: "superadmin@royalcrown.com",
        password: "SuperAdmin@123",
        name: "Super Admin",
    },
    doctor: {
        email: "doctor@royalcrown.com",
        password: "Doctor@123",
        name: "Clinic Doctor",
        phone: "9000000001",
    },
} as const;

const CLINIC_OPEN_TIME = "10:00";
const CLINIC_CLOSE_TIME = "20:00";

const EMPLOYEE_ROLE_NAMES = [...EMPLOYEE_ROLES, "Super Admin"] as const;

const seedEmployeeRoles = async () => {
    for (const name of EMPLOYEE_ROLE_NAMES) {
        await db
            .insert(employeeRoles)
            .values({ name })
            .onConflictDoNothing({ target: employeeRoles.name });
    }
};

const seedSuperAdmin = async () => {
    const { email, password, name } = DEV_CREDENTIALS.superAdmin;

    const [existing] = await db
        .select({ id: superAdmins.id })
        .from(superAdmins)
        .where(eq(superAdmins.email, email));

    if (existing) {
        console.log(`Super admin already exists: ${email}`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await db.insert(superAdmins).values({
        name,
        email,
        password: hashedPassword,
    });

    console.log(`Created super admin: ${email}`);
};

const seedClinicHours = async (clinicId: string) => {
    await db
        .delete(clinicWorkingHours)
        .where(eq(clinicWorkingHours.clinicId, clinicId));

    await db.insert(clinicWorkingHours).values(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
            clinicId,
            dayOfWeek,
            isClosed: false,
            openTime: CLINIC_OPEN_TIME,
            closeTime: CLINIC_CLOSE_TIME,
        }))
    );

    console.log(
        `Seeded clinic hours: ${CLINIC_OPEN_TIME}–${CLINIC_CLOSE_TIME} (all 7 days)`
    );
};

const seedDoctor = async (clinicId: string) => {
    const { email, password, name, phone } = DEV_CREDENTIALS.doctor;

    const [role] = await db
        .select({ id: employeeRoles.id })
        .from(employeeRoles)
        .where(eq(employeeRoles.name, ROLE_DOCTOR));

    if (!role) {
        throw new Error(`Employee role "${ROLE_DOCTOR}" was not seeded`);
    }

    const [existing] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.email, email));

    let employeeId = existing?.id;

    if (!employeeId) {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const [created] = await db
            .insert(employees)
            .values({
                clinicId,
                name,
                email,
                password: hashedPassword,
                phone,
                designation: ROLE_DOCTOR,
                timings: `${CLINIC_OPEN_TIME}-${CLINIC_CLOSE_TIME}`,
                isActive: true,
                isBlocked: false,
                isSuspended: false,
                mustChangePassword: false,
            })
            .returning({ id: employees.id });

        employeeId = created.id;
        console.log(`Created doctor: ${email}`);
    } else {
        await db
            .update(employees)
            .set({
                clinicId,
                isActive: true,
                isBlocked: false,
                isSuspended: false,
            })
            .where(eq(employees.id, employeeId));
        console.log(`Doctor already exists: ${email}`);
    }

    await db
        .insert(employeeRoleAssignments)
        .values({ employeeId, roleId: role.id })
        .onConflictDoNothing();

    await db
        .delete(employeeWorkingHours)
        .where(eq(employeeWorkingHours.employeeId, employeeId));

    await db.insert(employeeWorkingHours).values(
        Array.from({ length: 7 }, (_, dayOfWeek) => ({
            employeeId,
            dayOfWeek,
            isOff: false,
            startTime: CLINIC_OPEN_TIME,
            endTime: CLINIC_CLOSE_TIME,
        }))
    );

    console.log(
        `Seeded doctor hours: ${CLINIC_OPEN_TIME}–${CLINIC_CLOSE_TIME} (all 7 days)`
    );
};

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    await seedEmployeeRoles();
    const clinicMap = await seedClinics([
        {
            legacyClinicId: 1,
            clinicName: "Royal Crown Dental Care",
            clinicCode: "CLINIC-001-ROYAL-CROWN-DENTAL-CLINIC",
            email: "superadmin@royalcrown.com",
            phone: null,
            address: null,
            pincode: null,
            city: null,
            state: null,
            country: "India",
            isActive: true,
        },
    ]);

    const clinicId = clinicMap.get(1);
    if (!clinicId) {
        throw new Error("Royal Crown clinic was not seeded");
    }

    await seedClinicHours(clinicId);
    await seedSuperAdmin();
    await seedDoctor(clinicId);

    console.log("\n--- Dev credentials ---");
    console.log("Clinic: Royal Crown Dental Care");
    console.log(`Clinic ID (set CLINIC_ID in .env): ${clinicId}`);
    console.log(`Hours:   ${CLINIC_OPEN_TIME}–${CLINIC_CLOSE_TIME} every day`);
    console.log("\nSuper Admin (super_admins table)");
    console.log(`  Email:    ${DEV_CREDENTIALS.superAdmin.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.superAdmin.password}`);
    console.log("\nDoctor (employees table — required for appointment slots)");
    console.log(`  Email:    ${DEV_CREDENTIALS.doctor.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.doctor.password}`);
    console.log("\nLogin: POST /api/auth/login");
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
