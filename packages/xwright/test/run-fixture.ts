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

/**
 * Runs `xwright test` in a fixture project, and returns the report of the JSON reporter. The project is a directory
 * under `test/fixtures` of this package, or a URL of a directory.
 */
export async function runFixture(
	project: string | URL,
	args: string[] = [],
	env: NodeJS.ProcessEnv = {},
): Promise<{ code: number; dir: string; report: Report }> {
	const dir = fileURLToPath(
		typeof project === "string"
			? new URL(`fixtures/${project}/`, import.meta.url)
			: project,
	);
	const results = `${dir}results.json`;
	await rm(results, { force: true });
	const code = await promisify(execFile)(
		process.execPath,
		[cli, "test", ...args],
		{ cwd: dir, env: { ...process.env, ...env } },
	).then(
		() => 0,
		(error: { code: number }) => error.code,
	);
	const report = JSON.parse(await readFile(results, "utf8")) as Report;
	return { code, dir, report };
}
