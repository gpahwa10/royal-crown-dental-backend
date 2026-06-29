import { and, count, desc, eq } from "drizzle-orm";
import { s3Config } from "../../config/s3.config";
import { db } from "../../db/client";
import { employees } from "../../db/schema/employees";
import { files } from "../../db/schema/files";
import { patients } from "../../db/schema/patients";
import {
    buildObjectKey,
    createDownloadPresignedUrl,
    createUploadPresignedUrl,
    putObjectBuffer,
    verifyObjectExists,
} from "../../lib/s3.client";
import {
    FileDocumentType,
    FileUploadStatus,
    MAX_UPLOAD_FILE_SIZE_BYTES,
} from "./uploads.constants";
import { getPagination } from "./uploads.utils";

export interface PresignUploadInput {
    patientId: string;
    documentType: FileDocumentType;
    fileName: string;
    contentType: string;
    fileSize?: number;
    uploadedBy?: string;
}

export interface RegisterUploadInput {
    fileSize?: number;
}

export interface ListPatientUploadsOptions {
    page?: number;
    limit?: number;
    documentType?: FileDocumentType;
    status?: FileUploadStatus;
}

export type FileRecord = typeof files.$inferSelect;

export type PresignUploadResult = {
    file: FileRecord;
    uploadUrl: string;
    expiresIn: number;
    headers: {
        "Content-Type": string;
    };
};

export type FileWithDownloadUrl = {
    file: FileRecord;
    downloadUrl: string | null;
    expiresIn: number | null;
};

const resolveUploadedByEmployeeId = async (uploadedBy?: string) => {
    if (!uploadedBy) {
        return null;
    }

    const [employee] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.id, uploadedBy));

    return employee?.id ?? null;
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({ id: patients.id, clinicId: patients.clinicId })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

export const getFileRecord = async (id: string) => {
    const [file] = await db
        .select()
        .from(files)
        .where(eq(files.id, id));

    if (!file) {
        throw new Error("File not found");
    }

    return file;
};

