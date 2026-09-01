import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { consultationOdontograms } from "../../db/schema/consultationOdontograms";
import { consultations } from "../../db/schema/consultations";
import { odontogramChanges } from "../../db/schema/odontogramChanges";
import { patientOdontograms } from "../../db/schema/patientOdontograms";
import { patients } from "../../db/schema/patients";
import {
    ConsultationOdontogramData,
    OdontogramChangeRecord,
    OdontogramErrorCode,
    PatientOdontogramData,
    UpdateConsultationOdontogramInput,
} from "./odontograms.types";

export class OdontogramError extends Error {
    constructor(
        public code: OdontogramErrorCode,
        message: string,
        public status: number = 400
    ) {
        super(message);
        this.name = "OdontogramError";
    }
}

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const diffOdontogramCharts = (
    previousStatus: Record<string, unknown> | null | undefined,
    newStatus: Record<string, unknown> | null | undefined,
    previousPlan: Record<string, unknown> | null | undefined,
    newPlan: Record<string, unknown> | null | undefined
): OdontogramChangeRecord[] => {
    const changes: OdontogramChangeRecord[] = [];

    const prevStat = previousStatus ?? {};
    const nextStat = newStatus ?? {};

    const statusKeys = Array.from(
        new Set([...Object.keys(prevStat), ...Object.keys(nextStat)])
    );

    let foundStatusToothDiff = false;
    for (const key of statusKeys) {
        const prevVal = prevStat[key];
        const nextVal = nextStat[key];
        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
            foundStatusToothDiff = true;
            changes.push({
                toothNumber: key,
                changeType: "status_chart_updated",
                previousState:
                    typeof prevVal === "object" && prevVal !== null
                        ? (prevVal as Record<string, unknown>)
                        : prevVal !== undefined
                          ? { value: prevVal }
                          : null,
                newState:
                    typeof nextVal === "object" && nextVal !== null
                        ? (nextVal as Record<string, unknown>)
                        : { value: nextVal },
            });
        }
    }

    if (!foundStatusToothDiff && JSON.stringify(prevStat) !== JSON.stringify(nextStat)) {
        changes.push({
            toothNumber: null,
            changeType: "status_chart_updated",
            previousState: prevStat,
            newState: nextStat,
        });
    }

    const prevPl = previousPlan ?? {};
    const nextPl = newPlan ?? {};

    const planKeys = Array.from(
        new Set([...Object.keys(prevPl), ...Object.keys(nextPl)])
    );

    let foundPlanToothDiff = false;
    for (const key of planKeys) {
        const prevVal = prevPl[key];
        const nextVal = nextPl[key];
        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
            foundPlanToothDiff = true;
            changes.push({
                toothNumber: key,
                changeType: "plan_chart_updated",
                previousState:
                    typeof prevVal === "object" && prevVal !== null
                        ? (prevVal as Record<string, unknown>)
                        : prevVal !== undefined
                          ? { value: prevVal }
                          : null,
                newState:
                    typeof nextVal === "object" && nextVal !== null
                        ? (nextVal as Record<string, unknown>)
                        : { value: nextVal },
            });
        }
    }

    if (!foundPlanToothDiff && JSON.stringify(prevPl) !== JSON.stringify(nextPl)) {
        changes.push({
            toothNumber: null,
            changeType: "plan_chart_updated",
            previousState: prevPl,
            newState: nextPl,
        });
    }

    return changes;
};

export const getPatientCurrentOdontogram = async (
    patientId: string,
    clinicId: string,
    executor: DbExecutor = db
): Promise<PatientOdontogramData | null> => {
    const [patient] = await executor
        .select({ id: patients.id, clinicId: patients.clinicId })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new OdontogramError(
            "ODONTOGRAM_PATIENT_NOT_FOUND",
            "Patient not found",
            404
        );
    }

    if (patient.clinicId !== clinicId) {
        throw new OdontogramError(
            "ODONTOGRAM_UNAUTHORIZED",
            "You cannot access patient data from another clinic",
            403
        );
    }

    const [record] = await executor
        .select()
        .from(patientOdontograms)
        .where(
            and(
                eq(patientOdontograms.patientId, patientId),
                eq(patientOdontograms.clinicId, clinicId)
            )
        );

    if (!record) {
        return null;
    }

    return {
        id: record.id,
        patientId: record.patientId,
        clinicId: record.clinicId,
        statusChart: record.statusChart,
        planChart: record.planChart ?? {},
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
};

