import { and, desc, eq, ilike, or, SQL } from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import {
    generateClinicCode,
    getNextLegacyClinicId,
} from "./clinics.utils";

export type ClinicRow = typeof clinics.$inferSelect;

export interface CreateClinicInput {
    clinicName: string;
    clinicCode?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    legacyClinicId?: number;
}

export interface UpdateClinicInput {
    clinicName?: string;
    clinicCode?: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    pincode?: string | null;
    isActive?: boolean;
}

export interface ListClinicsOptions {
    includeInactive?: boolean;
    search?: string;
}

const assertClinicCodeAvailable = async (
    clinicCode: string,
    excludeId?: string
) => {
    const [existing] = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.clinicCode, clinicCode));

    if (existing && existing.id !== excludeId) {
        throw new Error("A clinic with this clinic code already exists");
    }
};

const assertLegacyClinicIdAvailable = async (
    legacyClinicId: number,
    excludeId?: string
) => {
    const [existing] = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.legacyClinicId, legacyClinicId));

    if (existing && existing.id !== excludeId) {
        throw new Error("A clinic with this legacy clinic id already exists");
    }
};

export const getClinicRecord = async (id: string) => {
    const [clinic] = await db
        .select()
        .from(clinics)
        .where(eq(clinics.id, id));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    return clinic;
};

export const listClinics = async (options: ListClinicsOptions = {}) => {
    const filters: SQL[] = [];

    if (!options.includeInactive) {
        filters.push(eq(clinics.isActive, true));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(clinics.clinicName, term),
                ilike(clinics.clinicCode, term),
                ilike(clinics.city, term),
                ilike(clinics.phone, term),
                ilike(clinics.email, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    return db
        .select()
        .from(clinics)
        .where(whereClause)
        .orderBy(desc(clinics.createdAt));
};

export const getClinicById = async (id: string) => getClinicRecord(id);

export const createClinic = async (input: CreateClinicInput) => {
    const now = new Date();

    const clinic = await db.transaction(async (tx) => {
        const legacyClinicId =
            input.legacyClinicId ?? (await getNextLegacyClinicId(tx));

        await assertLegacyClinicIdAvailable(legacyClinicId);

        const clinicCode =
            input.clinicCode ??
            (await generateClinicCode(input.clinicName, legacyClinicId, tx));

        await assertClinicCodeAvailable(clinicCode);

        const [created] = await tx
            .insert(clinics)
            .values({
                legacyClinicId,
                clinicName: input.clinicName,
                clinicCode,
                email: input.email ?? null,
                phone: input.phone ?? null,
                address: input.address ?? null,
                city: input.city ?? null,
                state: input.state ?? null,
                country: input.country ?? null,
                pincode: input.pincode ?? null,
                isActive: true,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return created;
    });

    return clinic;
};

export const updateClinic = async (id: string, input: UpdateClinicInput) => {
    const clinic = await getClinicRecord(id);

    if (input.clinicCode && input.clinicCode !== clinic.clinicCode) {
        await assertClinicCodeAvailable(input.clinicCode, id);
    }

    const [updated] = await db
        .update(clinics)
        .set({
            clinicName: input.clinicName ?? clinic.clinicName,
            clinicCode: input.clinicCode ?? clinic.clinicCode,
            email:
                input.email !== undefined ? input.email : clinic.email,
            phone:
                input.phone !== undefined ? input.phone : clinic.phone,
            address:
                input.address !== undefined ? input.address : clinic.address,
            city: input.city !== undefined ? input.city : clinic.city,
            state: input.state !== undefined ? input.state : clinic.state,
            country:
                input.country !== undefined ? input.country : clinic.country,
            pincode:
                input.pincode !== undefined ? input.pincode : clinic.pincode,
            isActive:
                input.isActive !== undefined ? input.isActive : clinic.isActive,
            updatedAt: new Date(),
        })
        .where(eq(clinics.id, id))
        .returning();

    return updated;
};

export const deleteClinic = async (id: string) => {
    const clinic = await getClinicRecord(id);

    if (!clinic.isActive) {
        throw new Error("Clinic is already inactive");
    }

    const [updated] = await db
        .update(clinics)
        .set({
            isActive: false,
            updatedAt: new Date(),
        })
        .where(eq(clinics.id, id))
        .returning();

    return updated;
};
