import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../test/run-fixture.js";

it("makes the options of an adapter for each worker", async () => {
	const events = fileURLToPath(
		new URL("../test/fixtures/worker-options/events.log", import.meta.url),
	);
	await rm(events, { force: true });
	const { code, report } = await runFixture("worker-options");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 4, unexpected: 0 });
	expect(code).toBe(0);

	const lines = (await readFile(events, "utf8")).trimEnd().split("\n");
	// The runner, outside the workers, gets the options of the indices 0.
	expect(lines).toContain("runner: createOnce slot-0");
	expect(lines).toContain("runner: disposeOnce slot-0");
	// Each worker gets the options of its own index, which its tests see.
	expect(lines).toContain("worker: create slot-0");
	expect(lines).toContain("worker: create slot-1");
	const tests = lines.filter((line) => line.startsWith("worker: test"));
	expect(tests).toHaveLength(4);
	for (const line of tests) {
		const [, label, index] =
			/test slot-(\d+) parallelIndex=(\d+)/.exec(line) ?? [];
		expect(label).toBe(index);
	}
});