export const initializeConsultationOdontogram = async (
    consultationId: string,
    clinicId: string,
    executor: DbExecutor = db
): Promise<ConsultationOdontogramData> => {
    const [consultation] = await executor
        .select()
        .from(consultations)
        .where(eq(consultations.id, consultationId));

    if (!consultation) {
        throw new OdontogramError(
            "ODONTOGRAM_CONSULTATION_NOT_FOUND",
            "Consultation not found",
            404
        );
    }

    if (consultation.clinicId !== clinicId) {
        throw new OdontogramError(
            "ODONTOGRAM_UNAUTHORIZED",
            "You cannot access consultations from another clinic",
            403
        );
    }

    if (consultation.status === "cancelled") {
        throw new OdontogramError(
            "ODONTOGRAM_NOT_EDITABLE",
            "Cannot initialize odontogram for cancelled consultation",
            409
        );
    }

    const [existing] = await executor
        .select()
        .from(consultationOdontograms)
        .where(eq(consultationOdontograms.consultationId, consultationId));

    if (existing) {
        return {
            id: existing.id,
            consultationId: existing.consultationId,
            patientId: existing.patientId,
            clinicId: existing.clinicId,
            statusChart: existing.statusChart,
            planChart: existing.planChart ?? {},
            chartVersion: existing.chartVersion,
            readOnly: false,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
        };
    }

    const [patientOdontogram] = await executor
        .select()
        .from(patientOdontograms)
        .where(
            and(
                eq(patientOdontograms.patientId, consultation.patientId),
                eq(patientOdontograms.clinicId, consultation.clinicId)
            )
        );

    const initialStatus = patientOdontogram?.statusChart ?? {};
    const initialPlan = patientOdontogram?.planChart ?? {};

    const [created] = await executor
        .insert(consultationOdontograms)
        .values({
            consultationId: consultation.id,
            patientId: consultation.patientId,
            clinicId: consultation.clinicId,
            statusChart: initialStatus,
            planChart: initialPlan,
            chartVersion: 1,
        })
        .returning();

    return {
        id: created.id,
        consultationId: created.consultationId,
        patientId: created.patientId,
        clinicId: created.clinicId,
        statusChart: created.statusChart,
        planChart: created.planChart ?? {},
        chartVersion: created.chartVersion,
        readOnly: false,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
    };
};

