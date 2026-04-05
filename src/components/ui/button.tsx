import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex justify-center items-center gap-2 [&_svg]:size-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ring-offset-background focus-visible:ring-offset-2 disabled:opacity-50 font-semibold text-sm whitespace-nowrap transition-all duration-300 [&_svg]:pointer-events-none disabled:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_4px_20px_-4px_hsl(142_76%_36%/0.15)] hover:shadow-[0_8px_30px_-8px_hsl(142_76%_36%/0.2)]",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				hero: "bg-gradient-to-br from-primary to-primary-700 text-primary-foreground shadow-[0_8px_30px_-8px_hsl(142_76%_36%/0.2)] hover:shadow-[0_0_40px_hsl(142_76%_36%/0.3)] hover:scale-105 active:scale-100",
				"hero-outline":
					"border-2 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground backdrop-blur-sm hover:bg-primary-foreground/20 hover:border-primary-foreground/50",
				glass:
					"backdrop-blur-lg bg-gradient-to-br from-background/90 to-background/70 border border-border/50 text-foreground hover:shadow-[0_8px_30px_-8px_hsl(142_76%_36%/0.2)]",
			},
			size: {
				default: "h-10 px-5 py-2",
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-9 rounded-md px-4",
				lg: "h-12 rounded-xl px-8 text-base",
				xl: "h-14 rounded-xl px-10 text-lg",
				icon: "size-8",
				"icon-xs":
					"size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
				"icon-sm":
					"size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
				"icon-lg": "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
