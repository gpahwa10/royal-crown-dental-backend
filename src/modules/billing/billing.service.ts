import {
    and,
    count,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    or,
    SQL,
} from "drizzle-orm";
import { db } from "../../db/client";
import { clinicVisits } from "../../db/schema/clinicVisits";
import { clinics } from "../../db/schema/clinic";
import { invoiceItems } from "../../db/schema/invoices_items";
import { invoices } from "../../db/schema/invoices";
import { patients } from "../../db/schema/patients";
import { patientMemberships } from "../../db/schema/patientMemberships";
import { payments } from "../../db/schema/payments";
import { serviceCatalog } from "../../db/schema/serviceCatalog";
import { generateInvoicePdfBuffer } from "../../lib/invoicePdf";
import { getActiveMembershipBenefitsForPatient } from "../membership/membership.benefits";
import { uploadServerGeneratedFile } from "../uploads/uploads.service";
import {
    calculateInvoiceLines,
    InvoiceLineInput,
    resolveInvoiceStatus,
} from "./billing.calculator";
import { InvoiceSourceType, InvoiceStatus } from "./billing.constants";
import { generateInvoiceNumber } from "./billing.utils";

export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type PaymentRow = typeof payments.$inferSelect;

export interface CreateInvoiceInput {
    patientId: string;
    clinicId: string;
    clinicVisitId?: string;
    sourceType?: InvoiceSourceType;
    sourceId?: string | null;
    manualDiscount?: number;
    items: InvoiceLineInput[];
    generatedBy?: string;
    skipMembershipDiscount?: boolean;
}

export interface UpdateInvoiceInput {
    items: InvoiceLineInput[];
    manualDiscount?: number;
}

export interface RecordInvoicePaymentInput {
    amount: number;
    paymentMethod: PaymentRow["paymentMethod"];
    paymentReference?: string;
    paymentDate?: Date;
    receivedBy?: string;
    notes?: string;
}

export type InvoiceDetails = {
    invoice: InvoiceRow;
    items: InvoiceItemRow[];
    payments: PaymentRow[];
    patient: { id: string; name: string; patientCode: string };
    clinic: { id: string; clinicName: string };
    invoicePdfFileId: string | null;
};

const assertPatientExists = async (patientId: string) => {
    const [patient] = await db
        .select({
            id: patients.id,
            clinicId: patients.clinicId,
            name: patients.name,
            patientCode: patients.patientCode,
        })
        .from(patients)
        .where(eq(patients.id, patientId));

    if (!patient) {
        throw new Error("Patient not found");
    }

    return patient;
};

const assertClinicExists = async (clinicId: string) => {
    const [clinic] = await db
        .select({ id: clinics.id, clinicName: clinics.clinicName })
        .from(clinics)
        .where(eq(clinics.id, clinicId));

    if (!clinic) {
        throw new Error("Clinic not found");
    }

    return clinic;
};

const assertClinicVisitForInvoice = async (
    clinicVisitId: string,
    clinicId: string,
    patientId: string
) => {
    const [visit] = await db
        .select({
            id: clinicVisits.id,
            clinicId: clinicVisits.clinicId,
            patientId: clinicVisits.patientId,
        })
        .from(clinicVisits)
        .where(eq(clinicVisits.id, clinicVisitId));

    if (!visit) {
        throw new Error("Clinic visit not found");
    }

    if (visit.clinicId !== clinicId) {
        throw new Error("Clinic visit does not belong to the selected clinic");
    }

    if (visit.patientId && visit.patientId !== patientId) {
        throw new Error("Clinic visit patient does not match invoice patient");
    }

    return visit;
};

export const getInvoiceRecord = async (id: string) => {
    const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

    if (!invoice) {
        throw new Error("Invoice not found");
    }

    return invoice;
};

const getInvoiceItems = async (invoiceId: string) =>
    db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId));

const getInvoicePayments = async (invoiceId: string) =>
    db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId))
        .orderBy(desc(payments.paymentDate));

export const listPaymentsForInvoice = getInvoicePayments;

