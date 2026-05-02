const IMAGE_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"bmp",
	"tif",
	"tiff",
	"svg",
	"avif",
	"ico",
]);

function extensionFromFilename(name: string): string {
	return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Local file picked in the browser */
export function isImageFile(file: File): boolean {
	if (file.type.startsWith("image/")) return true;
	return IMAGE_EXTENSIONS.has(extensionFromFilename(file.name));
}

/** Stored CDN / absolute URL */
export function isLikelyImageUrl(url: string): boolean {
	const pathOnly = url.split("?")[0].split("#")[0].toLowerCase();
	const ext = extensionFromFilename(pathOnly);
	return IMAGE_EXTENSIONS.has(ext);
}
