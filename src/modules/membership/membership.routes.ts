import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
    completeMembershipPaymentHandler,
    createMembershipBenefitHandler,
    createMembershipPlanHandler,
    deleteMembershipBenefitHandler,
    deleteMembershipPlanHandler,
    getMembershipPlanHandler,
    listMembershipPlansHandler,
    purchasePatientMembershipHandler,
    updateMembershipBenefitHandler,
    updateMembershipPlanHandler,
} from "./membership.controller";

const membershipPlansRouter = Router();
membershipPlansRouter.use(authenticate);

membershipPlansRouter.post("/", createMembershipPlanHandler);
membershipPlansRouter.get("/", listMembershipPlansHandler);
membershipPlansRouter.get("/:id", getMembershipPlanHandler);
membershipPlansRouter.patch("/:id", updateMembershipPlanHandler);
membershipPlansRouter.delete("/:id", deleteMembershipPlanHandler);
membershipPlansRouter.post("/:id/benefits", createMembershipBenefitHandler);
membershipPlansRouter.patch(
    "/:id/benefits/:benefitId",
    updateMembershipBenefitHandler
);
membershipPlansRouter.delete(
    "/:id/benefits/:benefitId",
    deleteMembershipBenefitHandler
);

const patientMembershipsRouter = Router();
patientMembershipsRouter.use(authenticate);

patientMembershipsRouter.post("/", purchasePatientMembershipHandler);
patientMembershipsRouter.post(
    "/:id/payment",
    completeMembershipPaymentHandler
);

export { membershipPlansRouter, patientMembershipsRouter };
