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
    ROLE_RECEPTION,
    SALT_ROUNDS,
} from "../modules/auth/auth.constants";
import { seedClinics } from "./seed/seed-clinics";

export const DEV_CREDENTIALS = {
    superAdmin: {
        email: "luvayhamid@hotmail.com",
        password: "SuperAdmin@123",
        name: "Luvay Hamid",
        phone: "+254-738420070",
    },
    doctor: {
        email: "instaglaze52@gmail.com",
        password: "Doctor@123",
        name: "Doctor",
        phone: "+254-722901521",
    },
    receptionist: {
        email: "royalcrowndentalcare@hotmail.com",
        password: "Receptionist@123",
        name: "Receptionist",
        phone: "+254-412225429",
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
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [existing] = await db
        .select({ id: superAdmins.id })
        .from(superAdmins)
        .where(eq(superAdmins.email, email));

    if (existing) {
        await db
            .update(superAdmins)
            .set({
                name,
                password: hashedPassword,
                isActive: true,
                isBlocked: false,
                mustChangePassword: false,
                updatedAt: new Date(),
            })
            .where(eq(superAdmins.id, existing.id));
        console.log(`Updated super admin: ${email}`);
        return;
    }

    await db.insert(superAdmins).values({
        name,
        email,
        password: hashedPassword,
        mustChangePassword: false,
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

const seedEmployee = async ({
    clinicId,
    credentials,
    roleName,
    label,
}: {
    clinicId: string;
    credentials: (typeof DEV_CREDENTIALS)["superAdmin" | "doctor" | "receptionist"];
    roleName: string;
    label: string;
}) => {
    const { email, password, name, phone } = credentials;

    const [role] = await db
        .select({ id: employeeRoles.id })
        .from(employeeRoles)
        .where(eq(employeeRoles.name, roleName));

    if (!role) {
        throw new Error(`Employee role "${roleName}" was not seeded`);
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
                designation: roleName,
                timings: `${CLINIC_OPEN_TIME}-${CLINIC_CLOSE_TIME}`,
                isActive: true,
                isBlocked: false,
                isSuspended: false,
                mustChangePassword: false,
            })
            .returning({ id: employees.id });

        employeeId = created.id;
        console.log(`Created ${label}: ${email}`);
    } else {
        await db
            .update(employees)
            .set({
                clinicId,
                name,
                phone,
                designation: roleName,
                isActive: true,
                isBlocked: false,
                isSuspended: false,
                mustChangePassword: false,
            })
            .where(eq(employees.id, employeeId));
        console.log(`${label} already exists: ${email}`);
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
        `Seeded ${label} hours: ${CLINIC_OPEN_TIME}–${CLINIC_CLOSE_TIME} (all 7 days)`
    );
};

const seedSuperAdminDoctor = async (clinicId: string) =>
    seedEmployee({
        clinicId,
        credentials: DEV_CREDENTIALS.superAdmin,
        roleName: ROLE_DOCTOR,
        label: "super admin doctor",
    });

const seedDoctor = async (clinicId: string) =>
    seedEmployee({
        clinicId,
        credentials: DEV_CREDENTIALS.doctor,
        roleName: ROLE_DOCTOR,
        label: "doctor",
    });

const seedReceptionist = async (clinicId: string) =>
    seedEmployee({
        clinicId,
        credentials: DEV_CREDENTIALS.receptionist,
        roleName: ROLE_RECEPTION,
        label: "receptionist",
    });

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
    await seedSuperAdminDoctor(clinicId);
    await seedDoctor(clinicId);
    await seedReceptionist(clinicId);

    console.log("\n--- Dev credentials ---");
    console.log("Clinic: Royal Crown Dental Care");
    console.log(`Clinic ID (set CLINIC_ID in .env): ${clinicId}`);
    console.log(`Hours:   ${CLINIC_OPEN_TIME}–${CLINIC_CLOSE_TIME} every day`);
    console.log("\nSuper Admin (doctor + super_admins — platform access)");
    console.log(`  Email:    ${DEV_CREDENTIALS.superAdmin.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.superAdmin.password}`);
    console.log("\nDoctor (employees table — required for appointment slots)");
    console.log(`  Email:    ${DEV_CREDENTIALS.doctor.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.doctor.password}`);
    console.log("\nReceptionist (employees table — FDE role)");
    console.log(`  Email:    ${DEV_CREDENTIALS.receptionist.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.receptionist.password}`);
    console.log("\nLogin: POST /api/auth/login");
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
