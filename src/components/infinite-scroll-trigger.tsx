"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface InfiniteScrollTriggerProps {
	onLoadMore: () => void;
	isLoading: boolean;
	hasMore: boolean;
	className?: string;
	threshold?: number;
	rootMargin?: string;
}

export default function InfiniteScrollTrigger({
	onLoadMore,
	isLoading,
	hasMore,
	className,
	threshold = 0.1,
	rootMargin = "200px",
}: InfiniteScrollTriggerProps) {
	const observerTarget = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const target = observerTarget.current;
		if (!target) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && hasMore && !isLoading) {
					onLoadMore();
				}
			},
			{ threshold, rootMargin },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [onLoadMore, isLoading, hasMore, threshold, rootMargin]);

	if (!hasMore) return null;

	return (
		<div
			ref={observerTarget}
			className={cn("flex justify-center p-4", className)}
		>
			{isLoading && (
				<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
			)}
		</div>
	);
}
