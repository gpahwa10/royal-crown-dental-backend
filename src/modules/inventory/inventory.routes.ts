import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    adjustInventoryHandler,
    bulkCreateInventoryItemsHandler,
    consumeInventoryHandler,
    createCategoryHandler,
    createInventoryItemHandler,
    createLocationHandler,
    createVariantHandler,
    deleteCategoryHandler,
    deleteInventoryItemHandler,
    deleteLocationHandler,
    deleteVariantHandler,
    getCategoryHandler,
    getClinicInventoryDashboardHandler,
    getClinicStockHandler,
    getInventoryDashboardHandler,
    getInventoryItemHandler,
    getItemHistoryHandler,
    getLocationHandler,
    getLowStockHandler,
    getOutOfStockHandler,
    getStockSummaryHandler,
    getTransactionHandler,
    getWarehouseDashboardHandler,
    getWarehouseStockHandler,
    listCategoriesHandler,
    listInventoryItemsHandler,
    listClinicInventoryItemsHandler,
    listLocationsHandler,
    listStockHandler,
    listTransactionsHandler,
    purchaseInventoryHandler,
    transferInventoryHandler,
    updateCategoryHandler,
    updateInventoryItemHandler,
    updateLocationHandler,
    updateVariantHandler,
} from "./inventory.controller";

const router = Router();

router.use(authenticate);

router.post("/items", createInventoryItemHandler);
router.post("/items/bulk", bulkCreateInventoryItemsHandler);

// Paginated item GET APIs — query: ?page=1&limit=10 (&search, &categoryId, &clinicId, &clinicOnly, &isActive where supported)
router.get("/items/clinic/:clinicId", listClinicInventoryItemsHandler);
router.get("/items", listInventoryItemsHandler);
router.get("/items/:id/history", getItemHistoryHandler); // query: ?page=1&limit=20

router.get("/items/:id", getInventoryItemHandler);
router.put("/items/:id", updateInventoryItemHandler);
router.delete("/items/:id", deleteInventoryItemHandler);

router.post("/variants", createVariantHandler);
router.put("/variants/:id", updateVariantHandler);
router.delete("/variants/:id", deleteVariantHandler);

router.post("/categories", createCategoryHandler);
router.get("/categories", listCategoriesHandler);
router.get("/categories/:id", getCategoryHandler);
router.put("/categories/:id", updateCategoryHandler);
router.delete("/categories/:id", deleteCategoryHandler);

router.post("/locations", createLocationHandler);
router.get("/locations", listLocationsHandler);
router.get("/locations/:id", getLocationHandler);
router.put("/locations/:id", updateLocationHandler);
router.delete("/locations/:id", deleteLocationHandler);

router.get("/stock/summary", getStockSummaryHandler);
router.get("/stock/warehouse", getWarehouseStockHandler);
router.get("/stock/clinic/:clinicId", getClinicStockHandler);
router.get("/stock/low", getLowStockHandler);
router.get("/stock/out", getOutOfStockHandler);
router.get("/stock", listStockHandler);

router.post("/purchase", purchaseInventoryHandler);
router.post("/transfer", transferInventoryHandler);
router.post("/consume", consumeInventoryHandler);
router.post("/adjust", adjustInventoryHandler);

router.get("/transactions", listTransactionsHandler);
router.get("/transactions/:id", getTransactionHandler);

router.get("/dashboard/warehouse", getWarehouseDashboardHandler);
router.get("/dashboard/clinic/:clinicId", getClinicInventoryDashboardHandler);
router.get("/dashboard", getInventoryDashboardHandler);

export default router;
