"use client";

import axios from "axios";
import { Star } from "lucide-react";
import { useParams } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function ReviewPage() {
	const params = useParams();
	const token = params.token as string;

	const [rating, setRating] = useState<number>(0);
	const [hoverRating, setHoverRating] = useState<number>(0);
	const [waitTime, setWaitTime] = useState<"short" | "medium" | "long" | null>(
		null,
	);
	const [comment, setComment] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);

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
			if (axios.isAxiosError(error)) {
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

	if (isSuccess) {
		return (
			<div className="flex justify-center items-center bg-slate-50 dark:bg-slate-950 p-4 min-h-screen">
				<div className="absolute inset-0 bg-gradient-to-br from-blue-100 dark:from-blue-900/20 to-indigo-100 dark:to-indigo-900/20 opacity-50 pointer-events-none" />
				<Card className="z-10 relative bg-white/80 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl border-0 w-full max-w-md animate-fade-in-up glassmorphism">
					<CardHeader className="pt-12 pb-8 text-center">
						<div className="flex justify-center items-center bg-green-100 dark:bg-green-900/30 mx-auto mb-6 rounded-full w-20 h-20">
							<Star className="fill-green-600 dark:fill-green-400 w-10 h-10 text-green-600 dark:text-green-400 animate-bounce" />
						</div>
						<CardTitle className="bg-clip-text bg-gradient-to-r from-blue-600 dark:from-blue-400 to-indigo-600 dark:to-indigo-400 font-bold text-transparent text-3xl">
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
		<div className="flex justify-center items-center bg-slate-50 dark:bg-slate-950 p-4 min-h-screen">
			<div className="absolute inset-0 bg-gradient-to-br from-blue-100 dark:from-blue-900/20 to-indigo-100 dark:to-indigo-900/20 opacity-50 pointer-events-none" />

			<Card className="z-10 relative bg-white/80 dark:bg-slate-900/80 shadow-2xl backdrop-blur-xl border-0 w-full max-w-md overflow-hidden animate-fade-in-up glassmorphism">
				<div className="top-0 left-0 absolute bg-gradient-to-r from-blue-600 to-indigo-600 w-full h-2" />
				<CardHeader className="pb-6 text-center">
					<CardTitle className="font-bold text-slate-900 dark:text-white text-2xl">
						Rate your visit
					</CardTitle>
					<CardDescription className="text-base">
						Please take 30 seconds to share your experience.
					</CardDescription>
				</CardHeader>

				<CardContent>
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
												? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-300 font-semibold shadow-sm transform scale-105"
												: "border-slate-200 bg-white text-slate-600 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
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
								className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 focus:border-blue-500 dark:border-slate-800 rounded-xl focus:ring-blue-500/20 h-32 transition-all resize-none"
								value={comment}
								onChange={(e) => setComment(e.target.value)}
							/>
						</div>

						<Button
							type="submit"
							disabled={isSubmitting}
							className="bg-gradient-to-r from-blue-600 hover:from-blue-700 to-indigo-600 hover:to-indigo-700 shadow-blue-500/25 shadow-lg py-6 rounded-xl w-full text-white text-lg transition-all hover:-translate-y-1 duration-300 transform"
						>
							{isSubmitting ? "Submitting..." : "Submit Review"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