export const getConsultationOdontogram = async (
    consultationId: string,
    clinicId?: string,
    executor: DbExecutor = db
): Promise<ConsultationOdontogramData | null> => {
    const [consultation] = await executor
        .select()
        .from(consultations)
        .where(eq(consultations.id, consultationId));

    if (!consultation) {
        throw new OdontogramError(
            "ODONTOGRAM_CONSULTATION_NOT_FOUND",
            "Consultation not found",
            404
        );
    }

    if (clinicId && consultation.clinicId !== clinicId) {
        throw new OdontogramError(
            "ODONTOGRAM_UNAUTHORIZED",
            "You cannot access consultations from another clinic",
            403
        );
    }

    const [record] = await executor
        .select()
        .from(consultationOdontograms)
        .where(eq(consultationOdontograms.consultationId, consultationId));

    if (!record) {
        return null;
    }

    const isReadOnly = consultation.status === "cancelled";

    return {
        id: record.id,
        consultationId: record.consultationId,
        patientId: record.patientId,
        clinicId: record.clinicId,
        statusChart: record.statusChart,
        planChart: record.planChart ?? {},
        chartVersion: record.chartVersion,
        readOnly: isReadOnly,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
};

export const updateConsultationOdontogram = async (
    consultationId: string,
    input: UpdateConsultationOdontogramInput,
    clinicId: string,
    userId: string
): Promise<ConsultationOdontogramData> => {
    const [consultation] = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, consultationId));

    if (!consultation) {
        throw new OdontogramError(
            "ODONTOGRAM_CONSULTATION_NOT_FOUND",
            "Consultation not found",
            404
        );
    }

    if (consultation.clinicId !== clinicId) {
        throw new OdontogramError(
            "ODONTOGRAM_UNAUTHORIZED",
            "You cannot access consultations from another clinic",
            403
        );
    }

    if (consultation.status === "cancelled") {
        throw new OdontogramError(
            "ODONTOGRAM_NOT_EDITABLE",
            "Cannot edit odontogram for cancelled consultation",
            409
        );
    }

    const [current] = await db
        .select()
        .from(consultationOdontograms)
        .where(eq(consultationOdontograms.consultationId, consultationId));

    if (!current) {
        throw new OdontogramError(
            "ODONTOGRAM_NOT_FOUND",
            "Consultation odontogram has not been initialized",
            404
        );
    }

    if (input.version !== current.chartVersion) {
        throw new OdontogramError(
            "ODONTOGRAM_VERSION_CONFLICT",
            "The dental chart was updated by another user. Reload the latest chart before saving again.",
            409
        );
    }

    const changes = diffOdontogramCharts(
        current.statusChart,
        input.statusChart,
        current.planChart,
        input.planChart
    );

    const updated = await db.transaction(async (tx) => {
        const [updatedRecord] = await tx
            .update(consultationOdontograms)
            .set({
                statusChart: input.statusChart,
                planChart: input.planChart ?? {},
                chartVersion: current.chartVersion + 1,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(consultationOdontograms.id, current.id),
                    eq(consultationOdontograms.chartVersion, input.version)
                )
            )
            .returning();

        if (!updatedRecord) {
            throw new OdontogramError(
                "ODONTOGRAM_VERSION_CONFLICT",
                "The dental chart was updated by another user. Reload the latest chart before saving again.",
                409
            );
        }

        if (changes.length > 0) {
            await tx.insert(odontogramChanges).values(
                changes.map((c) => ({
                    patientId: consultation.patientId,
                    clinicId: consultation.clinicId,
                    consultationId: consultation.id,
                    toothNumber: c.toothNumber,
                    changeType: c.changeType,
                    previousState: c.previousState,
                    newState: c.newState,
                    createdBy: userId,
                }))
            );
        }

        if (consultation.status === "completed") {
            const [currentPatientOdontogram] = await tx
                .select()
                .from(patientOdontograms)
                .where(
                    and(
                        eq(patientOdontograms.patientId, consultation.patientId),
                        eq(patientOdontograms.clinicId, consultation.clinicId)
                    )
                );

            if (currentPatientOdontogram) {
                await tx
                    .update(patientOdontograms)
                    .set({
                        statusChart: input.statusChart,
                        planChart: input.planChart ?? {},
                        version: currentPatientOdontogram.version + 1,
                        updatedAt: new Date(),
                    })
                    .where(eq(patientOdontograms.id, currentPatientOdontogram.id));
            } else {
                await tx.insert(patientOdontograms).values({
                    patientId: consultation.patientId,
                    clinicId: consultation.clinicId,
                    statusChart: input.statusChart,
                    planChart: input.planChart ?? {},
                    version: 1,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        }

        return updatedRecord;
    });

    return {
        id: updated.id,
        consultationId: updated.consultationId,
        patientId: updated.patientId,
        clinicId: updated.clinicId,
        statusChart: updated.statusChart,
        planChart: updated.planChart ?? {},
        chartVersion: updated.chartVersion,
        readOnly: false,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
    };
};

export const finalizeConsultationOdontogram = async (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    consultationId: string,
    clinicId: string
) => {
    const [consultationWorkingOdontogram] = await tx
        .select()
        .from(consultationOdontograms)
        .where(eq(consultationOdontograms.consultationId, consultationId));

    if (!consultationWorkingOdontogram) {
        return;
    }

    const [currentPatientOdontogram] = await tx
        .select()
        .from(patientOdontograms)
        .where(
            and(
                eq(patientOdontograms.patientId, consultationWorkingOdontogram.patientId),
                eq(patientOdontograms.clinicId, clinicId)
            )
        );

    if (currentPatientOdontogram) {
        await tx
            .update(patientOdontograms)
            .set({
                statusChart: consultationWorkingOdontogram.statusChart,
                planChart: consultationWorkingOdontogram.planChart ?? {},
                version: currentPatientOdontogram.version + 1,
                updatedAt: new Date(),
            })
            .where(eq(patientOdontograms.id, currentPatientOdontogram.id));
    } else {
        await tx.insert(patientOdontograms).values({
            patientId: consultationWorkingOdontogram.patientId,
            clinicId: clinicId,
            statusChart: consultationWorkingOdontogram.statusChart,
            planChart: consultationWorkingOdontogram.planChart ?? {},
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }
};
