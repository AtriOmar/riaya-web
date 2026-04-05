import { Ban, ChevronRight, Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";

type Props = {
	status: string | null;
	rejectionReasons?: string[] | null;
};

export default function ApplicationStatus({ status, rejectionReasons }: Props) {
	if (!status || status === "verified") return null;

	const configs: Record<
		string,
		{
			icon: React.ReactNode;
			title: string;
			description?: string;
			variant: string;
		}
	> = {
		none: {
			icon: <ShieldAlert className="w-12 h-12 text-primary" />,
			title: "Verify your profile to start working with Riaya",
			description: "Fill your business information and apply for verification",
			variant: "border-border hover:bg-muted/50",
		},
		pending: {
			icon: <Clock className="w-12 h-12 text-primary" />,
			title: "Your application is under review",
			description:
				"We are reviewing your profile, we'll notify you once it's done",
			variant: "border-border hover:bg-muted/50",
		},
		rejected: {
			icon: <Clock className="w-12 h-12 text-destructive" />,
			title: "Your application has been rejected",
			description: "Please correct the errors and reapply.",
			variant: "border-destructive/30 hover:bg-destructive/5",
		},
		banned: {
			icon: <Ban className="w-12 h-12 text-destructive" />,
			title: "You have been banned",
			variant: "border-destructive/30 hover:bg-destructive/5",
		},
	};

	const config = configs[status];
	if (!config) return null;

	return (
		<Link
			href="/dashboard/profile"
			className={`flex items-center gap-4 mt-4 px-4 py-4 border rounded-lg shadow-sm hover:shadow-md transition ${config.variant}`}
		>
			{config.icon}
			<div className="grow">
				<p
					className={`text-lg font-medium ${status === "rejected" || status === "banned" ? "text-destructive" : ""}`}
				>
					{config.title}
				</p>
				{config.description && (
					<p
						className={`mt-1 text-sm ${status === "rejected" ? "text-destructive/80" : "text-muted-foreground"}`}
					>
						{config.description}
					</p>
				)}
				{rejectionReasons && rejectionReasons.length > 0 && (
					<>
						<p className="mt-1 text-destructive/80 text-sm">
							Rejection reasons:
						</p>
						<ul className="mt-1 ml-6 list-disc">
							{rejectionReasons.map((reason) => (
								<li key={reason} className="text-destructive/80 text-sm">
									{reason}
								</li>
							))}
						</ul>
					</>
				)}
			</div>
			<ChevronRight className="w-6 h-6 text-muted-foreground shrink-0" />
		</Link>
	);
}
