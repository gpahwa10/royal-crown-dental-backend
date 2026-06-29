import { z } from "zod";

export const invoiceIdParamSchema = z.object({
    id: z.uuid(),
});

export const paymentIdParamSchema = z.object({
    id: z.uuid(),
});