const attachInvoicePdf = async (
    invoice: InvoiceRow,
    patientName: string,
    clinicName: string,
    items: InvoiceItemRow[]
) => {
    const buffer = await generateInvoicePdfBuffer({
        invoiceNumber: invoice.invoiceNumber,
        patientName,
        clinicName,
        createdAt: invoice.createdAt,
        items: items.map((item) => ({
            serviceName: item.serviceName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
        })),
        subtotal: invoice.subtotal,
        membershipDiscount: invoice.membershipDiscount,
        manualDiscount: invoice.manualDiscount,
        taxAmount: invoice.taxAmount,
        grandTotal: invoice.grandTotal,
        amountPaid: invoice.amountPaid,
        balanceAmount: invoice.balanceAmount,
        status: invoice.status,
    });

    const file = await uploadServerGeneratedFile({
        patientId: invoice.patientId,
        clinicId: invoice.clinicId,
        documentType: "invoice",
        fileName: `${invoice.invoiceNumber}.pdf`,
        contentType: "application/pdf",
        buffer,
        uploadedBy: invoice.generatedBy ?? undefined,
    });

    const [updated] = await db
        .update(invoices)
        .set({
            invoicePdfFileId: file.id,
            updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoice.id))
        .returning();

    return updated;
};

export const buildInvoiceDetails = async (
    invoice: InvoiceRow
): Promise<InvoiceDetails> => {
    const patient = await assertPatientExists(invoice.patientId);
    const clinic = await assertClinicExists(invoice.clinicId);
    const items = await getInvoiceItems(invoice.id);
    const paymentRows = await getInvoicePayments(invoice.id);

    return {
        invoice,
        items,
        payments: paymentRows,
        patient: {
            id: patient.id,
            name: patient.name,
            patientCode: patient.patientCode,
        },
        clinic,
        invoicePdfFileId: invoice.invoicePdfFileId,
    };
};

const calculateInvoiceFromCatalog = async (input: {
    clinicId: string;
    patientId: string;
    items: InvoiceLineInput[];
    manualDiscount?: number;
    skipMembershipDiscount?: boolean;
}) => {
    const serviceIds = input.items
        .map((item) => item.serviceId)
        .filter((id): id is string => Boolean(id));
    const uniqueServiceIds = [...new Set(serviceIds)];

    const services =
        uniqueServiceIds.length > 0
            ? await db
                  .select({
                      id: serviceCatalog.id,
                      serviceCode: serviceCatalog.serviceCode,
                      serviceName: serviceCatalog.serviceName,
                  })
                  .from(serviceCatalog)
                  .where(
                      and(
                          inArray(serviceCatalog.id, uniqueServiceIds),
                          eq(serviceCatalog.clinicId, input.clinicId),
                          eq(serviceCatalog.isActive, true)
                      )
                  )
            : [];

    if (services.length !== uniqueServiceIds.length) {
        throw new Error("Service not found");
    }

    const benefitsByServiceCode = input.skipMembershipDiscount
        ? new Map()
        : await getActiveMembershipBenefitsForPatient(input.patientId);

    return calculateInvoiceLines(
        input.items,
        services.map((service) => ({
            serviceId: service.id,
            serviceCode: service.serviceCode,
            serviceName: service.serviceName,
        })),
        benefitsByServiceCode,
        input.manualDiscount ?? 0
    );
};

