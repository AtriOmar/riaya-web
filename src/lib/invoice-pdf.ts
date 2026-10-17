import PDFDocument from "pdfkit";
import { millimesToTnd } from "@/lib/money";

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

// ─── Design tokens ────────────────────────────────────────────────────────────

const COLOR = {
	brand: "#16a34a",
	brandDark: "#166534",
	brandSoft: "#f0fdf4",
	ink: "#111827",
	body: "#374151",
	muted: "#6b7280",
	faint: "#9ca3af",
	line: "#e5e7eb",
	surface: "#f9fafb",
};

const FONT = { regular: "Helvetica", bold: "Helvetica-Bold" };

const PAGE_MARGIN = 48;
const FOOTER_HEIGHT = 56;

const STATUS_STYLE: Record<string, { label: string; fg: string; bg: string }> =
	{
		unpaid: { label: "Impayée", fg: "#b91c1c", bg: "#fef2f2" },
		partially_paid: {
			label: "Partiellement payée",
			fg: "#b45309",
			bg: "#fffbeb",
		},
		paid: { label: "Payée", fg: "#15803d", bg: "#f0fdf4" },
		cancelled: { label: "Annulée", fg: "#4b5563", bg: "#f3f4f6" },
	};

const PAYMENT_METHOD_FR: Record<string, string> = {
	cash: "Espèces",
	transfer: "Virement",
};

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Standard PDF fonts only cover WinAnsi; `fr` locales emit narrow no-break
 *  spaces (U+202F) that render as garbage, so swap them for plain spaces. */
function pdfSafe(text: string): string {
	return text.replace(/[  ]/g, " ");
}

function formatAmount(millimes: number): string {
	return pdfSafe(
		millimesToTnd(millimes).toLocaleString("fr-FR", {
			minimumFractionDigits: 3,
			maximumFractionDigits: 3,
		}),
	);
}

function formatMoney(millimes: number, currency: string): string {
	return `${formatAmount(millimes)} ${currency}`;
}

function toDate(value: Date | string | null | undefined): Date | null {
	if (!value) return null;
	const d = typeof value === "string" ? new Date(value) : value;
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: Date | string | null | undefined): string {
	const d = toDate(value);
	if (!d) return "—";
	return pdfSafe(
		d.toLocaleDateString("fr-FR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
			timeZone: "Africa/Tunis",
		}),
	);
}

function formatShortDate(value: Date | string | null | undefined): string {
	const d = toDate(value);
	if (!d) return "—";
	return d.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "Africa/Tunis",
	});
}

function doctorDisplayName(doctor: InvoicePdfDoctor): string {
	const name = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ");
	return name ? `Dr ${name}` : "Médecin";
}

function patientDisplayName(patient: InvoicePdfPatient): string {
	const name = [patient.firstName, patient.lastName].filter(Boolean).join(" ");
	return name || "Patient";
}

