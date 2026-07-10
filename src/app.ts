import express from 'express';
import cors from 'cors';
import authRoutes from "./modules/auth/auth.routes";
import employeesRoutes from "./modules/employees/employees.routes";
import clinicsRoutes from "./modules/clinics/clinics.routes";
import patientsRoutes from './modules/patients/patients.routes';
import inventoryRoutes from "./modules/inventory/inventory.routes";
import leadsRoutes from "./modules/leads/leads.routes";
import appointmentsRoutes from "./modules/appointments/appointments.routes";
import consultationsRoutes from "./modules/consultations/consultations.routes";
import prescriptionsRoutes from "./modules/prescriptions/prescriptions.routes";
import labRequestsRoutes from "./modules/lab-requests/labRequests.routes";
import dentalLabOrdersRoutes from "./modules/dental-lab/dentalLab.routes";
import uploadsRoutes from "./modules/uploads/uploads.routes";
import clinicVisitsRoutes from "./modules/clinic-visits/clinicVisit.routes";
import serviceCatalogRoutes from "./modules/service-catalog/serviceCatalog.routes";
import billingRoutes from "./modules/billing/billing.routes";
import {
    membershipPlansRouter,
    patientMembershipsRouter,
} from "./modules/membership/membership.routes";
import paymentsRoutes, {
    invoicePaymentsRouter,
} from "./modules/payments/payments.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";

export const app = express();
app.use(
    cors({
        origin: [
          "http://localhost:5173",
        ],
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
      })
);

app.use(express.json());
app.get('/health', (req, res) => {
    res.send('OK');
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/clinics", clinicsRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/consultations", consultationsRoutes);
app.use("/api/prescriptions", prescriptionsRoutes);
app.use("/api/lab-requests", labRequestsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/dental-lab-orders", dentalLabOrdersRoutes);
app.use("/api/clinic-visits", clinicVisitsRoutes);
app.use("/api/services", serviceCatalogRoutes);
app.use("/api/membership-plans", membershipPlansRouter);
app.use("/api/patient-memberships", patientMembershipsRouter);
app.use("/api/invoices", billingRoutes);
app.use("/api/invoices", invoicePaymentsRouter);
app.use("/api/payments", paymentsRoutes);
app.use("/api/analytics", analyticsRoutes);