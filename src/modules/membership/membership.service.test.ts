import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { membershipPlanBenefits } from "../../db/schema/membershipPlanBenefits";
import { membershipPlans } from "../../db/schema/membershipPlans";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import { appConfig } from "../../config/app.config";
import {
    getMembershipPlanById,
    listMembershipPlans,
} from "./membership.service";

describe("membership plan benefits in responses", () => {
    let planId: string;
    let serviceCode: string;

    beforeAll(async () => {
        const unique = Date.now().toString();
        serviceCode = `BEN${unique.slice(-6)}`;

        const [service] = await db
            .insert(serviceCatalog)
            .values({
                serviceCode,
                serviceName: `Benefit Test Service ${unique}`,
                category: "clinical",
                clinicId: appConfig.clinicId,
                isActive: true,
            })
            .returning();

        const [plan] = await db
            .insert(membershipPlans)
            .values({
                planCode: `PLAN${unique.slice(-6)}`,
                planName: `Plan Benefits Test ${unique}`,
                price: 1000,
                validityDays: 365,
                isActive: true,
            })
            .returning();
        planId = plan.id;

        await db.insert(membershipPlanBenefits).values({
            membershipPlanId: planId,
            serviceCode: service.serviceCode,
            discountType: "percentage",
            discountValue: 50,
        });
    });

    afterAll(async () => {
        await db
            .delete(membershipPlanBenefits)
            .where(eq(membershipPlanBenefits.membershipPlanId, planId));
        await db.delete(membershipPlans).where(eq(membershipPlans.id, planId));
        await db
            .delete(serviceCatalog)
            .where(eq(serviceCatalog.serviceCode, serviceCode));
    });

    it("includes benefits when listing membership plans", async () => {
        const plans = await listMembershipPlans();
        const plan = plans.find((item) => item.id === planId);

        expect(plan).toBeDefined();
        expect(plan?.benefits?.length).toBeGreaterThan(0);
        expect(plan?.benefits?.[0]?.serviceCode).toBe(serviceCode);
    });

    it("returns a flat plan with benefits on get by id", async () => {
        const plan = await getMembershipPlanById(planId);

        expect(plan.id).toBe(planId);
        expect(plan.benefits?.length).toBeGreaterThan(0);
        expect(plan.benefits?.[0]?.serviceCode).toBe(serviceCode);
    });
});
