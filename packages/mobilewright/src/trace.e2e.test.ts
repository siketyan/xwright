import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../../xwright/test/run-fixture.js";

const fixture = new URL("../test/fixtures/fake-device-trace/", import.meta.url);

function track(results: string, test: string): Record<string, unknown>[] {
	return readFileSync(
		join(results, test, "xwright-trace", "phone.ndjson"),
		"utf8",
	)
		.trimEnd()
		.split("\n")
		.map((line) => JSON.parse(line));
}

it("records the operations of Mobilewright with the commands of the driver", async () => {
	const results = fileURLToPath(new URL("test-results/", fixture));
	await rm(results, { recursive: true, force: true });
	const { report } = await runFixture(fixture);
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 1, unexpected: 1 });

	const events = track(results, "trace.e2e.ts-taps-a-text-android");
	const tap = events.find((event) => event.title === "locator.tap()");
	expect(tap).toMatchObject({
		type: "before",
		class: "Mobilewright",
		stack: [
			expect.objectContaining({
				file: expect.stringMatching(/trace\.e2e\.ts$/),
				line: 13,
			}),
		],
	});
	expect(
		events
			.filter(
				(event) => event.type === "before" && event.parentId === tap?.callId,
			)
			.map((event) => event.title),
	).toEqual(["getViewHierarchy", "getViewHierarchy", "tap"]);
	expect(events).toContainEqual(
		expect.objectContaining({
			type: "screenshot",
			callId: tap?.callId,
			phase: "after",
			file: expect.stringMatching(/^phone\/resources\/.*\.png$/),
		}),
	);

	// The app is relaunched under the hook of the adapter.
	const beforeEach = events.find((event) => event.title === "beforeEach");
	expect(
		events
			.filter(
				(event) =>
					event.type === "before" && event.parentId === beforeEach?.callId,
			)
			.map((event) => event.title),
	).toEqual(["device.terminateApp()", "device.launchApp()"]);

	// A failure records the view hierarchy under onFailure.
	const failed = track(results, "trace.e2e.ts-fails-android");
	const onFailure = failed.find((event) => event.title === "onFailure");
	expect(failed).toContainEqual(
		expect.objectContaining({
			type: "snapshot",
			snapshotType: "xwright.view-tree@1",
			callId: onFailure?.callId,
			payload: [expect.objectContaining({ type: "Window" })],
		}),
	);
}, 60_000);
