import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
    canAccessAllClinics,
    hasPlatformAdminAccess,
    ROLE_ASSISTANT,
    ROLE_DOCTOR,
    ROLE_RECEPTION,
} from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    buildClinicVisitTimelineEvents,
    getClinicVisitDashboardMetrics,
} from "./clinicVisit.metrics";
import {
    attachMedicalRecordToVisit,
    checkOutClinicVisit,
    createAppointmentFromVisit,
    createClinicVisit,
    createMembershipFromVisit,
    getClinicVisitById,
    listClinicVisits,
    listClinicVisitsByPatientId,
    registerPatientFromVisit,
    startConsultationFromVisit,
    updateClinicVisit,
} from "./clinicVisit.service";
import {
    assertClinicVisitClinicAccess,
    handleError,
} from "./clinicVisit.utils";
import {
    attachMedicalRecordSchema,
    clinicVisitDashboardQuerySchema,
    clinicVisitIdParamSchema,
    clinicVisitListQuerySchema,
    createAppointmentFromVisitSchema,
    createClinicVisitSchema,
    createMembershipFromVisitSchema,
    patientIdParamSchema,
    registerPatientFromVisitSchema,
    startConsultationFromVisitSchema,
    updateClinicVisitSchema,
} from "./clinicVisit.validation";

const resolveClinicId = (
    req: AuthRequest,
    requestedClinicId?: string
): string | undefined => {
    if (canAccessAllClinics(req.employee)) {
        return requestedClinicId;
    }

    return req.employee?.clinicId;
};

const assertClinicVisitWriteAccess = (req: AuthRequest) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return;
    }

    const roles = req.employee?.roles ?? [];
    if (
        roles.includes(ROLE_DOCTOR) &&
        !roles.includes(ROLE_RECEPTION) &&
        !roles.includes(ROLE_ASSISTANT)
    ) {
        throw new Error("Doctors have read-only access to clinic visit records");
    }
};

const resolveDoctorFilter = (req: AuthRequest, doctorId?: string) => {
    if (hasPlatformAdminAccess(req.employee)) {
        return doctorId;
    }

    const roles = req.employee?.roles ?? [];
    if (
        roles.includes(ROLE_DOCTOR) &&
        !roles.includes(ROLE_RECEPTION) &&
        !roles.includes(ROLE_ASSISTANT)
    ) {
        return req.employee?.id;
    }

    return doctorId;
};

const assertVisitAccess = async (
    req: AuthRequest,
    visitClinicId: string,
    visitDoctorId?: string | null
) => {
    assertClinicVisitClinicAccess(
        visitClinicId,
        hasPlatformAdminAccess(req.employee),
        req.employee?.clinicId
    );

    if (
        !hasPlatformAdminAccess(req.employee) &&
        req.employee?.roles?.includes(ROLE_DOCTOR) &&
        !req.employee.roles.includes(ROLE_RECEPTION) &&
        !req.employee.roles.includes(ROLE_ASSISTANT) &&
        visitDoctorId &&
        visitDoctorId !== req.employee.id
    ) {
        throw new Error("You can only access visits assigned to you");
    }
};

export const createClinicVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const body = createClinicVisitSchema.parse(req.body);
        const clinicId = resolveClinicId(req, body.clinicId);

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "clinicId is required",
            });
        }

        const visit = await createClinicVisit({
            ...body,
            clinicId,
            createdBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(201).json({ success: true, data: visit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listClinicVisitsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = clinicVisitListQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);
        const doctorId = resolveDoctorFilter(req, query.doctorId);

        const result = await listClinicVisits({
            ...query,
            clinicId,
            doctorId,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicVisitDashboardHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const query = clinicVisitDashboardQuerySchema.parse(req.query);
        const clinicId = resolveClinicId(req, query.clinicId);

        const metrics = await getClinicVisitDashboardMetrics({
            clinicId,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
        });

        return res.status(200).json({ success: true, data: metrics });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getClinicVisitHandler = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const visit = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            visit.visit.clinicId,
            visit.visit.doctorId
        );

        const timeline = buildClinicVisitTimelineEvents(
            [visit.visit],
            new Map([[visit.visit.id, visit.medicalRecords.length]])
        );

        return res
            .status(200)
            .json({ success: true, data: { ...visit, timeline } });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateClinicVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = updateClinicVisitSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const visit = await updateClinicVisit(id, body);
        return res.status(200).json({ success: true, data: visit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const checkOutClinicVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const visit = await checkOutClinicVisit(id);
        return res.status(200).json({ success: true, data: visit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const registerPatientFromVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = registerPatientFromVisitSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const result = await registerPatientFromVisit(id, {
            ...body,
            clinicId: existing.visit.clinicId,
            name: body.name ?? existing.visit.visitorName,
            phone: body.phone ?? existing.visit.visitorPhone,
            email: body.email ?? existing.visit.visitorEmail ?? undefined,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const startConsultationFromVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = startConsultationFromVisitSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const result = await startConsultationFromVisit(id, body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createAppointmentFromVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = createAppointmentFromVisitSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const result = await createAppointmentFromVisit(id, body);
        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createMembershipFromVisitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = createMembershipFromVisitSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const result = await createMembershipFromVisit(id, {
            membershipPlanId: body.membershipPlanId,
            payment: body.payment,
            purchasedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
            receivedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const attachMedicalRecordHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertClinicVisitWriteAccess(req);
        const { id } = clinicVisitIdParamSchema.parse(req.params);
        const body = attachMedicalRecordSchema.parse(req.body);
        const existing = await getClinicVisitById(id);

        await assertVisitAccess(
            req,
            existing.visit.clinicId,
            existing.visit.doctorId
        );

        const visit = await attachMedicalRecordToVisit(id, body.fileId);
        return res.status(200).json({ success: true, data: visit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientClinicVisitsHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { patientId } = patientIdParamSchema.parse(req.params);
        const patientDetails = await getPatientDetails(patientId);

        assertPatientClinicAccess(
            patientDetails.patient.clinicId,
            hasPlatformAdminAccess(req.employee),
            req.employee?.clinicId
        );

        const visits = await listClinicVisitsByPatientId(patientId);
        return res.status(200).json({ success: true, data: visits });
    } catch (error) {
        return handleError(res, error);
    }
};
