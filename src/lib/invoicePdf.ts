import PDFDocument from "pdfkit";

export type InvoicePdfData = {
    invoiceNumber: string;
    patientName: string;
    clinicName: string;
    createdAt: Date;
    items: {
        serviceName: string;
        quantity: number;
        unitPrice: number;
        discountAmount: number;
        taxAmount: number;
        lineTotal: number;
    }[];
    subtotal: number;
    membershipDiscount: number;
    manualDiscount: number;
    taxAmount: number;
    grandTotal: number;
    amountPaid: number;
    balanceAmount: number;
    status: string;
};

const formatMoney = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

export const generateInvoicePdfBuffer = (data: InvoicePdfData): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.fontSize(20).text("TAX INVOICE", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Invoice #: ${data.invoiceNumber}`);
        doc.text(`Date: ${data.createdAt.toISOString().slice(0, 10)}`);
        doc.text(`Clinic: ${data.clinicName}`);
        doc.text(`Patient: ${data.patientName}`);
        doc.text(`Status: ${data.status}`);
        doc.moveDown();

        doc.fontSize(11).text("Items", { underline: true });
        doc.moveDown(0.5);

        for (const item of data.items) {
            doc.text(
                `${item.serviceName} x${item.quantity} @ ${formatMoney(item.unitPrice)}`
            );
            doc.text(
                `  Discount: ${formatMoney(item.discountAmount)} | Tax: ${formatMoney(item.taxAmount)} | Total: ${formatMoney(item.lineTotal)}`
            );
            doc.moveDown(0.3);
        }

        doc.moveDown();
        doc.text(`Subtotal: ${formatMoney(data.subtotal)}`);
        doc.text(`Membership Discount: -${formatMoney(data.membershipDiscount)}`);
        doc.text(`Manual Discount: -${formatMoney(data.manualDiscount)}`);
        doc.text(`Tax: ${formatMoney(data.taxAmount)}`);
        doc.fontSize(13).text(`Grand Total: ${formatMoney(data.grandTotal)}`);
        doc.fontSize(12).text(`Amount Paid: ${formatMoney(data.amountPaid)}`);
        doc.text(`Balance: ${formatMoney(data.balanceAmount)}`);

        doc.end();
    });
