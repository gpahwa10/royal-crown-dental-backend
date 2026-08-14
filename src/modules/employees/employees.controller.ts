import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    canListEmployees,
    isDoctorEmployee,
    ROLE_DOCTOR,
} from "../auth/auth.constants";
import {
    blockEmployee,
    editEmployee,
    getEmployeeById,
    getEmployeeHours,
    listEmployees,
    putEmployeeHours,
    registerHR,
    registerStaff,
    suspendEmployee,
    activateEmployee,
} from "./employees.service";
import { handleError } from "./employees.utils";
import {
    editEmployeeParamsSchema,
    editEmployeeSchema,
    employeeIdParamSchema,
    listEmployeesQuerySchema,
    listPasswordResetRequestsQuerySchema,
    passwordResetRequestIdParamSchema,
    registerHRSchema,
    registerStaffSchema,
    blockEmployeeSchema,
    suspendEmployeeSchema,
    suspendEmployeeParamsSchema,
    activateEmployeeParamsSchema,
    replaceEmployeeWorkingHoursSchema,
} from "./employees.validation";
import {
    approvePasswordReset,
    listPasswordResetRequests,
    rejectPasswordReset,
} from "./passwordReset.service";



export const registerStaffHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = registerStaffSchema.parse(req.body);

        const clinicId = req.clinicId;

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
            clinicId: req.clinicId!,
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
        const hasFullListAccess = canListEmployees(req.employee);
        const isDoctorSelectOnly = !hasFullListAccess;
        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const result = await listEmployees({
            clinicId,
            page: query.page,
            limit: query.limit,
            role: isDoctorSelectOnly ? ROLE_DOCTOR : query.role,
            status: isDoctorSelectOnly ? "active" : query.status,
        });

        return res.status(200).json({
            success: true,
            data: {
                ...result,
                ...(isDoctorEmployee(req.employee) && {
                    defaultDoctorId: req.employee!.id,
                }),
            },
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

        if (existing.clinicId !== req.clinicId) {
            return res.status(403).json({
                success: false,
                message: "You cannot edit employees from another clinic",
            });
        }

        if (body.clinicId && body.clinicId !== req.clinicId) {
            return res.status(403).json({
                success: false,
                message: "You cannot move employees to another clinic",
            });
        }

        const result = await editEmployee({
            id,
            ...body,
            clinicId: undefined,
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
            existing.clinicId !== req.clinicId
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
            existing.clinicId !== req.clinicId
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
            existing.clinicId !== req.clinicId
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
export const getEmployeeWorkingHoursHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = employeeIdParamSchema.parse(req.params);
        const existing = await getEmployeeById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        if (
            existing.clinicId !== req.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot view employees from another clinic",
            });
        }

        const workingHours = await getEmployeeHours(id);
        return res.status(200).json({ success: true, data: workingHours });
    } catch (error) {
        return handleError(res, error);
    }
};

export const putEmployeeWorkingHoursHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = employeeIdParamSchema.parse(req.params);
        const body = replaceEmployeeWorkingHoursSchema.parse(req.body);
        const existing = await getEmployeeById(id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }
        if (
            existing.clinicId !== req.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot edit employees from another clinic",
            });
        }

        const workingHours = await putEmployeeHours(id, body.days);
        return res.status(200).json({
            success: true,
            message: "Employee working hours updated",
            data: workingHours,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPasswordResetRequestsHandler = async (
    req: AuthRequest,
    res: Response,
) => {
    try {
        const query = listPasswordResetRequestsQuerySchema.parse(req.query);
        const items = await listPasswordResetRequests(
            query.status,
            req.clinicId
        );
        return res.status(200).json({ success: true, data: { items } });
    } catch (error) {
        return handleError(res, error);
    }
};

export const approvePasswordResetHandler = async (
    req: AuthRequest,
    res: Response,
) => {
    try {
        if (!req.employee?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }
        const { id } = passwordResetRequestIdParamSchema.parse(req.params);
        const result = await approvePasswordReset(id, {
            id: req.employee.id,
            isSuperAdmin: req.employee.isSuperAdmin,
        });
        return res.status(200).json({
            success: true,
            message: "Password reset to the default. Staff must change it on next login.",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};

export const rejectPasswordResetHandler = async (
    req: AuthRequest,
    res: Response,
) => {
    try {
        if (!req.employee?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized access" });
        }
        const { id } = passwordResetRequestIdParamSchema.parse(req.params);
        const result = await rejectPasswordReset(id, {
            id: req.employee.id,
            isSuperAdmin: req.employee.isSuperAdmin,
        });
        return res.status(200).json({
            success: true,
            message: "Reset request rejected",
            data: result,
        });
    } catch (error) {
        return handleError(res, error);
    }
};
