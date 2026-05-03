"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

type AppointmentBookedMessage = {
	type: "appointment_booked";
	callSid: string;
	data?: {
		doctorId?: unknown;
		newPatientName?: string | null;
	};
};

function isAppointmentBooked(msg: unknown): msg is AppointmentBookedMessage {
	return (
		typeof msg === "object" &&
		msg !== null &&
		"type" in msg &&
		(msg as { type: string }).type === "appointment_booked"
	);
}

/**
 * Subscribes to the realtime dashboard socket and notifies this doctor when
 * an appointment is booked for them via the phone / AI flow.
 */
export default function DoctorAppointmentSocketListener({
	doctorId,
}: {
	doctorId: number;
}) {
	const { mutate } = useSWRConfig();
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectAttempt = useRef(0);
	const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const doctorIdRef = useRef(doctorId);
	doctorIdRef.current = doctorId;

	const scheduleReconnect = useCallback(() => {
		if (reconnectTimer.current) return;
		const delay =
			RECONNECT_DELAYS[
				Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
			];
		reconnectAttempt.current++;
		reconnectTimer.current = setTimeout(() => {
			reconnectTimer.current = null;
			connectRef.current();
		}, delay);
	}, []);

	const connectRef = useRef<() => void>(() => {});

	const connect = useCallback(() => {
		const url = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
		if (!url) return;

		try {
			const ws = new WebSocket(`${url.replace(/\/$/, "")}/dashboard`);
			wsRef.current = ws;

			ws.onopen = () => {
				reconnectAttempt.current = 0;
			};

			ws.onclose = () => {
				wsRef.current = null;
				scheduleReconnect();
			};

			ws.onerror = () => {
				/* onclose schedules reconnect */
			};

			ws.onmessage = (event) => {
				try {
					const msg: unknown = JSON.parse(event.data);
					if (!isAppointmentBooked(msg)) return;

					const bookedDoctorId = Number(msg.data?.doctorId);
					if (
						!Number.isFinite(bookedDoctorId) ||
						bookedDoctorId !== doctorIdRef.current
					) {
						return;
					}

					const rawName = msg.data?.newPatientName?.trim();
					const patientLabel =
						rawName && rawName.length > 0 ? rawName : "A patient";

					toast.success(`New appointment request from ${patientLabel}`);
					void mutate("appointments");
				} catch {
					/* ignore malformed payloads */
				}
			};
		} catch {
			scheduleReconnect();
		}
	}, [mutate, scheduleReconnect]);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	useEffect(() => {
		connect();
		return () => {
			if (reconnectTimer.current) {
				clearTimeout(reconnectTimer.current);
				reconnectTimer.current = null;
			}
			if (wsRef.current) {
				wsRef.current.onclose = null;
				wsRef.current.close();
				wsRef.current = null;
			}
		};
	}, [connect]);

	return null;
}
