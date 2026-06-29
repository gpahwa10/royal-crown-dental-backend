import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    getPaymentHandler,
    listInvoicePaymentsHandler,
} from "./payments.controller";

const router = Router();

router.use(authenticate);

router.get("/:id", getPaymentHandler);

const invoicePaymentsRouter = Router();
invoicePaymentsRouter.use(authenticate);
invoicePaymentsRouter.get("/:id/payments", listInvoicePaymentsHandler);

export default router;
export { invoicePaymentsRouter };
