"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef } from "react";
import {
	Circle,
	CircleMarker,
	MapContainer,
	Marker,
	Polyline,
	TileLayer,
	Tooltip,
	useMap,
} from "react-leaflet";
import useSWR from "swr";
import "leaflet/dist/leaflet.css";
import TunisiaDimOverlay from "@/components/maps/tunisia-dim-overlay";
import { BEST_FIT_MAX_RADIUS_KM } from "@/lib/best-fit-radius";
import {
	TUNISIA_BOUNDS,
	TUNISIA_CENTER,
	TUNISIA_MIN_ZOOM,
} from "@/lib/tunisia-map";
import { getDrivingRoute } from "@/services/manual/driving-route";
import type { CallJourney, JourneyDoctor } from "../call-journey";

const TILE_URL = "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
const TILE_ATTR =
	'&copy; <a href="https://www.google.com/maps">Google Maps</a>';

const PATIENT = "#e11d48";
const DOCTOR = "#0f766e";
const BOOKED = "#16a34a";

/** A doctor of the call's speciality with a cabinet location. */
export type MapDoctor = {
	id: number;
	name: string;
	cabinet: string | null;
	lat: number;
	lng: number;
};

type LatLng = { lat: number; lng: number };

type Props = {
	journey: CallJourney;
	doctors: MapDoctor[];
	specialityName: string | null;
	doctorsLoading: boolean;
};

function pinIcon(color: string, label = "", size = 28) {
	return L.divIcon({
		className: "",
		iconSize: [size, size],
		iconAnchor: [size / 2, size],
		tooltipAnchor: [0, -size],
		html: `<div style="
			position:relative;width:${size}px;height:${size}px;
			border-radius:9999px 9999px 9999px 4px;transform:rotate(-45deg);
			background:${color};border:2px solid #fff;
			box-shadow:0 1px 4px rgba(0,0,0,.35);
		"><span style="
			position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
			transform:rotate(45deg);color:#fff;font:600 12px/1 system-ui,sans-serif;
		">${label}</span></div>`,
	});
}

