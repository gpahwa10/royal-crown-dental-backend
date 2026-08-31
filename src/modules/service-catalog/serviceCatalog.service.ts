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
}

export interface UpdateServiceCatalogInput {
    serviceCode?: string;
    serviceName?: string;
    description?: string | null;
    category?: string | null;
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

export interface ServiceCatalogListResult {
    data: ServiceCatalogRow[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
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

    const updateValues: Partial<ServiceCatalogRow> = {};
    if (input.serviceCode !== undefined) updateValues.serviceCode = input.serviceCode;
    if (input.serviceName !== undefined) updateValues.serviceName = input.serviceName;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.category !== undefined) updateValues.category = input.category;
    if (input.isActive !== undefined) updateValues.isActive = input.isActive;
    updateValues.updatedAt = new Date();

    const [updated] = await db
        .update(serviceCatalog)
        .set(updateValues)
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
