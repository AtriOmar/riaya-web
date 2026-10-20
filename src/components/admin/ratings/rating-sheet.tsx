"use client";

import { format } from "date-fns";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-handling";
import {
	useDeleteApiDoctorsIdBestFitExclusion,
	useGetApiDoctorRatingsId,
} from "@/services/generated/ratings/ratings";
import ExcludeDoctorDialog from "./exclude-doctor-dialog";
import {
	DoctorAvatar,
	formatLongWaits,
	formatRating,
	isPoorAverage,
	RatingValue,
	recentCaption,
	revalidateRatingsData,
	Stars,
	tooFewCaption,
	WAIT_LABELS,
} from "./rating-labels";

type Props = {
	doctorId: number | null;
	onOpenChange: (open: boolean) => void;
};

export default function RatingSheet({ doctorId, onOpenChange }: Props) {
	return (
		<Sheet open={doctorId !== null} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				showCloseButton
				className="gap-0 p-0 !w-[min(100vw,600px)] !max-w-[min(100vw,600px)]"
			>
				<SheetTitle className="sr-only">Doctor feedback</SheetTitle>
				<SheetDescription className="sr-only">
					Patient ratings and comments for one doctor, and their referral
					status.
				</SheetDescription>
				{doctorId !== null && <FeedbackDetail doctorId={doctorId} />}
			</SheetContent>
		</Sheet>
	);
}

function Stat({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div>
			<div className="text-muted-foreground text-xs">{label}</div>
			<div className="font-semibold text-lg">{children}</div>
		</div>
	);
}

function FeedbackDetail({ doctorId }: { doctorId: number }) {
	const id = String(doctorId);
	const { data, isLoading } = useGetApiDoctorRatingsId(id);
	const { trigger: reinstate, isMutating } =
		useDeleteApiDoctorsIdBestFitExclusion(id);
	const [excludeOpen, setExcludeOpen] = useState(false);

	if (isLoading || !data) {
		return (
			<div className="flex flex-col gap-3 p-4 pt-12">
				<Skeleton className="h-6 w-48" />
				<Skeleton className="h-4 w-64" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	async function onReinstate() {
		try {
			await reinstate();
			await revalidateRatingsData();
			toast.success(`Dr ${data?.name} is listed for referrals again`);
		} catch (e) {
			toast.error(getErrorMessage(e));
		}
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-3 border-b px-4 py-3 pr-12">
				<DoctorAvatar doctor={data} className="size-10" />
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-semibold text-base">Dr {data.name}</span>
						{data.exclusion && (
							<span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs">
								Excluded from referrals
							</span>
						)}
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{[data.speciality, data.cabinetName].filter(Boolean).join(" · ")}
					</p>
				</div>
			</div>

			<div className="grid shrink-0 grid-cols-2 gap-3 border-b px-4 py-3 sm:grid-cols-4">
				<Stat label="Average">
					<RatingValue
						value={formatRating(data.averageRating)}
						basedOn={data.reviewCount}
						danger={isPoorAverage(data)}
					/>
				</Stat>
				<Stat label="Last 90 days">
					<RatingValue
						value={formatRating(data.last90DaysAverage)}
						basedOn={data.reviewCount90d}
						caption={recentCaption(data)}
					/>
				</Stat>
				<Stat label="Reviews">
					<RatingValue
						value={data.reviewCount}
						basedOn={data.reviewCount}
						caption={tooFewCaption(data.reviewCount)}
					/>
				</Stat>
				<Stat label="Long waits">
					<RatingValue value={formatLongWaits(data)} basedOn={data.waitCount} />
				</Stat>
			</div>

			{data.exclusion && (
				<div className="shrink-0 border-b bg-destructive/5 px-4 py-3">
					<div className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Excluded on{" "}
						{format(new Date(data.exclusion.excludedAt), "d MMM yyyy")} · reason
						shown to the doctor
					</div>
					<p className="text-sm leading-relaxed">{data.exclusion.reason}</p>
				</div>
			)}

			<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Reviews
				</div>
				{data.reviews.length === 0 ? (
					<p className="text-muted-foreground text-sm">No reviews yet.</p>
				) : (
					<ul className="divide-y">
						{data.reviews.map((r) => (
							<li key={r.id} className="space-y-1.5 py-3 first:pt-0">
								<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
									{r.rating != null && <Stars value={r.rating} />}
									{r.waitTime && <span>{WAIT_LABELS[r.waitTime]}</span>}
									{r.appointmentDate && (
										<span>
											Visit {format(new Date(r.appointmentDate), "d MMM yyyy")}
										</span>
									)}
									<span>Appointment #{r.appointmentId}</span>
									{r.patientName && <span>{r.patientName}</span>}
								</div>
								{r.comment ? (
									<p className="break-words whitespace-pre-line text-sm">
										{r.comment}
									</p>
								) : (
									<p className="text-muted-foreground text-sm italic">
										No comment
									</p>
								)}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
				{data.exclusion ? (
					<Button variant="outline" disabled={isMutating} onClick={onReinstate}>
						{isMutating ? <Loader2 className="animate-spin" /> : <RotateCcw />}
						List for referrals again
					</Button>
				) : (
					<Button variant="destructive" onClick={() => setExcludeOpen(true)}>
						<Ban />
						Stop referrals
					</Button>
				)}
			</div>

			<ExcludeDoctorDialog
				open={excludeOpen}
				onOpenChange={setExcludeOpen}
				doctorId={data.doctorId}
				doctorName={data.name}
			/>
		</div>
	);
}
