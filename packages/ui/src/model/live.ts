import type { TraceSource } from "./source.ts";
import {
	parseEvents,
	parseTrace,
	TEST_TRACK,
	type Trace,
	type TraceEvent,
	type TraceMeta,
} from "./trace.ts";

/** The part of a track read so far. */
interface TrackState {
	offset: number;
	decoder: TextDecoder;
	/** The last line, not written to its end yet, to join with what comes next. */
	rest: string;
	events: TraceEvent[];
}

/** How often a trace being written is read again, in milliseconds. */
const INTERVAL = 500;

/**
 * Follows a trace while it is written: reads what was appended to each track, and `trace.json` for the devices added
 * since and for the result. Calls `onTrace` with the trace at first and whenever it changed, until the test ended or
 * the signal aborts. A source that does not change is read once.
 */
export async function watchTrace(
	source: TraceSource,
	onTrace: (trace: Trace) => void,
	signal?: AbortSignal,
): Promise<void> {
	const tracks = new Map<string, TrackState>();
	let lastMeta = "";

	const poll = async (): Promise<TraceMeta> => {
		const text = await source.text("trace.json");
		if (text === undefined) {
			throw new Error(`${source.name} has no trace.json`);
		}
		const meta = JSON.parse(text) as TraceMeta;
		let changed = text !== lastMeta;
		lastMeta = text;
		const files = [
			{ name: TEST_TRACK, file: `${TEST_TRACK}.ndjson` },
			...meta.devices.map(({ name, file }) => ({ name, file })),
		];
		for (const { name, file } of files) {
			let track = tracks.get(name);
			if (track === undefined) {
				track = { offset: 0, decoder: new TextDecoder(), rest: "", events: [] };
				tracks.set(name, track);
			}
			let text: string;
			if (source.bytesFrom === undefined) {
				text = (await source.text(file)) ?? "";
			} else {
				const bytes = await source.bytesFrom(file, track.offset);
				track.offset += bytes.length;
				text = track.decoder.decode(bytes, { stream: true });
			}
			if (text === "") {
				continue;
			}
			const lines = (track.rest + text).split("\n");
			track.rest = lines.pop() ?? "";
			track.events.push(...parseEvents(lines.join("\n")));
			changed = true;
		}
		if (changed) {
			onTrace(
				parseTrace(
					meta,
					files.map(({ name }) => ({
						name,
						events: tracks.get(name)?.events ?? [],
					})),
					(file) => source.url(file),
				),
			);
		}
		return meta;
	};

	let meta = await poll();
	// The duration is written when the test ended, after its last hooks.
	while (
		source.bytesFrom !== undefined &&
		!(meta.result && meta.result.duration > 0)
	) {
		await new Promise((resolve) => setTimeout(resolve, INTERVAL));
		if (signal?.aborted) {
			return;
		}
		meta = await poll();
	}
}