export const createInvoice = async (input: CreateInvoiceInput) => {
    const patient = await assertPatientExists(input.patientId);
    if (patient.clinicId !== input.clinicId) {
        throw new Error("Patient does not belong to the selected clinic");
    }

    await assertClinicExists(input.clinicId);

    if (input.clinicVisitId) {
        await assertClinicVisitForInvoice(
            input.clinicVisitId,
            input.clinicId,
            input.patientId
        );
    }

    const calculation = await calculateInvoiceFromCatalog({
        clinicId: input.clinicId,
        patientId: input.patientId,
        items: input.items,
        manualDiscount: input.manualDiscount,
        skipMembershipDiscount: input.skipMembershipDiscount,
    });

    const now = new Date();

    const invoice = await db.transaction(async (tx) => {
        const invoiceNumber = await generateInvoiceNumber(tx);

        const [created] = await tx
            .insert(invoices)
            .values({
                invoiceNumber,
                patientId: input.patientId,
                clinicId: input.clinicId,
                sourceType: input.sourceType ?? "manual",
                sourceId: input.sourceId ?? null,
                subtotal: calculation.subtotal,
                membershipDiscount: calculation.membershipDiscount,
                manualDiscount: calculation.manualDiscount,
                taxAmount: calculation.taxAmount,
                grandTotal: calculation.grandTotal,
                amountPaid: 0,
                balanceAmount: calculation.grandTotal,
                status: "pending",
                generatedBy: input.generatedBy ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();

        await tx.insert(invoiceItems).values(
            calculation.lines.map((line) => ({
                invoiceId: created.id,
                serviceId: line.serviceId,
                serviceName: line.serviceName,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount,
                taxPercentage: line.taxPercentage,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
            }))
        );

        return created;
    });

    const items = await getInvoiceItems(invoice.id);
    const clinic = await assertClinicExists(invoice.clinicId);
    const updatedInvoice = await attachInvoicePdf(
        invoice,
        patient.name,
        clinic.clinicName,
        items
    );

    if (input.clinicVisitId) {
        await db
            .update(clinicVisits)
            .set({
                invoiceId: updatedInvoice.id,
                patientId: input.patientId,
                outcome: "billing_completed",
                updatedAt: new Date(),
            })
            .where(eq(clinicVisits.id, input.clinicVisitId));
    }

    return buildInvoiceDetails(updatedInvoice);
};

export const updateInvoice = async (id: string, input: UpdateInvoiceInput) => {
    const invoice = await getInvoiceRecord(id);

    if (invoice.status !== "pending") {
        throw new Error("Only pending invoices can be edited");
    }

    const patient = await assertPatientExists(invoice.patientId);
    const clinic = await assertClinicExists(invoice.clinicId);

    const calculation = await calculateInvoiceFromCatalog({
        clinicId: invoice.clinicId,
        patientId: invoice.patientId,
        items: input.items,
        manualDiscount: input.manualDiscount,
    });

    const now = new Date();

    const updated = await db.transaction(async (tx) => {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));

        await tx.insert(invoiceItems).values(
            calculation.lines.map((line) => ({
                invoiceId: id,
                serviceId: line.serviceId,
                serviceName: line.serviceName,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discountAmount: line.discountAmount,
                taxPercentage: line.taxPercentage,
                taxAmount: line.taxAmount,
                lineTotal: line.lineTotal,
            }))
        );

        const [saved] = await tx
            .update(invoices)
            .set({
                subtotal: calculation.subtotal,
                membershipDiscount: calculation.membershipDiscount,
                manualDiscount: calculation.manualDiscount,
                taxAmount: calculation.taxAmount,
                grandTotal: calculation.grandTotal,
                amountPaid: 0,
                balanceAmount: calculation.grandTotal,
                status: "pending",
                updatedAt: now,
            })
            .where(eq(invoices.id, id))
            .returning();

        return saved;
    });

    const items = await getInvoiceItems(updated.id);
    const withPdf = await attachInvoicePdf(
        updated,
        patient.name,
        clinic.clinicName,
        items
    );

    return buildInvoiceDetails(withPdf);
};

export const listInvoices = async (options: {
    page?: number;
    limit?: number;
    clinicId?: string;
    patientId?: string;
    status?: InvoiceStatus;
    search?: string;
}) => {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;
    const filters: SQL[] = [];

    if (options.clinicId) {
        filters.push(eq(invoices.clinicId, options.clinicId));
    }

    if (options.patientId) {
        filters.push(eq(invoices.patientId, options.patientId));
    }

    if (options.status) {
        filters.push(eq(invoices.status, options.status));
    }

    if (options.search) {
        const term = `%${options.search}%`;
        filters.push(
            or(
                ilike(invoices.invoiceNumber, term),
                ilike(patients.name, term)
            )!
        );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
        .select({ total: count() })
        .from(invoices)
        .innerJoin(patients, eq(invoices.patientId, patients.id))
        .where(whereClause);

    const rows = await db
        .select({ invoice: invoices })
        .from(invoices)
        .innerJoin(patients, eq(invoices.patientId, patients.id))
        .where(whereClause)
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset);

    const items = await Promise.all(
        rows.map((row) => buildInvoiceDetails(row.invoice))
    );

    return { items, total: totalRow?.total ?? 0, page, limit };
};

export const getInvoiceById = async (id: string) => {
    const invoice = await getInvoiceRecord(id);
    return buildInvoiceDetails(invoice);
};

