import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import type { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

const CONFIGURED = "7bd1c9c8-b192-425c-805b-c07aa15cb5ed";
const OTHER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

vi.stubEnv("CLINIC_ID", CONFIGURED);
vi.stubEnv("JWT_SECRET", "test-secret");

vi.mock("../modules/auth/auth.service", () => ({
    hasSuperAdmins: vi.fn(),
}));

describe("authenticate clinic check", () => {
    it("rejects an employee JWT from another clinic", async () => {
        const { authenticate } = await import("./auth.middleware");
        const token = jwt.sign(
            {
                id: "emp-1",
                clinicId: OTHER,
                roles: ["Doctor"],
                isSuperAdmin: false,
            },
            "test-secret"
        );

        const req = {
            headers: { authorization: `Bearer ${token}` },
            originalUrl: "/api/patients",
        } as unknown as AuthRequest;

        const json = vi.fn();
        const status = vi.fn(() => ({ json }));
        const res = { status } as unknown as Response;
        const next = vi.fn() as NextFunction;

        authenticate(req, res, next);

        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "You cannot access another clinic",
        });
        expect(next).not.toHaveBeenCalled();
    });

    it("allows a super admin JWT", async () => {
        const { authenticate } = await import("./auth.middleware");
        const token = jwt.sign(
            {
                id: "admin-1",
                clinicId: null,
                roles: [],
                isSuperAdmin: true,
            },
            "test-secret"
        );

        const req = {
            headers: { authorization: `Bearer ${token}` },
            originalUrl: "/api/patients",
        } as unknown as AuthRequest;

        const res = {} as Response;
        const next = vi.fn() as NextFunction;

        authenticate(req, res, next);

        expect(next).toHaveBeenCalledOnce();
    });
});
