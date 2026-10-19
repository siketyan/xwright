import { mkdirSync, mkdtempSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TraceDirectory } from "./directory.js";
import { openTrace, openTraces, serveTrace } from "./server.js";
import { zipDirectory } from "./zip.js";

function makeTrace(): string {
	const dir = join(
		mkdtempSync(join(tmpdir(), "xwright-serve-")),
		"xwright-trace",
	);
	const trace = new TraceDirectory(dir);
	trace.deviceTrack({ name: "web", adapter: "fake", trace: "on" })?.append({
		type: "before",
		callId: "call@1",
		stack: [{ file: import.meta.filename, line: 1, column: 1 }],
	});
	trace.close();
	return dir;
}

const servers: { close(): void }[] = [];
afterEach(() => {
	for (const server of servers.splice(0)) {
		server.close();
	}
});

async function serve(path: string): Promise<string> {
	const { url, server } = await serveTrace(openTrace(path));
	servers.push(server);
	return url;
}

describe("serveTrace", () => {
	for (const [kind, prepare] of [
		["a directory", (dir: string) => dir],
		[
			"a ZIP file",
			(dir: string) => {
				zipDirectory(dir, `${dir}.zip`);
				return `${dir}.zip`;
			},
		],
	] as const) {
		it(`serves the UI and the files of ${kind}`, async () => {
			const url = await serve(prepare(makeTrace()));

			const page = await fetch(url);
			expect(page.headers.get("content-type")).toMatch(/^text\/html/);
			expect(await page.text()).toContain('<div id="root">');

			const meta = await fetch(new URL("trace/trace.json", url));
			expect(await meta.json()).toMatchObject({ version: 1 });
			const track = await fetch(new URL("trace/web.ndjson", url));
			expect(await track.text()).toContain('"callId":"call@1"');
			expect((await fetch(new URL("trace/missing.ndjson", url))).status).toBe(
				404,
			);
		});
	}

	it("serves only the sources the stacks point to", async () => {
		const url = await serve(makeTrace());
		const source = (file: string) =>
			fetch(new URL(`source?file=${encodeURIComponent(file)}`, url));
		expect(await (await source(import.meta.filename)).text()).toContain(
			"serves only the sources",
		);
		expect((await source("/etc/passwd")).status).toBe(404);
		expect(
			(await fetch(new URL("trace/..%2F..%2Fetc%2Fpasswd", url))).status,
		).toBe(404);
	});

	it("serves ranges of files, for the live UI", async () => {
		const url = await serve(makeTrace());
		const track = new URL("trace/web.ndjson", url);
		const whole = await (await fetch(track)).text();

		const rest = await fetch(track, { headers: { range: "bytes=10-" } });
		expect(rest.status).toBe(206);
		expect(rest.headers.get("content-range")).toBe(
			`bytes 10-${whole.length - 1}/${whole.length}`,
		);
		expect(await rest.text()).toBe(whole.slice(10));

		const none = await fetch(track, {
			headers: { range: `bytes=${whole.length}-` },
		});
		expect(none.status).toBe(416);
	});

	it("refuses a path without a trace", () => {
		expect(() => openTrace(tmpdir())).toThrow(/has no trace\.json/);
	});
});

describe("openTraces", () => {
	it("finds the traces under a directory, also the exported ones, once", () => {
		const results = mkdtempSync(join(tmpdir(), "xwright-results-"));
		// Exported, with its directory still there.
		const kept = makeTrace();
		renameSync(dirname(kept), join(results, "a"));
		zipDirectory(
			join(results, "a", "xwright-trace"),
			join(results, "a", "xwright-trace.zip"),
		);
		// Exported only, as downloaded from CI.
		const exported = makeTrace();
		mkdirSync(join(results, "b"));
		zipDirectory(exported, join(results, "b", "xwright-trace.zip"));

		const traces = openTraces(results);
		expect(traces.map((trace) => trace.label)).toEqual([
			"a/xwright-trace",
			"b/xwright-trace.zip",
		]);
		for (const trace of traces) {
			expect(trace.files.read("web.ndjson")?.toString()).toContain("call@1");
		}
	});

	it("finds the traces in a ZIP file, also in the ZIP files in it", () => {
		const artifact = mkdtempSync(join(tmpdir(), "xwright-artifact-"));
		mkdirSync(join(artifact, "content", "a"), { recursive: true });
		zipDirectory(
			makeTrace(),
			join(artifact, "content", "a", "xwright-trace.zip"),
		);
		zipDirectory(join(artifact, "content"), join(artifact, "traces.zip"));
		expect(
			openTraces(join(artifact, "traces.zip")).map((trace) => trace.label),
		).toEqual(["traces.zip/a/xwright-trace.zip"]);
	});
});
