import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { assertFinancialWriteAccess } from "../billing/billing.utils";
import {
    createServiceCatalog,
    deleteServiceCatalog,
    getServiceCatalogById,
    listServiceCatalog,
    updateServiceCatalog,
} from "./serviceCatalog.service";
import {
    assertServiceCatalogClinicAccess,
    handleError,
} from "./serviceCatalog.utils";
import {
    createServiceCatalogSchema,
    serviceCatalogIdParamSchema,
    serviceCatalogListQuerySchema,
    updateServiceCatalogSchema,
} from "./serviceCatalog.validation";

const resolveClinicId = (
    req: AuthRequest,
    _requestedClinicId?: string
): string | undefined => {
    return req.clinicId;
};

export const createServiceCatalogHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const body = createServiceCatalogSchema.parse(req.body);

        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const service = await createServiceCatalog({
            ...body,
            clinicId,
        });

        return res.status(201).json({ success: true, data: service });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listServiceCatalogHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = serviceCatalogListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listServiceCatalog({
            page: query.page,
            limit: query.limit,
            clinicId,
            search: query.search,
            category: query.category,
            isActive: query.isActive,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getServiceCatalogHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = serviceCatalogIdParamSchema.parse(req.params);
        const service = await getServiceCatalogById(id);

        assertServiceCatalogClinicAccess(
            service.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        return res.status(200).json({ success: true, data: service });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateServiceCatalogHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = serviceCatalogIdParamSchema.parse(req.params);
        const body = updateServiceCatalogSchema.parse(req.body);

        const existing = await getServiceCatalogById(id);
        assertServiceCatalogClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const service = await updateServiceCatalog(id, body);
        return res.status(200).json({ success: true, data: service });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteServiceCatalogHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = serviceCatalogIdParamSchema.parse(req.params);

        const existing = await getServiceCatalogById(id);
        assertServiceCatalogClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const service = await deleteServiceCatalog(id);
        return res.status(200).json({ success: true, data: service });
    } catch (error) {
        return handleError(res, error);
    }
};
