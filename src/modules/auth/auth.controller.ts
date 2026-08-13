import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { changePassword, createSuperAdmin, login, logout } from "./auth.service";
import { requestPasswordReset } from "../employees/passwordReset.service";
import { handleError } from "./auth.utils";
import {
    changePasswordSchema,
    createSuperAdminSchema,
    forgotPasswordSchema,
    loginSchema,
} from "./auth.validation";

export const loginHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = loginSchema.parse(req.body);
        const result = await login(body.email, body.password);

        return res.status(200).json({ success: true, data: result });
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

export const forgotPasswordHandler = async (req: AuthRequest, res: Response) => {
    try {
        const body = forgotPasswordSchema.parse(req.body);
        const result = await requestPasswordReset(body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const changePasswordHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.employee?.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access",
            });
        }

        const body = changePasswordSchema.parse(req.body);
        const result = await changePassword({
            userId: req.employee.id,
            isSuperAdmin: Boolean(req.employee.isSuperAdmin),
            currentPassword: body.currentPassword,
            newPassword: body.newPassword,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};
