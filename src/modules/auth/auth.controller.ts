import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    createSuperAdmin,
    login,
    logout,
    registerHR,
    registerStaff,
} from "./auth.service";
import { hasPlatformAdminAccess } from "./auth.constants";
import {
    createSuperAdminSchema,
    loginSchema,
    registerHRSchema,
    registerStaffSchema,
} from "./auth.validation";

const getErrorMessage = (error: unknown) => {
    if (!(error instanceof Error)) {
        return "Something went wrong";
    }

    const cause = (error as Error & { cause?: Error }).cause;
    if (cause?.message) {
        return cause.message;
    }

    return error.message;
};

const handleError = (res: Response, error: unknown) => {
    const message = getErrorMessage(error);

    const status =
        message === "Invalid credentials" ||
        message.includes("not configured")
            ? 400
            : message.includes("already exists")
              ? 409
              : 400;

    return res.status(status).json({ success: false, message });
};

export const loginHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = loginSchema.parse(req.body);
        const result = await login(body.email, body.password);

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const registerStaffHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = registerStaffSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const result = await registerStaff({
            ...body,
            clinicId,
            phone: body.phone ?? "",
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const registerHRHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = registerHRSchema.parse(req.body);

        const result = await registerHR({
            ...body,
            phone: body.phone ?? "",
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createSuperAdminHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createSuperAdminSchema.parse(req.body);
        const result = await createSuperAdmin(body);

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const logoutHandler = async (_req: AuthRequest, res: Response) => {
    try {
        const result = await logout();

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};
