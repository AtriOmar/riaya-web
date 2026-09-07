"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import tunisiaGeoJson from "@/data/tunisia.json";

/** GeoJSON world ring [lng, lat] — Tunisia rings punched as holes. */
const WORLD_OUTER: [number, number][] = [
	[-180, -90],
	[-180, 90],
	[180, 90],
	[180, -90],
	[-180, -90],
];

type Ring = [number, number][];

function extractOuterRings(geojson: GeoJSON.FeatureCollection): Ring[] {
	const rings: Ring[] = [];
	for (const feature of geojson.features) {
		const geometry = feature.geometry;
		if (geometry.type === "Polygon") {
			rings.push(geometry.coordinates[0] as Ring);
		} else if (geometry.type === "MultiPolygon") {
			for (const polygon of geometry.coordinates) {
				rings.push(polygon[0] as Ring);
			}
		}
	}
	return rings;
}

/**
 * Dims everything outside Tunisia using accurate GeoJSON boundaries
 * (same approach as Leaflet.Mask: world polygon with country holes).
 */
export default function TunisiaDimOverlay() {
	const map = useMap();

	useEffect(() => {
		const geojson = tunisiaGeoJson as GeoJSON.FeatureCollection;
		const holes = extractOuterRings(geojson);

		const maskFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
			type: "Feature",
			properties: {},
			geometry: {
				type: "Polygon",
				coordinates: [WORLD_OUTER, ...holes],
			},
		};

		const mask = L.geoJSON(maskFeature, {
			interactive: false,
			style: {
				stroke: false,
				fillColor: "#0b1220",
				fillOpacity: 0.45,
			},
		});

		const border = L.geoJSON(geojson, {
			interactive: false,
			style: {
				color: "#0f766e",
				weight: 1.5,
				opacity: 0.7,
				fillOpacity: 0,
			},
		});

		mask.addTo(map);
		border.addTo(map);

		return () => {
			map.removeLayer(mask);
			map.removeLayer(border);
		};
	}, [map]);

	return null;
}
