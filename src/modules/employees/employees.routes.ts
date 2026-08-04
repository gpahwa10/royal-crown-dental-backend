import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { requireHRRegistration } from "../../middleware/hrRegistration.middleware";
import {
    requireEmployeeListAccess,
    requireEmployeeManagementAccess,
    requireStaffRegistration,
} from "../../middleware/staffRegistration.middleware";
import {
    editEmployeeHandler,
    listEmployeesHandler,
    registerHRHandler,
    registerStaffHandler,
    suspendEmployeeHandler,
    activateEmployeeHandler,
    blockEmployeeHandler,
    getEmployeeWorkingHoursHandler,
    putEmployeeWorkingHoursHandler,
} from "./employees.controller";

const router = Router();

// Staff: HR Head, HR Assistant, Director, or super admin
router.post(
    "/staff/register",
    authenticate,
    requireStaffRegistration,
    registerStaffHandler
);

// HR: Director or super admin only
router.post(
    "/hr/register",
    authenticate,
    requireHRRegistration,
    registerHRHandler
);

// List: HR Head, HR Assistant, Director, super admin, Lab Technician, or Phlebotomist
router.get(
    "/list",
    authenticate,
    requireEmployeeListAccess,
    listEmployeesHandler
);

router.get(
    "/:id/working-hours",
    authenticate,
    requireEmployeeListAccess,
    getEmployeeWorkingHoursHandler
);

router.put(
    "/:id/working-hours",
    authenticate,
    requireStaffRegistration,
    putEmployeeWorkingHoursHandler
);

router.put(
    "/edit/:id",
    authenticate,
    requireStaffRegistration,
    editEmployeeHandler 
);

router.put(
    "/block/:id",
    authenticate,
    requireEmployeeManagementAccess,
    blockEmployeeHandler
);

router.put(
    "/suspend/:id",
    authenticate,
    requireStaffRegistration,
    suspendEmployeeHandler
);

router.put(
    "/activate/:id",
    authenticate,
    requireStaffRegistration,
    activateEmployeeHandler
);
export default router;
