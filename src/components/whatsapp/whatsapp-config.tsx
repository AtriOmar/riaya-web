"use client";

import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

// NEXT_PUBLIC_REALTIME_URL is a ws:// or wss:// URL.
// We derive the HTTP base by swapping the protocol so we can call GET /whatsapp-status.
function getSocketHttpBase(): string {
	const wsUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";
	return wsUrl
		.replace(/^wss:\/\//i, "https://")
		.replace(/^ws:\/\//i, "http://");
}

type WsStatus =
	| { type: "qr"; data: string }
	| { type: "connected"; phone?: string }
	| { type: "disconnected"; reason?: string }
	| { type: "connecting" };

type Props = {
	/** The userId to scope the WhatsApp connection to (e.g. "admin" or a doctor's user ID). */
	userId: string;
};

export default function WhatsappConfig({ userId }: Props) {
	const [status, setStatus] = useState<WsStatus>({ type: "connecting" });
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		let ws: WebSocket;
		let cancelled = false;

		async function init() {
			// 1. HTTP GET for initial state — avoids blank screen while WS connects
			try {
				const base = getSocketHttpBase();
				const res = await fetch(
					`${base}/whatsapp-status?userId=${encodeURIComponent(userId)}`,
				);
				if (res.ok) {
					const data = (await res.json()) as {
						connected: boolean;
						phone?: string;
					};
					if (!cancelled) {
						setStatus(
							data.connected
								? { type: "connected", phone: data.phone }
								: { type: "disconnected" },
						);
					}
				}
			} catch {
				// socket server may be offline; WS will clarify
			}

			if (cancelled) return;

			// 2. Open WS for live QR and connection events
			const wsBase =
				process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";
			const wsUrl = `${wsBase}/whatsapp?userId=${encodeURIComponent(userId)}`;
			ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onmessage = (e) => {
				try {
					const msg = JSON.parse(e.data as string) as WsStatus;
					if (!cancelled) setStatus(msg);
				} catch {}
			};

			ws.onerror = () => {
				if (!cancelled)
					setStatus({ type: "disconnected", reason: "WebSocket error" });
			};

			ws.onclose = () => {
				if (!cancelled)
					setStatus((prev) =>
						prev.type === "connected" ? { type: "disconnected" } : prev,
					);
			};
		}

		init();

		return () => {
			cancelled = true;
			wsRef.current?.close();
		};
	}, [userId]);

	return (
		<div className="max-w-lg">
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<CardTitle className="text-base">Connection Status</CardTitle>
						<StatusBadge status={status} />
					</div>
					<CardDescription>
						{status.type === "qr" &&
							"Scan the QR code with your WhatsApp mobile app."}
						{status.type === "connected" &&
							(status.phone
								? `Connected as +${status.phone}`
								: "WhatsApp is connected.")}
						{status.type === "disconnected" &&
							"WhatsApp is not linked. Reload to request a new QR code."}
						{status.type === "connecting" &&
							"Connecting to the socket service…"}
					</CardDescription>
				</CardHeader>

				<CardContent className="flex justify-center py-6">
					{status.type === "connecting" && (
						<Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
					)}

					{status.type === "qr" && (
						<div className="flex flex-col items-center gap-3">
							<Image
								src={status.data}
								alt="WhatsApp QR code"
								className="border rounded-lg"
								width={230}
								height={230}
							/>
							<p className="text-muted-foreground text-xs">
								Open WhatsApp {">"} Linked devices {">"} Link a device
							</p>
						</div>
					)}

					{status.type === "connected" && (
						<div className="flex flex-col items-center gap-2 py-4 text-green-600">
							<CheckCircle2 className="w-12 h-12" />
							<p className="font-medium text-sm">
								{status.phone ? `+${status.phone}` : "Connected"}
							</p>
						</div>
					)}

					{status.type === "disconnected" && (
						<div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
							<WifiOff className="w-12 h-12" />
							{status.reason && status.reason !== "idle_shutdown" && (
								<p className="text-xs">Reason: {status.reason}</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			<p className="mt-4 text-muted-foreground text-xs">
				The connection is maintained by the socket service. Closing this page
				does not immediately disconnect WhatsApp — the service will sleep after
				a few minutes of inactivity.
			</p>
		</div>
	);
}

function StatusBadge({ status }: { status: WsStatus }) {
	if (status.type === "connected")
		return (
			<Badge className="bg-green-100 border-green-200 text-green-700">
				Connected
			</Badge>
		);
	if (status.type === "qr")
		return (
			<Badge className="bg-yellow-100 border-yellow-200 text-yellow-700">
				Scan QR
			</Badge>
		);
	if (status.type === "connecting")
		return <Badge variant="secondary">Connecting…</Badge>;
	return <Badge variant="outline">Disconnected</Badge>;
}
