"use client";

import { MoreVertical, Plus, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type CardPreview = {
	id: string;
	brand: string;
	last4: string;
	expMonth: number;
	expYear: number;
	isDefault: boolean;
};

const BRAND_STYLES: Record<
	string,
	{ gradient: string; chip: string; label: string }
> = {
	visa: {
		gradient: "from-[#1a1f71] via-[#2a4db7] to-[#1a1f71]",
		chip: "bg-amber-300/90",
		label: "Visa",
	},
	mastercard: {
		gradient: "from-[#eb001b] via-[#f79e1b] to-[#eb001b]",
		chip: "bg-amber-200/90",
		label: "Mastercard",
	},
	amex: {
		gradient: "from-[#0077a6] via-[#00a3e0] to-[#0077a6]",
		chip: "bg-white/80",
		label: "Amex",
	},
	american_express: {
		gradient: "from-[#0077a6] via-[#00a3e0] to-[#0077a6]",
		chip: "bg-white/80",
		label: "Amex",
	},
	discover: {
		gradient: "from-[#ff6000] via-[#f7a500] to-[#ff6000]",
		chip: "bg-white/80",
		label: "Discover",
	},
	diners: {
		gradient: "from-[#2d4a6f] via-[#4a6fa5] to-[#2d4a6f]",
		chip: "bg-amber-200/90",
		label: "Diners",
	},
	jcb: {
		gradient: "from-[#0e4c92] via-[#1e7ac4] to-[#0e4c92]",
		chip: "bg-white/80",
		label: "JCB",
	},
	unionpay: {
		gradient: "from-[#e21836] via-[#00447c] to-[#e21836]",
		chip: "bg-white/80",
		label: "UnionPay",
	},
};

const FALLBACK_STYLES = [
	{
		gradient: "from-slate-700 via-slate-500 to-slate-800",
		chip: "bg-amber-200/90",
		label: "Card",
	},
	{
		gradient: "from-emerald-800 via-teal-600 to-emerald-900",
		chip: "bg-amber-200/90",
		label: "Card",
	},
	{
		gradient: "from-violet-800 via-fuchsia-600 to-violet-900",
		chip: "bg-amber-200/90",
		label: "Card",
	},
	{
		gradient: "from-rose-800 via-orange-600 to-rose-900",
		chip: "bg-amber-200/90",
		label: "Card",
	},
];

function cardStyle(brand: string, index: number) {
	const known = BRAND_STYLES[brand.toLowerCase()];
	if (known) return known;
	return FALLBACK_STYLES[index % FALLBACK_STYLES.length];
}

function billingUnavailable() {
	toast.info("Online billing is temporarily unavailable.");
}

function PaymentCard({ card, index }: { card: CardPreview; index: number }) {
	const style = cardStyle(card.brand, index);
	const exp = `${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`;

	return (
		<div
			className={cn(
				"@container relative aspect-[1.586/1] w-full max-w-[240px] rounded-[6%] text-white shadow-md",
				"bg-linear-to-br overflow-hidden select-none",
				style.gradient,
			)}
		>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_45%)]" />

			<div className="relative flex h-full flex-col justify-between p-[6.5%]">
				<div className="flex items-start justify-between">
					<div className="flex items-center" style={{ gap: "2.5cqw" }}>
						<div
							className={cn("rounded-[12%] shadow-inner", style.chip)}
							style={{ height: "12cqw", width: "17cqw" }}
						/>
						{card.isDefault && (
							<span
								className="rounded-full bg-white/20 font-semibold tracking-wide uppercase backdrop-blur-sm"
								style={{
									paddingInline: "3cqw",
									paddingBlock: "1cqw",
									fontSize: "4cqw",
								}}
							>
								Default
							</span>
						)}
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="rounded-full p-[2cqw] text-white/90 hover:bg-white/15 transition-colors"
								aria-label="Card options"
							>
								<MoreVertical style={{ width: "5cqw", height: "5cqw" }} />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								variant="destructive"
								onClick={billingUnavailable}
							>
								<Trash2 className="size-4" />
								Remove card
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex flex-col" style={{ gap: "3.5cqw" }}>
					<p
						className="font-mono tracking-[0.15em] whitespace-nowrap"
						style={{ fontSize: "5cqw" }}
					>
						•••• •••• •••• {card.last4}
					</p>
					<div
						className="flex items-end justify-between"
						style={{ gap: "3cqw" }}
					>
						<div>
							<p
								className="uppercase tracking-wider text-white/70"
								style={{ fontSize: "3.5cqw" }}
							>
								Expires
							</p>
							<p
								className="font-medium tracking-wide"
								style={{ fontSize: "5cqw" }}
							>
								{exp}
							</p>
						</div>
						<p
							className="font-semibold tracking-wide uppercase"
							style={{ fontSize: "5cqw" }}
						>
							{style.label === "Card" ? card.brand : style.label}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}

/** UI preview cards — not backed by a payment provider. */
const PREVIEW_CARDS: CardPreview[] = [
	{
		id: "preview-visa",
		brand: "visa",
		last4: "4242",
		expMonth: 12,
		expYear: 2028,
		isDefault: true,
	},
	{
		id: "preview-mc",
		brand: "mastercard",
		last4: "4444",
		expMonth: 8,
		expYear: 2027,
		isDefault: false,
	},
];

export default function PaymentMethodsList({
	cards = PREVIEW_CARDS,
}: {
	cards?: CardPreview[];
}) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-end">
				<Button variant="outline" size="sm" onClick={billingUnavailable}>
					<Plus className="size-4 mr-2" />
					Add card
				</Button>
			</div>

			{cards.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
					<WalletCards className="size-8 text-muted-foreground" />
					<p className="text-sm text-muted-foreground">
						No cards saved yet. Add one or upgrade to Pro to save a card.
					</p>
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{cards.map((card, index) => (
						<PaymentCard key={card.id} card={card} index={index} />
					))}
				</div>
			)}
		</div>
	);
}
