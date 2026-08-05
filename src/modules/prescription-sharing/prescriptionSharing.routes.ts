import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/auth.middleware";
import { MAX_PRESCRIPTION_PDF_BYTES } from "./prescriptionSharing.constants";
import {
    downloadPrescriptionFileHandler,
    getPrescriptionFileHandler,
    uploadPrescriptionHandler,
} from "./prescriptionSharing.controller";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PRESCRIPTION_PDF_BYTES },
    fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || "").toLowerCase();
        if (
            mime === "application/pdf" ||
            mime === "application/x-pdf" ||
            mime === ""
        ) {
            cb(null, true);
            return;
        }
        cb(new Error("Only PDF files are allowed"));
    },
});

const handleMulterError = (
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!err) {
        next();
        return;
    }

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
                success: false,
                message: "PDF file must be 10 MB or smaller",
            });
            return;
        }
        res.status(400).json({ success: false, message: err.message });
        return;
    }

    if (err instanceof Error) {
        res.status(400).json({ success: false, message: err.message });
        return;
    }

    res.status(400).json({ success: false, message: "Upload failed" });
};

const router = Router();

router.post(
    "/upload",
    authenticate,
    (req, res, next) => {
        upload.single("file")(req, res, (err) => handleMulterError(err, req, res, next));
    },
    uploadPrescriptionHandler
);

router.get("/:id/file", authenticate, getPrescriptionFileHandler);
router.get("/:id/file/download", authenticate, downloadPrescriptionFileHandler);

export default router;
