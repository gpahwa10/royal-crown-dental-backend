import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { assertFinancialWriteAccess } from "../billing/billing.utils";
import {
    completeMembershipPayment,
    createMembershipBenefit,
    createMembershipPlan,
    deleteMembershipBenefit,
    deleteMembershipPlan,
    getMembershipPlanById,
    listMembershipPlans,
    purchasePatientMembership,
    updateMembershipBenefit,
    updateMembershipPlan,
} from "./membership.service";
import { handleError } from "./membership.utils";
import {
    completeMembershipPaymentSchema,
    createMembershipBenefitSchema,
    createMembershipPlanSchema,
    membershipBenefitParamsSchema,
    membershipPlanIdParamSchema,
    membershipPlanListQuerySchema,
    patientMembershipIdParamSchema,
    purchasePatientMembershipSchema,
    updateMembershipBenefitSchema,
    updateMembershipPlanSchema,
} from "./membership.validation";

export const createMembershipPlanHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const body = createMembershipPlanSchema.parse(req.body);
        const plan = await createMembershipPlan(body);
        return res.status(201).json({ success: true, data: plan });
    } catch (error) {
        return handleError(res, error);
    }
};

export const listMembershipPlansHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        membershipPlanListQuerySchema.parse(req.query);
        const plans = await listMembershipPlans();
        return res.status(200).json({ success: true, data: plans });
    } catch (error) {
        return handleError(res, error);
    }
};

export const getMembershipPlanHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { id } = membershipPlanIdParamSchema.parse(req.params);
        const plan = await getMembershipPlanById(id);
        return res.status(200).json({ success: true, data: plan });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateMembershipPlanHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = membershipPlanIdParamSchema.parse(req.params);
        const body = updateMembershipPlanSchema.parse(req.body);
        const plan = await updateMembershipPlan(id, body);
        return res.status(200).json({ success: true, data: plan });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteMembershipPlanHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = membershipPlanIdParamSchema.parse(req.params);
        const plan = await deleteMembershipPlan(id);
        return res.status(200).json({ success: true, data: plan });
    } catch (error) {
        return handleError(res, error);
    }
};

export const createMembershipBenefitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = membershipPlanIdParamSchema.parse(req.params);
        const body = createMembershipBenefitSchema.parse(req.body);
        const benefit = await createMembershipBenefit(id, body);
        return res.status(201).json({ success: true, data: benefit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const updateMembershipBenefitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id, benefitId } = membershipBenefitParamsSchema.parse(
            req.params
        );
        const body = updateMembershipBenefitSchema.parse(req.body);
        const benefit = await updateMembershipBenefit(id, benefitId, body);
        return res.status(200).json({ success: true, data: benefit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const deleteMembershipBenefitHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id, benefitId } = membershipBenefitParamsSchema.parse(
            req.params
        );
        const benefit = await deleteMembershipBenefit(id, benefitId);
        return res.status(200).json({ success: true, data: benefit });
    } catch (error) {
        return handleError(res, error);
    }
};

export const purchasePatientMembershipHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const body = purchasePatientMembershipSchema.parse(req.body);

        const result = await purchasePatientMembership({
            ...body,
            purchasedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};

export const completeMembershipPaymentHandler = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        assertFinancialWriteAccess(req);
        const { id } = patientMembershipIdParamSchema.parse(req.params);
        const body = completeMembershipPaymentSchema.parse(req.body);

        const result = await completeMembershipPayment(id, {
            ...body,
            receivedBy: req.employee?.isSuperAdmin
                ? undefined
                : req.employee?.id,
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        return handleError(res, error);
    }
};
