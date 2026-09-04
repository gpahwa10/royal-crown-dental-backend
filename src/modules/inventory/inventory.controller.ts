import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    bulkCreateInventoryItems,
    createCategory,
    createInventoryItem,
    createVariant,
    deleteCategory,
    deleteInventoryItem,
    deleteVariant,
    getCategoryById,
    getInventoryItemById,
    listCategories,
    listInventoryItems,
    listInventoryItemsByClinic,
    updateCategory,
    updateInventoryItem,
    updateVariant,
} from "./inventory.service";
import {
    adjustInventory,
    consumeInventory,
    getClinicInventoryDashboard,
    getClinicStock,
    getInventoryDashboard,
    getLowStockItems,
    getOutOfStockItems,
    getStockSummary,
    listStock,
    purchaseInventory,
} from "./inventory.stock.service";
import { handleError } from "./inventory.utils";
import {
    adjustInventorySchema,
    bulkCreateInventoryItemsSchema,
    categoryParamsSchema,
    clinicParamsSchema,
    consumeInventorySchema,
    createCategorySchema,
    createInventoryItemSchema,
    createVariantSchema,
    getInventoryItemQuerySchema,
    inventoryItemParamsSchema,
    listInventoryItemsQuerySchema,
    listStockQuerySchema,
    purchaseInventorySchema,
    updateCategorySchema,
    updateInventoryItemSchema,
    updateVariantSchema,
    variantParamsSchema,
} from "./inventory.validation";

const requireDeploymentClinic = (req: AuthRequest, clinicId?: string) => {
    if (clinicId && clinicId !== req.clinicId) {
        throw new Error("You cannot access another clinic");
    }
    if (!req.clinicId) {
        throw new Error("clinicId is required");
    }
    return req.clinicId;
};

export const createInventoryItemHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createInventoryItemSchema.parse(req.body);
        const item = await createInventoryItem({
            ...body,
            clinicId: requireDeploymentClinic(req, body.clinicId),
        });
        return res.status(201).json({
            success: true,
            data: {
                id: item.id,
                name: item.name,
                clinicId: item.clinicId,
                currentStock: 0,
                reservedStock: 0,
                isLowStock: item.minimumStockLevel > 0,
            },
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const bulkCreateInventoryItemsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = bulkCreateInventoryItemsSchema.parse(req.body);
        const clinicId = requireDeploymentClinic(req);
        const items = await bulkCreateInventoryItems(
            body.map((item) => ({
                ...item,
                clinicId: requireDeploymentClinic(req, item.clinicId) ?? clinicId,
            }))
        );
        return res.status(201).json({
            success: true,
            data: items.map((item) => ({
                id: item.id,
                name: item.name,
                clinicId: item.clinicId,
                currentStock: 0,
                reservedStock: 0,
                isLowStock: item.minimumStockLevel > 0,
            })),
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateInventoryItemHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const body = updateInventoryItemSchema.parse(req.body);
        if (body.clinicId) {
            requireDeploymentClinic(req, body.clinicId);
        }
        const item = await updateInventoryItem(id, body);
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteInventoryItemHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const item = await deleteInventoryItem(id);
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listInventoryItemsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = listInventoryItemsQuerySchema.parse(req.query);
        const result = await listInventoryItems({
            ...query,
            clinicId: requireDeploymentClinic(req, query.clinicId),
        });
        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listClinicInventoryItemsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const scopedClinicId = requireDeploymentClinic(req, clinicId);
        const query = listInventoryItemsQuerySchema.parse(req.query);
        const result = await listInventoryItemsByClinic(scopedClinicId, query);
        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getInventoryItemHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const query = getInventoryItemQuerySchema.parse(req.query);
        const item = await getInventoryItemById(id, {
            clinicId: requireDeploymentClinic(req, query.clinicId),
        });
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createVariantHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = createVariantSchema.parse(req.body);
        const variant = await createVariant(body);
        return res.status(201).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateVariantHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = variantParamsSchema.parse(req.params);
        const body = updateVariantSchema.parse(req.body);
        const variant = await updateVariant(id, body);
        return res.status(200).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteVariantHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = variantParamsSchema.parse(req.params);
        const variant = await deleteVariant(id);
        return res.status(200).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createCategoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = createCategorySchema.parse(req.body);
        const category = await createCategory(body);
        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listCategoriesHandler = async (req: AuthRequest, res: Response) => {
    try {
        const categories = await listCategories();
        return res.status(200).json({ success: true, data: categories });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getCategoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const category = await getCategoryById(id);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateCategoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const body = updateCategorySchema.parse(req.body);
        const category = await updateCategory(id, body);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteCategoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const category = await deleteCategory(id);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listStockHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await listStock({
            ...query,
            clinicId: requireDeploymentClinic(req, query.clinicId),
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicStockHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const query = listStockQuerySchema.parse(req.query);
        const result = await getClinicStock(
            requireDeploymentClinic(req, clinicId),
            query
        );
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getLowStockHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await getLowStockItems({
            ...query,
            clinicId: requireDeploymentClinic(req, query.clinicId),
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getOutOfStockHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await getOutOfStockItems({
            ...query,
            clinicId: requireDeploymentClinic(req, query.clinicId),
        });
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getStockSummaryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const summary = await getStockSummary(requireDeploymentClinic(req));
        return res.status(200).json({ success: true, data: summary });
    } catch (error) {
        return handleError(res, error);
    }
};

export const purchaseInventoryHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = purchaseInventorySchema.parse(req.body);
        const result = await purchaseInventory({
            ...body,
            clinicId: requireDeploymentClinic(req),
        });
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const consumeInventoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = consumeInventorySchema.parse(req.body);
        const result = await consumeInventory({
            ...body,
            clinicId: requireDeploymentClinic(req),
        });
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const adjustInventoryHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = adjustInventorySchema.parse(req.body);
        const result = await adjustInventory({
            ...body,
            clinicId: requireDeploymentClinic(req),
        });
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getInventoryDashboardHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const dashboard = await getInventoryDashboard(
            requireDeploymentClinic(req)
        );
        return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicInventoryDashboardHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const dashboard = await getClinicInventoryDashboard(
            requireDeploymentClinic(req, clinicId)
        );
        return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
        return handleError(res, error);
    }
};