/** Fits the view to what matters, and moves smoothly as a live call fills in. */
function FitView({ points, fitKey }: { points: LatLng[]; fitKey: string }) {
	const map = useMap();
	const pointsRef = useRef(points);
	pointsRef.current = points;
	const first = useRef(true);

	useEffect(() => {
		const pts = pointsRef.current;
		const animate = !first.current;
		first.current = false;
		if (pts.length === 0) return;
		if (pts.length === 1) {
			const p = pts[0] as LatLng;
			map.flyTo([p.lat, p.lng], 13, { animate, duration: 0.8 });
			return;
		}
		const bounds = L.latLngBounds(
			pts.map((p) => [p.lat, p.lng] as [number, number]),
		);
		map.flyToBounds(bounds, {
			padding: [32, 32],
			maxZoom: 14,
			animate,
			duration: 0.8,
		});
	}, [map, fitKey]);

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

function DoctorTooltip({
	name,
	cabinet,
	offer,
}: {
	name: string;
	cabinet?: string | null;
	offer?: JourneyDoctor;
}) {
	return (
		<div className="space-y-0.5">
			<p className="font-semibold">{name}</p>
			{cabinet && <p className="text-muted-foreground">{cabinet}</p>}
			{offer?.distanceKm != null && (
				<p>
					{offer.distanceKm} km away
					{offer.farAway ? " (outside the radius)" : ""}
				</p>
			)}
			{offer?.when && <p>Offered: {offer.when}</p>}
		</div>
	);
}

function Legend({
	journey,
	otherCount,
	specialityName,
	doctorsLoading,
}: {
	journey: CallJourney;
	otherCount: number;
	specialityName: string | null;
	doctorsLoading: boolean;
}) {
	const dot = (color: string, hollow = false) => (
		<span
			className="inline-block size-2.5 shrink-0 rounded-full"
			style={
				hollow
					? { border: `2px solid ${color}` }
					: { background: color, border: "1px solid #fff" }
			}
		/>
	);
	return (
		<div className="pointer-events-none absolute bottom-2 left-2 z-[1000] flex flex-col gap-1 rounded-md bg-background/90 px-2 py-1.5 text-[10px] text-foreground shadow-sm ring-1 ring-foreground/10">
			{journey.patient && (
				<span className="flex items-center gap-1.5">
					{dot(PATIENT)} Patient
				</span>
			)}
			{journey.candidates.length > 1 && (
				<span className="flex items-center gap-1.5">
					{dot(PATIENT, true)} Places found
				</span>
			)}
			{journey.offered.length > 0 && (
				<span className="flex items-center gap-1.5">
					{dot(DOCTOR)} Offered (by rank)
				</span>
			)}
			{journey.booking && (
				<span className="flex items-center gap-1.5">
					{dot(BOOKED)} {journey.booking.urgent ? "Asked (urgent)" : "Booked"}
				</span>
			)}
			{specialityName && (
				<span className="flex items-center gap-1.5">
					<span
						className="inline-block size-2 shrink-0 rounded-full opacity-60"
						style={{ background: DOCTOR }}
					/>
					{doctorsLoading
						? `Loading ${specialityName.toLowerCase()} doctors…`
						: `${otherCount} other ${specialityName.toLowerCase()} doctor${otherCount === 1 ? "" : "s"}`}
				</span>
			)}
		</div>
	);
}

export default function CallMapInner({
	journey,
	doctors,
	specialityName,
	doctorsLoading,
}: Props) {
	const { patient, candidates, offered, booking } = journey;
	const bookedIds = useMemo(() => new Set(booking?.doctorIds ?? []), [booking]);
	const byId = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

	// Offered doctors placed with their cabinet, best rank first.
	const placedOffers = useMemo(
		() =>
			offered.flatMap((offer) => {
				const doctor = byId.get(offer.id);
				return doctor ? [{ offer, doctor }] : [];
			}),
		[offered, byId],
	);
	const offeredIds = new Set(offered.map((d) => d.id));
	const others = doctors.filter((d) => !offeredIds.has(d.id));

	// The road route to the booked doctor (one doctor; urgent asks go to several).
	const bookedDoctor =
		booking && !booking.urgent && booking.doctorIds[0] != null
			? byId.get(booking.doctorIds[0])
			: undefined;
	const { data: route } = useSWR(
		patient && bookedDoctor
			? [
					"driving-route",
					patient.lat,
					patient.lng,
					bookedDoctor.lat,
					bookedDoctor.lng,
				]
			: null,
		() => getDrivingRoute(patient as LatLng, bookedDoctor as MapDoctor),
		{ revalidateOnFocus: false },
	);

	// Frame the patient (or the places found) and the doctors offered.
	const focus = useMemo(() => {
		const pts: LatLng[] = patient ? [patient] : [...candidates];
		for (const { doctor } of placedOffers) pts.push(doctor);
		return pts;
	}, [patient, candidates, placedOffers]);
	const fitKey = focus.map((p) => `${p.lat},${p.lng}`).join("|");

	const patientIcon = useMemo(() => pinIcon(PATIENT), []);
	const shownCandidates = candidates.filter(
		(c) => !patient || c.lat !== patient.lat || c.lng !== patient.lng,
	);

	return (
		<MapContainer
			center={[TUNISIA_CENTER.lat, TUNISIA_CENTER.lng]}
			zoom={TUNISIA_MIN_ZOOM}
			minZoom={TUNISIA_MIN_ZOOM}
			maxBounds={TUNISIA_BOUNDS}
			maxBoundsViscosity={1}
			scrollWheelZoom
			style={{ height: "100%", width: "100%" }}
		>
			<TileLayer attribution={TILE_ATTR} url={TILE_URL} />
			<TunisiaDimOverlay />
			<InvalidateOnMount />
			<FitView points={focus} fitKey={fitKey} />

			{patient && (
				<Circle
					center={[patient.lat, patient.lng]}
					radius={BEST_FIT_MAX_RADIUS_KM * 1000}
					interactive={false}
					pathOptions={{
						color: PATIENT,
						weight: 1,
						dashArray: "4 6",
						fillOpacity: 0.03,
					}}
				/>
			)}

			{others.map((d) => (
				<CircleMarker
					key={d.id}
					center={[d.lat, d.lng]}
					radius={4}
					pathOptions={{
						color: "#ffffff",
						weight: 1,
						fillColor: DOCTOR,
						fillOpacity: 0.55,
					}}
				>
					<Tooltip direction="top">
						<DoctorTooltip name={d.name} cabinet={d.cabinet} />
					</Tooltip>
				</CircleMarker>
			))}

			{patient &&
				placedOffers.map(({ offer, doctor }) =>
					bookedIds.has(offer.id) && route ? null : (
						<Polyline
							key={`line-${offer.id}`}
							positions={[
								[patient.lat, patient.lng],
								[doctor.lat, doctor.lng],
							]}
							interactive={false}
							pathOptions={{
								color: bookedIds.has(offer.id) ? BOOKED : DOCTOR,
								weight: 2,
								opacity: 0.7,
								dashArray: "5 6",
							}}
						/>
					),
				)}

			{route?.lines.map((line) => (
				<Fragment key={`route-${line[0]?.join(",")}`}>
					<Polyline
						positions={line}
						interactive={false}
						pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.9 }}
					/>
					<Polyline
						positions={line}
						interactive={false}
						pathOptions={{ color: BOOKED, weight: 4 }}
					/>
				</Fragment>
			))}

			{shownCandidates.map((c) => (
				<CircleMarker
					key={`place-${c.lat},${c.lng}`}
					center={[c.lat, c.lng]}
					radius={7}
					pathOptions={{
						color: PATIENT,
						weight: 2,
						fillColor: "#ffffff",
						fillOpacity: 0.9,
					}}
				>
					<Tooltip direction="top">
						<span dir="auto">{c.label ?? "Place found"}</span>
					</Tooltip>
				</CircleMarker>
			))}

			{placedOffers.map(({ offer, doctor }) => {
				const booked = bookedIds.has(offer.id);
				return (
					<Marker
						key={`offer-${offer.id}`}
						position={[doctor.lat, doctor.lng]}
						icon={pinIcon(
							booked ? BOOKED : DOCTOR,
							booked ? "✓" : String(offer.rank ?? "•"),
							booked ? 32 : 28,
						)}
						zIndexOffset={booked ? 900 : 500}
					>
						<Tooltip direction="top">
							<DoctorTooltip
								name={offer.name}
								cabinet={doctor.cabinet}
								offer={offer}
							/>
						</Tooltip>
					</Marker>
				);
			})}

			{patient && (
				<Marker
					position={[patient.lat, patient.lng]}
					icon={patientIcon}
					zIndexOffset={1000}
				>
					<Tooltip direction="top">
						<span dir="auto">{patient.label ?? "Patient"}</span>
					</Tooltip>
				</Marker>
			)}

			<Legend
				journey={journey}
				otherCount={others.length}
				specialityName={specialityName}
				doctorsLoading={doctorsLoading}
			/>
		</MapContainer>
	);
}
