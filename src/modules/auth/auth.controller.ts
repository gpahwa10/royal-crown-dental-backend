import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { createSuperAdmin, login, logout } from "./auth.service";
import { handleError } from "./auth.utils";
import { createSuperAdminSchema, loginSchema } from "./auth.validation";

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
