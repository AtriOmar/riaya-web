import { Layers } from "lucide-react";
import Image from "next/image";

function isPdf(url: string) {
	try {
		return new URL(url, "http://localhost").pathname
			.toLowerCase()
			.endsWith(".pdf");
	} catch {
		return url.toLowerCase().endsWith(".pdf");
	}
}

/** Fills its parent: the first page for a PDF, the picture otherwise. Not interactive, so a wrapping link stays clickable. */
export default function DocumentPreview({
	url,
	alt,
}: {
	url: string;
	alt: string;
}) {
	if (!isPdf(url)) {
		return (
			<Image
				unoptimized
				src={url}
				alt={alt}
				fill
				className="w-full h-full object-cover"
			/>
		);
	}

	return (
		<object
			data={url}
			type="application/pdf"
			className="w-full h-full pointer-events-none"
		>
			<div className="flex flex-col justify-center items-center bg-muted/50 w-full h-full text-sm">
				<Layers className="mb-2 size-8 text-muted-foreground" />
				<span className="mt-1 text-muted-foreground text-xs">PDF Document</span>
			</div>
		</object>
	);
}
