import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { runFixture } from "../test/run-fixture.js";

it("skips the tests in the projects without the device, and reports steps", async () => {
	const { code, dir, report } = await runFixture("use-step");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({
		expected: 2,
		unexpected: 0,
		skipped: 2,
	});
	expect(code).toBe(0);

	const skipped = report.suites[0]?.specs
		.flatMap((spec) => spec.tests)
		.filter((test) => test.projectName === "without-phone");
	for (const test of skipped ?? []) {
		expect(test.annotations).toContainEqual(
			expect.objectContaining({
				type: "skip",
				description: 'The project does not have device "phone"',
			}),
		);
	}

	expect(JSON.parse(await readFile(`${dir}steps.json`, "utf8"))).toEqual([
		{ title: "outer", line: 14 },
		{ title: "inner", line: 15 },
	]);
});
