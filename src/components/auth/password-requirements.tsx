import { Check, Circle } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

export default function PasswordRequirements({
	password,
}: {
	password: string;
}) {
	return (
		<ul className="space-y-1 text-sm" aria-live="polite">
			{PASSWORD_RULES.map((rule) => {
				const met = rule.test(password);
				return (
					<li
						key={rule.id}
						className={cn(
							"flex items-center gap-2 transition-colors",
							met
								? "text-green-600 dark:text-green-400"
								: "text-muted-foreground",
						)}
					>
						{met ? (
							<Check className="w-4 h-4" />
						) : (
							<Circle className="w-4 h-4" />
						)}
						<span>{rule.label}</span>
						<span className="sr-only">{met ? "(met)" : "(not met)"}</span>
					</li>
				);
			})}
		</ul>
	);
}
