// Pieces shared by the fake Konnect checkout and card screens.

import { cn } from "@/lib/utils";

export const inputBase =
	"relative h-9 w-full appearance-none bg-transparent px-3 py-2 text-[#333] outline-none transition ease-in-out placeholder:text-xs placeholder:text-[#9ca3af] focus:ring-4 focus:ring-blue-300/50 disabled:cursor-progress disabled:bg-gray-100 disabled:opacity-70";

export function ErrorIcon({
	message,
	className,
}: {
	message: string;
	className: string;
}) {
	return (
		<div className={cn("absolute", className)}>
			<span className="group relative inline-flex items-center justify-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={1.5}
					stroke="currentColor"
					aria-hidden="true"
					className="h-5 text-red-600"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
					/>
				</svg>
				<span className="hidden group-hover:block">
					<span className="absolute -top-12 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center rounded-sm text-center text-sm">
						<span className="rounded-sm bg-red-600 px-2 py-1">
							<span className="whitespace-nowrap text-white">{message}</span>
						</span>
						<span className="h-0 w-fit border-x-8 border-t-8 border-transparent border-t-red-600" />
					</span>
				</span>
			</span>
		</div>
	);
}
