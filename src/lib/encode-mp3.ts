import { Mp3Encoder } from "@breezystack/lamejs";

const BITRATE_KBPS = 96;
const FRAME_SIZE = 1152;

function toInt16(samples: Float32Array): Int16Array {
	const out = new Int16Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return out;
}

/**
 * Re-encodes a browser recording (webm/opus, mp4/aac, wav…) as mono MP3, so it
 * plays and downloads the same everywhere. Throws if the browser can't decode it.
 */
export async function encodeMp3(blob: Blob): Promise<Blob> {
	const ctx = new AudioContext();
	let decoded: AudioBuffer;
	try {
		decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
	} finally {
		void ctx.close();
	}

	// Recordings are one mixed track; average channels down to mono.
	const mono = new Float32Array(decoded.length);
	for (let c = 0; c < decoded.numberOfChannels; c++) {
		const channel = decoded.getChannelData(c);
		for (let i = 0; i < mono.length; i++) {
			mono[i] += channel[i] / decoded.numberOfChannels;
		}
	}
	const pcm = toInt16(mono);

	const encoder = new Mp3Encoder(1, decoded.sampleRate, BITRATE_KBPS);
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	for (let i = 0; i < pcm.length; i += FRAME_SIZE) {
		const out = encoder.encodeBuffer(pcm.subarray(i, i + FRAME_SIZE));
		if (out.length) chunks.push(new Uint8Array(out));
	}
	const tail = encoder.flush();
	if (tail.length) chunks.push(new Uint8Array(tail));

	return new Blob(chunks, { type: "audio/mpeg" });
}
