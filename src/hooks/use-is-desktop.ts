import { useSyncExternalStore } from "react";

/** Matches Tailwind's `lg` breakpoint. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop() {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(DESKTOP_QUERY);
			mq.addEventListener("change", cb);
			return () => mq.removeEventListener("change", cb);
		},
		() => window.matchMedia(DESKTOP_QUERY).matches,
		() => false,
	);
}
