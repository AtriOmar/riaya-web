import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AlertVariant = "warning" | "info" | "destructive" | "success";

interface ConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	alertTitle?: string;
	alertMessage?: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	isLoading?: boolean;
	trigger?: ReactNode;
	variant?: AlertVariant;
	disabled?: boolean;
}

const variantConfig = {
	warning: {
		icon: AlertTriangle,
		iconClass: "text-amber-600 dark:text-amber-500",
		buttonVariant: "default" as const,
	},
	info: {
		icon: Info,
		iconClass: "text-primary",
		buttonVariant: "default" as const,
	},
	destructive: {
		icon: AlertCircle,
		iconClass: "text-destructive",
		buttonVariant: "destructive" as const,
	},
	success: {
		icon: CheckCircle,
		iconClass: "text-primary",
		buttonVariant: "default" as const,
	},
};

export default function ConfirmationDialog({
	open,
	onOpenChange,
	title,
	description,
	alertTitle,
	alertMessage,
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	isLoading = false,
	trigger,
	variant = "info",
	disabled = false,
}: ConfirmationDialogProps) {
	const handleConfirm = () => {
		onConfirm();
	};

	const config = variantConfig[variant];
	const IconComponent = config.icon;

	const dialogContent = (
		<DialogContent className="sm:max-w-md">
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
			</DialogHeader>
			<div className="space-y-3">
				{description && (
					<p className="text-muted-foreground text-sm">{description}</p>
				)}

				{alertTitle && alertMessage && (
					<div
						className={cn(
							"flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 p-3",
						)}
					>
						<IconComponent
							className={cn("mt-0.5 size-4 shrink-0", config.iconClass)}
						/>
						<div className="min-w-0 text-sm">
							<p className="font-medium text-foreground">{alertTitle}</p>
							<p className="mt-1 text-muted-foreground">{alertMessage}</p>
						</div>
					</div>
				)}
			</div>
			<DialogFooter className="sm:justify-end">
				<Button
					type="button"
					variant="outline"
					onClick={() => onOpenChange(false)}
				>
					{cancelText}
				</Button>
				<Button
					type="button"
					onClick={handleConfirm}
					disabled={isLoading || disabled}
					variant={config.buttonVariant}
				>
					{isLoading ? "Loading…" : confirmText}
				</Button>
			</DialogFooter>
		</DialogContent>
	);

	if (trigger) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogTrigger asChild>{trigger}</DialogTrigger>
				{dialogContent}
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{dialogContent}
		</Dialog>
	);
}
