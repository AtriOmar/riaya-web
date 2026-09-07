/** Approximate geographic bounds of Tunisia for Leaflet `maxBounds`. */
export const TUNISIA_BOUNDS: [[number, number], [number, number]] = [
	[30.15, 7.45], // southwest (lat, lng)
	[37.55, 11.7], // northeast
];

export const TUNISIA_CENTER = { lat: 33.8869, lng: 9.5375 };

/** Prevent zooming out far enough to see beyond the country. */
export const TUNISIA_MIN_ZOOM = 6;
