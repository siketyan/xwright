import { describe, expect, it } from "vitest";
import { watchTrace } from "./live.ts";
import type { TraceSource } from "./source.ts";
import type { Trace } from "./trace.ts";

/** A trace being written: each read of a file gets the next chunk of it. */
function writingSource(
	meta: string[],
	chunks: Record<string, string[]>,
): TraceSource {
	const encoder = new TextEncoder();
	let metaRead = 0;
	const written: Record<string, string> = {};
	const reads: Record<string, number> = {};
	return {
		name: "live",
		async text(path) {
			if (path === "trace.json") {
				return meta[Math.min(metaRead++, meta.length - 1)];
			}
			return written[path];
		},
		url: (path) => path,
		async bytesFrom(path, offset) {
			const index = reads[path] ?? 0;
			reads[path] = index + 1;
			written[path] = (written[path] ?? "") + (chunks[path]?.[index] ?? "");
			return encoder.encode(written[path]).subarray(offset);
		},
	};
}

const device = {
	name: "web",
	adapter: "fake",
	file: "web.ndjson",
	trace: "on",
};
const meta = (devices: unknown[], result?: unknown) =>
	JSON.stringify({
		version: 1,
		clock: { wallTime: 0, monotonicTime: 0 },
		devices,
		types: {},
		result,
	});

describe("watchTrace", () => {
	it("reads what is appended, joins split lines, and stops when the test ended", async () => {
		const source = writingSource(
			[
				meta([]),
				meta([device]),
				meta([device], { status: "passed", duration: 0 }),
				meta([device], { status: "passed", duration: 30 }),
			],
			{
				"test.ndjson": [
					'{"type":"before","callId":"s","startTime":1,"title":"st',
					'ep"}\n',
					'{"type":"after","callId":"s","endTime":9}\n',
				],
				"web.ndjson": [
					'{"type":"before","callId":"a","parentId":"s","startTime":2,"title":"tap"}\n',
				],
			},
		);
		const traces: Trace[] = [];
		await watchTrace(source, (trace) => traces.push(trace));

		const last = traces.at(-1);
		expect(last?.meta.result).toEqual({ status: "passed", duration: 30 });
		expect(last?.actions.map((action) => action.title)).toEqual(["step"]);
		expect(last?.actions[0]?.children.map((action) => action.title)).toEqual([
			"tap",
		]);
		expect(last?.actions[0]?.endTime).toBe(9);
		// The first read had only a part of the line of the step.
		expect(traces[0]?.actions).toEqual([]);
	});

	it("reads a source that does not change once", async () => {
		const traces: Trace[] = [];
		await watchTrace(
			{
				name: "zip",
				text: async (path) => (path === "trace.json" ? meta([]) : ""),
				url: (path) => path,
			},
			(trace) => traces.push(trace),
		);
		expect(traces).toHaveLength(1);
	});
});
