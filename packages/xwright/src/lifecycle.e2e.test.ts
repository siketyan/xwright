import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../test/run-fixture.js";

it("runs the hooks of the adapters outside the user's", async () => {
	const events = fileURLToPath(
		new URL("../test/fixtures/lifecycle/events.log", import.meta.url),
	);
	await rm(events, { force: true });
	const { code, report } = await runFixture("lifecycle");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 3, unexpected: 1 });
	expect(code).toBe(1);

	expect((await readFile(events, "utf8")).trimEnd().split("\n")).toEqual([
		"runner: createOnce shared",
		"worker: create a token-shared",
		"worker: beforeAll a first.e2e.ts",
		"worker: create b token-shared",
		"worker: beforeAll b first.e2e.ts",
		"worker: user beforeAll a",
		"worker: beforeEach a passes",
		"worker: beforeEach b passes",
		"worker: user beforeEach a",
		"worker: test passes",
		"worker: user afterEach a",
		"worker: afterEach a passes passed",
		"worker: afterEach b passes passed",
		"worker: beforeEach a fails",
		"worker: beforeEach b fails",
		"worker: user beforeEach a",
		"worker: test fails",
		"worker: onFailure a fails",
		"worker: onFailure b fails",
		"worker: user afterEach a",
		"worker: afterEach a fails failed",
		"worker: afterEach b fails failed",
		"worker: user afterAll a",
		"worker: afterAll b first.e2e.ts",
		"worker: afterAll a first.e2e.ts",
		"worker: dispose b",
		"worker: dispose a",
		// The worker is recreated after the failure.
		"worker: create b token-shared",
		"worker: beforeAll b second.e2e.ts",
		"worker: beforeEach b uses b",
		"worker: test uses b",
		"worker: afterEach b uses b passed",
		"worker: afterAll b second.e2e.ts",
		"worker: create a token-shared",
		"worker: beforeAll a third.e2e.ts",
		"worker: beforeEach a uses a",
		"worker: test uses a",
		"worker: afterEach a uses a passed",
		"worker: afterAll a third.e2e.ts",
		"worker: dispose a",
		"worker: dispose b",
		"runner: disposeOnce shared token-shared",
	]);
}, 60_000);
