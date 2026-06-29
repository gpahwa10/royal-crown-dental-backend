import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client";
import { consultations } from "../../db/schema/consultations";
import { prescriptionItems } from "../../db/schema/prescriptionItems";
import { prescriptions } from "../../db/schema/prescriptions";

export interface PrescriptionItemInput {
    medicineName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
}

export interface CreatePrescriptionInput {
    notes?: string;
    items: PrescriptionItemInput[];
}

export interface UpdatePrescriptionInput {
    notes?: string | null;
    items?: PrescriptionItemInput[];
}

export type PrescriptionWithItems = typeof prescriptions.$inferSelect & {
    items: (typeof prescriptionItems.$inferSelect)[];
};

const attachItemsToPrescriptions = async (
    prescriptionRows: (typeof prescriptions.$inferSelect)[]
): Promise<PrescriptionWithItems[]> => {
    if (prescriptionRows.length === 0) {
        return [];
    }

    const prescriptionIds = prescriptionRows.map((row) => row.id);
    const itemRows = await db
        .select()
        .from(prescriptionItems)
        .where(inArray(prescriptionItems.prescriptionId, prescriptionIds));

    const itemsByPrescriptionId = new Map<
        string,
        (typeof prescriptionItems.$inferSelect)[]
    >();

    for (const item of itemRows) {
        const existing = itemsByPrescriptionId.get(item.prescriptionId) ?? [];
        existing.push(item);
        itemsByPrescriptionId.set(item.prescriptionId, existing);
    }

    return prescriptionRows.map((prescription) => ({
        ...prescription,
        items: itemsByPrescriptionId.get(prescription.id) ?? [],
    }));
};

const getPrescriptionRecord = async (id: string) => {
    const [prescription] = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.id, id));

    if (!prescription) {
        throw new Error("Prescription not found");
    }

    return prescription;
};

const getConsultationRecord = async (consultationId: string) => {
    const [consultation] = await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, consultationId));

    if (!consultation) {
        throw new Error("Consultation not found");
    }

    return consultation;
};

const assertConsultationAllowsPrescription = async (consultationId: string) => {
    const consultation = await getConsultationRecord(consultationId);

    if (consultation.status === "completed") {
        throw new Error("Consultation already completed");
    }

    if (consultation.status === "cancelled") {
        throw new Error("Cannot add prescription to a cancelled consultation");
    }

    return consultation;
};

export const getPrescriptionsForConsultation = async (
    consultationId: string
) => {
    const prescriptionRows = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.consultationId, consultationId));

    return attachItemsToPrescriptions(prescriptionRows);
};

export const createPrescriptionForConsultation = async (
    consultationId: string,
    input: CreatePrescriptionInput
) => {
    const consultation = await assertConsultationAllowsPrescription(
        consultationId
    );

    const [existing] = await db
        .select({ id: prescriptions.id })
        .from(prescriptions)
        .where(eq(prescriptions.consultationId, consultationId));

    if (existing) {
        throw new Error("Prescription already exists for this consultation");
    }

    const result = await db.transaction(async (tx) => {
        const [prescription] = await tx
            .insert(prescriptions)
            .values({
                consultationId,
                patientId: consultation.patientId,
                doctorId: consultation.doctorId,
                notes: input.notes,
            })
            .returning();

        const items = await tx
            .insert(prescriptionItems)
            .values(
                input.items.map((item) => ({
                    prescriptionId: prescription.id,
                    medicineName: item.medicineName,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    instructions: item.instructions,
                }))
            )
            .returning();

        return { ...prescription, items };
    });

    return result;
};

export const getPrescriptionById = async (id: string) => {
    const prescription = await getPrescriptionRecord(id);
    const [withItems] = await attachItemsToPrescriptions([prescription]);
    return withItems;
};

export const updatePrescription = async (
    id: string,
    input: UpdatePrescriptionInput
) => {
    const prescription = await getPrescriptionRecord(id);
    const consultation = await getConsultationRecord(prescription.consultationId);

    if (consultation.status === "completed") {
        throw new Error("Consultation already completed");
    }

    const result = await db.transaction(async (tx) => {
        const [updated] = await tx
            .update(prescriptions)
            .set({
                ...(input.notes !== undefined && { notes: input.notes }),
                updatedAt: new Date(),
            })
            .where(eq(prescriptions.id, prescription.id))
            .returning();

        let items: (typeof prescriptionItems.$inferSelect)[];

        if (input.items) {
            await tx
                .delete(prescriptionItems)
                .where(eq(prescriptionItems.prescriptionId, prescription.id));

            items = await tx
                .insert(prescriptionItems)
                .values(
                    input.items.map((item) => ({
                        prescriptionId: prescription.id,
                        medicineName: item.medicineName,
                        dosage: item.dosage,
                        frequency: item.frequency,
                        duration: item.duration,
                        instructions: item.instructions,
                    }))
                )
                .returning();
        } else {
            items = await tx
                .select()
                .from(prescriptionItems)
                .where(eq(prescriptionItems.prescriptionId, prescription.id));
        }

        return { ...updated, items };
    });

    return result;
};

export const listPrescriptionsByPatientId = async (patientId: string) => {
    const prescriptionRows = await db
        .select()
        .from(prescriptions)
        .where(eq(prescriptions.patientId, patientId))
        .orderBy(desc(prescriptions.createdAt));

    return attachItemsToPrescriptions(prescriptionRows);
};

export const getPrescriptionClinicId = async (prescriptionId: string) => {
    const prescription = await getPrescriptionRecord(prescriptionId);
    const consultation = await getConsultationRecord(prescription.consultationId);
    return consultation.clinicId;
};

export { assertPrescriptionClinicAccess } from "./prescriptions.utils";
