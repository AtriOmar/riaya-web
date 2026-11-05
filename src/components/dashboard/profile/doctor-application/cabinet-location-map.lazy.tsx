"use client";

import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the map must never run on the server.
const CabinetLocationMapLazy = dynamic(() => import("./cabinet-location-map"), {
	ssr: false,
	loading: () => (
		<div className="flex size-full items-center justify-center bg-muted/40">
			<MapPin className="size-4 text-muted-foreground/60" />
		</div>
	),
});

export default CabinetLocationMapLazy;
