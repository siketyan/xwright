import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TraceDirectory, type Track } from "./directory.js";
import { createTracer } from "./tracer.js";

function setup(): { track: Track; read: () => Record<string, unknown>[] } {
	const dir = join(mkdtempSync(join(tmpdir(), "xwright-trace-")), "trace");
	const trace = new TraceDirectory(dir);
	const track = trace.deviceTrack({
		name: "phone",
		adapter: "fake",
		trace: "on",
	}) as Track;
	return {
		track,
		read: () =>
			readFileSync(join(dir, "phone.ndjson"), "utf8")
				.trimEnd()
				.split("\n")
				.map((line) => JSON.parse(line)),
	};
}

describe("createTracer", () => {
	it("records nested actions with their parents", async () => {
		const { track, read } = setup();
		const tracer = createTracer(() => track);
		const result = await tracer.action(
			{ title: "tap", class: "Locator", method: "tap", t: 10 },
			() =>
				tracer.action({ title: "find", t: 11 }, () => {
					tracer.log({ callId: "call@x", text: "waiting", t: 12 });
					return 42;
				}),
		);
		expect(result).toBe(42);

		const [outer, inner, log, innerEnd, outerEnd] = read();
		expect(outer).toMatchObject({
			type: "before",
			startTime: 10,
			title: "tap",
			class: "Locator",
			method: "tap",
			params: {},
		});
		expect(outer).not.toHaveProperty("parentId");
		// The frames of Xwright, where this test is, are left out of the stack.
		expect(outer?.stack).toEqual([]);
		expect(inner).toMatchObject({
			type: "before",
			parentId: outer?.callId,
			startTime: 11,
			class: "Device",
			method: "find",
		});
		expect(log).toEqual({
			type: "log",
			callId: "call@x",
			time: 12,
			message: "waiting",
		});
		expect(innerEnd).toMatchObject({ type: "after", callId: inner?.callId });
		expect(outerEnd).toMatchObject({ type: "after", callId: outer?.callId });
	});

	it("records the error of a failed action", async () => {
		const { track, read } = setup();
		const tracer = createTracer(() => track);
		await expect(
			tracer.action({ title: "tap" }, () => {
				throw new TypeError("gone");
			}),
		).rejects.toThrow("gone");
		expect(read()[1]).toMatchObject({
			type: "after",
			error: { name: "TypeError", message: "gone" },
		});
	});

	it("records snapshots, messages and resources", () => {
		const { track, read } = setup();
		const tracer = createTracer(() => track);
		const span = tracer.begin({ title: "tap", t: 1 });
		tracer.input({ callId: span.callId, point: { x: 1, y: 2 } });
		tracer.snapshot({
			type: "xwright.screenshot@1",
			phase: "after",
			callId: span.callId,
			payload: new Uint8Array([1]),
			t: 2,
		});
		tracer.snapshot({ type: "myco.ble.att@1", payload: { handle: 3 }, t: 3 });
		tracer.end(span, { result: "ok", t: 4 });
		tracer.log({ level: "warning", text: "low battery", t: 5 });
		tracer.resource({
			type: "xwright.http@1",
			target: "https://example.com/",
			status: 200,
			startTime: 6,
			endTime: 7,
		});

		expect(read().slice(1)).toEqual([
			{ type: "input", callId: span.callId, point: { x: 1, y: 2 } },
			{
				type: "screenshot",
				callId: span.callId,
				phase: "after",
				time: 2,
				file: expect.stringMatching(/^phone\/resources\/.*\.png$/),
			},
			{
				type: "snapshot",
				snapshotType: "myco.ble.att@1",
				time: 3,
				payload: { handle: 3 },
			},
			{ type: "after", callId: span.callId, endTime: 4, result: "ok" },
			{ type: "message", time: 5, level: "warning", text: "low battery" },
			{
				type: "resource",
				id: expect.stringMatching(/^resource@/),
				resourceType: "xwright.http@1",
				startTime: 6,
				endTime: 7,
				target: "https://example.com/",
				status: 200,
			},
		]);
	});

	it("records nothing without a track", async () => {
		const tracer = createTracer(() => undefined);
		expect(await tracer.action({ title: "tap" }, () => 1)).toBe(1);
	});
});
