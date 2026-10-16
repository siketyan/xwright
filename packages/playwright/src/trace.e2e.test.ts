import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../../xwright/test/run-fixture.js";

const fixture = new URL("../test/fixtures/web-trace/", import.meta.url);
const executable = "/opt/pw-browsers/chromium";

it("converts Playwright's live trace into the track of the device", async () => {
	const results = fileURLToPath(new URL("test-results/", fixture));
	await rm(results, { recursive: true, force: true });
	const { code, report } = await runFixture(
		fixture,
		[],
		existsSync(executable)
			? { XWRIGHT_CHROMIUM_EXECUTABLE_PATH: executable }
			: {},
	);
	expect(report.errors).toEqual([]);
	expect(code).toBe(0);

	const trace = join(
		results,
		"web.e2e.ts-clicks-a-button-traced",
		"xwright-trace",
	);
	const read = (track: string): Record<string, unknown>[] =>
		readFileSync(join(trace, `${track}.ndjson`), "utf8")
			.trimEnd()
			.split("\n")
			.map((line) => JSON.parse(line));
	const web = read("web");
	const [step] = read("test");

	// The calls of the API are actions, under the step that made them, with the stack of the test.
	const goto = web.find((event) => event.title === "Frame.goto");
	expect(goto).toMatchObject({
		type: "before",
		class: "Frame",
		method: "goto",
		parentId: step?.callId,
		stack: [
			expect.objectContaining({
				file: expect.stringMatching(/web\.e2e\.ts$/),
				line: 20,
			}),
			expect.objectContaining({
				file: expect.stringMatching(/web\.e2e\.ts$/),
				line: 19,
			}),
		],
	});
	const click = web.find((event) => event.title === "Frame.click");
	expect(click).not.toHaveProperty("parentId");

	// Playwright's events of the calls are put under the actions.
	const ofClick = web.filter((event) => event.callId === click?.callId);
	expect(ofClick.map((event) => event.type)).toEqual(
		expect.arrayContaining(["before", "log", "input", "after"]),
	);
	expect(
		web.some(
			(event) =>
				event.type === "frame-snapshot" &&
				(event.snapshot as { callId?: string }).callId === click?.callId,
		),
	).toBe(true);
	expect(web).toContainEqual(
		expect.objectContaining({ type: "message", text: "clicked" }),
	);
	expect(web).toContainEqual(
		expect.objectContaining({
			type: "resource",
			resourceType: "xwright.http@1",
			target: "https://xwright.test/",
			status: 200,
		}),
	);
	const frame = web.find((event) => event.type === "screencast-frame");
	expect(existsSync(join(trace, frame?.file as string))).toBe(true);

	// The times are the host's, between the start and the end of the step.
	const log = web.find(
		(event) => event.type === "log" && event.callId === goto?.callId,
	);
	expect(log?.time).toBeGreaterThan(goto?.startTime as number);
	expect(log?.time).toBeLessThan(
		read("test").find((event) => event.type === "after")?.endTime as number,
	);

	// Playwright's own files of the trace are not left.
	expect(readdirSync(trace).sort()).toEqual([
		"test.ndjson",
		"trace.json",
		"web",
		"web.ndjson",
	]);
}, 60_000);
