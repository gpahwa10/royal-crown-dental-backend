import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { hasPlatformAdminAccess } from "../auth/auth.constants";
import { getPatientDetails } from "../patients/patients.service";
import { assertPatientClinicAccess } from "../patients/patients.utils";
import { listRadiographsByPatientId } from "./radiographs.service";
import { handleError } from "./radiographs.utils";
import { patientIdParamSchema } from "./radiographs.validation";

export const listPatientRadiographsHandler = async (
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

        const radiographRows = await listRadiographsByPatientId(patientId);
        return res.status(200).json({ success: true, data: radiographRows });
    } catch (error) {
        return handleError(res, error);
    }
};
