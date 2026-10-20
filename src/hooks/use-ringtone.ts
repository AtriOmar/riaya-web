"use client";

import { useEffect } from "react";

const RINGTONE_SRC = "/sounds/call-ringtone.mp3";

/** Plays the ringtone on loop while `active` is true. */
export function useRingtone(active: boolean) {
	useEffect(() => {
		if (!active) return;
		const audio = new Audio(RINGTONE_SRC);
		audio.loop = true;
		// Autoplay rules may block this until the user has interacted with the page.
		void audio.play().catch(() => {});
		return () => {
			audio.pause();
			audio.src = "";
		};
	}, [active]);
}
