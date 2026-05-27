import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    blockEmployee,
    editEmployee,
    getEmployeeById,
    listEmployees,
    registerHR,
    registerStaff,
    suspendEmployee,
    activateEmployee,
} from "./employees.service";
import { handleError } from "./employees.utils";
import {
    editEmployeeParamsSchema,
    editEmployeeSchema,
    listEmployeesQuerySchema,
    registerHRSchema,
    registerStaffSchema,
    blockEmployeeSchema,
    suspendEmployeeSchema,
    suspendEmployeeParamsSchema,
    activateEmployeeParamsSchema,
} from "./employees.validation";



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

export const listEmployeesHandler = async (req: AuthRequest, res: Response) => {
    try {
        const query = listEmployeesQuerySchema.parse(req.query);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? query.clinicId
            : req.employee?.clinicId;

        const result = await listEmployees({
            clinicId,
            page: query.page,
            limit: query.limit,
        });

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const editEmployeeHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = editEmployeeParamsSchema.parse(req.params);
        const body = editEmployeeSchema.parse(req.body);

        const existing = await getEmployeeById(id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        if (
            !hasPlatformAdminAccess(req.employee) &&
            existing.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot edit employees from another clinic",
            });
        }

        const result = await editEmployee({
            id,
            ...body,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const blockEmployeeHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = editEmployeeParamsSchema.parse(req.params);
        const { isBlocked } = blockEmployeeSchema.parse(req.body);
        const existing = await getEmployeeById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        if (
            !hasPlatformAdminAccess(req.employee) &&
            existing.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot modify employees from another clinic",
            });
        }
        await blockEmployee(id, isBlocked);
        const updated = await getEmployeeById(id);
        return res.status(200).json({
            success: true,
            data: {
                id: updated!.id,
                isBlocked: updated!.isBlocked,
            },
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const suspendEmployeeHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = suspendEmployeeParamsSchema.parse(req.params);
        const { isSuspended } = suspendEmployeeSchema.parse(req.body);
        const existing = await getEmployeeById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        if (
            !hasPlatformAdminAccess(req.employee) &&
            existing.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot modify employees from another clinic",
            });
        }
        await suspendEmployee(id, isSuspended);
        const updated = await getEmployeeById(id);
        return res.status(200).json({ success: true, data: { id: updated!.id, isSuspended: updated!.isSuspended } });
    } catch (error) {
        return handleError(res, error);
    }
};

export const activateEmployeeHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = activateEmployeeParamsSchema.parse(req.params);
        const existing = await getEmployeeById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        if (
            !hasPlatformAdminAccess(req.employee) &&
            existing.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot modify employees from another clinic",
            });
        }
        await activateEmployee(id);
        return res.status(200).json({ success: true, data: { id: existing!.id, isActive: existing!.isActive } });
        } catch (error) {
        return handleError(res, error);
    }
};