"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
	MapContainer,
	Marker,
	Polyline,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import useSWR from "swr";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import TunisiaDimOverlay from "@/components/maps/tunisia-dim-overlay";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import {
	TUNISIA_BOUNDS,
	TUNISIA_CENTER,
	TUNISIA_MIN_ZOOM,
} from "@/lib/tunisia-map";
import { cn } from "@/lib/utils";
import { getDrivingRoute } from "@/services/manual/driving-route";
import { DoctorCardBody } from "../shared/doctor-hover-card";

const TILE_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const TILE_ATTR =
	'&copy; <a href="https://www.google.com/maps">Google Maps</a>';

export type MappableDoctor = BestFitRangeDoctor & {
	rank: number;
};

type Props = {
	patient: { lat: number; lng: number } | null;
	doctors: MappableDoctor[];
	onSelectDoctor: (doctorId: number) => void;
};

function patientIcon() {
	return L.divIcon({
		className: "",
		iconSize: [28, 28],
		iconAnchor: [14, 28],
		popupAnchor: [0, -24],
		html: `<div style="
			width:28px;height:28px;border-radius:9999px 9999px 9999px 4px;
			transform:rotate(-45deg);
			background:#e11d48;border:2px solid #fff;
			box-shadow:0 1px 4px rgba(0,0,0,.35);
		"></div>`,
	});
}

function doctorIcon() {
	return L.divIcon({
		className: "",
		iconSize: [26, 26],
		iconAnchor: [13, 26],
		popupAnchor: [0, -22],
		html: `<div style="
			width:26px;height:26px;border-radius:9999px 9999px 9999px 4px;
			transform:rotate(-45deg);
			background:#0f766e;border:2px solid #fff;
			box-shadow:0 1px 4px rgba(0,0,0,.35);
		"></div>`,
	});
}

function clusterIcon(cluster: L.MarkerCluster) {
	const count = cluster.getChildCount();
	const size = count < 10 ? 36 : count < 50 ? 42 : 48;
	return L.divIcon({
		className: "",
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
		html: `<div style="
			width:${size}px;height:${size}px;border-radius:9999px;
			display:flex;align-items:center;justify-content:center;
			background:#0f766e;color:#fff;
			font:600 ${count < 10 ? 13 : 12}px/1 system-ui,sans-serif;
			border:3px solid #fff;
			box-shadow:0 2px 8px rgba(0,0,0,.35);
		">${count}</div>`,
	});
}

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
	const map = useMap();

	useEffect(() => {
		if (points.length === 0) return;
		if (points.length === 1) {
			const p = points[0];
			if (p) map.setView([p.lat, p.lng], 13);
			return;
		}
		const bounds = L.latLngBounds(
			points.map((p) => [p.lat, p.lng] as [number, number]),
		);
		map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
	}, [map, points]);

	return null;
}

function InvalidateOnMount() {
	const map = useMap();
	useEffect(() => {
		const t = setTimeout(() => map.invalidateSize(), 50);
		return () => clearTimeout(t);
	}, [map]);
	return null;
}

/** Clears the selection on empty-map clicks (not on marker clicks). */
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
	useMapEvents({
		click: (e) => {
			const target = e.originalEvent.target as HTMLElement | null;
			if (target?.closest(".leaflet-marker-icon")) return;
			onClear();
		},
	});
	return null;
}

type LatLng = { lat: number; lng: number };

/**
 * shadcn-styled card pinned to a map coordinate. Rendered inside the map so it
 * follows pan/zoom, and kept out of Leaflet's click/scroll handling.
 */
function AnchoredCard({
	position,
	open,
	children,
}: {
	position: LatLng;
	open: boolean;
	children: React.ReactNode;
}) {
	const map = useMap();
	const [, force] = useState(0);
	const ref = useRef<HTMLDivElement>(null);

	useMapEvents({ move: () => force((n) => n + 1) });

	useEffect(() => {
		if (!ref.current) return;
		L.DomEvent.disableClickPropagation(ref.current);
		L.DomEvent.disableScrollPropagation(ref.current);
	}, []);

	const pt = map.latLngToContainerPoint([position.lat, position.lng]);

	return (
		// Outer div positions (transform), inner div animates — they must not
		// share a transform or the enter animation would shift the card.
		<div
			ref={ref}
			className={cn(
				"absolute z-[1000] w-72 -translate-x-1/2 -translate-y-full",
				!open && "pointer-events-none",
			)}
			style={{ left: pt.x, top: pt.y - 34 }}
		>
			<div
				className={cn(
					"origin-bottom overflow-hidden rounded-lg bg-popover text-popover-foreground text-sm shadow-lg ring-1 ring-foreground/10 duration-150 fill-mode-forwards",
					open
						? "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2"
						: "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2",
				)}
			>
				{children}
			</div>
		</div>
	);
}

/** Road route from the patient to a doctor (cached per pair by SWR). */
function useDrivingRoute(
	patient: LatLng | null,
	doctor: MappableDoctor | undefined,
) {
	const lat = doctor?.cabinetLatitude;
	const lng = doctor?.cabinetLongitude;
	const key =
		patient && lat != null && lng != null
			? ["driving-route", patient.lat, patient.lng, lat, lng]
			: null;

	return useSWR(
		key,
		() =>
			getDrivingRoute(patient as LatLng, {
				lat: lat as number,
				lng: lng as number,
			}),
		{ revalidateOnFocus: false },
	);
}

