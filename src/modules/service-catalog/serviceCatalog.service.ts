import {
    and,
    count,
    desc,
    eq,
    ilike,
    or,
    SQL,
} from "drizzle-orm";
import { db } from "../../db/client";
import { clinics } from "../../db/schema/clinic";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import { generateServiceCode } from "./serviceCatalog.utils";

export interface CreateServiceCatalogInput {
    clinicId: string;
    serviceCode?: string;
    serviceName: string;
    description?: string;
    category?: string;
    defaultPrice?: number;
    taxPercentage?: number;
    isTaxable?: boolean;
}

export interface UpdateServiceCatalogInput {
    serviceCode?: string;
    serviceName?: string;
    description?: string | null;
    category?: string | null;
    defaultPrice?: number;
    taxPercentage?: number;
    isTaxable?: boolean;
    isActive?: boolean;
}

export interface ListServiceCatalogOptions {
    page?: number;
    limit?: number;
    clinicId?: string;
    search?: string;
    category?: string;
    isActive?: boolean;
}

export type ServiceCatalogRow = typeof serviceCatalog.$inferSelect;

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, isActive: clinics.isActive })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    if (!clinic.isActive) {
        throw new Error("Clinic is not active");
    }
};

export const getServiceCatalogRecord = async (id: string) => {
    const [service] = await db
        .select()
        .from(serviceCatalog)
        .where(eq(serviceCatalog.id, id));

    if (!service) {
        throw new Error("Service not found");
    }

    return service;
};

export const createServiceCatalog = async (input: CreateServiceCatalogInput) => {
    await assertClinicExists(input.clinicId);

    const now = new Date();

    return db.transaction(async (tx) => {
        const serviceCode =
            input.serviceCode ??
            (await generateServiceCode(input.clinicId, tx));

        const [service] = await tx
            .insert(serviceCatalog)
            .values({
                serviceCode,
                serviceName: input.serviceName,
                description: input.description,
                category: input.category,
                defaultPrice: input.defaultPrice ?? 0,
                taxPercentage: input.taxPercentage ?? 0,
                isTaxable: input.isTaxable ?? false,
                clinicId: input.clinicId,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        return service;
    });
};

export const listServiceCatalog = async (
    options: ListServiceCatalogOptions = {}
) => {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const filters: SQL[] = [];

    if (options.clinicId) {
        filters.push(eq(serviceCatalog.clinicId, options.clinicId));
    }

    if (options.category) {
        filters.push(eq(serviceCatalog.category, options.category));
    }

    if (options.isActive !== undefined) {
        filters.push(eq(serviceCatalog.isActive, options.isActive));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(serviceCatalog.serviceCode, term),
                ilike(serviceCatalog.serviceName, term),
                ilike(serviceCatalog.category, term),
                ilike(serviceCatalog.description, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(serviceCatalog)
        .where(whereClause);

    const items = await db
        .select()
        .from(serviceCatalog)
        .where(whereClause)
        .orderBy(desc(serviceCatalog.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        items,
        total: totalRow?.total ?? 0,
        page,
        limit,
    };
};

export const getServiceCatalogById = async (id: string) => {
    return getServiceCatalogRecord(id);
};

export const updateServiceCatalog = async (
    id: string,
    input: UpdateServiceCatalogInput
) => {
    await getServiceCatalogRecord(id);

    const [updated] = await db
        .update(serviceCatalog)
        .set({
            ...input,
            updatedAt: new Date(),
        })
        .where(eq(serviceCatalog.id, id))
        .returning();

    return updated;
};

export const deleteServiceCatalog = async (id: string) => {
    await getServiceCatalogRecord(id);

    const [updated] = await db
        .update(serviceCatalog)
        .set({
            isActive: false,
            updatedAt: new Date(),
        })
        .where(eq(serviceCatalog.id, id))
        .returning();

    return updated;
};
