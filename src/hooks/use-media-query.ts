import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches; false on the server. */
export function useMediaQuery(query: string) {
	return useSyncExternalStore(
		(cb) => {
			const mq = window.matchMedia(query);
			mq.addEventListener("change", cb);
			return () => mq.removeEventListener("change", cb);
		},
		() => window.matchMedia(query).matches,
		() => false,
	);
}
