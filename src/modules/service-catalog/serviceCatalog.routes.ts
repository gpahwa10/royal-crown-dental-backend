import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    createServiceCatalogHandler,
    deleteServiceCatalogHandler,
    getServiceCatalogHandler,
    listServiceCatalogHandler,
    updateServiceCatalogHandler,
} from "./serviceCatalog.controller";

const router = Router();

router.use(authenticate);

router.post("/", createServiceCatalogHandler);
router.get("/", listServiceCatalogHandler);
router.get("/:id", getServiceCatalogHandler);
router.patch("/:id", updateServiceCatalogHandler);
router.delete("/:id", deleteServiceCatalogHandler);

export default router;
