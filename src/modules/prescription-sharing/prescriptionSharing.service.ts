import { randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/client";
import { consultations } from "../../db/schema/consultations";
import { prescriptionFiles } from "../../db/schema/prescriptionFiles";
import { prescriptionShareLinks } from "../../db/schema/prescriptionShareLinks";
import { prescriptions } from "../../db/schema/prescriptions";
import { s3Config } from "../../config/s3.config";
import {
    createDownloadPresignedUrl,
    putObjectBuffer,
} from "../../lib/s3.client";
import {
    PRESCRIPTION_PDF_MIME,
    SHARE_LINK_TTL_HOURS,
} from "./prescriptionSharing.constants";
import {
    assertValidPdfUpload,
    buildPrescriptionObjectKey,
    getPublicApiBaseUrl,
} from "./prescriptionSharing.utils";

const createShareToken = () => randomBytes(32).toString("base64url");

const getPrescriptionWithClinic = async (prescriptionId: string) => {
    const [row] = await db
        .select({
            prescription: prescriptions,
            clinicId: consultations.clinicId,
        })
        .from(prescriptions)
        .innerJoin(
            consultations,
            eq(consultations.id, prescriptions.consultationId)
        )
        .where(eq(prescriptions.id, prescriptionId));

    if (!row) {
        throw new Error("Prescription not found");
    }

    return row;
};

export const uploadPrescriptionPdf = async (input: {
    file: Express.Multer.File;
    clinicId: string;
    patientId: string;
    prescriptionId: string;
    uploadedBy: string | null;
}) => {
    assertValidPdfUpload(input.file);

    const { prescription, clinicId } = await getPrescriptionWithClinic(
        input.prescriptionId
    );

    if (clinicId !== input.clinicId) {
        throw new Error("clinicId does not match the prescription clinic");
    }

    if (prescription.patientId !== input.patientId) {
        throw new Error("patientId does not match the prescription patient");
    }

    const bucket = s3Config.bucket;
    const s3Key = buildPrescriptionObjectKey({
        clinicId: input.clinicId,
        patientId: input.patientId,
        prescriptionId: input.prescriptionId,
    });

    const originalFileName =
        input.file.originalname?.trim() ||
        `prescription-${input.prescriptionId}.pdf`;

    await putObjectBuffer({
        bucket,
        objectKey: s3Key,
        contentType: PRESCRIPTION_PDF_MIME,
        body: input.file.buffer,
    });

    const now = new Date();
    const [existing] = await db
        .select()
        .from(prescriptionFiles)
        .where(eq(prescriptionFiles.prescriptionId, input.prescriptionId));

    let fileRow: typeof prescriptionFiles.$inferSelect;

    if (existing) {
        const [updated] = await db
            .update(prescriptionFiles)
            .set({
                clinicId: input.clinicId,
                patientId: input.patientId,
                bucket,
                s3Key,
                originalFileName,
                mimeType: PRESCRIPTION_PDF_MIME,
                size: input.file.size,
                uploadedBy: input.uploadedBy,
                updatedAt: now,
            })
            .where(eq(prescriptionFiles.id, existing.id))
            .returning();
        fileRow = updated;
    } else {
        const [created] = await db
            .insert(prescriptionFiles)
            .values({
                clinicId: input.clinicId,
                patientId: input.patientId,
                prescriptionId: input.prescriptionId,
                bucket,
                s3Key,
                originalFileName,
                mimeType: PRESCRIPTION_PDF_MIME,
                size: input.file.size,
                uploadedBy: input.uploadedBy,
            })
            .returning();
        fileRow = created;
    }

    const expiresAt = new Date(
        now.getTime() + SHARE_LINK_TTL_HOURS * 60 * 60 * 1000
    );
    const token = createShareToken();

    await db.insert(prescriptionShareLinks).values({
        token,
        fileId: fileRow.id,
        expiresAt,
        createdBy: input.uploadedBy,
    });

    const shareUrl = `${getPublicApiBaseUrl()}/share/${token}`;

    return {
        shareUrl,
        fileId: fileRow.id,
        expiresAt: expiresAt.toISOString(),
        prescriptionId: input.prescriptionId,
    };
};

export const getPrescriptionFileMeta = async (prescriptionId: string) => {
    const { prescription, clinicId } =
        await getPrescriptionWithClinic(prescriptionId);

    const [file] = await db
        .select()
        .from(prescriptionFiles)
        .where(eq(prescriptionFiles.prescriptionId, prescriptionId));

    return {
        prescriptionId,
        clinicId,
        patientId: prescription.patientId,
        hasFile: Boolean(file),
        file: file
            ? {
                  id: file.id,
                  originalFileName: file.originalFileName,
                  mimeType: file.mimeType,
                  size: file.size,
                  createdAt: file.createdAt,
                  updatedAt: file.updatedAt,
              }
            : null,
    };
};

export const getAuthenticatedDownloadUrl = async (prescriptionId: string) => {
    const { clinicId } = await getPrescriptionWithClinic(prescriptionId);

    const [file] = await db
        .select()
        .from(prescriptionFiles)
        .where(eq(prescriptionFiles.prescriptionId, prescriptionId));

    if (!file) {
        throw new Error("Prescription file not found");
    }

    const { downloadUrl, expiresIn } = await createDownloadPresignedUrl({
        bucket: file.bucket,
        objectKey: file.s3Key,
    });

    return {
        clinicId,
        downloadUrl,
        expiresIn,
        originalFileName: file.originalFileName,
    };
};

export const resolveShareRedirect = async (token: string) => {
    const now = new Date();

    const [link] = await db
        .select({
            expiresAt: prescriptionShareLinks.expiresAt,
            bucket: prescriptionFiles.bucket,
            s3Key: prescriptionFiles.s3Key,
        })
        .from(prescriptionShareLinks)
        .innerJoin(
            prescriptionFiles,
            eq(prescriptionFiles.id, prescriptionShareLinks.fileId)
        )
        .where(
            and(
                eq(prescriptionShareLinks.token, token),
                gt(prescriptionShareLinks.expiresAt, now)
            )
        );

    if (!link) {
        const [expired] = await db
            .select({ id: prescriptionShareLinks.id })
            .from(prescriptionShareLinks)
            .where(eq(prescriptionShareLinks.token, token));

        if (expired) {
            throw new Error("Share link has expired");
        }

        throw new Error("Share link not found");
    }

    const { downloadUrl } = await createDownloadPresignedUrl({
        bucket: link.bucket,
        objectKey: link.s3Key,
    });

    return downloadUrl;
};

export const getClinicIdForPrescription = async (prescriptionId: string) => {
    const { clinicId } = await getPrescriptionWithClinic(prescriptionId);
    return clinicId;
};
