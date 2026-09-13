/**
 * G.711 µ-law (u-law) encode / decode utilities.
 *
 * Audio format used by Twilio Media Streams and OpenAI Realtime:
 *   - 8000 Hz, mono, µ-law encoded
 *   - payload transferred as base64 strings
 */

// ─── Decode table ─────────────────────────────────────────────────────────────

/** µ-law to 16-bit PCM lookup table (ITU-T G.711) */
const ULAW_DECODE_TABLE = new Int16Array(256);
(() => {
	for (let i = 0; i < 256; i++) {
		const mu = ~i & 0xff;
		const sign = mu & 0x80;
		const exponent = (mu >> 4) & 0x07;
		const mantissa = mu & 0x0f;
		let sample = ((mantissa << 3) + 0x84) << exponent;
		sample -= 0x84;
		ULAW_DECODE_TABLE[i] = sign ? -sample : sample;
	}
})();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decode a base64 G.711 µ-law chunk to a normalized Float32 PCM array
 * suitable for use with Web Audio API (values in [-1, 1]).
 */
export function decodeUlaw(base64Data: string): Float32Array {
	const binaryStr = atob(base64Data);
	const bytes = new Uint8Array(binaryStr.length);
	for (let i = 0; i < binaryStr.length; i++) {
		bytes[i] = binaryStr.charCodeAt(i);
	}
	const pcm = new Float32Array(bytes.length);
	for (let i = 0; i < bytes.length; i++) {
		pcm[i] = ULAW_DECODE_TABLE[bytes[i]] / 32768;
	}
	return pcm;
}

/**
 * Encode a single normalized PCM sample (float in [-1, 1]) to a µ-law byte.
 * Uses the standard ITU-T G.711 algorithm with bias 0x84.
 */
function encodeUlawSample(sample: number): number {
	const BIAS = 0x84;
	const CLIP = 32635;
	// Convert float to 16-bit signed
	let pcm = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
	const sign = pcm < 0 ? 0x80 : 0;
	if (pcm < 0) pcm = -pcm;
	pcm = Math.min(pcm + BIAS, CLIP + BIAS);
	// Find exponent
	let exponent = 7;
	for (
		let mask = 0x4000;
		(pcm & mask) === 0 && exponent > 0;
		exponent--, mask >>= 1
	) {}
	const mantissa = (pcm >> (exponent + 3)) & 0x0f;
	return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/**
 * Encode a Float32Array of normalized PCM samples (values in [-1, 1]) to a
 * base64 G.711 µ-law string.  The resulting string can be used directly as
 * the `payload` field in a Twilio Media Stream `media` event.
 */
export function encodeUlawToBase64(pcm: Float32Array): string {
	const bytes = new Uint8Array(pcm.length);
	for (let i = 0; i < pcm.length; i++) {
		bytes[i] = encodeUlawSample(pcm[i]);
	}
	// Convert to binary string for btoa
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}