function compact(lines: (string | null | undefined | false)[]): string[] {
	return lines.filter(
		(l): l is string => typeof l === "string" && l.trim() !== "",
	);
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/** Build a Tunisian-style invoice PDF (French labels, TND). */
export async function buildInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			size: "A4",
			margin: PAGE_MARGIN,
			bufferPages: true,
			info: {
				Title: `Facture ${data.number}`,
				Author: doctorDisplayName(data.doctor),
				Subject: `Facture ${data.number} — ${patientDisplayName(data.patient)}`,
			},
		});
		const chunks: Buffer[] = [];
		doc.on("data", (chunk: Buffer) => chunks.push(chunk));
		doc.on("end", () => resolve(Buffer.concat(chunks)));
		doc.on("error", reject);

		const left = PAGE_MARGIN;
		const right = doc.page.width - PAGE_MARGIN;
		const width = right - left;
		const contentBottom = doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT;
		const remaining = Math.max(0, data.totalCentimes - data.amountPaidCentimes);
		const status = STATUS_STYLE[data.status] ?? {
			label: data.status,
			fg: COLOR.body,
			bg: COLOR.surface,
		};

		/** Single-line text that never triggers pdfkit's auto page break. */
		const line = (
			text: string,
			x: number,
			y: number,
			opts: {
				font?: string;
				size?: number;
				color?: string;
				width?: number;
				align?: "left" | "right" | "center";
				characterSpacing?: number;
			} = {},
		) => {
			doc
				.font(opts.font ?? FONT.regular)
				.fontSize(opts.size ?? 9.5)
				.fillColor(opts.color ?? COLOR.body)
				.text(text, x, y, {
					width: opts.width,
					align: opts.align ?? "left",
					characterSpacing: opts.characterSpacing,
					lineBreak: false,
					ellipsis: opts.width ? true : undefined,
				});
		};

		const label = (text: string, x: number, y: number, w?: number) =>
			line(text.toUpperCase(), x, y, {
				font: FONT.bold,
				size: 7.5,
				color: COLOR.muted,
				characterSpacing: 0.8,
				width: w,
				align: w ? "right" : "left",
			});

		/** Move to a new page when `needed` points would overflow the content area. */
		let y = 0;
		const ensureSpace = (needed: number): boolean => {
			if (y + needed <= contentBottom) return false;
			doc.addPage();
			drawTopBar();
			y = PAGE_MARGIN + 8;
			return true;
		};

		const drawTopBar = () => {
			doc.rect(0, 0, doc.page.width, 6).fill(COLOR.brand);
		};

		// ── Header ──────────────────────────────────────────────────────────────
		drawTopBar();
		y = PAGE_MARGIN;

		const headerLeftWidth = width * 0.58;
		line(doctorDisplayName(data.doctor), left, y, {
			font: FONT.bold,
			size: 17,
			color: COLOR.ink,
			width: headerLeftWidth,
		});
		let hy = y + 22;
		if (data.doctor.specialityName) {
			line(data.doctor.specialityName, left, hy, {
				font: FONT.bold,
				size: 10,
				color: COLOR.brand,
				width: headerLeftWidth,
			});
			hy += 16;
		}
		const cabinetLines = compact([
			data.doctor.cabinetName,
			compact([data.doctor.address, data.doctor.cityName]).join(", "),
		]);
		for (const text of cabinetLines) {
			doc
				.font(FONT.regular)
				.fontSize(9)
				.fillColor(COLOR.body)
				.text(text, left, hy, { width: headerLeftWidth });
			hy = doc.y + 2;
		}
		const legalLine = compact([
			data.doctor.tin && `MF : ${data.doctor.tin}`,
			data.doctor.medicalCouncilNumber &&
				`N° Ordre : ${data.doctor.medicalCouncilNumber}`,
		]).join("   ·   ");
		if (legalLine) {
			line(legalLine, left, hy + 2, {
				size: 8.5,
				color: COLOR.muted,
				width: headerLeftWidth,
			});
			hy += 14;
		}

		// Title block (right)
		line("FACTURE", left, y - 2, {
			font: FONT.bold,
			size: 24,
			color: COLOR.ink,
			width,
			align: "right",
			characterSpacing: 2,
		});
		line(`N° ${data.number}`, left, y + 28, {
			font: FONT.bold,
			size: 10.5,
			color: COLOR.brand,
			width,
			align: "right",
		});
		line(`Émise le ${formatDate(data.issuedAt)}`, left, y + 44, {
			size: 9,
			color: COLOR.muted,
			width,
			align: "right",
		});

		y = Math.max(hy, y + 60) + 18;

		// ── Patient + amount due ────────────────────────────────────────────────
		const gap = 16;
		const cardWidth = (width - gap) / 2;
		const cardPad = 14;
		const innerWidth = cardWidth - cardPad * 2;

		const patientFacts = compact([
			data.patient.cin && `CIN : ${data.patient.cin}`,
			data.patient.phoneNumber && `Tél. : ${data.patient.phoneNumber}`,
			data.patient.address,
		]);
		const factsHeight = patientFacts.reduce(
			(h, f) =>
				h +
				doc
					.font(FONT.regular)
					.fontSize(9)
					.heightOfString(f, { width: innerWidth }) +
				3,
			0,
		);
		const cardHeight = Math.max(cardPad * 2 + 30 + factsHeight, 92);

		// Patient card
		doc.roundedRect(left, y, cardWidth, cardHeight, 6).fill(COLOR.surface);
		label("Facturée à", left + cardPad, y + cardPad);
		line(patientDisplayName(data.patient), left + cardPad, y + cardPad + 12, {
			font: FONT.bold,
			size: 11.5,
			color: COLOR.ink,
			width: innerWidth,
		});
		let fy = y + cardPad + 30;
		for (const fact of patientFacts) {
			doc
				.font(FONT.regular)
				.fontSize(9)
				.fillColor(COLOR.body)
				.text(fact, left + cardPad, fy, { width: innerWidth });
			fy = doc.y + 3;
		}

		// Amount-due card
		const dueX = left + cardWidth + gap;
		const dueAmount =
			data.status === "cancelled" ? data.totalCentimes : remaining;
		doc.roundedRect(dueX, y, cardWidth, cardHeight, 6).fill(COLOR.brandSoft);
		doc.rect(dueX, y + 6, 3, cardHeight - 12).fill(COLOR.brand);
		label(
			data.status === "paid" ? "Montant réglé" : "Montant dû",
			dueX + cardPad,
			y + cardPad,
		);
		line(
			formatMoney(
				data.status === "paid" ? data.totalCentimes : dueAmount,
				data.currency,
			),
			dueX + cardPad,
			y + cardPad + 14,
			{ font: FONT.bold, size: 20, color: COLOR.brandDark, width: innerWidth },
		);
		doc.font(FONT.bold).fontSize(8.5);
		const pillWidth = doc.widthOfString(status.label) + 22;
		const pillY = y + cardHeight - cardPad - 18;
		doc
			.roundedRect(dueX + cardPad, pillY, pillWidth, 18, 9)
			.fill(status.bg)
			.roundedRect(dueX + cardPad, pillY, pillWidth, 18, 9)
			.lineWidth(0.5)
			.stroke(status.fg);
		doc.circle(dueX + cardPad + 9, pillY + 9, 2.5).fill(status.fg);
		line(status.label, dueX + cardPad + 15, pillY + 5, {
			font: FONT.bold,
			size: 8.5,
			color: status.fg,
		});
		y += cardHeight + 26;

		// ── Items table ─────────────────────────────────────────────────────────
		const col = {
			desc: { x: left + 12, w: width * 0.52 - 12 },
			qty: { x: left + width * 0.52, w: width * 0.1 },
			unit: { x: left + width * 0.62, w: width * 0.17 },
			total: { x: left + width * 0.79, w: width * 0.21 - 12 },
		};

		const drawTableHeader = () => {
			doc.roundedRect(left, y, width, 24, 4).fill(COLOR.ink);
			const ty = y + 8.5;
			const head = {
				font: FONT.bold,
				size: 7.5,
				color: "#ffffff",
				characterSpacing: 0.8,
			};
			line("DÉSIGNATION", col.desc.x, ty, head);
			line("QTÉ", col.qty.x, ty, { ...head, width: col.qty.w, align: "right" });
			line("PRIX UNITAIRE", col.unit.x, ty, {
				...head,
				width: col.unit.w,
				align: "right",
			});
			line("MONTANT", col.total.x, ty, {
				...head,
				width: col.total.w,
				align: "right",
			});
			y += 24;
		};

		drawTableHeader();

		data.items.forEach((item, index) => {
			const descHeight = doc
				.font(FONT.regular)
				.fontSize(9.5)
				.heightOfString(item.description, { width: col.desc.w });
			const rowHeight = Math.max(28, descHeight + 16);

			if (ensureSpace(rowHeight)) drawTableHeader();

			if (index % 2 === 1) {
				doc.rect(left, y, width, rowHeight).fill(COLOR.surface);
			}
			const ty = y + (rowHeight - Math.max(descHeight, 11)) / 2 + 1;
			doc
				.font(FONT.regular)
				.fontSize(9.5)
				.fillColor(COLOR.ink)
				.text(item.description, col.desc.x, ty, { width: col.desc.w });
			const numY = y + rowHeight / 2 - 4.5;
			line(String(item.quantity), col.qty.x, numY, {
				width: col.qty.w,
				align: "right",
			});
			line(formatAmount(item.unitPriceCentimes), col.unit.x, numY, {
				width: col.unit.w,
				align: "right",
			});
			line(
				formatAmount(item.quantity * item.unitPriceCentimes),
				col.total.x,
				numY,
				{
					font: FONT.bold,
					color: COLOR.ink,
					width: col.total.w,
					align: "right",
				},
			);
			y += rowHeight;
			doc
				.moveTo(left, y)
				.lineTo(right, y)
				.lineWidth(0.5)
				.strokeColor(COLOR.line)
				.stroke();
		});

		if (data.items.length === 0) {
			line("Aucune prestation", col.desc.x, y + 10, { color: COLOR.faint });
			y += 32;
		}

		// ── Totals ──────────────────────────────────────────────────────────────
		y += 18;
		const totalsWidth = width * 0.42;
		const totalsX = right - totalsWidth;
		const showBalance =
			data.status !== "cancelled" &&
			data.amountPaidCentimes > 0 &&
			remaining > 0;
		ensureSpace(34 + (showBalance ? 2 * 20 + 6 : 0));

		const totalRow = (
			text: string,
			value: string,
			opts: { strong?: boolean; color?: string } = {},
		) => {
			line(text, totalsX, y, {
				font: opts.strong ? FONT.bold : FONT.regular,
				size: 9.5,
				color: opts.color ?? COLOR.body,
			});
			line(value, totalsX, y, {
				font: opts.strong ? FONT.bold : FONT.regular,
				size: 9.5,
				color: opts.color ?? COLOR.ink,
				width: totalsWidth,
				align: "right",
			});
			y += 20;
		};

		const highlight = (text: string, value: string) => {
			doc
				.roundedRect(totalsX - 10, y - 2, totalsWidth + 10, 34, 5)
				.fill(COLOR.brand);
			line(text, totalsX, y + 10, {
				font: FONT.bold,
				size: 10,
				color: "#ffffff",
			});
			line(value, totalsX, y + 8, {
				font: FONT.bold,
				size: 13,
				color: "#ffffff",
				width: totalsWidth - 8,
				align: "right",
			});
			y += 34;
		};

		if (showBalance) {
			totalRow("Total", formatMoney(data.totalCentimes, data.currency), {
				strong: true,
			});
			totalRow(
				"Déjà payé",
				`- ${formatMoney(data.amountPaidCentimes, data.currency)}`,
				{ color: COLOR.brandDark },
			);
			y += 6;
			highlight("Reste à payer", formatMoney(remaining, data.currency));
		} else {
			highlight(
				data.status === "cancelled"
					? "Total (annulée)"
					: data.status === "paid"
						? "Total réglé"
						: "Total à payer",
				formatMoney(data.totalCentimes, data.currency),
			);
		}
		y += 28;

		// ── Payments ────────────────────────────────────────────────────────────
		if (data.payments.length > 0) {
			ensureSpace(40 + data.payments.length * 22);
			line("Historique des paiements", left, y, {
				font: FONT.bold,
				size: 11,
				color: COLOR.ink,
			});
			y += 20;
			const pCol = {
				date: left,
				method: left + width * 0.35,
				amount: { x: left + width * 0.6, w: width * 0.4 },
			};
			label("Date", pCol.date, y);
			label("Mode", pCol.method, y);
			label("Montant", pCol.amount.x, y, pCol.amount.w);
			y += 14;
			for (const payment of data.payments) {
				ensureSpace(22);
				doc
					.moveTo(left, y)
					.lineTo(right, y)
					.lineWidth(0.5)
					.strokeColor(COLOR.line)
					.stroke();
				y += 7;
				line(formatShortDate(payment.paidAt), pCol.date, y);
				line(
					PAYMENT_METHOD_FR[payment.paymentMethod] ?? payment.paymentMethod,
					pCol.method,
					y,
				);
				line(
					formatMoney(payment.amountCentimes, data.currency),
					pCol.amount.x,
					y,
					{
						font: FONT.bold,
						color: COLOR.ink,
						width: pCol.amount.w,
						align: "right",
					},
				);
				y += 15;
			}
			y += 18;
		}

		// ── Notes ───────────────────────────────────────────────────────────────
		const notes = data.notes?.trim();
		if (notes) {
			const notesHeight =
				doc
					.font(FONT.regular)
					.fontSize(9)
					.heightOfString(notes, { width: width - 28 }) + 40;
			ensureSpace(notesHeight);
			doc.roundedRect(left, y, width, notesHeight, 6).fill(COLOR.surface);
			label("Notes", left + 14, y + 12);
			doc
				.font(FONT.regular)
				.fontSize(9)
				.fillColor(COLOR.body)
				.text(notes, left + 14, y + 26, { width: width - 28 });
			y += notesHeight + 16;
		}

		// ── Footer on every page ────────────────────────────────────────────────
		const range = doc.bufferedPageRange();
		const issuer = compact([
			doctorDisplayName(data.doctor),
			data.doctor.cabinetName,
			data.doctor.tin && `MF ${data.doctor.tin}`,
		]).join("  ·  ");
		for (let i = range.start; i < range.start + range.count; i++) {
			doc.switchToPage(i);
			// Footer sits inside the bottom margin; disable it so pdfkit doesn't paginate.
			const bottomMargin = doc.page.margins.bottom;
			doc.page.margins.bottom = 0;
			const fy = doc.page.height - PAGE_MARGIN - 18;
			doc
				.moveTo(left, fy - 10)
				.lineTo(right, fy - 10)
				.lineWidth(0.5)
				.strokeColor(COLOR.line)
				.stroke();
			line(issuer, left, fy, {
				size: 7.5,
				color: COLOR.muted,
				width: width * 0.75,
			});
			line(`Page ${i - range.start + 1} / ${range.count}`, left, fy, {
				size: 7.5,
				color: COLOR.muted,
				width,
				align: "right",
			});
			line("Facture générée avec Riaya", left, fy + 12, {
				size: 7,
				color: COLOR.faint,
			});
			doc.page.margins.bottom = bottomMargin;
		}

		doc.end();
	});
}
