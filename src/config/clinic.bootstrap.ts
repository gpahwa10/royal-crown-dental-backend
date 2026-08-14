import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { clinics } from "../db/schema/clinic";
import { appConfig } from "./app.config";

export const assertConfiguredClinicExists = async () => {
    const clinicId = appConfig.clinicId;

    const [clinic] = await db
        .select({ id: clinics.id, isActive: clinics.isActive })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error(
            `CLINIC_ID ${clinicId} does not match any clinic in the database`
        );
    }

    if (!clinic.isActive) {
        throw new Error(`Configured clinic ${clinicId} is inactive`);
    }
};
