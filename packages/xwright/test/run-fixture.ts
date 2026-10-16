import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

export interface Report {
	stats: { expected: number; unexpected: number; skipped: number };
	errors: { message: string }[];
	suites: Suite[];
}

export interface Suite {
	specs: {
		title: string;
		tests: {
			projectName: string;
			annotations: { type: string; description?: string }[];
			results: { status: string; errors: { message: string }[] }[];
		}[];
	}[];
}

/** Runs `xwright test` in a directory under `test/fixtures`, and returns the report of the JSON reporter. */
export async function runFixture(
	name: string,
	args: string[] = [],
): Promise<{ code: number; dir: string; report: Report }> {
	const dir = fileURLToPath(new URL(`fixtures/${name}/`, import.meta.url));
	const results = `${dir}results.json`;
	await rm(results, { force: true });
	const code = await promisify(execFile)(
		process.execPath,
		[cli, "test", ...args],
		{ cwd: dir },
	).then(
		() => 0,
		(error: { code: number }) => error.code,
	);
	const report = JSON.parse(await readFile(results, "utf8")) as Report;
	return { code, dir, report };
}
