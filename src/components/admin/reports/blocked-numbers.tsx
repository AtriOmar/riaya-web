"use client";

import { format } from "date-fns";
import { Ban, Clock, MoreHorizontal, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DataTable, { type Column } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-handling";
import { formatPhoneDisplay } from "@/lib/phone";
import {
	useDeleteApiBlockedPhonesPhone,
	useGetApiBlockedPhones,
	usePatchApiBlockedPhonesPhone,
} from "@/services/generated/abuse/abuse";
import type { GetApiBlockedPhones200Item } from "@/services/generated/api.schemas";
import BlockNumberDialog from "./block-number-dialog";
import {
	DURATION_OPTIONS,
	formatBlockExpiry,
	revalidateAbuseData,
} from "./report-labels";

const columns: Column<GetApiBlockedPhones200Item>[] = [
	{
		key: "number",
		header: "Number",
		skeleton: <Skeleton className="h-4 w-32" />,
		cell: (row) => (
			<span className="font-medium whitespace-nowrap">
				{formatPhoneDisplay(row.phoneNumber)}
			</span>
		),
	},
	{
		key: "expires",
		header: "Blocked",
		skeleton: <Skeleton className="h-4 w-24" />,
		cell: (row) => (
			<span className="whitespace-nowrap">
				{formatBlockExpiry(row.expiresAt)}
			</span>
		),
	},
	{
		key: "reason",
		header: "Note",
		skeleton: <Skeleton className="h-4 w-48" />,
		cell: (row) => (
			<p className="line-clamp-2 max-w-sm text-muted-foreground text-sm">
				{row.reason || "—"}
			</p>
		),
	},
	{
		key: "attempts",
		header: "Calls rejected",
		skeleton: <Skeleton className="h-4 w-16" />,
		cell: (row) => (
			<span className="whitespace-nowrap text-sm">
				{row.rejectedCallCount}
				{row.lastRejectedAt && (
					<span className="text-muted-foreground">
						{" "}
						· last {format(new Date(row.lastRejectedAt), "d MMM")}
					</span>
				)}
			</span>
		),
	},
	{
		key: "by",
		header: "Blocked by",
		skeleton: <Skeleton className="h-4 w-24" />,
		cell: (row) => (
			<span className="whitespace-nowrap text-muted-foreground text-sm">
				{row.blockedByName ?? "—"} · {format(new Date(row.createdAt), "d MMM")}
			</span>
		),
	},
	{
		key: "actions",
		header: "",
		className: "w-12",
		cell: (row) => <RowActions row={row} />,
	},
];

function RowActions({ row }: { row: GetApiBlockedPhones200Item }) {
	const phone = encodeURIComponent(row.phoneNumber);
	const { trigger: changeDuration } = usePatchApiBlockedPhonesPhone(phone);
	const { trigger: unblock, isMutating } =
		useDeleteApiBlockedPhonesPhone(phone);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const label = formatPhoneDisplay(row.phoneNumber);

	async function run(action: () => Promise<unknown>, success: string) {
		try {
			await action();
			await revalidateAbuseData();
			toast.success(success);
			return true;
		} catch (e) {
			toast.error(getErrorMessage(e));
			return false;
		}
	}

	return (
		// Keep clicks inside the menu from reaching the table row.
		// biome-ignore lint/a11y/useKeyWithClickEvents: click guard only
		<div onClick={(e) => e.stopPropagation()}>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={`Actions for ${label}`}
					>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Clock />
							Change duration
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{DURATION_OPTIONS.map((o) => (
								<DropdownMenuItem
									key={o.value}
									onSelect={() =>
										run(
											() => changeDuration({ duration: o.value }),
											o.value === "permanent"
												? `${label} blocked permanently`
												: `${label} blocked for ${o.label} from now`,
										)
									}
								>
									{o.value === "permanent"
										? "Permanent"
										: `${o.label} from now`}
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => setConfirmOpen(true)}>
						<ShieldOff />
						Unblock
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unblock {label}?</DialogTitle>
						<DialogDescription>
							The AI will answer calls from this number again. Past reports stay
							in the Reviewed list.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant="outline">Cancel</Button>
						</DialogClose>
						<Button
							disabled={isMutating}
							onClick={async () => {
								if (await run(() => unblock(), `${label} unblocked`)) {
									setConfirmOpen(false);
								}
							}}
						>
							Unblock
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export default function BlockedNumbers() {
	const { data, isLoading } = useGetApiBlockedPhones();
	const [addOpen, setAddOpen] = useState(false);

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted-foreground text-sm">
					Calls from these numbers are rejected before the AI answers.
				</p>
				<Button onClick={() => setAddOpen(true)}>
					<Ban />
					Block a number
				</Button>
			</div>
			<DataTable
				columns={columns}
				data={data ?? []}
				isLoading={isLoading}
				skeletonRows={4}
				keyExtractor={(row) => row.phoneNumber}
				emptyMessage={
					<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
						<ShieldOff className="mb-4 size-12 opacity-50" />
						<span className="font-semibold text-foreground">
							No blocked numbers
						</span>
						<span className="mt-1 max-w-sm text-center text-sm">
							Block a number from a reported call, or add one by hand.
						</span>
					</div>
				}
			/>
			<BlockNumberDialog open={addOpen} onOpenChange={setAddOpen} />
		</div>
	);
}
