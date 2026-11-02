"use client";

import axios from "axios";
import { CalendarDays, MapPin, Star, Stethoscope } from "lucide-react";
import { useParams } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PRACTICE_TIME_ZONE } from "@/lib/practice-time";
import { cn } from "@/lib/utils";
import type { GetApiReviewsToken200 } from "@/services/generated/api.schemas";
import { useGetApiReviewsToken } from "@/services/generated/reviews/reviews";

/** "Saturday 24 October 2026 · 10:30–11:00" on the practice's clock. */
function formatVisit(start: string, end: string | null): string {
	const day = new Intl.DateTimeFormat("en-GB", {
		timeZone: PRACTICE_TIME_ZONE,
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date(start));
	const time = (iso: string) =>
		new Intl.DateTimeFormat("en-GB", {
			timeZone: PRACTICE_TIME_ZONE,
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(iso));
	return `${day} · ${time(start)}${end ? `–${time(end)}` : ""}`;
}

function VisitSummary({ visit }: { visit: GetApiReviewsToken200 }) {
	const place = [visit.cabinetName, visit.city].filter(Boolean).join(", ");
	return (
		<div className="space-y-2 bg-primary-50/70 dark:bg-slate-800/60 p-4 border border-primary-100 dark:border-slate-700 rounded-xl text-sm">
			<div className="flex items-start gap-3">
				<Stethoscope className="mt-0.5 w-4 h-4 text-primary shrink-0" />
				<div>
					<p className="font-semibold text-slate-900 dark:text-white">
						{visit.doctorName ? `Dr. ${visit.doctorName}` : "Your doctor"}
					</p>
					{visit.speciality && (
						<p className="text-slate-500 dark:text-slate-400">
							{visit.speciality}
						</p>
					)}
				</div>
			</div>
			{visit.start && (
				<div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
					<CalendarDays className="w-4 h-4 text-primary shrink-0" />
					{formatVisit(visit.start, visit.end)}
				</div>
			)}
			{place && (
				<div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
					<MapPin className="w-4 h-4 text-primary shrink-0" />
					{place}
				</div>
			)}
		</div>
	);
}

function MessageCard({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<div className="relative flex justify-center items-center bg-primary-50 dark:bg-slate-950 p-4 min-h-screen">
			<div className="top-4 right-4 z-20 absolute">
				<ThemeToggle />
			</div>
			<Card className="z-10 relative bg-white/80 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl border-0 w-full max-w-md">
				<CardHeader className="py-12 text-center">
					<CardTitle className="font-bold text-slate-900 dark:text-white text-2xl">
						{title}
					</CardTitle>
					<CardDescription className="mt-2 text-base">
						{description}
					</CardDescription>
				</CardHeader>
			</Card>
		</div>
	);
}

export default function ReviewPage() {
	const params = useParams();
	const token = params.token as string;
	const { data: visit, error, isLoading } = useGetApiReviewsToken(token);

	const [rating, setRating] = useState<number>(0);
	const [hoverRating, setHoverRating] = useState<number>(0);
	const [waitTime, setWaitTime] = useState<"short" | "medium" | "long" | null>(
		null,
	);
	const [comment, setComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isExpired, setIsExpired] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!rating) {
			toast.error("Please provide a star rating.");
			return;
		}
		if (!waitTime) {
			toast.error("Please let us know about the wait time.");
			return;
		}

		try {
			setIsSubmitting(true);
			await axios.post("/api/reviews/submit", {
				token,
				rating,
				waitTime,
				comment,
			});
			setIsSuccess(true);
		} catch (error) {
			if (
				axios.isAxiosError(error) &&
				error.response?.data?.error === "REVIEW_EXPIRED"
			) {
				setIsExpired(true);
			} else if (axios.isAxiosError(error)) {
				toast.error(
					error.response?.data?.message || "Failed to submit review.",
				);
			} else {
				toast.error("Failed to submit review.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	if (error) {
		return (
			<MessageCard
				title="Link not found"
				description="This review link is not valid. Please check the message you received."
			/>
		);
	}

	if (isExpired || visit?.status === "expired") {
		return (
			<MessageCard
				title="This link has expired"
				description="Review links are only valid for 30 days after your visit."
			/>
		);
	}

	if (visit?.status === "submitted") {
		return (
			<MessageCard
				title="Already rated"
				description="You have already shared your feedback on this visit. Thank you!"
			/>
		);
	}

	if (isSuccess) {
		return (
			<div className="relative flex justify-center items-center bg-primary-50 dark:bg-slate-950 p-4 min-h-screen">
				<div className="top-4 right-4 z-20 absolute">
					<ThemeToggle />
				</div>
				<div className="absolute inset-0 bg-gradient-to-br from-primary-100 dark:from-primary-900/20 to-primary-50 dark:to-primary-800/20 opacity-50 pointer-events-none" />
				<Card className="z-10 relative bg-white/80 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl border-0 w-full max-w-md animate-fade-in-up glassmorphism">
					<CardHeader className="pt-12 pb-8 text-center">
						<div className="flex justify-center items-center bg-green-100 dark:bg-green-900/30 mx-auto mb-6 rounded-full w-20 h-20">
							<Star className="fill-green-600 dark:fill-green-400 w-10 h-10 text-green-600 dark:text-green-400 animate-bounce" />
						</div>
						<CardTitle className="font-bold text-primary-600 dark:text-primary-400 text-3xl">
							Thank You!
						</CardTitle>
						<CardDescription className="mt-2 text-slate-600 dark:text-slate-300 text-lg">
							Your feedback helps us provide better care.
						</CardDescription>
					</CardHeader>
				</Card>
			</div>
		);
	}

	return (
		<div className="relative flex justify-center items-center bg-primary-50 dark:bg-slate-950 p-4 min-h-screen">
			<div className="top-4 right-4 z-20 absolute">
				<ThemeToggle />
			</div>
			<div className="absolute inset-0 bg-gradient-to-br from-primary-100 dark:from-primary-900/20 to-primary-50 dark:to-primary-800/20 opacity-50 pointer-events-none" />

			<Card className="z-10 relative bg-white/80 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl border-0 w-full max-w-md overflow-hidden animate-fade-in-up glassmorphism">
				<div className="top-0 left-0 absolute bg-primary w-full h-2" />
				<CardHeader className="pb-6 text-center">
					<CardTitle className="font-bold text-slate-900 dark:text-white text-2xl">
						{visit?.patientFirstName
							? `How was your visit, ${visit.patientFirstName}?`
							: "Rate your visit"}
					</CardTitle>
					<CardDescription className="text-base">
						Please take 30 seconds to share your experience.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-8">
					{isLoading || !visit ? (
						<Skeleton className="rounded-xl w-full h-28" />
					) : (
						<VisitSummary visit={visit} />
					)}
					<form onSubmit={handleSubmit} className="space-y-8">
						{/* Rating */}
						<div className="space-y-4">
							<Label className="block font-medium text-lg text-center">
								1. How was your experience?
							</Label>
							<div className="flex justify-center gap-2">
								{[1, 2, 3, 4, 5].map((star) => (
									<button
										key={star}
										type="button"
										onMouseEnter={() => setHoverRating(star)}
										onMouseLeave={() => setHoverRating(0)}
										onClick={() => setRating(star)}
										className={cn(
											"p-2 hover:scale-110 transition-all duration-300 ease-out transform",
											(hoverRating || rating) >= star
												? "text-yellow-400 drop-shadow-md"
												: "text-slate-200 dark:text-slate-700 hover:text-yellow-200",
										)}
									>
										<Star
											className={cn(
												"w-10 h-10 transition-all",
												(hoverRating || rating) >= star
													? "fill-yellow-400"
													: "",
											)}
										/>
									</button>
								))}
							</div>
						</div>

						{/* Wait Time */}
						<div className="space-y-4">
							<Label className="block font-medium text-lg text-center">
								2. How was the wait time?
							</Label>
							<div className="gap-3 grid grid-cols-3">
								{[
									{ value: "short", label: "Short" },
									{ value: "medium", label: "Medium" },
									{ value: "long", label: "Long" },
								].map((option) => (
									<button
										type="button"
										key={option.value}
										onClick={() =>
											setWaitTime(option.value as "short" | "medium" | "long")
										}
										className={cn(
											"px-2 py-3 border-2 rounded-xl text-center transition-all duration-200 cursor-pointer",
											waitTime === option.value
												? "border-primary bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:border-primary-400 dark:text-primary-300 font-semibold shadow-sm transform scale-105"
												: "border-slate-200 bg-white text-slate-600 hover:border-primary-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
										)}
									>
										{option.label}
									</button>
								))}
							</div>
						</div>

						{/* Comment */}
						<div className="space-y-4">
							<Label className="block font-medium text-lg text-center">
								3. Any other feedback?{" "}
								<span className="font-normal text-slate-400 text-sm">
									(Optional)
								</span>
							</Label>
							<Textarea
								placeholder="Tell us what you liked or how we can improve..."
								className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 focus:border-primary dark:border-slate-800 rounded-xl focus:ring-primary/20 h-32 transition-all resize-none"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
							/>
						</div>

						<Button
							type="submit"
							disabled={isSubmitting}
							className="bg-primary hover:bg-primary-600 shadow-primary/25 shadow-lg py-6 rounded-xl w-full text-white text-lg transition-all hover:-translate-y-1 duration-300 transform"
						>
							{isSubmitting ? "Submitting..." : "Submit Review"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
