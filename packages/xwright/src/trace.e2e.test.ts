import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../test/run-fixture.js";

const results = fileURLToPath(
	new URL("../test/fixtures/trace/test-results/", import.meta.url),
);

function events(trace: string, track: string): Record<string, unknown>[] {
	return readFileSync(
		join(results, trace, "xwright-trace", `${track}.ndjson`),
		"utf8",
	)
		.trimEnd()
		.split("\n")
		.map((line) => JSON.parse(line));
}

function meta(trace: string): Record<string, unknown> {
	return JSON.parse(
		readFileSync(join(results, trace, "xwright-trace", "trace.json"), "utf8"),
	);
}

it("writes the trace of each test by the trace modes of the devices", async () => {
	await rm(results, { recursive: true, force: true });
	const { report } = await runFixture("trace");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 2, unexpected: 4 });

	// "b" records only on failure, so the passing test keeps only "a".
	const passes = "trace.e2e.ts-passes-traced";
	expect(meta(passes)).toMatchObject({
		version: 1,
		test: { title: "passes", project: "traced", retry: 0 },
		devices: [{ name: "a", adapter: "fake", file: "a.ndjson", trace: "on" }],
		result: { status: "passed" },
	});
	expect(existsSync(join(results, passes, "xwright-trace", "b.ndjson"))).toBe(
		false,
	);

	const [outer, inner, innerEnd, outerEnd, stdout] = events(passes, "test");
	expect(outer).toMatchObject({
		type: "before",
		title: "outer",
		class: "Test",
	});
	expect(inner).toMatchObject({
		type: "before",
		title: "inner",
		parentId: outer?.callId,
	});
	expect(innerEnd).toMatchObject({ type: "after", callId: inner?.callId });
	expect(outerEnd).toMatchObject({ type: "after", callId: outer?.callId });
	expect(stdout).toMatchObject({
		type: "stdout",
		text: "hello from the test\n",
	});

	const [tap, message, screenshot, tapEnd] = events(passes, "a");
	expect(tap).toMatchObject({
		type: "before",
		title: "tap button",
		parentId: inner?.callId,
		stack: [
			{ file: expect.stringMatching(/xwright\.config\.ts$/), line: 12 },
			{ file: expect.stringMatching(/trace\.e2e\.ts$/), line: 16 },
			{ file: expect.stringMatching(/trace\.e2e\.ts$/), line: 15 },
			{ file: expect.stringMatching(/trace\.e2e\.ts$/), line: 14 },
		],
	});
	expect(message).toMatchObject({ type: "message", text: "tapped button" });
	expect(screenshot).toMatchObject({
		type: "screenshot",
		callId: tap?.callId,
		file: expect.stringMatching(/^a\/resources\/.*\.png$/),
	});
	expect(
		readFileSync(
			join(results, passes, "xwright-trace", screenshot?.file as string),
		),
	).toEqual(Buffer.from([137, 80, 78, 71]));
	expect(tapEnd).toMatchObject({ type: "after", callId: tap?.callId });

	// The failing test keeps both devices, and its error.
	const fails = "trace.e2e.ts-fails-traced";
	expect(meta(fails)).toMatchObject({
		devices: [{ name: "a" }, { name: "b" }],
		result: { status: "failed" },
	});
	expect(events(fails, "test")).toEqual([
		expect.objectContaining({ type: "error", message: "Error: expected" }),
	]);

	// A test that failed in `beforeAll`, with no `afterEach` run, keeps its trace and its error too.
	const failsInBeforeAll = "uses-before-all.e2e.ts-fails-in-beforeAll-traced";
	expect(meta(failsInBeforeAll)).toMatchObject({
		devices: [{ name: "a" }],
		result: { status: "failed" },
	});
	expect(events(failsInBeforeAll, "test")).toEqual([
		expect.objectContaining({
			type: "error",
			message: "Error: beforeAll failed",
		}),
	]);
	expect(events(failsInBeforeAll, "a")).toContainEqual(
		expect.objectContaining({ type: "before", title: "tap sign in" }),
	);

	// The worker has the creation and the disposal of the devices.
	const worker = join(results, "xwright-worker-0");
	expect(readdirSync(worker).sort()).toEqual([
		"a.ndjson",
		"b.ndjson",
		"trace.json",
	]);

	// The project without trace modes writes nothing.
	expect(
		existsSync(join(results, "trace.e2e.ts-passes-untraced", "xwright-trace")),
	).toBe(false);
}, 60_000);
