import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { employeeRoleAssignments } from "../db/schema/employeeRoleAssignments";
import { employees } from "../db/schema/employees";
import { employeeRoles } from "../db/schema/roles";
import { superAdmins } from "../db/schema/superAdmins";
import { ROLE_DIRECTOR, SALT_ROUNDS } from "../modules/auth/auth.constants";
import { seedClinics } from "./seed/seed-clinics";

export const DEV_CREDENTIALS = {
    superAdmin: {
        email: "superadmin@dental.local",
        password: "SuperAdmin@123",
        firstName: "Super",
        lastName: "Admin",
    },
    director: {
        email: "director@dental.local",
        password: "Director@123",
        name: "Platform Director",
        phone: "9000000001",
        designation: "Director",
        clinicLegacyId: 1,
    },
} as const;

const EMPLOYEE_ROLE_NAMES = [
    "Doctor",
    "Assistant",
    "HR Head",
    "HR Assistant",
    "Lab Technician",
    "Phlebotomist",
    "Reception",
    "Super Admin",
    "Director",
] as const;

const seedEmployeeRoles = async () => {
    for (const name of EMPLOYEE_ROLE_NAMES) {
        await db
            .insert(employeeRoles)
            .values({ name })
            .onConflictDoNothing({ target: employeeRoles.name });
    }
};

const getRoleId = async (name: string) => {
    const [role] = await db
        .select()
        .from(employeeRoles)
        .where(eq(employeeRoles.name, name));

    if (!role) {
        throw new Error(`Role "${name}" not found. Run employee_roles seed first.`);
    }

    return role.id;
};

const seedSuperAdmin = async () => {
    const { email, password, firstName, lastName } =
        DEV_CREDENTIALS.superAdmin;

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
        firstName,
        lastName,
        email,
        password: hashedPassword,
    });

    console.log(`Created super admin: ${email}`);
};

const seedDirector = async (clinicMap: Map<number, string>) => {
    const { email, password, name, phone, designation, clinicLegacyId } =
        DEV_CREDENTIALS.director;

    const [existing] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.email, email));

    if (existing) {
        console.log(`Director already exists: ${email}`);
        return;
    }

    const clinicId = clinicMap.get(clinicLegacyId);
    if (!clinicId) {
        throw new Error(
            `Clinic legacy id ${clinicLegacyId} not found. Run seed:clinics first.`
        );
    }

    const roleId = await getRoleId(ROLE_DIRECTOR);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [employee] = await db
        .insert(employees)
        .values({
            clinicId,
            name,
            email,
            password: hashedPassword,
            phone,
            designation,
        })
        .returning();

    await db.insert(employeeRoleAssignments).values({
        employeeId: employee.id,
        roleId,
    });

    console.log(`Created director: ${email} (clinic legacy #${clinicLegacyId})`);
};

const main = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set");
    }

    await seedEmployeeRoles();
    const clinicMap = await seedClinics();
    await seedSuperAdmin();
    await seedDirector(clinicMap);

    console.log("\n--- Dev credentials ---");
    console.log("Super Admin (super_admins table)");
    console.log(`  Email:    ${DEV_CREDENTIALS.superAdmin.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.superAdmin.password}`);
    console.log("\nDirector (employees + Director role)");
    console.log(`  Email:    ${DEV_CREDENTIALS.director.email}`);
    console.log(`  Password: ${DEV_CREDENTIALS.director.password}`);
    console.log(`  Clinic:   legacy id ${DEV_CREDENTIALS.director.clinicLegacyId}`);
    console.log("\nLogin: POST /api/auth/login");
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
