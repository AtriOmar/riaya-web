import { PauseCircle } from "lucide-react";

/** Shown to a secretary while the doctor's plan doesn't include secretaries. */
export default function SecretaryPaused({
	doctorName,
}: {
	doctorName: string | null;
}) {
	return (
		<div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
			<div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<PauseCircle className="size-7" />
			</div>
			<h2 className="font-semibold text-lg">Your access is paused</h2>
			<p className="text-muted-foreground text-sm">
				{doctorName ?? "Your doctor"}'s plan no longer includes secretary
				accounts. You'll get access back as soon as they renew Pro.
			</p>
		</div>
	);
}
