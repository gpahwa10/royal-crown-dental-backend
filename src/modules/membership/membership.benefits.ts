import { and, eq, gte } from "drizzle-orm";
import { db } from "../../db/client";
import { membershipPlanBenefits } from "../../db/schema/membershipPlanBenefits";
import { membershipPlans } from "../../db/schema/membershipPlans";
import { patientMemberships } from "../../db/schema/patientMemberships";
import { MembershipBenefitSnapshot } from "../billing/billing.calculator";

export const getActivePatientMembership = async (patientId: string) => {
    const now = new Date();

    const [row] = await db
        .select({
            membership: patientMemberships,
            plan: membershipPlans,
        })
        .from(patientMemberships)
        .innerJoin(
            membershipPlans,
            eq(patientMemberships.membershipPlanId, membershipPlans.id)
        )
        .where(
            and(
                eq(patientMemberships.patientId, patientId),
                eq(patientMemberships.status, "active"),
                gte(patientMemberships.expiryDate, now)
            )
        )
        .limit(1);

    return row ?? null;
};

export const getActiveMembershipBenefitsForPatient = async (
    patientId: string
) => {
    const active = await getActivePatientMembership(patientId);
    if (!active) {
        return new Map<string, MembershipBenefitSnapshot>();
    }

    const benefits = await db
        .select()
        .from(membershipPlanBenefits)
        .where(
            eq(membershipPlanBenefits.membershipPlanId, active.plan.id)
        );

    const map = new Map<string, MembershipBenefitSnapshot>();
    for (const benefit of benefits) {
        map.set(benefit.serviceCode, {
            serviceCode: benefit.serviceCode,
            discountType: benefit.discountType,
            discountValue: benefit.discountValue,
        });
    }

    return map;
};
