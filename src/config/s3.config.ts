const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};

export const s3Config = {
    get region() {
        return requireEnv("AWS_REGION");
    },
    get bucket() {
        return requireEnv("S3_BUCKET_NAME");
    },
    get accessKeyId() {
        return requireEnv("AWS_ACCESS_KEY_ID");
    },
    get secretAccessKey() {
        return requireEnv("AWS_SECRET_ACCESS_KEY");
    },
    get presignExpiresInSeconds() {
        const value = process.env.S3_PRESIGN_EXPIRES_IN_SECONDS;
        if (!value) {
            return 900;
        }

        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed) || parsed < 60 || parsed > 3600) {
            return 900;
        }

        return parsed;
    },
};
