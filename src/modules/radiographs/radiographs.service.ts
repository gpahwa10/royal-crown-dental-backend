import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../../db/client";
import { employees } from "../../db/schema/employees";
import { files } from "../../db/schema/files";
import { patients } from "../../db/schema/patients";
import { radiographs } from "../../db/schema/radiographs";
import {
    buildStoredFileUrl,
    FileRecord,
} from "../uploads/uploads.service";

export type RadiographRow = typeof radiographs.$inferSelect;

export type RadiographPatientSummary = {
    id: string;
    source: "record" | "upload";
    consultationId: string | null;
    studyType: string;
    toothRegion: string | null;
    scheduledDate: string | null;
    status: RadiographRow["status"];
    notes: string | null;
    reportText: string | null;
    imageFileId: string | null;
    imageUrl: string | null;
    reportFileId: string | null;
    reportUrl: string | null;
    contentType: string | null;
    uploadStatus: FileRecord["status"] | null;
    doctor: { id: string; name: string };
    createdAt: string;
};

export type RadiographTimelineEvent = {
    type: string;
    date: string;
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }
};

const getDoctorSummaries = async (doctorIds: string[]) => {
    const uniqueIds = [...new Set(doctorIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
        return new Map<string, { id: string; name: string }>();
    }

    const rows = await db
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(inArray(employees.id, uniqueIds));

    return new Map(rows.map((row) => [row.id, row]));
};

const getFilesByIds = async (fileIds: string[]) => {
    if (fileIds.length === 0) {
        return new Map<string, FileRecord>();
    }

    const rows = await db
        .select()
        .from(files)
        .where(inArray(files.id, fileIds));

    return new Map(rows.map((row) => [row.id, row]));
};

const mapUploadStatusToRadiographStatus = (
    status: FileRecord["status"]
): RadiographRow["status"] => {
    if (status === "uploaded") {
        return "acquired";
    }

    if (status === "archived") {
        return "reported";
    }

    return "scheduled";
};

const toRecordSummary = (
    row: RadiographRow,
    doctor: { id: string; name: string },
    imageFile: FileRecord | null,
    reportFile: FileRecord | null
): RadiographPatientSummary => ({
    id: row.id,
    source: "record",
    consultationId: row.consultationId,
    studyType: row.studyType,
    toothRegion: row.toothRegion,
    scheduledDate: row.scheduledDate?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    reportText: row.reportText,
    imageFileId: row.imageFileId,
    imageUrl: imageFile ? buildStoredFileUrl(imageFile) : null,
    reportFileId: row.reportFileId,
    reportUrl: reportFile ? buildStoredFileUrl(reportFile) : null,
    contentType: imageFile?.contentType ?? reportFile?.contentType ?? null,
    uploadStatus: imageFile?.status ?? reportFile?.status ?? null,
    doctor,
    createdAt: row.createdAt.toISOString(),
});

const toUploadSummary = (
    file: FileRecord,
    uploader: { id: string; name: string }
): RadiographPatientSummary => ({
    id: file.id,
    source: "upload",
    consultationId: null,
    studyType: file.originalFileName,
    toothRegion: null,
    scheduledDate: null,
    status: mapUploadStatusToRadiographStatus(file.status),
    notes: null,
    reportText: null,
    imageFileId: file.id,
    imageUrl: file.status === "uploaded" ? buildStoredFileUrl(file) : null,
    reportFileId: null,
    reportUrl: null,
    contentType: file.contentType,
    uploadStatus: file.status,
    doctor: uploader,
    createdAt: file.createdAt.toISOString(),
});

const listRadiographUploadFilesByPatientId = async (patientId: string) =>
    db
        .select()
        .from(files)
        .where(
            and(
                eq(files.patientId, patientId),
                eq(files.documentType, "radiograph"),
                ne(files.status, "archived")
            )
        )
        .orderBy(desc(files.createdAt));

export const listRadiographsByPatientId = async (patientId: string) => {
    await assertPatientExists(patientId);

    const radiographRows = await db
        .select()
        .from(radiographs)
        .where(eq(radiographs.patientId, patientId))
        .orderBy(desc(radiographs.createdAt));

    const uploadFiles = await listRadiographUploadFilesByPatientId(patientId);

    const linkedFileIds = new Set(
        radiographRows.flatMap((row) =>
            [row.imageFileId, row.reportFileId].filter(
                (fileId): fileId is string => Boolean(fileId)
            )
        )
    );

    const doctorIds = [
        ...radiographRows.map((row) => row.doctorId),
        ...uploadFiles
            .map((file) => file.uploadedBy)
            .filter((id): id is string => Boolean(id)),
    ];

    const recordFileIds = [
        ...new Set(
            radiographRows.flatMap((row) =>
                [row.imageFileId, row.reportFileId].filter(
                    (fileId): fileId is string => Boolean(fileId)
                )
            )
        ),
    ];

    const doctorsById = await getDoctorSummaries(doctorIds);
    const filesById = await getFilesByIds(recordFileIds);

    const recordSummaries = radiographRows.map((row) =>
        toRecordSummary(
            row,
            doctorsById.get(row.doctorId) ?? { id: row.doctorId, name: "" },
            row.imageFileId ? (filesById.get(row.imageFileId) ?? null) : null,
            row.reportFileId ? (filesById.get(row.reportFileId) ?? null) : null
        )
    );

    const uploadSummaries = uploadFiles
        .filter((file) => !linkedFileIds.has(file.id))
        .map((file) =>
            toUploadSummary(
                file,
                file.uploadedBy
                    ? (doctorsById.get(file.uploadedBy) ?? {
                          id: file.uploadedBy,
                          name: "",
                      })
                    : { id: "", name: "" }
            )
        );

    return [...recordSummaries, ...uploadSummaries].sort(
        (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime()
    );
};

export const buildRadiographTimelineEvents = (
    radiographRows: RadiographRow[],
    filesById: Map<string, FileRecord>,
    uploadFiles: FileRecord[] = []
): RadiographTimelineEvent[] => {
    const events: RadiographTimelineEvent[] = [];

    for (const row of radiographRows) {
        events.push({
            type: "radiograph_created",
            date: row.createdAt.toISOString(),
        });

        if (row.scheduledDate) {
            events.push({
                type: "radiograph_scheduled",
                date: row.scheduledDate.toISOString(),
            });
        }

        if (row.imageFileId) {
            const imageFile = filesById.get(row.imageFileId);
            events.push({
                type: "radiograph_image_uploaded",
                date: (imageFile?.createdAt ?? row.createdAt).toISOString(),
            });
        }

        if (row.status === "acquired" || row.status === "reported") {
            events.push({
                type: "radiograph_acquired",
                date: row.createdAt.toISOString(),
            });
        }

        if (row.status === "reported" || row.reportFileId || row.reportText) {
            const reportFile = row.reportFileId
                ? filesById.get(row.reportFileId)
                : undefined;
            events.push({
                type: "radiograph_reported",
                date: (reportFile?.createdAt ?? row.createdAt).toISOString(),
            });
        }
    }

    for (const file of uploadFiles) {
        events.push({
            type: "radiograph_uploaded",
            date: file.createdAt.toISOString(),
        });

        if (file.status === "uploaded") {
            events.push({
                type: "radiograph_image_uploaded",
                date: file.updatedAt.toISOString(),
            });
        }
    }

    return events;
};

export const getRadiographTimelineEventsForPatient = async (
    patientId: string
) => {
    const radiographRows = await db
        .select()
        .from(radiographs)
        .where(eq(radiographs.patientId, patientId));

    const uploadFiles = await listRadiographUploadFilesByPatientId(patientId);

    const linkedFileIds = new Set(
        radiographRows.flatMap((row) =>
            [row.imageFileId, row.reportFileId].filter(
                (fileId): fileId is string => Boolean(fileId)
            )
        )
    );

    const fileIds = [
        ...new Set(
            radiographRows.flatMap((row) =>
                [row.imageFileId, row.reportFileId].filter(
                    (fileId): fileId is string => Boolean(fileId)
                )
            )
        ),
    ];
    const filesById = await getFilesByIds(fileIds);

    const standaloneUploads = uploadFiles.filter(
        (file) => !linkedFileIds.has(file.id)
    );

    return buildRadiographTimelineEvents(
        radiographRows,
        filesById,
        standaloneUploads
    );
};
