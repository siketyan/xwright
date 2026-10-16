import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

/** Runs `xwright test` in a directory under `test/fixtures`, and returns the report of the JSON reporter. */
export async function runFixture(
	name: string,
	args: string[] = [],
): Promise<{ code: number; stdout: string; report: Report }> {
	const cwd = fileURLToPath(
		new URL(`../test/fixtures/${name}/`, import.meta.url),
	);
	const results = `${cwd}results.json`;
	await rm(results, { force: true });
	const { code, stdout } = await promisify(execFile)(
		process.execPath,
		[cli, "test", ...args],
		{ cwd },
	).then(
		({ stdout }) => ({ code: 0, stdout }),
		(error: { code: number; stdout: string }) => error,
	);
	const report = JSON.parse(await readFile(results, "utf8")) as Report;
	return { code, stdout, report };
}

export interface Report {
	stats: { expected: number; unexpected: number; skipped: number };
	errors: { message: string }[];
}

it("runs Playwright Test with xwright.config.ts", async () => {
	const { code, report } = await runFixture("projects");
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 2, unexpected: 0 });
	expect(code).toBe(0);
});

it("filters projects", async () => {
	const { report } = await runFixture("projects", ["--project", "first"]);
	expect(report.stats).toMatchObject({ expected: 1, unexpected: 0 });
});
