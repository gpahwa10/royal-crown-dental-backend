import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { eq } from "drizzle-orm";

export const listClinics =() => {
    return db.select().from(clinics).where(eq(clinics.isActive, true));
}