import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../../xwright/test/run-fixture.js";
import { startFakeAppium } from "../test/fake-appium.js";

const fixture = new URL("../test/fixtures/fake/", import.meta.url);

function track(results: string, test: string): Record<string, unknown>[] {
	return readFileSync(
		join(results, test, "xwright-trace", "phone.ndjson"),
		"utf8",
	)
		.trimEnd()
		.split("\n")
		.map((line) => JSON.parse(line));
}

it("drives a device through Appium and records its commands", async () => {
	const results = fileURLToPath(new URL("test-results/", fixture));
	await rm(results, { recursive: true, force: true });
	const appium = await startFakeAppium();
	try {
		const { report } = await runFixture(fixture, [], {
			FAKE_APPIUM_URL: appium.url,
		});
		expect(report.errors).toEqual([]);
		expect(report.stats).toMatchObject({ expected: 1, unexpected: 1 });

		const requests = appium.log.map((line) =>
			line.split(" ").slice(0, 2).join(" "),
		);
		// One session for the worker, and the app launched again before each test.
		expect(
			requests.filter((request) => request === "POST /session"),
		).toHaveLength(1);
		expect(appium.log).toContain(
			'POST /execute/sync {"script":"mobile: terminateApp","args":[{"appId":"com.example.app"}]}',
		);
		expect(appium.log).toContain(
			'POST /execute/sync {"script":"mobile: activateApp","args":[{"appId":"com.example.app"}]}',
		);
		// The screenshot after a click is taken before the next command of the test.
		const click = requests.indexOf("POST /element/e-Sign%20in/click");
		expect(requests.slice(click + 1, click + 3)).toEqual([
			"GET /screenshot",
			"POST /elements",
		]);
		expect(requests.at(-1)).toBe("DELETE /");

		const events = track(results, "appium.e2e.ts-signs-in-android");
		const find = events.find(
			(event) => event.title === "findElements accessibility id=Sign in",
		);
		expect(find).toMatchObject({
			type: "before",
			class: "Appium",
			method: "findElements",
			stack: [
				expect.objectContaining({
					file: expect.stringMatching(/appium\.e2e\.ts$/),
					line: 14,
				}),
				expect.anything(),
			],
		});
		// Under the step of the test.
		const [stepStart] = readFileSync(
			join(
				results,
				"appium.e2e.ts-signs-in-android",
				"xwright-trace",
				"test.ndjson",
			),
			"utf8",
		)
			.split("\n")
			.map((line) => JSON.parse(line || "{}"));
		expect(find?.parentId).toBe(stepStart?.callId);
		const click2 = events.find((event) => event.title === "elementClick");
		expect(events).toContainEqual(
			expect.objectContaining({
				type: "screenshot",
				callId: click2?.callId,
				phase: "after",
			}),
		);

		// The source of the page is recorded when a test failed.
		const failed = track(results, "appium.e2e.ts-fails-android");
		expect(failed).toContainEqual(
			expect.objectContaining({
				type: "snapshot",
				snapshotType: "appium.page-source@1",
				payload: "<hierarchy><node text='Sign in'/></hierarchy>",
			}),
		);
	} finally {
		appium.server.close();
	}
}, 60_000);