export default function DoctorsMapInner({
	patient,
	doctors,
	onSelectDoctor,
}: Props) {
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	const [selectedId, setSelectedId] = useState<number | null>(null);

	// The card stays mounted briefly after deselecting so it can animate out.
	const [shownId, setShownId] = useState<number | null>(null);
	useEffect(() => {
		if (selectedId != null) {
			setShownId(selectedId);
			return;
		}
		const t = setTimeout(() => setShownId(null), 160);
		return () => clearTimeout(t);
	}, [selectedId]);

	const hoveredDoctor = doctors.find((d) => d.id === hoveredId);
	const selectedDoctor = doctors.find((d) => d.id === selectedId);
	const shownDoctor = doctors.find((d) => d.id === shownId);

	// The line follows the hovered doctor, and falls back to the selected one.
	const lineDoctor = hoveredDoctor ?? selectedDoctor;

	const { data: lineRoute } = useDrivingRoute(patient, lineDoctor);
	const { data: selectedRoute, isLoading: selectedRouteLoading } =
		useDrivingRoute(patient, shownDoctor);

	const points = useMemo(() => {
		const pts: LatLng[] = patient ? [patient] : [];
		for (const d of doctors) {
			if (d.cabinetLatitude != null && d.cabinetLongitude != null) {
				pts.push({ lat: d.cabinetLatitude, lng: d.cabinetLongitude });
			}
		}
		return pts;
	}, [patient, doctors]);

	const patientMarkerIcon = useMemo(() => patientIcon(), []);
	const doctorMarkerIcon = useMemo(() => doctorIcon(), []);

	return (
		<MapContainer
			center={[
				(patient ?? TUNISIA_CENTER).lat,
				(patient ?? TUNISIA_CENTER).lng,
			]}
			zoom={patient ? 12 : TUNISIA_MIN_ZOOM}
			minZoom={TUNISIA_MIN_ZOOM}
			maxBounds={TUNISIA_BOUNDS}
			maxBoundsViscosity={1}
			scrollWheelZoom
			style={{ height: "100%", width: "100%" }}
		>
			<TileLayer attribution={TILE_ATTR} url={TILE_URL} />
			<TunisiaDimOverlay />
			<InvalidateOnMount />
			<ClearOnMapClick onClear={() => setSelectedId(null)} />
			<FitBounds points={points} />

			{lineRoute?.lines.map((line) => (
				<Fragment key={`route-${lineDoctor?.id}-${line[0]?.join(",")}`}>
					{/* White casing keeps the line readable over roads/labels */}
					<Polyline
						positions={line}
						interactive={false}
						pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }}
					/>
					<Polyline
						positions={line}
						interactive={false}
						pathOptions={{ color: "#0f766e", weight: 4, opacity: 1 }}
					/>
				</Fragment>
			))}

			{/* Patient pin stays outside the cluster group */}
			{patient && (
				<Marker
					position={[patient.lat, patient.lng]}
					icon={patientMarkerIcon}
				/>
			)}

			<MarkerClusterGroup
				chunkedLoading
				showCoverageOnHover={false}
				maxClusterRadius={(zoom) => (zoom < 13 ? 55 : zoom < 15 ? 30 : 0)}
				disableClusteringAtZoom={15}
				spiderfyOnMaxZoom={false}
				iconCreateFunction={clusterIcon}
			>
				{doctors.map((doctor) => {
					if (
						doctor.cabinetLatitude == null ||
						doctor.cabinetLongitude == null
					) {
						return null;
					}
					return (
						<Marker
							key={doctor.id}
							position={[doctor.cabinetLatitude, doctor.cabinetLongitude]}
							icon={doctorMarkerIcon}
							eventHandlers={{
								// Hover draws the route; click opens the card.
								mouseover: () => setHoveredId(doctor.id),
								mouseout: () =>
									setHoveredId((cur) => (cur === doctor.id ? null : cur)),
								// Clicking the same doctor again closes the card.
								click: () =>
									setSelectedId((cur) =>
										cur === doctor.id ? null : doctor.id,
									),
							}}
						/>
					);
				})}
			</MarkerClusterGroup>

			{shownDoctor &&
				shownDoctor.cabinetLatitude != null &&
				shownDoctor.cabinetLongitude != null && (
					<AnchoredCard
						position={{
							lat: shownDoctor.cabinetLatitude,
							lng: shownDoctor.cabinetLongitude,
						}}
						open={selectedId != null}
					>
						<div className="relative">
							<button
								type="button"
								aria-label="Close"
								className="absolute top-1.5 right-2 text-lg leading-none text-muted-foreground hover:text-foreground"
								onClick={() => setSelectedId(null)}
							>
								×
							</button>
							<DoctorCardBody doctor={shownDoctor} />
						</div>
						<div className="flex items-center justify-between gap-3 border-t px-3.5 py-2.5">
							<p className="text-muted-foreground text-xs">
								{!patient
									? "Set a location to see the route"
									: selectedRouteLoading
										? "Finding route…"
										: selectedRoute
											? `${selectedRoute.distanceKm.toFixed(1)} km by road`
											: "Route unavailable"}
							</p>
							<button
								type="button"
								className="shrink-0 font-medium text-primary text-xs underline-offset-2 hover:underline"
								onClick={() => onSelectDoctor(shownDoctor.id)}
							>
								View schedule
							</button>
						</div>
					</AnchoredCard>
				)}
		</MapContainer>
	);
}
