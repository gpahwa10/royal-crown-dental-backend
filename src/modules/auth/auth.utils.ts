import { Response } from "express";

export const getErrorMessage = (error: unknown) => {
    if (!(error instanceof Error)) {
        return "Something went wrong";
    }

    const cause = (error as Error & { cause?: Error }).cause;
    if (cause?.message) {
        return cause.message;
    }

    return error.message;
};

export const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status =
        message === "Invalid credentials" ||
        message === "Current password is incorrect" ||
        message.includes("not configured")
            ? 400
            : message === "You cannot access another clinic"
              ? 403
            : message === "User not found"
              ? 404
              : message.includes("already exists")
                ? 409
                : 400;

    return res.status(status).json({ success: false, message });
};
