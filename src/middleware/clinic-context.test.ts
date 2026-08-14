import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

vi.stubEnv("CLINIC_ID", "7bd1c9c8-b192-425c-805b-c07aa15cb5ed");

describe("clinicContext", () => {
    it("sets req.clinicId from configuration and ignores client input", async () => {
        const { clinicContext } = await import("./clinic-context");
        const req = {
            body: { clinicId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
            query: { clinicId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
            params: { clinicId: "cccccccc-cccc-cccc-cccc-cccccccccccc" },
        } as unknown as AuthRequest;
        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        clinicContext(req, res, next);

        expect(req.clinicId).toBe("7bd1c9c8-b192-425c-805b-c07aa15cb5ed");
        expect(next).toHaveBeenCalledOnce();
    });
});
