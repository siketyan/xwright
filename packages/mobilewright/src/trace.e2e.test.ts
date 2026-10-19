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

it("records the operations of Mobilewright, without the commands of the driver", async () => {
	const results = fileURLToPath(new URL("test-results/", fixture));
	await rm(results, { recursive: true, force: true });
	const { report } = await runFixture(fixture);
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 2, unexpected: 1 });

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
	// The commands the driver sent for the tap are not actions.
	expect(
		events.filter(
			(event) => event.type === "before" && event.parentId === tap?.callId,
		),
	).toEqual([]);
	expect(
		events.some((event) => event.type === "before" && event.class === "Driver"),
	).toBe(false);
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

// Reads the steps of the run of the fixture by the test above.
it("reports the operations of Mobilewright as Playwright reports the calls of its API", () => {
	const steps = JSON.parse(
		readFileSync(fileURLToPath(new URL("steps.json", fixture)), "utf8"),
	) as Record<string, { title: string; category: string; steps: unknown[] }[]>;
	const find = (
		list: { title: string; category: string; steps: unknown[] }[],
		title: string,
	) => list.find((step) => step.title === title);

	// Not steps of the test, which the list reporter prints, but calls of the API and assertions.
	expect(find(steps["taps a text"] ?? [], "locator.tap()")).toMatchObject({
		category: "pw:api",
	});
	const greet = find(steps["taps in a step"] ?? [], "greet");
	expect(greet).toMatchObject({ category: "test.step" });
	expect(greet?.steps).toEqual([
		expect.objectContaining({ title: "locator.tap()", category: "pw:api" }),
		expect.objectContaining({
			title: "expect.toBeVisible()",
			category: "expect",
		}),
	]);
});
