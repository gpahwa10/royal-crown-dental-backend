import "dotenv/config";
import { db } from "../db/client";
import { sql } from "drizzle-orm";

const indexes = [
    // Consultations
    `CREATE INDEX IF NOT EXISTS "consultations_patient_id_idx" ON "consultations" ("patient_id");`,
    `CREATE INDEX IF NOT EXISTS "consultations_clinic_id_idx" ON "consultations" ("clinic_id");`,
    `CREATE INDEX IF NOT EXISTS "consultations_doctor_id_idx" ON "consultations" ("doctor_id");`,
    `CREATE INDEX IF NOT EXISTS "consultations_patient_created_at_idx" ON "consultations" ("patient_id", "created_at" DESC);`,

    // Prescriptions & Items
    `CREATE INDEX IF NOT EXISTS "prescriptions_patient_id_idx" ON "prescriptions" ("patient_id");`,
    `CREATE INDEX IF NOT EXISTS "prescription_items_prescription_id_idx" ON "prescription_items" ("prescription_id");`,

    // Appointments
    `CREATE INDEX IF NOT EXISTS "appointments_patient_id_idx" ON "appointments" ("patient_id");`,
    `CREATE INDEX IF NOT EXISTS "appointments_clinic_id_idx" ON "appointments" ("clinic_id");`,
    `CREATE INDEX IF NOT EXISTS "appointments_scheduled_at_idx" ON "appointments" ("scheduled_at" DESC);`,

    // Employee Role Assignments
    `CREATE INDEX IF NOT EXISTS "employee_role_assignments_employee_id_idx" ON "employee_role_assignments" ("employee_id");`,
];

const main = async () => {
    console.log("Applying performance indexes to PostgreSQL...");

    for (const queryStr of indexes) {
        try {
            await db.execute(sql.raw(queryStr));
            console.log("OK:", queryStr.trim());
        } catch (error) {
            console.error("FAILED:", queryStr, error);
            throw error;
        }
    }

    console.log("All performance indexes applied successfully.");
    process.exit(0);
};

main().catch((err) => {
    console.error("Index migration failed:", err);
    process.exit(1);
});
