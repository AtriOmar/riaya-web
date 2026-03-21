"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

type CallData = {
  callSid: string;
  startTime: string;
  status: "active" | "ended";
  endTime?: string;
  transcript: TranscriptEntry[];
  patientName: string | null;
  functionCalls: FunctionCallEntry[];
};

type TranscriptEntry = {
  role: "patient" | "ai" | "system";
  text: string;
  timestamp: number;
};

type FunctionCallEntry = {
  name: string;
  args: unknown;
  status: "calling" | "success" | "error";
  result?: unknown;
  timestamp: number;
};

type WsMessage =
  | { type: "call_start"; callSid: string; timestamp: string }
  | { type: "call_end"; callSid: string; timestamp: string }
  | {
      type: "patient_transcript";
      callSid: string;
      text: string;
      isFinal: boolean;
    }
  | {
      type: "ai_transcript";
      callSid: string;
      text: string;
      isFinal: boolean;
    }
  | { type: "patient_audio" | "ai_audio"; callSid: string; payload: string }
  | {
      type: "function_call";
      callSid: string;
      name: string;
      args: unknown;
      status: "calling" | "success" | "error";
      result?: unknown;
    }
  | { type: "appointment_booked"; callSid: string }
  | { type: "error"; callSid: string; message: string };

export default function useRealtimeSocket() {
  const [calls, setCalls] = useState<Map<string, CallData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [listeningCalls, setListeningCalls] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCallbackRef = useRef<
    ((callSid: string, role: string, payload: string) => void) | null
  >(null);

  const toggleListening = useCallback((callSid: string) => {
    setListeningCalls((prev) => {
      const next = new Set(prev);
      if (next.has(callSid)) next.delete(callSid);
      else next.add(callSid);
      return next;
    });
  }, []);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case "call_start":
        setCalls((prev) => {
          const next = new Map(prev);
          next.set(msg.callSid, {
            callSid: msg.callSid,
            startTime: msg.timestamp,
            status: "active",
            transcript: [],
            patientName: null,
            functionCalls: [],
          });
          return next;
        });
        break;

      case "call_end":
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (call)
            next.set(msg.callSid, {
              ...call,
              status: "ended",
              endTime: msg.timestamp,
            });
          return next;
        });
        setListeningCalls((prev) => {
          const next = new Set(prev);
          next.delete(msg.callSid);
          return next;
        });
        break;

      case "patient_transcript":
        if (!msg.isFinal) break;
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (call)
            next.set(msg.callSid, {
              ...call,
              transcript: [
                ...call.transcript,
                { role: "patient", text: msg.text, timestamp: Date.now() },
              ],
            });
          return next;
        });
        break;

      case "ai_transcript":
        if (!msg.isFinal) break;
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (call)
            next.set(msg.callSid, {
              ...call,
              transcript: [
                ...call.transcript,
                { role: "ai", text: msg.text, timestamp: Date.now() },
              ],
            });
          return next;
        });
        break;

      case "patient_audio":
      case "ai_audio": {
        const role = msg.type === "patient_audio" ? "patient" : "ai";
        audioCallbackRef.current?.(msg.callSid, role, msg.payload);
        break;
      }

      case "function_call":
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (!call) return prev;

          const functionCalls = [...call.functionCalls];
          const entry: FunctionCallEntry = {
            name: msg.name,
            args: msg.args,
            status: msg.status,
            result: msg.result,
            timestamp: Date.now(),
          };

          const idx = functionCalls.findIndex(
            (fc) => fc.name === msg.name && fc.status === "calling",
          );
          if (idx >= 0 && msg.status !== "calling") functionCalls[idx] = entry;
          else functionCalls.push(entry);

          const text =
            msg.status === "calling"
              ? `🔧 Calling ${msg.name}...`
              : msg.status === "success"
                ? `✅ ${msg.name} completed`
                : `❌ ${msg.name} failed`;

          next.set(msg.callSid, {
            ...call,
            functionCalls,
            transcript: [
              ...call.transcript,
              { role: "system", text, timestamp: Date.now() },
            ],
          });
          return next;
        });
        break;

      case "appointment_booked":
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (call)
            next.set(msg.callSid, {
              ...call,
              transcript: [
                ...call.transcript,
                {
                  role: "system",
                  text: "📅 Appointment booked successfully!",
                  timestamp: Date.now(),
                },
              ],
            });
          return next;
        });
        break;

      case "error":
        setCalls((prev) => {
          const next = new Map(prev);
          const call = next.get(msg.callSid);
          if (call)
            next.set(msg.callSid, {
              ...call,
              transcript: [
                ...call.transcript,
                {
                  role: "system",
                  text: `⚠️ Error: ${msg.message}`,
                  timestamp: Date.now(),
                },
              ],
            });
          return next;
        });
        break;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    const delay =
      RECONNECT_DELAYS[
        Math.min(reconnectAttempt.current, RECONNECT_DELAYS.length - 1)
      ];
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (!url) return;

    try {
      const ws = new WebSocket(`${url}/dashboard`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempt.current = 0;
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        /* onclose will fire */
      };

      ws.onmessage = (event) => {
        try {
          handleMessage(JSON.parse(event.data));
        } catch {
          /* ignore malformed messages */
        }
      };
    } catch {
      scheduleReconnect();
    }
  }, [handleMessage, scheduleReconnect]);

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

  return {
    calls,
    isConnected,
    listeningCalls,
    toggleListening,
    audioCallbackRef,
  };
}
