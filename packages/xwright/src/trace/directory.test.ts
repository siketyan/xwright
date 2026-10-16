import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TraceDirectory } from "./directory.js";

function readEvents(path: string): unknown[] {
	return readFileSync(path, "utf8")
		.trimEnd()
		.split("\n")
		.map((line) => JSON.parse(line));
}

function readMeta(dir: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(dir, "trace.json"), "utf8"));
}

function newDirectory(): TraceDirectory {
	const dir = join(mkdtempSync(join(tmpdir(), "xwright-trace-")), "trace");
	return new TraceDirectory(dir, undefined, {
		wallTime: 1000,
		monotonicTime: 5,
	});
}

describe("TraceDirectory", () => {
	it("writes trace.json and appends events to the tracks", () => {
		const trace = newDirectory();
		trace.testTrack()?.append({ type: "before", callId: "call@1" });
		const phone = trace.deviceTrack({
			name: "phone",
			adapter: "fake",
			trace: "on",
		});
		phone?.append({ type: "before", callId: "call@2" });
		phone?.append({ type: "after", callId: "call@2" });
		trace.setResult({ status: "passed", duration: 10 });
		trace.close();

		expect(readMeta(trace.path)).toEqual({
			version: 1,
			clock: { wallTime: 1000, monotonicTime: 5 },
			devices: [
				{ name: "phone", adapter: "fake", file: "phone.ndjson", trace: "on" },
			],
			types: {},
			result: { status: "passed", duration: 10 },
		});
		expect(readEvents(join(trace.path, "test.ndjson"))).toEqual([
			{ type: "before", callId: "call@1" },
		]);
		expect(readEvents(join(trace.path, "phone.ndjson"))).toEqual([
			{ type: "before", callId: "call@2" },
			{ type: "after", callId: "call@2" },
		]);
	});

	it("puts small payloads in events and others in resource files", () => {
		const trace = newDirectory();
		const track = trace.deviceTrack({
			name: "phone",
			adapter: "fake",
			trace: "on",
		});
		expect(track?.payload({ text: "small" })).toEqual({
			payload: { text: "small" },
		});

		const large = track?.payload({ text: "x".repeat(5000) });
		expect(large).toEqual({
			file: expect.stringMatching(/^phone\/resources\/[0-9a-f]{40}\.json$/),
			contentType: "application/json",
		});
		const png = track?.payload(new Uint8Array([1, 2, 3]), "image/png");
		expect(png).toEqual({
			file: expect.stringMatching(/^phone\/resources\/[0-9a-f]{40}\.png$/),
			contentType: "image/png",
		});
		const file = (png as { file: string }).file;
		expect([...readFileSync(join(trace.path, file))]).toEqual([1, 2, 3]);
	});

	it("deletes the tracks that are not kept", () => {
		const trace = newDirectory();
		trace.testTrack()?.append({ type: "before" });
		trace.deviceTrack({ name: "web", adapter: "fake", trace: "on" });
		trace
			.deviceTrack({
				name: "phone",
				adapter: "fake",
				trace: "retain-on-failure",
			})
			?.resource("data", "text/plain");

		expect(trace.retain((device) => device.trace === "on")).toBe(true);
		expect(existsSync(join(trace.path, "phone.ndjson"))).toBe(false);
		expect(existsSync(join(trace.path, "phone"))).toBe(false);
		expect(existsSync(join(trace.path, "web.ndjson"))).toBe(true);
		expect(readMeta(trace.path).devices).toEqual([
			{ name: "web", adapter: "fake", file: "web.ndjson", trace: "on" },
		]);
		expect(
			trace.deviceTrack({ name: "phone", adapter: "fake", trace: "on" }),
		).toBeUndefined();

		expect(trace.retain(() => false)).toBe(false);
		expect(existsSync(trace.path)).toBe(false);
		expect(trace.testTrack()).toBeUndefined();
	});
});