export const cancelInvoice = async (id: string) => {
    const invoice = await getInvoiceRecord(id);

    if (invoice.status === "paid" || invoice.status === "cancelled") {
        throw new Error("Invoice already paid");
    }

    const [updated] = await db
        .update(invoices)
        .set({
            status: "cancelled",
            balanceAmount: 0,
            updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

    return buildInvoiceDetails(updated);
};

export const recordInvoicePayment = async (
    invoiceId: string,
    input: RecordInvoicePaymentInput
) => {
    const invoice = await getInvoiceRecord(invoiceId);

    if (invoice.status === "cancelled" || invoice.status === "refunded") {
        throw new Error("Invoice already paid");
    }

    if (input.amount > invoice.balanceAmount) {
        throw new Error("Invalid payment amount");
    }

    const paymentDate = input.paymentDate ?? new Date();

    const result = await db.transaction(async (tx) => {
        const [payment] = await tx
            .insert(payments)
            .values({
                invoiceId,
                amount: input.amount,
                paymentMethod: input.paymentMethod,
                paymentReference: input.paymentReference,
                paymentDate,
                receivedBy: input.receivedBy ?? null,
                notes: input.notes,
            })
            .returning();

        const amountPaid = invoice.amountPaid + input.amount;
        const balanceAmount = Math.max(0, invoice.grandTotal - amountPaid);
        const status = resolveInvoiceStatus(
            invoice.grandTotal,
            amountPaid,
            invoice.status
        ) as InvoiceStatus;

        const [updatedInvoice] = await tx
            .update(invoices)
            .set({
                amountPaid,
                balanceAmount,
                status,
                updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoiceId))
            .returning();

        return { payment, invoice: updatedInvoice };
    });

    return {
        payment: result.payment,
        invoice: await buildInvoiceDetails(result.invoice),
    };
};

export const listInvoicesByPatientId = async (patientId: string) => {
    await assertPatientExists(patientId);

    const rows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.patientId, patientId))
        .orderBy(desc(invoices.createdAt));

    return Promise.all(rows.map((row) => buildInvoiceDetails(row)));
};

export const getPatientOutstandingBalance = async (patientId: string) => {
    const rows = await db
        .select({ balanceAmount: invoices.balanceAmount })
        .from(invoices)
        .where(
            and(
                eq(invoices.patientId, patientId),
                gte(invoices.balanceAmount, 1),
                or(
                    eq(invoices.status, "pending"),
                    eq(invoices.status, "partially_paid")
                )
            )
        );

    return rows.reduce((sum, row) => sum + row.balanceAmount, 0);
};

export type FinancialTimelineEvent = { type: string; date: string };

export const getFinancialTimelineEventsForPatient = async (
    patientId: string
) => {
    const events: FinancialTimelineEvent[] = [];

    const membershipRows = await db
        .select()
        .from(patientMemberships)
        .where(eq(patientMemberships.patientId, patientId));

    for (const membership of membershipRows) {
        events.push({
            type: "membership_purchased",
            date: membership.purchaseDate.toISOString(),
        });

        if (membership.status === "active" && membership.startDate) {
            events.push({
                type: "membership_activated",
                date: membership.startDate.toISOString(),
            });
        }
    }

    const invoiceRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.patientId, patientId));

    for (const invoice of invoiceRows) {
        events.push({
            type: "invoice_generated",
            date: invoice.createdAt.toISOString(),
        });

        if (invoice.status === "cancelled") {
            events.push({
                type: "invoice_cancelled",
                date: invoice.updatedAt.toISOString(),
            });
        }

        if (invoice.status === "paid") {
            events.push({
                type: "invoice_fully_paid",
                date: invoice.updatedAt.toISOString(),
            });
        }
    }

    const paymentRows = await db
        .select()
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .where(eq(invoices.patientId, patientId));

    for (const row of paymentRows) {
        events.push({
            type: "payment_received",
            date: row.payments.paymentDate.toISOString(),
        });
    }

    return events;
};

export const getPaymentById = async (id: string) => {
    const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, id));

    if (!payment) {
        throw new Error("Payment not found");
    }

    const invoice = await getInvoiceRecord(payment.invoiceId);
    return {
        payment,
        invoice: await buildInvoiceDetails(invoice),
    };
};
