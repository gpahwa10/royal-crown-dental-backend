import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { invoices } from "../../db/schema/invoices";
import { membershipPlanBenefits } from "../../db/schema/membershipPlanBenefits";
import { membershipPlans } from "../../db/schema/membershipPlans";
import { patientMemberships } from "../../db/schema/patientMemberships";
import { patients } from "../../db/schema/patients";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import {
    createInvoice,
    recordInvoicePayment,
} from "../billing/billing.service";
import { getActivePatientMembership } from "./membership.benefits";
import { MembershipDiscountType } from "./membership.constants";

export { getActivePatientMembership } from "./membership.benefits";

export interface CreateMembershipPlanInput {
    planCode: string;
    planName: string;
    description?: string;
    price: number;
    validityDays: number;
}

export interface UpdateMembershipPlanInput {
    planName?: string;
    description?: string | null;
    price?: number;
    validityDays?: number;
    isActive?: boolean;
}

export interface CreateMembershipBenefitInput {
    serviceCode: string;
    discountType: MembershipDiscountType;
    discountValue: number;
}

export interface PurchasePatientMembershipInput {
    patientId: string;
    membershipPlanId: string;
    purchasedBy?: string;
}

export interface CompleteMembershipPaymentInput {
    amount: number;
    paymentMethod: "cash" | "upi" | "card" | "finance" | "bank_transfer" | "cheque";
    paymentReference?: string;
    paymentDate?: Date;
    receivedBy?: string;
    notes?: string;
}

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

export const getMembershipPlanRecord = async (id: string) => {
    const [plan] = await db
        .select()
        .from(membershipPlans)
        .where(eq(membershipPlans.id, id));

    if (!plan) {
        throw new Error("Membership plan not found");
    }

    return plan;
};

export const getPatientMembershipRecord = async (id: string) => {
    const [membership] = await db
        .select()
        .from(patientMemberships)
        .where(eq(patientMemberships.id, id));

    if (!membership) {
        throw new Error("Patient membership not found");
    }

    return membership;
};

const assertNoActiveMembership = async (patientId: string) => {
    const active = await getActivePatientMembership(patientId);
    if (active) {
        throw new Error("Duplicate active membership");
    }
};

