import { NextFunction, Response } from "express";
import {
    canManageInventory,
    canViewInventory,
} from "../modules/auth/auth.constants";
import { AuthRequest } from "./auth.middleware";

/** Any clinic employee role — read-only inventory access. */
export const requireInventoryViewAccess = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canViewInventory(req.employee)) {
        return res.status(403).json({
            success: false,
            message: "Employee access required to view inventory",
        });
    }

    next();
};

/** Super admin, Director, or Inventory manager — full inventory operations. */
export const requireInventoryManageAccess = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    if (!canManageInventory(req.employee)) {
        return res.status(403).json({
            success: false,
            message:
                "Super admin, Director, or Inventory Manager access required to manage inventory",
        });
    }

    next();
};
