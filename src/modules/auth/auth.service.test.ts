import "dotenv/config";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { employeeRoleAssignments } from "../../db/schema/employeeRoleAssignments";
import { employees } from "../../db/schema/employees";
import { employeeRoles } from "../../db/schema/roles";
import { superAdmins } from "../../db/schema/superAdmins";
import { ROLE_DOCTOR, SALT_ROUNDS } from "./auth.constants";
import { login } from "./auth.service";

describe("login for a doctor who is also super admin", () => {
    const unique = Date.now().toString();
    const email = `doctor-super-admin-${unique}@example.com`;
    const password = "SuperAdmin@123";
    const previousClinicId = process.env.CLINIC_ID;

    let clinicId: string;
    let employeeId: string;
    let roleId: string;

    beforeAll(async () => {
        const [clinic] = await db
            .insert(clinics)
            .values({
                clinicName: `Auth Dual Role Clinic ${unique}`,
                clinicCode: `AUTHDUAL${unique}`.slice(0, 50),
                isActive: true,
            })
            .returning();
        clinicId = clinic.id;
        process.env.CLINIC_ID = clinicId;

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [existingRole] = await db
            .select({ id: employeeRoles.id })
            .from(employeeRoles)
            .where(eq(employeeRoles.name, ROLE_DOCTOR));

        if (existingRole) {
            roleId = existingRole.id;
        } else {
            const [role] = await db
                .insert(employeeRoles)
                .values({ name: ROLE_DOCTOR })
                .returning({ id: employeeRoles.id });
            roleId = role.id;
        }

        const [employee] = await db
            .insert(employees)
            .values({
                clinicId,
                name: "Luvay Hamid",
                email,
                password: hashedPassword,
                phone: "+254-738420070",
                designation: ROLE_DOCTOR,
                isActive: true,
                isBlocked: false,
                isSuspended: false,
                mustChangePassword: false,
            })
            .returning({ id: employees.id });
        employeeId = employee.id;

        await db.insert(employeeRoleAssignments).values({
            employeeId,
            roleId,
        });

        await db.insert(superAdmins).values({
            name: "Luvay Hamid",
            email,
            password: hashedPassword,
            mustChangePassword: false,
        });
    });

    afterAll(async () => {
        process.env.CLINIC_ID = previousClinicId;
        await db.delete(superAdmins).where(eq(superAdmins.email, email));
        await db
            .delete(employeeRoleAssignments)
            .where(eq(employeeRoleAssignments.employeeId, employeeId));
        await db.delete(employees).where(eq(employees.id, employeeId));
        await db.delete(clinics).where(eq(clinics.id, clinicId));
    });

    it("returns doctor roles and super admin access for the same account", async () => {
        const result = await login(email, password);

        expect(result.isSuperAdmin).toBe(true);
        expect(result.hasPlatformAdminAccess).toBe(true);
        expect(result.roles).toContain(ROLE_DOCTOR);
        expect(result.user.id).toBe(employeeId);
    });
});
