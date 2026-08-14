import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    hasPlatformAdminAccess,
    ROLE_ASSISTANT,
    ROLE_DOCTOR,
    ROLE_RECEPTION,
} from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    attachDentalLabFile,
    createCementationAppointment,
    createDentalLabOrder,
    deliverDentalLabOrder,
    getDentalLabOrderById,
    listDentalLabOrders,
    listDentalLabOrdersByPatientId,
    recordCementation,
    removeDentalLabFile,
    updateDentalLabOrder,
} from "./dentalLab.service";
import {
    assertDentalLabOrderClinicAccess,
    handleError,
} from "./dentalLab.utils";
import {
    attachDentalLabFileSchema,
    createCementationAppointmentSchema,
    createDentalLabOrderSchema,
    deliverDentalLabOrderSchema,
    dentalLabOrderFileParamsSchema,
    dentalLabOrderIdParamSchema,
    dentalLabOrderListQuerySchema,
    patientIdParamSchema,
    recordCementationSchema,
    updateDentalLabOrderSchema,
} from "./dentalLab.validation";

const resolveClinicId = (
    req: AuthRequest,
    _requestedClinicId?: string
): string | undefined => {
    return req.clinicId;
};

const shouldScopeToDoctor = (req: AuthRequest) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return false;
    }

    const roles = req.employee?.roles ?? [];
    if (
        roles.includes(ROLE_RECEPTION) ||
        roles.includes(ROLE_ASSISTANT)
    ) {
        return false;
    }

    return roles.includes(ROLE_DOCTOR);
};

export const createDentalLabOrderHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const body = createDentalLabOrderSchema.parse(req.body);

        const clinicId = req.clinicId;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const result = await createDentalLabOrder({
            ...body,
            clinicId,
            consultationId: body.consultationId ?? null,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listDentalLabOrdersHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = dentalLabOrderListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);
        const doctorId = shouldScopeToDoctor(req)
            ? req.employee?.id
            : query.doctorId;

        const result = await listDentalLabOrders({
            page: query.page,
            limit: query.limit,
            status: query.status,
            clinicId,
            doctorId,
            patientId: query.patientId,
            search: query.search,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getDentalLabOrderHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        const details = await getDentalLabOrderById(id);

        assertDentalLabOrderClinicAccess(
            details.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        if (
            shouldScopeToDoctor(req) &&
            details.order.measuredByDoctorId !== req.employee?.id &&
            details.order.cementationDoctorId !== req.employee?.id
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot access dental lab orders from another clinic",
            });
        }

        return res.status(200).json({ success: true, data: details });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateDentalLabOrderHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        const body = updateDentalLabOrderSchema.parse(req.body);

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        if (
            shouldScopeToDoctor(req) &&
            existing.order.measuredByDoctorId !== req.employee?.id &&
            existing.order.cementationDoctorId !== req.employee?.id
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You cannot access dental lab orders from another clinic",
            });
        }

        const result = await updateDentalLabOrder(id, body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deliverDentalLabOrderHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        deliverDentalLabOrderSchema.parse(req.body);

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await deliverDentalLabOrder(id);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createCementationAppointmentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        const body = createCementationAppointmentSchema.parse(req.body);

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await createCementationAppointment(id, body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const recordCementationHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        const body = recordCementationSchema.parse(req.body);

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await recordCementation(id, body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const attachDentalLabFileHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = dentalLabOrderIdParamSchema.parse(req.params);
        const body = attachDentalLabFileSchema.parse(req.body);

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await attachDentalLabFile(id, body.fileId);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const removeDentalLabFileHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id, fileId } = dentalLabOrderFileParamsSchema.parse(
            req.params
        );

        const existing = await getDentalLabOrderById(id);
        assertDentalLabOrderClinicAccess(
            existing.order.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const result = await removeDentalLabFile(id, fileId);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientDentalLabOrdersHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const patientDetails = await getPatientDetails(patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const orders = await listDentalLabOrdersByPatientId(patientId);
        return res.status(200).json({ success: true, data: orders });
    } catch (error) {
        return handleError(res, error);
    }
};
