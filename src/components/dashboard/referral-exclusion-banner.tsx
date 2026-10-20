"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePractice } from "@/hooks/use-practice";

/**
 * Shown on every dashboard page while an admin has stopped Riaya from
 * referring patients to this doctor. Carries the admin's reason; never ratings.
 */
export default function ReferralExclusionBanner() {
	const { me } = usePractice();
	const profile = me?.doctorProfile;
	if (!profile?.bestFitExcludedAt) return null;

	return (
		<div className="pr-2 md:pr-10 pb-4 pl-2">
			<Alert variant="warning">
				<AlertTriangle className="size-4" />
				<AlertTitle>
					You are not currently receiving patient referrals from Riaya
				</AlertTitle>
				<AlertDescription className="space-y-1">
					{profile.bestFitExcludedReason && (
						<p>
							<span className="font-medium">Reason:</span>{" "}
							{profile.bestFitExcludedReason}
						</p>
					)}
					<p>
						Your existing appointments are not affected, and patients who ask
						for you by name can still book. To discuss this, contact Riaya
						support at{" "}
						<a
							href="mailto:contact@riaya.tn"
							className="font-medium underline underline-offset-2"
						>
							contact@riaya.tn
						</a>
						.
					</p>
				</AlertDescription>
			</Alert>
		</div>
	);
}
