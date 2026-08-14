import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import {
    getPrescriptionById,
    getPrescriptionClinicId,
    listPrescriptionsByPatientId,
    updatePrescription,
} from "./prescriptions.service";
import { assertPrescriptionClinicAccess, handleError } from "./prescriptions.utils";
import {
    patientIdParamSchema,
    prescriptionIdParamSchema,
    updatePrescriptionSchema,
} from "./prescriptions.validation";

export const getPrescriptionHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = prescriptionIdParamSchema.parse(req.params);
        const prescription = await getPrescriptionById(id);
        const clinicId = await getPrescriptionClinicId(id);

        assertPrescriptionClinicAccess(
            clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        return res.status(200).json({ success: true, data: prescription });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updatePrescriptionHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = prescriptionIdParamSchema.parse(req.params);
        const body = updatePrescriptionSchema.parse(req.body);
        const clinicId = await getPrescriptionClinicId(id);

        assertPrescriptionClinicAccess(
            clinicId,
            hasPlatformAdminAccess(req.employee),
            req.clinicId
        );

        const prescription = await updatePrescription(id, body);
        return res.status(200).json({ success: true, data: prescription });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listPatientPrescriptionsHandler = async (
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

        const prescriptions = await listPrescriptionsByPatientId(patientId);
        return res.status(200).json({ success: true, data: prescriptions });
    } catch (error) {
        return handleError(res, error);
    }
};
