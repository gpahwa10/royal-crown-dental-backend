import { z } from "zod";

export const radiographIdParamSchema = z.object({
    id: z.uuid(),
});

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});
