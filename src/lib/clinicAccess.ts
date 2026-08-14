export const assertSameClinic = (
    resourceClinicId: string,
    configuredClinicId: string | undefined | null,
    message: string
) => {
    if (!configuredClinicId || resourceClinicId !== configuredClinicId) {
        throw new Error(message);
    }
};
