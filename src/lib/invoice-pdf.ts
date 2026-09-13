import PDFDocument from "pdfkit";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/invoice";
import { formatTnd, millimesToTnd } from "@/lib/money";

export type InvoicePdfDoctor = {
	firstName: string | null;
	lastName: string | null;
	cabinetName: string | null;
	address: string | null;
	tin: string | null;
	medicalCouncilNumber: string | null;
	specialityName: string | null;
	cityName: string | null;
};

export type InvoicePdfPatient = {
	firstName: string | null;
	lastName: string | null;
	cin: string | null;
	phoneNumber: string | null;
	address: string | null;
};

export type InvoicePdfData = {
	number: string;
	status: string;
	currency: string;
	totalCentimes: number;
	amountPaidCentimes: number;
	notes: string | null;
	issuedAt: Date | string | null;
	items: {
		description: string;
		quantity: number;
		unitPriceCentimes: number;
	}[];
	payments: {
		amountCentimes: number;
		paymentMethod: string;
		paidAt: Date | string;
	}[];
	doctor: InvoicePdfDoctor;
	patient: InvoicePdfPatient;
};

const STATUS_FR: Record<string, string> = {
	unpaid: "Impayée",
	partially_paid: "Partiellement payée",
	paid: "Payée",
	cancelled: "Annulée",
};

function doctorDisplayName(doctor: InvoicePdfDoctor): string {
	const name = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ");
	return name ? `Dr. ${name}` : "Médecin";
}

function patientDisplayName(patient: InvoicePdfPatient): string {
	const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ");
	return name || "Patient";
}

function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "—";
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleDateString("fr-TN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
}

