import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { zipDirectory } from "../../../xwright/src/trace/zip.ts";
import { findTraces, readZip } from "./source.ts";

function zip(files: Record<string, string | Buffer>): ArrayBuffer {
	const dir = mkdtempSync(join(tmpdir(), "xwright-ui-zip-"));
	for (const [name, content] of Object.entries(files)) {
		mkdirSync(join(dir, "content", name, ".."), { recursive: true });
		writeFileSync(join(dir, "content", name), content);
	}
	zipDirectory(join(dir, "content"), join(dir, "out.zip"));
	const data = readFileSync(join(dir, "out.zip"));
	return data.buffer.slice(
		data.byteOffset,
		data.byteOffset + data.byteLength,
	) as ArrayBuffer;
}

describe("readZip", () => {
	it("reads the files of a ZIP file", async () => {
		const entries = await readZip(
			zip({ "trace.json": "{}", "web/resources/a.txt": "a" }),
		);
		expect([...entries.keys()].sort()).toEqual([
			"trace.json",
			"web/resources/a.txt",
		]);
		expect(new TextDecoder().decode(entries.get("web/resources/a.txt"))).toBe(
			"a",
		);
	});
});

describe("findTraces", () => {
	it("finds a trace at the root", async () => {
		const traces = findTraces(
			"trace.zip",
			await readZip(zip({ "trace.json": '{"version":1}' })),
		);
		expect(traces.map((trace) => trace.label)).toEqual(["trace.zip"]);
		expect(await (await traces[0]?.open())?.text("trace.json")).toBe(
			'{"version":1}',
		);
	});

	it("finds the traces in directories and in ZIP files of an artifact", async () => {
		const inner = Buffer.from(zip({ "trace.json": '{"version":1}' }));
		const traces = findTraces(
			"traces.zip",
			await readZip(
				zip({
					"a-android/xwright-trace.zip": inner,
					"b-web/xwright-trace/trace.json": '{"version":2}',
				}),
			),
		);
		expect(traces.map((trace) => trace.label)).toEqual([
			"a-android/xwright-trace",
			"b-web/xwright-trace",
		]);
		expect(await (await traces[0]?.open())?.text("trace.json")).toBe(
			'{"version":1}',
		);
		expect(await (await traces[1]?.open())?.text("trace.json")).toBe(
			'{"version":2}',
		);
	});
});
