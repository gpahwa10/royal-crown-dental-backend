import { z } from "zod";

export const patientIdParamSchema = z.object({
    patientId: z.uuid(),
});