function formatDateTime(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleString("fr-TN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function paymentMethodFr(method: string): string {
	if (method === "cash") return "Espèces";
	if (method === "transfer") return "Virement";
	return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

/** Build a Tunisian-style invoice PDF (French labels, TND). */
export async function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: "A4",
			margin: 50,
			info: {
				Title: `Facture ${data.number}`,
				Author: doctorDisplayName(data.doctor),
			},
		});
		const chunks: Buffer[] = [];
		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const pageWidth =
			doc.page.width - doc.page.margins.left - doc.page.margins.right;
		const left = doc.page.margins.left;
		const right = left + pageWidth;

		doc
			.font("Helvetica-Bold")
			.fontSize(20)
			.fillColor("#111827")
			.text("FACTURE", left, 50);

		doc
			.font("Helvetica")
			.fontSize(10)
			.fillColor("#4b5563")
			.text(`N° ${data.number}`, right - 200, 52, {
				width: 200,
				align: "right",
			})
			.text(`Date : ${formatDate(data.issuedAt)}`, right - 200, 66, {
				width: 200,
				align: "right",
			})
			.text(
				`Statut : ${STATUS_FR[data.status] ?? data.status}`,
				right - 200,
				80,
				{ width: 200, align: "right" },
			);

		doc.moveTo(left, 105).lineTo(right, 105).strokeColor("#e5e7eb").stroke();

		let y = 120;
		doc
			.font("Helvetica-Bold")
			.fontSize(11)
			.fillColor("#111827")
			.text("Émetteur", left, y);
		y += 16;
		doc
			.font("Helvetica-Bold")
			.fontSize(12)
			.text(doctorDisplayName(data.doctor), left, y);
		y += 16;
		doc.font("Helvetica").fontSize(10).fillColor("#374151");

		const doctorLines = [
			data.doctor.cabinetName,
			data.doctor.specialityName,
			[data.doctor.address, data.doctor.cityName].filter(Boolean).join(", ") ||
				null,
			data.doctor.tin ? `Matricule fiscal : ${data.doctor.tin}` : null,
			data.doctor.medicalCouncilNumber
				? `N° Ordre des médecins : ${data.doctor.medicalCouncilNumber}`
				: null,
		].filter(Boolean) as string[];

		for (const line of doctorLines) {
			doc.text(line, left, y, { width: pageWidth / 2 - 10 });
			y += 14;
		}

		let py = 120;
		const patientX = left + pageWidth / 2 + 10;
		doc
			.font("Helvetica-Bold")
			.fontSize(11)
			.fillColor("#111827")
			.text("Patient", patientX, py);
		py += 16;
		doc
			.font("Helvetica-Bold")
			.fontSize(12)
			.text(patientDisplayName(data.patient), patientX, py, {
				width: pageWidth / 2 - 10,
			});
		py += 16;
		doc.font("Helvetica").fontSize(10).fillColor("#374151");
		const patientLines = [
			data.patient.cin ? `CIN : ${data.patient.cin}` : null,
			data.patient.phoneNumber ? `Tél. : ${data.patient.phoneNumber}` : null,
			data.patient.address,
		].filter(Boolean) as string[];
		for (const line of patientLines) {
			doc.text(line, patientX, py, { width: pageWidth / 2 - 10 });
			py += 14;
		}

		y = Math.max(y, py) + 24;

		const colDesc = left;
		const colQty = left + pageWidth * 0.52;
		const colUnit = left + pageWidth * 0.64;
		const colTotal = left + pageWidth * 0.78;

		doc.rect(left, y - 4, pageWidth, 22).fill("#f3f4f6");
		doc
			.fillColor("#111827")
			.font("Helvetica-Bold")
			.fontSize(9)
			.text("Désignation", colDesc + 4, y + 2, { width: pageWidth * 0.5 })
			.text("Qté", colQty, y + 2, { width: 40, align: "right" })
			.text("P.U. (TND)", colUnit, y + 2, { width: 70, align: "right" })
			.text("Montant", colTotal, y + 2, {
				width: right - colTotal,
				align: "right",
			});

		y += 26;
		doc.font("Helvetica").fontSize(9).fillColor("#1f2937");

		for (const item of data.items) {
			const lineTotal = item.quantity * item.unitPriceCentimes;
			const descHeight = doc.heightOfString(item.description, {
				width: pageWidth * 0.5,
			});
			const rowHeight = Math.max(16, descHeight + 4);

			if (y + rowHeight > doc.page.height - 120) {
				doc.addPage();
				y = 50;
			}

			doc.text(item.description, colDesc + 4, y, { width: pageWidth * 0.5 });
			doc.text(String(item.quantity), colQty, y, { width: 40, align: "right" });
			doc.text(millimesToTnd(item.unitPriceCentimes).toFixed(3), colUnit, y, {
				width: 70,
				align: "right",
			});
			doc.text(millimesToTnd(lineTotal).toFixed(3), colTotal, y, {
				width: right - colTotal,
				align: "right",
			});
			y += rowHeight + 4;
		}

		y += 8;
		doc.moveTo(left, y).lineTo(right, y).strokeColor("#e5e7eb").stroke();
		y += 12;

		const remaining = Math.max(0, data.totalCentimes - data.amountPaidCentimes);
		const totals = [
			["Total", formatTnd(data.totalCentimes, data.currency)],
			["Payé", formatTnd(data.amountPaidCentimes, data.currency)],
			["Reste à payer", formatTnd(remaining, data.currency)],
		] as const;

		for (const [label, value] of totals) {
			doc
				.font(label === "Total" ? "Helvetica-Bold" : "Helvetica")
				.fontSize(10)
				.fillColor("#111827")
				.text(label, colUnit - 20, y, { width: 90, align: "right" })
				.text(value, colTotal, y, {
					width: right - colTotal,
					align: "right",
				});
			y += 16;
		}

		if (data.payments.length > 0) {
			y += 16;
			doc.font("Helvetica-Bold").fontSize(11).text("Paiements", left, y);
			y += 16;
			doc.font("Helvetica").fontSize(9).fillColor("#374151");
			for (const payment of data.payments) {
				doc.text(
					`${formatDateTime(payment.paidAt)}  ·  ${paymentMethodFr(payment.paymentMethod)}  ·  ${formatTnd(payment.amountCentimes, data.currency)}`,
					left,
					y,
					{ width: pageWidth },
				);
				y += 14;
			}
		}

		if (data.notes?.trim()) {
			y += 16;
			doc
				.font("Helvetica-Bold")
				.fontSize(11)
				.fillColor("#111827")
				.text("Notes", left, y);
			y += 14;
			doc
				.font("Helvetica")
				.fontSize(9)
				.fillColor("#374151")
				.text(data.notes.trim(), left, y, { width: pageWidth });
		}

		const footerY = doc.page.height - 50;
		doc
			.font("Helvetica")
			.fontSize(8)
			.fillColor("#9ca3af")
			.text(
				"Document généré par Riaya — facture à titre informatif.",
				left,
				footerY,
				{ width: pageWidth, align: "center" },
			);

		doc.end();
	});
}