export const presignUpload = async (input: PresignUploadInput) => {
    const patient = await assertPatientExists(input.patientId);

    if (input.fileSize && input.fileSize > MAX_UPLOAD_FILE_SIZE_BYTES) {
        throw new Error(
            `File size exceeds maximum allowed size of ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes`
        );
    }

    const now = new Date();
    const bucket = s3Config.bucket;
    const uploadedBy = await resolveUploadedByEmployeeId(input.uploadedBy);

    const [file] = await db
        .insert(files)
        .values({
            patientId: patient.id,
            clinicId: patient.clinicId,
            documentType: input.documentType,
            originalFileName: input.fileName,
            objectKey: "pending",
            bucket,
            contentType: input.contentType,
            fileSize: input.fileSize ?? null,
            status: "pending_upload",
            uploadedBy,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    const objectKey = buildObjectKey({
        clinicId: patient.clinicId,
        patientId: patient.id,
        documentType: input.documentType,
        fileId: file.id,
        originalFileName: input.fileName,
    });

    const [updatedFile] = await db
        .update(files)
        .set({
            objectKey,
            updatedAt: new Date(),
        })
        .where(eq(files.id, file.id))
        .returning();

    const { uploadUrl, expiresIn } = await createUploadPresignedUrl({
        bucket,
        objectKey,
        contentType: input.contentType,
    });

    return {
        file: updatedFile,
        uploadUrl,
        expiresIn,
        headers: {
            "Content-Type": input.contentType,
        },
    } satisfies PresignUploadResult;
};

export const registerUpload = async (
    id: string,
    input: RegisterUploadInput = {}
) => {
    const file = await getFileRecord(id);

    if (file.status !== "pending_upload") {
        throw new Error("File is already registered");
    }

    let objectMetadata: { contentType?: string; fileSize?: number };

    try {
        objectMetadata = await verifyObjectExists({
            bucket: file.bucket,
            objectKey: file.objectKey,
        });
    } catch {
        throw new Error("Upload not found in storage");
    }

    const resolvedFileSize = input.fileSize ?? objectMetadata.fileSize ?? null;

    if (
        resolvedFileSize !== null &&
        resolvedFileSize > MAX_UPLOAD_FILE_SIZE_BYTES
    ) {
        throw new Error(
            `File size exceeds maximum allowed size of ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes`
        );
    }

    const [updatedFile] = await db
        .update(files)
        .set({
            status: "uploaded",
            fileSize: resolvedFileSize,
            contentType: objectMetadata.contentType ?? file.contentType,
            updatedAt: new Date(),
        })
        .where(eq(files.id, id))
        .returning();

    return updatedFile;
};

export const getFileWithDownloadUrl = async (
    id: string,
    includeDownloadUrl = true
): Promise<FileWithDownloadUrl> => {
    const file = await getFileRecord(id);

    if (!includeDownloadUrl || file.status !== "uploaded") {
        return {
            file,
            downloadUrl: null,
            expiresIn: null,
        };
    }

    const { downloadUrl, expiresIn } = await createDownloadPresignedUrl({
        bucket: file.bucket,
        objectKey: file.objectKey,
    });

    return {
        file,
        downloadUrl,
        expiresIn,
    };
};

export const listPatientUploads = async (
    patientId: string,
    options: ListPatientUploadsOptions = {}
) => {
    await assertPatientExists(patientId);

    const { page, limit, offset } = getPagination(options.page, options.limit);
    const filters = [eq(files.patientId, patientId)];

    if (options.documentType) {
        filters.push(eq(files.documentType, options.documentType));
    }

    if (options.status) {
        filters.push(eq(files.status, options.status));
    }

    const whereClause = and(...filters);

    const [totalRow] = await db
        .select({ total: count() })
        .from(files)
        .where(whereClause);

    const items = await db
        .select()
        .from(files)
        .where(whereClause)
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);

    return {
        items,
        total: totalRow?.total ?? 0,
        page,
        limit,
    };
};

export const assertUploadedFileForPatient = async (
    fileId: string,
    patientId: string,
    documentType?: FileDocumentType
) => {
    const file = await getFileRecord(fileId);

    if (file.patientId !== patientId) {
        throw new Error("File does not belong to this patient");
    }

    if (file.status !== "uploaded") {
        throw new Error("File is not ready for attachment");
    }

    if (documentType && file.documentType !== documentType) {
        throw new Error(`File must be of type ${documentType}`);
    }

    return file;
};

export const buildStoredFileUrl = (file: FileRecord) => {
    return `s3://${file.bucket}/${file.objectKey}`;
};

export const uploadServerGeneratedFile = async (input: {
    patientId: string;
    clinicId: string;
    documentType: FileDocumentType;
    fileName: string;
    contentType: string;
    buffer: Buffer;
    uploadedBy?: string;
}) => {
    const bucket = s3Config.bucket;
    const now = new Date();
    const uploadedBy = await resolveUploadedByEmployeeId(input.uploadedBy);

    const [file] = await db
        .insert(files)
        .values({
            patientId: input.patientId,
            clinicId: input.clinicId,
            documentType: input.documentType,
            originalFileName: input.fileName,
            objectKey: "pending",
            bucket,
            contentType: input.contentType,
            fileSize: input.buffer.length,
            status: "pending_upload",
            uploadedBy,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    const objectKey = buildObjectKey({
        clinicId: input.clinicId,
        patientId: input.patientId,
        documentType: input.documentType,
        fileId: file.id,
        originalFileName: input.fileName,
    });

    await putObjectBuffer({
        bucket,
        objectKey,
        contentType: input.contentType,
        body: input.buffer,
    });

    const [updatedFile] = await db
        .update(files)
        .set({
            objectKey,
            status: "uploaded",
            fileSize: input.buffer.length,
            updatedAt: new Date(),
        })
        .where(eq(files.id, file.id))
        .returning();

    return updatedFile;
};
