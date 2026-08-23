"use client";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// Leaflet icon fix for Next.js
import L from "leaflet";

// Fix for default marker icon in Next.js
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const iconRetinaUrl =
	"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const shadowUrl =
	"https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
	iconUrl,
	iconRetinaUrl,
	shadowUrl,
	iconSize: [25, 41],
	iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

import { cn } from "@/lib/utils";

type Props = {
	center: { lat: number; lng: number };
	marker?: { lat: number; lng: number } | null;
	onMapClick?: (lat: number, lng: number) => void;
	onMarkerClick?: () => void;
	className?: string;
	mapStyle?: "street" | "satellite";
};

function ClickHandler({
	onMapClick,
}: {
	onMapClick?: (lat: number, lng: number) => void;
}) {
	useMapEvents({
		click(e) {
			if (onMapClick) {
				onMapClick(e.latlng.lat, e.latlng.lng);
			}
		},
	});
	return null;
}

export default function CabinetLocationMap({
	center,
	marker,
	onMapClick,
	onMarkerClick,
	className,
	mapStyle = "street",
}: Props) {
	const mapRef = useRef<LeafletMap>(null);

	useEffect(() => {
		if (mapRef.current && center) {
			mapRef.current.setView(
				[center.lat, center.lng],
				mapRef.current.getZoom(),
			);
		}
	}, [center]);

	useEffect(() => {
		if (!mapRef.current) return;
		const map = mapRef.current;

		const container = map.getContainer();
		const observer = new ResizeObserver(() => {
			map.invalidateSize();
		});
		observer.observe(container);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!mapRef.current) return;
		const map = mapRef.current;

		// When className changes (e.g., toggling fullscreen),
		// wait for the 300ms CSS transition to finish before recalculating size
		const timer = setTimeout(() => {
			map.invalidateSize();
		}, 350);

		return () => clearTimeout(timer);
	}, [className]);

	// Google Maps Standard Road Map
	const streetUrl = `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`;
	// Google Maps Hybrid provides the best satellite imagery with rich street names and store labels baked in
	const satelliteUrl = `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`;

	const attribution =
		'&copy; <a href="https://www.google.com/maps">Google Maps</a>';

	return (
		<div
			className={cn(
				"border rounded-lg w-full h-[450px] overflow-hidden",
				className,
			)}
		>
			<MapContainer
				center={[center.lat, center.lng]}
				zoom={13}
				minZoom={5}
				scrollWheelZoom={true}
				style={{ height: "100%", width: "100%" }}
				ref={mapRef}
			>
				{mapStyle === "street" && (
					<TileLayer attribution={attribution} url={streetUrl} />
				)}

				{mapStyle === "satellite" && (
					<TileLayer attribution={attribution} url={satelliteUrl} />
				)}
				{marker && (
					<Marker
						position={[marker.lat, marker.lng]}
						eventHandlers={onMarkerClick ? { click: onMarkerClick } : undefined}
					/>
				)}
				<ClickHandler onMapClick={onMapClick} />
			</MapContainer>
		</div>
	);
}
