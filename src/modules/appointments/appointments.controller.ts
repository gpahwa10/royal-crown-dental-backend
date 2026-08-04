import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import {
    assertAppointmentClinicAccess,
    assertAppointmentShiftAccess,
    createAppointment,
    getAppointmentById,
    getAvailableDoctorsForSlot,
    listAppointments,
    shiftAppointmentClinic,
    updateAppointment,
    updateAppointmentStatus,
} from "./appointments.service";
import { handleError } from "./appointments.utils";
import {
    appointmentParamsSchema,
    availableDoctorsQuerySchema,
    createAppointmentSchema,
    listAppointmentsQuerySchema,
    shiftAppointmentClinicSchema,
    updateAppointmentSchema,
    updateAppointmentStatusSchema,
} from "./appointments.validations";

const resolveClinicId = (
    req: AuthRequest,
    requestedClinicId?: string
): string | undefined => {
    if (hasPlatformAdminAccess(req.employee)) {
        return requestedClinicId ?? req.employee?.clinicId ?? undefined;
    }

    return req.employee?.clinicId;
};

export const listAvailableDoctorsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = availableDoctorsQuerySchema.parse(req.query);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? query.clinicId
            : req.employee?.clinicId ?? query.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        if (
            !hasPlatformAdminAccess(req.employee) &&
            clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot access appointments from another clinic",
            });
        }

        const doctors = await getAvailableDoctorsForSlot({
            clinicId,
            date: query.date,
            time: query.time,
            durationMinutes: query.durationMinutes,
        });

        return res.status(200).json({ success: true, data: doctors });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createAppointmentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createAppointmentSchema.parse(req.body);

        const clinicId = hasPlatformAdminAccess(req.employee)
            ? body.clinicId
            : req.employee?.clinicId ?? body.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const appointment = await createAppointment({
            ...body,
            clinicId,
        });

        return res.status(201).json({ success: true, data: appointment });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listAppointmentsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = listAppointmentsQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const result = await listAppointments({
            page: query.page,
            limit: query.limit,
            clinicId,
            status: query.status,
            employeeId: query.employeeId,
            patientId: query.patientId,
            leadId: query.leadId,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            search: query.search,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getAppointmentByIdHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = appointmentParamsSchema.parse(req.params);
        const appointment = await getAppointmentById(id);

        assertAppointmentClinicAccess(
            appointment.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        return res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateAppointmentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = appointmentParamsSchema.parse(req.params);
        const body = updateAppointmentSchema.parse(req.body);

        const existing = await getAppointmentById(id);
        assertAppointmentClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        if (
            body.clinicId &&
            !hasPlatformAdminAccess(req.employee) &&
            body.clinicId !== req.employee?.clinicId
        ) {
            return res.status(403).json({
                success: false,
                message: "You cannot modify appointments from another clinic",
            });
        }

        const appointment = await updateAppointment(id, body);
        return res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateAppointmentStatusHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = appointmentParamsSchema.parse(req.params);
        const body = updateAppointmentStatusSchema.parse(req.body);

        const existing = await getAppointmentById(id);
        assertAppointmentClinicAccess(
            existing.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const appointment = await updateAppointmentStatus(id, body.status);
        return res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        return handleError(res, error);
    }
};

export const shiftAppointmentClinicHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = appointmentParamsSchema.parse(req.params);
        const body = shiftAppointmentClinicSchema.parse(req.body);

        const existing = await getAppointmentById(id);
        assertAppointmentShiftAccess(
            existing.clinicId,
            body.newClinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const appointment = await shiftAppointmentClinic(id, body.newClinicId);
        return res.status(200).json({ success: true, data: appointment });
    } catch (error) {
        return handleError(res, error);
    }
};
