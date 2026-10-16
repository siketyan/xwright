import { expect, it } from "vitest";
import { runFixture } from "../test/run-fixture.js";

it("runs Playwright Test with xwright.config.ts", async () => {
	const { code, report } = await runFixture("projects");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 2, unexpected: 0 });
	expect(code).toBe(0);
}, 60_000);

it("filters projects", async () => {
	const { report } = await runFixture("projects", ["--project", "first"]);
	expect(report.stats).toMatchObject({ expected: 1, unexpected: 0 });
}, 60_000);
