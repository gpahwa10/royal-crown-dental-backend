import { describe, expect, it, vi } from "vitest";

vi.stubEnv("CLINIC_ID", "7bd1c9c8-b192-425c-805b-c07aa15cb5ed");

describe("resolveEffectiveScope", () => {
    it("always scopes analytics to CLINIC_ID and ignores query clinicId", async () => {
        const { resolveEffectiveScope } = await import("./analytics.utils");
        const scope = resolveEffectiveScope({
            req: {
                employee: {
                    id: "admin",
                    clinicId: null,
                    roles: [],
                    isSuperAdmin: true,
                },
            } as never,
            clinicId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            doctorId: undefined,
        });

        expect(scope.clinicId).toBe("7bd1c9c8-b192-425c-805b-c07aa15cb5ed");
        expect(scope.isPlatformAdmin).toBe(true);
    });
});