export const createMembershipPlan = async (
    input: CreateMembershipPlanInput
) => {
    const planCode = input.planCode.toUpperCase();

    const [existing] = await db
        .select({ id: membershipPlans.id })
        .from(membershipPlans)
        .where(eq(membershipPlans.planCode, planCode))
        .limit(1);

    if (existing) {
        throw new Error("Membership plan code already exists");
    }

    const now = new Date();

    const [plan] = await db
        .insert(membershipPlans)
        .values({
            ...input,
            planCode,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    return plan;
};

export const listMembershipPlans = async () =>
    db
        .select()
        .from(membershipPlans)
        .orderBy(desc(membershipPlans.createdAt));

export const getMembershipPlanById = async (id: string) => {
    const plan = await getMembershipPlanRecord(id);
    const benefits = await db
        .select()
        .from(membershipPlanBenefits)
        .where(eq(membershipPlanBenefits.membershipPlanId, id));

    return { plan, benefits };
};

export const updateMembershipPlan = async (
    id: string,
    input: UpdateMembershipPlanInput
) => {
    await getMembershipPlanRecord(id);

    const [plan] = await db
        .update(membershipPlans)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(membershipPlans.id, id))
        .returning();

    return plan;
};

export const deleteMembershipPlan = async (id: string) => {
    await getMembershipPlanRecord(id);

    const [plan] = await db
        .update(membershipPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(membershipPlans.id, id))
        .returning();

    return plan;
};

export const createMembershipBenefit = async (
    planId: string,
    input: CreateMembershipBenefitInput
) => {
    await getMembershipPlanRecord(planId);

    const serviceCode = input.serviceCode.toUpperCase();

    const [service] = await db
        .select({ serviceCode: serviceCatalog.serviceCode })
        .from(serviceCatalog)
        .where(eq(serviceCatalog.serviceCode, serviceCode))
        .limit(1);

    if (!service) {
        throw new Error("Service not found");
    }

    if (input.discountType === "percentage" && input.discountValue > 100) {
        throw new Error("Invalid discount configuration");
    }

    const [benefit] = await db
        .insert(membershipPlanBenefits)
        .values({
            membershipPlanId: planId,
            serviceCode,
            discountType: input.discountType,
            discountValue: input.discountValue,
        })
        .returning();

    return benefit;
};

export const updateMembershipBenefit = async (
    planId: string,
    benefitId: string,
    input: Partial<CreateMembershipBenefitInput>
) => {
    await getMembershipPlanRecord(planId);

    const [benefit] = await db
        .update(membershipPlanBenefits)
        .set({
            ...(input.serviceCode !== undefined && {
                serviceCode: input.serviceCode.toUpperCase(),
            }),
            ...(input.discountType !== undefined && {
                discountType: input.discountType,
            }),
            ...(input.discountValue !== undefined && {
                discountValue: input.discountValue,
            }),
        })
        .where(
            and(
                eq(membershipPlanBenefits.id, benefitId),
                eq(membershipPlanBenefits.membershipPlanId, planId)
            )
        )
        .returning();

    if (!benefit) {
        throw new Error("Membership benefit not found");
    }

    return benefit;
};

export const deleteMembershipBenefit = async (
    planId: string,
    benefitId: string
) => {
    await getMembershipPlanRecord(planId);

    const [benefit] = await db
        .delete(membershipPlanBenefits)
        .where(
            and(
                eq(membershipPlanBenefits.id, benefitId),
                eq(membershipPlanBenefits.membershipPlanId, planId)
            )
        )
        .returning();

    if (!benefit) {
        throw new Error("Membership benefit not found");
    }

    return benefit;
};

const findOrCreateMembershipService = async (
    clinicId: string,
    planName: string,
    price: number
) => {
    const [existing] = await db
        .select()
        .from(serviceCatalog)
        .where(
            and(
                eq(serviceCatalog.clinicId, clinicId),
                eq(serviceCatalog.serviceCode, "MEMBERSHIP")
            )
        );

    if (existing) {
        return existing;
    }

    const now = new Date();
    const [created] = await db
        .insert(serviceCatalog)
        .values({
            serviceCode: "MEMBERSHIP",
            serviceName: `Membership - ${planName}`,
            category: "Membership",
            clinicId,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    return created;
};

export const purchasePatientMembership = async (
    input: PurchasePatientMembershipInput
) => {
    const patient = await assertPatientExists(input.patientId);
    const clinicId = patient.clinicId;

    const plan = await getMembershipPlanRecord(input.membershipPlanId);
    if (!plan.isActive) {
        throw new Error("Membership plan not found");
    }

    await assertNoActiveMembership(input.patientId);

    const membershipService = await findOrCreateMembershipService(
        clinicId,
        plan.planName,
        plan.price
    );

    const invoiceDetails = await createInvoice({
        patientId: input.patientId,
        clinicId,
        sourceType: "membership",
        sourceId: plan.id,
        items: [{ serviceId: membershipService.id, quantity: 1, unitPrice: plan.price }],
        generatedBy: input.purchasedBy,
        skipMembershipDiscount: true,
    });

    const now = new Date();
    const [membership] = await db
        .insert(patientMemberships)
        .values({
            patientId: input.patientId,
            membershipPlanId: plan.id,
            invoiceId: invoiceDetails.invoice.id,
            purchaseDate: now,
            status: "pending_payment",
            purchasedBy: input.purchasedBy ?? null,
            createdAt: now,
            updatedAt: now,
        })
        .returning();

    return {
        membership,
        plan,
        invoice: invoiceDetails,
    };
};

export const completeMembershipPayment = async (
    membershipId: string,
    input: CompleteMembershipPaymentInput
) => {
    const membership = await getPatientMembershipRecord(membershipId);

    if (membership.status === "active") {
        throw new Error("Membership already active");
    }

    const plan = await getMembershipPlanRecord(membership.membershipPlanId);
    const invoice = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, membership.invoiceId));

    const invoiceRow = invoice[0];
    if (!invoiceRow) {
        throw new Error("Invoice not found");
    }

    const paymentResult = await recordInvoicePayment(membership.invoiceId, {
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentReference: input.paymentReference,
        paymentDate: input.paymentDate,
        receivedBy: input.receivedBy,
        notes: input.notes,
    });

    if (paymentResult.invoice.invoice.balanceAmount > 0) {
        return {
            membership,
            payment: paymentResult.payment,
            invoice: paymentResult.invoice,
            activated: false,
        };
    }

    const startDate = new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + plan.validityDays);

    const [activatedMembership] = await db
        .update(patientMemberships)
        .set({
            status: "active",
            startDate,
            expiryDate,
            updatedAt: new Date(),
        })
        .where(eq(patientMemberships.id, membershipId))
        .returning();

    return {
        membership: activatedMembership,
        payment: paymentResult.payment,
        invoice: paymentResult.invoice,
        activated: true,
    };
};

export const listPatientMemberships = async (patientId: string) => {
    await assertPatientExists(patientId);

    return db
        .select({
            membership: patientMemberships,
            plan: membershipPlans,
        })
        .from(patientMemberships)
        .innerJoin(
            membershipPlans,
            eq(patientMemberships.membershipPlanId, membershipPlans.id)
        )
        .where(eq(patientMemberships.patientId, patientId))
        .orderBy(desc(patientMemberships.createdAt));
};
