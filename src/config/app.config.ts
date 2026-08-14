import { z } from "zod";

const clinicIdSchema = z.string().uuid();

export const parseClinicId = (value: string | undefined): string => {
    const trimmed = value?.trim();
    if (!trimmed) {
        throw new Error("CLINIC_ID is required");
    }

    const parsed = clinicIdSchema.safeParse(trimmed);
    if (!parsed.success) {
        throw new Error("CLINIC_ID must be a valid UUID");
    }

    return parsed.data;
};

export const getConfiguredClinicId = (): string =>
    parseClinicId(process.env.CLINIC_ID);

export const appConfig = {
    get clinicId() {
        return getConfiguredClinicId();
    },
};
