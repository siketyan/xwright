import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const fixture = fileURLToPath(
	new URL("../../test/fixtures/tree-reporter/", import.meta.url),
);

/** Runs the fixture with the environment, and returns what the reporter printed, without the durations. */
async function run(env: NodeJS.ProcessEnv): Promise<string> {
	const environment = { ...process.env };
	for (const name of ["CI", "GITHUB_ACTIONS", "FORCE_COLOR", "NO_COLOR"]) {
		delete environment[name];
	}
	const stdout = await promisify(execFile)(process.execPath, [cli, "test"], {
		cwd: fixture,
		env: { ...environment, ...env },
	}).then(
		({ stdout }) => stdout,
		(error: { stdout: string }) => error.stdout,
	);
	return stdout.replace(/ \(\d+(\.\d)?m?s\)/g, "");
}

it("prints each test with its steps as a tree when it ends", async () => {
	const output = await run({ NO_COLOR: "1" });
	expect(output).toContain("Running 4 tests using 1 worker\n");
	expect(output).toContain(
		[
			"✓ [phone] › tree.e2e.ts:12 › signs in",
			"  └─ open the app",
			"     └─ tap Sign in",
			"  │ signed in",
		].join("\n"),
	);
	// A failed step is marked, and the error follows the tree.
	expect(output).toContain(
		[
			"✘ [phone] › tree.e2e.ts:21 › fails (retry #1)",
			"  └─ ✘ check the title",
			'     └─ ✘ Expect "toBe"',
			"    Error: expect(received).toBe(expected) // Object.is equality",
		].join("\n"),
	);
	expect(output).toContain("    at tree.e2e.ts:23:18");
	expect(output).toContain("- [phone] › tree.e2e.ts:31 › is skipped");
	expect(output).toContain(
		[
			"  1 failed",
			"    [phone] › tree.e2e.ts:21 › fails",
			"  1 flaky",
			"    [phone] › tree.e2e.ts:27 › is flaky",
			"  1 skipped",
			"  1 passed",
		].join("\n"),
	);
	// Without colors, the errors of Playwright are not colored either.
	expect(output).not.toContain("\u001b[");
}, 60_000);

it("shows every call and assertion with actions", async () => {
	const output = await run({ NO_COLOR: "1", TREE_ACTIONS: "1" });
	expect(output).toContain(
		[
			"✓ [phone] › tree.e2e.ts:12 › signs in",
			"  └─ open the app",
			"     └─ tap Sign in",
			'        └─ Expect "toBe"',
			"  │ signed in",
		].join("\n"),
	);
	expect(output).toContain(
		[
			"✓ [phone] › tree.e2e.ts:27 › is flaky (retry #1)",
			'  └─ Expect "toBe"',
		].join("\n"),
	);
}, 60_000);

it("puts the steps of each test in a group of GitHub Actions, with the error after it", async () => {
	const output = await run({ GITHUB_ACTIONS: "true", NO_COLOR: "1" });
	expect(output).toContain(
		[
			"::group::✓ [phone] › tree.e2e.ts:12 › signs in",
			"  └─ open the app",
			"     └─ tap Sign in",
			"  │ signed in",
			"::endgroup::",
		].join("\n"),
	);
	expect(output).toContain(
		[
			'     └─ ✘ Expect "toBe"',
			"::endgroup::",
			"    Error: expect(received).toBe(expected) // Object.is equality",
		].join("\n"),
	);
}, 60_000);

it("colors the statuses on GitHub Actions", async () => {
	const output = await run({ GITHUB_ACTIONS: "true" });
	expect(output).toContain("\u001b[32m  1 passed");
	expect(output).toContain("\u001b[31m  1 failed\u001b[39m");
	// The title of a group is colored too.
	expect(output).toContain(
		"::group::\u001b[32m✓\u001b[39m [phone] › tree.e2e.ts:12 › signs in",
	);
}, 60_000);
