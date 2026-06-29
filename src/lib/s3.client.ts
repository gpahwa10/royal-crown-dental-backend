import {
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Config } from "../config/s3.config";

let s3Client: S3Client | null = null;

export const getS3Client = () => {
    if (!s3Client) {
        s3Client = new S3Client({
            region: s3Config.region,
            credentials: {
                accessKeyId: s3Config.accessKeyId,
                secretAccessKey: s3Config.secretAccessKey,
            },
        });
    }

    return s3Client;
};

export const createUploadPresignedUrl = async (input: {
    bucket: string;
    objectKey: string;
    contentType: string;
}) => {
    const command = new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
        ContentType: input.contentType,
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, {
        expiresIn: s3Config.presignExpiresInSeconds,
    });

    return {
        uploadUrl,
        expiresIn: s3Config.presignExpiresInSeconds,
    };
};

export const createDownloadPresignedUrl = async (input: {
    bucket: string;
    objectKey: string;
}) => {
    const command = new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
    });

    const downloadUrl = await getSignedUrl(getS3Client(), command, {
        expiresIn: s3Config.presignExpiresInSeconds,
    });

    return {
        downloadUrl,
        expiresIn: s3Config.presignExpiresInSeconds,
    };
};

export const verifyObjectExists = async (input: {
    bucket: string;
    objectKey: string;
}) => {
    const response = await getS3Client().send(
        new HeadObjectCommand({
            Bucket: input.bucket,
            Key: input.objectKey,
        })
    );

    return {
        contentType: response.ContentType,
        fileSize: response.ContentLength,
    };
};

export const buildObjectKey = (input: {
    clinicId: string;
    patientId: string;
    documentType: string;
    fileId: string;
    originalFileName: string;
}) => {
    const sanitizedFileName = input.originalFileName
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 180);

    return `clinics/${input.clinicId}/patients/${input.patientId}/${input.documentType}/${input.fileId}/${sanitizedFileName}`;
};

export const putObjectBuffer = async (input: {
    bucket: string;
    objectKey: string;
    contentType: string;
    body: Buffer;
}) => {
    await getS3Client().send(
        new PutObjectCommand({
            Bucket: input.bucket,
            Key: input.objectKey,
            ContentType: input.contentType,
            Body: input.body,
        })
    );
};
