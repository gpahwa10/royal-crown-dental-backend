import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    cancelInvoiceHandler,
    createInvoiceHandler,
    createInvoicePaymentHandler,
    deleteInvoiceHandler,
    getInvoiceHandler,
    listInvoicesHandler,
    updateInvoiceHandler,
} from "./billing.controller";

const router = Router();

router.use(authenticate);

router.post("/", createInvoiceHandler);
router.get("/", listInvoicesHandler);
router.get("/:id", getInvoiceHandler);
router.patch("/:id", updateInvoiceHandler);
router.patch("/:id/cancel", cancelInvoiceHandler);
router.delete("/:id", deleteInvoiceHandler);
router.post("/:id/payments", createInvoicePaymentHandler);

export default router;
