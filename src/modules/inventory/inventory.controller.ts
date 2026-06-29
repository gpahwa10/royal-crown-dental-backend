import { Request, Response } from "express";
import {
    bulkCreateInventoryItems,
    createCategory,
    createInventoryItem,
    createLocation,
    createVariant,
    deleteCategory,
    deleteInventoryItem,
    deleteLocation,
    deleteVariant,
    getCategoryById,
    getInventoryItemById,
    getItemHistory,
    getLocationById,
    listCategories,
    listInventoryItems,
    listInventoryItemsByClinic,
    listLocations,
    updateCategory,
    updateInventoryItem,
    updateLocation,
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
    getTransactionById,
    getWarehouseDashboard,
    getWarehouseStock,
    listStock,
    listTransactions,
    purchaseInventory,
    transferInventory,
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
    createLocationSchema,
    createVariantSchema,
    getInventoryItemQuerySchema,
    inventoryItemParamsSchema,
    itemHistoryQuerySchema,
    listInventoryItemsQuerySchema,
    listStockQuerySchema,
    listTransactionsQuerySchema,
    locationParamsSchema,
    purchaseInventorySchema,
    transactionParamsSchema,
    transferInventorySchema,
    updateCategorySchema,
    updateInventoryItemSchema,
    updateLocationSchema,
    updateVariantSchema,
    variantParamsSchema,
} from "./inventory.validation";

export const createInventoryItemHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const body = createInventoryItemSchema.parse(req.body);
        const item = await createInventoryItem(body);
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
    req: Request,
    res: Response
) => {
    try {
        const body = bulkCreateInventoryItemsSchema.parse(req.body);
        const items = await bulkCreateInventoryItems(body);
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
    req: Request,
    res: Response
) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const body = updateInventoryItemSchema.parse(req.body);
        const item = await updateInventoryItem(id, body);
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteInventoryItemHandler = async (
    req: Request,
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
    req: Request,
    res: Response
) => {
    try {
        const query = listInventoryItemsQuerySchema.parse(req.query);
        const result = await listInventoryItems(query);
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
    req: Request,
    res: Response
) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const query = listInventoryItemsQuerySchema.parse(req.query);
        const result = await listInventoryItemsByClinic(clinicId, query);
        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getInventoryItemHandler = async (req: Request, res: Response) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const query = getInventoryItemQuerySchema.parse(req.query);
        const item = await getInventoryItemById(id, {
            clinicId: query.clinicId,
        });
        return res.status(200).json({ success: true, data: item });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getItemHistoryHandler = async (req: Request, res: Response) => {
    try {
        const { id } = inventoryItemParamsSchema.parse(req.params);
        const query = itemHistoryQuerySchema.parse(req.query);
        const result = await getItemHistory(id, query);
        return res.status(200).json({
            success: true,
            data: result.items,
            pagination: result.pagination,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createVariantHandler = async (req: Request, res: Response) => {
    try {
        const body = createVariantSchema.parse(req.body);
        const variant = await createVariant(body);
        return res.status(201).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateVariantHandler = async (req: Request, res: Response) => {
    try {
        const { id } = variantParamsSchema.parse(req.params);
        const body = updateVariantSchema.parse(req.body);
        const variant = await updateVariant(id, body);
        return res.status(200).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteVariantHandler = async (req: Request, res: Response) => {
    try {
        const { id } = variantParamsSchema.parse(req.params);
        const variant = await deleteVariant(id);
        return res.status(200).json({ success: true, data: variant });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createCategoryHandler = async (req: Request, res: Response) => {
    try {
        const body = createCategorySchema.parse(req.body);
        const category = await createCategory(body);
        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listCategoriesHandler = async (req: Request, res: Response) => {
    try {
        const categories = await listCategories();
        return res.status(200).json({ success: true, data: categories });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getCategoryHandler = async (req: Request, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const category = await getCategoryById(id);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateCategoryHandler = async (req: Request, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const body = updateCategorySchema.parse(req.body);
        const category = await updateCategory(id, body);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteCategoryHandler = async (req: Request, res: Response) => {
    try {
        const { id } = categoryParamsSchema.parse(req.params);
        const category = await deleteCategory(id);
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createLocationHandler = async (req: Request, res: Response) => {
    try {
        const body = createLocationSchema.parse(req.body);
        const location = await createLocation(body);
        return res.status(201).json({ success: true, data: location });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listLocationsHandler = async (req: Request, res: Response) => {
    try {
        const locations = await listLocations();
        return res.status(200).json({ success: true, data: locations });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getLocationHandler = async (req: Request, res: Response) => {
    try {
        const { id } = locationParamsSchema.parse(req.params);
        const location = await getLocationById(id);
        return res.status(200).json({ success: true, data: location });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateLocationHandler = async (req: Request, res: Response) => {
    try {
        const { id } = locationParamsSchema.parse(req.params);
        const body = updateLocationSchema.parse(req.body);
        const location = await updateLocation(id, body);
        return res.status(200).json({ success: true, data: location });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteLocationHandler = async (req: Request, res: Response) => {
    try {
        const { id } = locationParamsSchema.parse(req.params);
        const location = await deleteLocation(id);
        return res.status(200).json({ success: true, data: location });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listStockHandler = async (req: Request, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await listStock(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getWarehouseStockHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await getWarehouseStock(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicStockHandler = async (req: Request, res: Response) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const query = listStockQuerySchema.parse(req.query);
        const result = await getClinicStock(clinicId, query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getLowStockHandler = async (req: Request, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await getLowStockItems(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getOutOfStockHandler = async (req: Request, res: Response) => {
    try {
        const query = listStockQuerySchema.parse(req.query);
        const result = await getOutOfStockItems(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getStockSummaryHandler = async (req: Request, res: Response) => {
    try {
        const summary = await getStockSummary();
        return res.status(200).json({ success: true, data: summary });
    } catch (error) {
        return handleError(res, error);
    }
};

export const purchaseInventoryHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const body = purchaseInventorySchema.parse(req.body);
        const result = await purchaseInventory(body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const transferInventoryHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const body = transferInventorySchema.parse(req.body);
        const result = await transferInventory(body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const consumeInventoryHandler = async (req: Request, res: Response) => {
    try {
        const body = consumeInventorySchema.parse(req.body);
        const result = await consumeInventory(body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const adjustInventoryHandler = async (req: Request, res: Response) => {
    try {
        const body = adjustInventorySchema.parse(req.body);
        const result = await adjustInventory(body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listTransactionsHandler = async (req: Request, res: Response) => {
    try {
        const query = listTransactionsQuerySchema.parse(req.query);
        const result = await listTransactions(query);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getTransactionHandler = async (req: Request, res: Response) => {
    try {
        const { id } = transactionParamsSchema.parse(req.params);
        const transaction = await getTransactionById(id);
        return res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getInventoryDashboardHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const dashboard = await getInventoryDashboard();
        return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicInventoryDashboardHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const { clinicId } = clinicParamsSchema.parse(req.params);
        const dashboard = await getClinicInventoryDashboard(clinicId);
        return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getWarehouseDashboardHandler = async (
    req: Request,
    res: Response
) => {
    try {
        const dashboard = await getWarehouseDashboard();
        return res.status(200).json({ success: true, data: dashboard });
    } catch (error) {
        return handleError(res, error);
    }
};
