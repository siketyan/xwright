import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import { runFixture } from "../../xwright/test/run-fixture.js";

it("drives a browser", async () => {
	const executable = "/opt/pw-browsers/chromium";
	const { code, report } = await runFixture(
		new URL("../test/fixtures/web/", import.meta.url),
		[],
		existsSync(executable)
			? { XWRIGHT_CHROMIUM_EXECUTABLE_PATH: executable }
			: {},
	);
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 4, unexpected: 0 });
	expect(code).toBe(0);
}, 60_000);
