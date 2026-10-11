"use client";

/**
 * useLivekitCall
 *
 * Browser test call against the LiveKit voice agent. Joins a LiveKit room over
 * WebRTC with a token from `POST /api/livekit/test-call-token` (the token's room
 * config dispatches the agent), publishes the mic and plays the agent's audio.
 * Same shape as `useSimulatedCall` so the test-call UI can switch engines.
 *
 * Transcripts come from the voice server's `/dashboard` feed, which the agent
 * relays to under the same callSid.
 */

import {
	ParticipantKind,
	type RemoteTrack,
	Room,
	RoomEvent,
	Track,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCallTranscript } from "@/hooks/use-call-transcript";
import type {
	SimulatedCallState,
	SimulatedCallStatus,
} from "@/hooks/use-simulated-call";
import { getErrorMessage } from "@/lib/error-handling";
import { usePostApiLivekitTestCallToken } from "@/services/generated/test-call/test-call";

/** How long to wait for the agent worker to join before giving up. */
const AGENT_JOIN_TIMEOUT_MS = 20_000;

/** Resolves once an agent participant is in the room, or rejects after the timeout. */
function waitForAgent(room: Room): Promise<void> {
	const hasAgent = () =>
		[...room.remoteParticipants.values()].some(
			(p) => p.kind === ParticipantKind.AGENT,
		);
	return new Promise((resolve, reject) => {
		if (hasAgent()) return resolve();
		const timer = setTimeout(() => {
			room.off(RoomEvent.ParticipantConnected, onJoin);
			reject(
				new Error(
					"The voice agent didn't join the call. Make sure the LiveKit agent is running (pnpm agent:dev in voice/).",
				),
			);
		}, AGENT_JOIN_TIMEOUT_MS);
		const onJoin = () => {
			if (!hasAgent()) return;
			clearTimeout(timer);
			room.off(RoomEvent.ParticipantConnected, onJoin);
			resolve();
		};
		room.on(RoomEvent.ParticipantConnected, onJoin);
	});
}

export function useLivekitCall(): SimulatedCallState {
	const [status, setStatus] = useState<SimulatedCallStatus>("idle");
	const [callSid, setCallSid] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const {
		transcript,
		connect: connectDashboard,
		disconnect: disconnectDashboard,
		reset: resetTranscript,
	} = useCallTranscript();
	const { trigger: requestToken } = usePostApiLivekitTestCallToken();

	const roomRef = useRef<Room | null>(null);
	const audioElsRef = useRef<HTMLMediaElement[]>([]);

	const detachAudio = useCallback(() => {
		for (const el of audioElsRef.current) el.remove();
		audioElsRef.current = [];
	}, []);

	const teardown = useCallback(() => {
		const room = roomRef.current;
		roomRef.current = null;
		if (room) {
			room.removeAllListeners();
			void room.disconnect();
		}
		detachAudio();
		disconnectDashboard();
	}, [detachAudio, disconnectDashboard]);

	const startCall = useCallback(
		async (phoneNumber: string) => {
			if (status !== "idle" && status !== "ended" && status !== "error") return;
			const trimmedPhone = phoneNumber.trim();
			if (!trimmedPhone) return;

			setError(null);
			resetTranscript();
			setStatus("connecting");

			try {
				const {
					token,
					url,
					callSid: sid,
				} = await requestToken({
					phoneNumber: trimmedPhone,
				});
				setCallSid(sid);
				connectDashboard(sid);

				const room = new Room({
					audioCaptureDefaults: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					},
				});
				roomRef.current = room;

				room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
					if (track.kind !== Track.Kind.Audio) return;
					const el = track.attach();
					el.style.display = "none";
					document.body.appendChild(el);
					audioElsRef.current.push(el);
				});
				room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
					for (const el of track.detach()) el.remove();
				});
				// The agent deletes the room after `end_call`; the user can also hang up.
				room.on(RoomEvent.Disconnected, () => {
					teardown();
					setStatus("ended");
				});

				await room.connect(url, token);
				setStatus("requesting-mic");
				await room.localParticipant.setMicrophoneEnabled(true);
				await room.startAudio();
				// Stay in "connecting" until the agent is actually there, so the page
				// never claims to be in a call with an empty room.
				setStatus("connecting");
				await waitForAgent(room);
				setStatus("in-call");
			} catch (err) {
				teardown();
				setError(
					err instanceof Error && err.message.startsWith("The voice agent")
						? err.message
						: getErrorMessage(err, "Could not start the LiveKit call."),
				);
				setStatus("error");
			}
		},
		[status, resetTranscript, requestToken, connectDashboard, teardown],
	);

	const hangUp = useCallback(() => {
		teardown();
		setStatus("ended");
	}, [teardown]);

	useEffect(() => teardown, [teardown]);

	return { status, callSid, error, transcript, startCall, hangUp };
}
