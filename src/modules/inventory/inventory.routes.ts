import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    requireInventoryManageAccess,
    requireInventoryViewAccess,
} from "../../middleware/inventory.middleware";
import {
    adjustInventoryHandler,
    bulkCreateInventoryItemsHandler,
    consumeInventoryHandler,
    createCategoryHandler,
    createInventoryItemHandler,
    createVariantHandler,
    deleteCategoryHandler,
    deleteInventoryItemHandler,
    deleteVariantHandler,
    getCategoryHandler,
    getClinicInventoryDashboardHandler,
    getClinicStockHandler,
    getInventoryDashboardHandler,
    getInventoryItemHandler,
    getLowStockHandler,
    getOutOfStockHandler,
    getStockSummaryHandler,
    listCategoriesHandler,
    listInventoryItemsHandler,
    listClinicInventoryItemsHandler,
    listStockHandler,
    purchaseInventoryHandler,
    updateCategoryHandler,
    updateInventoryItemHandler,
    updateVariantHandler,
} from "./inventory.controller";

const router = Router();

router.use(authenticate);
router.use(requireInventoryViewAccess);

router.post("/items", requireInventoryManageAccess, createInventoryItemHandler);
router.post(
    "/items/bulk",
    requireInventoryManageAccess,
    bulkCreateInventoryItemsHandler
);

router.get("/items/clinic/:clinicId", listClinicInventoryItemsHandler);
router.get("/items", listInventoryItemsHandler);
router.get("/items/:id", getInventoryItemHandler);
router.put(
    "/items/:id",
    requireInventoryManageAccess,
    updateInventoryItemHandler
);
router.delete(
    "/items/:id",
    requireInventoryManageAccess,
    deleteInventoryItemHandler
);

router.post("/variants", requireInventoryManageAccess, createVariantHandler);
router.put(
    "/variants/:id",
    requireInventoryManageAccess,
    updateVariantHandler
);
router.delete(
    "/variants/:id",
    requireInventoryManageAccess,
    deleteVariantHandler
);

router.post(
    "/categories",
    requireInventoryManageAccess,
    createCategoryHandler
);
router.get("/categories", listCategoriesHandler);
router.get("/categories/:id", getCategoryHandler);
router.put(
    "/categories/:id",
    requireInventoryManageAccess,
    updateCategoryHandler
);
router.delete(
    "/categories/:id",
    requireInventoryManageAccess,
    deleteCategoryHandler
);

router.get("/stock/summary", getStockSummaryHandler);
router.get("/stock/clinic/:clinicId", getClinicStockHandler);
router.get("/stock/low", getLowStockHandler);
router.get("/stock/out", getOutOfStockHandler);
router.get("/stock", listStockHandler);

router.post(
    "/purchase",
    requireInventoryManageAccess,
    purchaseInventoryHandler
);
router.post(
    "/consume",
    requireInventoryManageAccess,
    consumeInventoryHandler
);
router.post("/adjust", requireInventoryManageAccess, adjustInventoryHandler);

router.get("/dashboard/clinic/:clinicId", getClinicInventoryDashboardHandler);
router.get("/dashboard", getInventoryDashboardHandler);

export default router;
