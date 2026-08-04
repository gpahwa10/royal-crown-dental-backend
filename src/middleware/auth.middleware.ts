import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { requireSuperAdmin } from "./superAdmin.middleware";
import { hasSuperAdmins } from "../modules/auth/auth.service";

export interface AuthRequest extends Request {
    employee?: {
        id: string;
        clinicId: string;
        roles: string[];
        isSuperAdmin: boolean;
        mustChangePassword?: boolean;
    };
}

const isPasswordChangeAllowedPath = (originalUrl: string) => {
    const path = originalUrl.split("?")[0];
    return (
        path.endsWith("/auth/change-password") ||
        path.endsWith("/auth/logout")
    );
};

export const authenticate = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token missing",
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Invalid token format",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as AuthRequest["employee"];

        req.employee = decoded;

        if (
            decoded?.mustChangePassword &&
            !isPasswordChangeAllowedPath(req.originalUrl)
        ) {
            return res.status(403).json({
                success: false,
                code: "MUST_CHANGE_PASSWORD",
                message:
                    "Password change required before accessing the application",
            });
        }

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized access",
        });
    }
};

export const ensureSuperAdminCreateAccess = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const superAdminsExist = await hasSuperAdmins();

    if (!superAdminsExist) {
        return next();
    }

    return authenticate(req, res, () =>
        requireSuperAdmin(req, res, next)
    );
};
