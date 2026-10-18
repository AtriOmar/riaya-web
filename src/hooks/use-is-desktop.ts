import { useMediaQuery } from "./use-media-query";

/** Matches Tailwind's `lg` breakpoint. */
export function useIsDesktop() {
	return useMediaQuery("(min-width: 1024px)");
}
