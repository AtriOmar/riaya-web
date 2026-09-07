"use client";

import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	Tooltip,
	useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import TunisiaDimOverlay from "@/components/maps/tunisia-dim-overlay";
import type { BestFitRangeDoctor } from "@/hooks/use-best-fit-range";
import { TUNISIA_BOUNDS, TUNISIA_MIN_ZOOM } from "@/lib/tunisia-map";
import { shortName } from "../shared/helpers";

const TILE_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const TILE_ATTR =
	'&copy; <a href="https://www.google.com/maps">Google Maps</a>';

export type MappableDoctor = BestFitRangeDoctor & {
	rank: number;
};

type Props = {
	patient: { lat: number; lng: number };
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

export default function DoctorsMapInner({
	patient,
	doctors,
	onSelectDoctor,
}: Props) {
	const mapRef = useRef<LeafletMap>(null);

	const points = useMemo(() => {
		const pts: { lat: number; lng: number }[] = [patient];
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
			center={[patient.lat, patient.lng]}
			zoom={12}
			minZoom={TUNISIA_MIN_ZOOM}
			maxBounds={TUNISIA_BOUNDS}
			maxBoundsViscosity={1}
			scrollWheelZoom
			style={{ height: "100%", width: "100%" }}
			ref={mapRef}
		>
			<TileLayer attribution={TILE_ATTR} url={TILE_URL} />
			<TunisiaDimOverlay />
			<InvalidateOnMount />
			<FitBounds points={points} />

			{/* Patient pin stays outside the cluster group */}
			<Marker position={[patient.lat, patient.lng]} icon={patientMarkerIcon}>
				<Popup>
					<div className="text-xs font-medium">Patient location</div>
				</Popup>
			</Marker>

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
					const name = shortName(doctor);
					return (
						<Marker
							key={doctor.id}
							position={[doctor.cabinetLatitude, doctor.cabinetLongitude]}
							icon={doctorMarkerIcon}
							eventHandlers={{
								click: () => onSelectDoctor(doctor.id),
							}}
						>
							<Tooltip direction="top" offset={[0, -22]} opacity={1}>
								<div className="min-w-[120px] space-y-0.5">
									<p className="font-semibold text-xs">{name}</p>
									<p className="text-[11px] text-muted-foreground">
										{doctor.distance.toFixed(1)} km
										{doctor.address ? ` · ${doctor.address}` : ""}
									</p>
									<p className="text-[11px] text-muted-foreground">
										{doctor.slots.length} slot
										{doctor.slots.length === 1 ? "" : "s"} available
									</p>
								</div>
							</Tooltip>
							<Popup>
								<div className="min-w-[140px] space-y-1">
									<p className="font-semibold text-sm">{name}</p>
									<p className="text-xs text-muted-foreground">
										{doctor.distance.toFixed(1)} km
										{doctor.address ? ` · ${doctor.address}` : ""}
									</p>
									<p className="text-[11px] text-muted-foreground">
										{doctor.slots.length} slot
										{doctor.slots.length === 1 ? "" : "s"} available
									</p>
									<button
										type="button"
										className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
										onClick={() => onSelectDoctor(doctor.id)}
									>
										View schedule
									</button>
								</div>
							</Popup>
						</Marker>
					);
				})}
			</MarkerClusterGroup>
		</MapContainer>
	);
}
