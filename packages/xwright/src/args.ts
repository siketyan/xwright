import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ConfigCLIOverrides } from "playwright/lib/common";
import type { RunOptions } from "playwright/lib/runner";
import { resolveReporterName } from "./config.js";

export const USAGE = `Usage: xwright <command> [options]

Commands:
  test [test-filter...]   Run the tests
  export-trace [path...]  Write the traces under the paths, or test-results, into ZIP files for CI
  show-trace [path]       Show the traces at the path, or in test-results, in the browser

Run "xwright <command> --help" for the options of a command.`;

export const EXPORT_USAGE = `Usage: xwright export-trace [options] [path...]

Writes each trace found under the paths into a ZIP file next to it, e.g. xwright-trace.zip, and deletes the directory
of the trace, as Playwright keeps its traces as ZIP files. A path is a directory of a trace or a directory to search,
such as the output directory of the tests. Defaults to test-results.

Options:
  -o, --output <file>  The ZIP file to write, when exactly one trace is found
  -h, --help           Display help`;

export const SHOW_USAGE = `Usage: xwright show-trace [options] [path]

Serves the UI with the traces at the path, and prints its URL. A path is a directory of a trace or a directory to
search, such as the output directory of the tests, or a ZIP file of traces, such as an artifact of CI. The UI lists
the tests of the traces, when there are more than one. Defaults to test-results; without traces there, the UI opens
a trace dropped on it.

Options:
  --host <host>  The host to listen on. Defaults to 127.0.0.1
  --port <port>  The port to listen on. Defaults to a free one
  -h, --help     Display help`;

/** What `xwright show-trace` does. */
export interface ShowCommand {
	path?: string;
	host?: string;
	port?: number;
}

/** Parses the arguments of `xwright show-trace`. */
export function parseShowArgs(
	args: string[],
	cwd = process.cwd(),
): ShowCommand | "help" {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			host: { type: "string" },
			port: { type: "string" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		return "help";
	}
	const [path, ...rest] = positionals;
	if (rest.length > 0) {
		throw new Error("show-trace takes one path");
	}
	return {
		path: path === undefined ? undefined : resolve(cwd, path),
		host: values.host,
		port: parseInteger("--port", values.port),
	};
}

/** What `xwright export-trace` does. */
export interface ExportCommand {
	paths: string[];
	output?: string;
}

/** Parses the arguments of `xwright export-trace`. */
export function parseExportArgs(
	args: string[],
	cwd = process.cwd(),
): ExportCommand | "help" {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			output: { type: "string", short: "o" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		return "help";
	}
	return {
		paths: (positionals.length > 0 ? positionals : ["test-results"]).map(
			(path) => resolve(cwd, path),
		),
		output:
			values.output === undefined ? undefined : resolve(cwd, values.output),
	};
}

const CONFIG_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"];
const BUILT_IN_REPORTERS = [
	"list",
	"line",
	"dot",
	"json",
	"junit",
	"null",
	"github",
	"html",
	"blob",
	"perfetto",
];

export const TEST_USAGE = `Usage: xwright test [options] [test-filter...]

Options:
  -c, --config <file>         Configuration file, or a directory with xwright.config.{ts,js,mts,mjs,cts,cjs}
  --forbid-only               Fail if test.only is called
  --fully-parallel            Run all tests in parallel
  -g, --grep <grep>           Only run tests matching this regular expression
  --grep-invert <grep>        Only run tests not matching this regular expression
  --global-timeout <timeout>  Maximum time this test suite can run in milliseconds
  --last-failed               Only re-run the failures
  --list                      Collect all the tests and report them, but do not run
  --max-failures <N>          Stop after the first N failures
  -x                          Stop after the first failure
  --output <dir>              Folder for output artifacts
  --pass-with-no-tests        Make the run pass when no tests are found
  --project <name...>         Only run tests from the specified projects
  --quiet                     Suppress stdio
  --repeat-each <N>           Run each test N times
  --reporter <reporter>       Reporter to use, comma-separated, such as tree of Xwright
  --retries <retries>         Maximum retry count for flaky tests
  --shard <shard>             Shard tests and execute only the selected shard, e.g. "1/3"
  --timeout <timeout>         Test timeout threshold in milliseconds
  --test-list <file>          Path to a file containing a list of tests to run
  --test-list-invert <file>   Path to a file containing a list of tests to skip
  --tsconfig <path>           Path to a single tsconfig applicable to all imported files
  --ui                        Run the tests in the UI, which shows the trace of each test as it runs
  --ui-host <host>            The host the UI listens on. Defaults to 127.0.0.1
  --ui-port <port>            The port the UI listens on. Defaults to a free one
  -j, --workers <workers>     Number of concurrent workers, or a percentage of logical CPU cores
  -h, --help                  Display help`;

/** What `xwright test` passes to Playwright Test. */
export interface TestCommand {
	configFile: string;
	overrides: ConfigCLIOverrides;
	options: RunOptions;
	/** Where to serve the UI, with `--ui`. */
	ui?: { host?: string; port?: number };
}

const UI_OPTIONS = ["--ui", "--ui-host", "--ui-port"];

/** The arguments of `xwright test` without the options of the UI, for the runs the UI starts. */
export function withoutUiArgs(args: string[]): string[] {
	const rest: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const arg = args[i] ?? "";
		const name = arg.split("=")[0] ?? "";
		if (!UI_OPTIONS.includes(name)) {
			rest.push(arg);
		} else if (name !== "--ui" && !arg.includes("=")) {
			i++;
		}
	}
	return rest;
}

/** Parses the arguments of `xwright test`, the same as `playwright test` takes. */
export function parseTestArgs(
	args: string[],
	cwd = process.cwd(),
): TestCommand | "help" {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		options: {
			config: { type: "string", short: "c" },
			"forbid-only": { type: "boolean" },
			"fully-parallel": { type: "boolean" },
			grep: { type: "string", short: "g" },
			"grep-invert": { type: "string" },
			"global-timeout": { type: "string" },
			"last-failed": { type: "boolean" },
			list: { type: "boolean" },
			"max-failures": { type: "string" },
			x: { type: "boolean", short: "x" },
			output: { type: "string" },
			"pass-with-no-tests": { type: "boolean" },
			project: { type: "string", multiple: true },
			quiet: { type: "boolean" },
			"repeat-each": { type: "string" },
			reporter: { type: "string" },
			retries: { type: "string" },
			shard: { type: "string" },
			"test-list": { type: "string" },
			"test-list-invert": { type: "string" },
			timeout: { type: "string" },
			tsconfig: { type: "string" },
			ui: { type: "boolean" },
			"ui-host": { type: "string" },
			"ui-port": { type: "string" },
			workers: { type: "string", short: "j" },
			help: { type: "boolean", short: "h" },
		},
	});
	if (values.help) {
		return "help";
	}

	const tsconfig = values.tsconfig ? resolve(cwd, values.tsconfig) : undefined;
	if (tsconfig && !existsSync(tsconfig)) {
		throw new Error(`--tsconfig "${values.tsconfig}" does not exist`);
	}

	const overrides: ConfigCLIOverrides = {
		forbidOnly: values["forbid-only"] || undefined,
		fullyParallel: values["fully-parallel"] || undefined,
		globalTimeout: parseInteger("--global-timeout", values["global-timeout"]),
		maxFailures: values.x
			? 1
			: parseInteger("--max-failures", values["max-failures"]),
		outputDir: values.output ? resolve(cwd, values.output) : undefined,
		quiet: values.quiet || undefined,
		repeatEach: parseInteger("--repeat-each", values["repeat-each"]),
		reporter: values.reporter
			? values.reporter.split(",").map((name) => [resolveReporter(name, cwd)])
			: undefined,
		retries: parseInteger("--retries", values.retries),
		shard: values.shard ? parseShard(values.shard) : undefined,
		timeout: parseInteger("--timeout", values.timeout),
		tsconfig,
		workers: values.workers,
	};

	return {
		configFile: resolveConfigFile(values.config, cwd),
		overrides: Object.fromEntries(
			Object.entries(overrides).filter(([, value]) => value !== undefined),
		),
		options: {
			locations: positionals.length > 0 ? positionals : undefined,
			grep: values.grep,
			grepInvert: values["grep-invert"],
			listMode: values.list ?? false,
			projectFilter: values.project,
			passWithNoTests: values["pass-with-no-tests"] ?? false,
			lastFailed: values["last-failed"] ?? false,
			testList: values["test-list"]
				? resolve(cwd, values["test-list"])
				: undefined,
			testListInvert: values["test-list-invert"]
				? resolve(cwd, values["test-list-invert"])
				: undefined,
		},
		ui:
			values.ui || values["ui-host"] || values["ui-port"]
				? {
						host: values["ui-host"],
						port: parseInteger("--ui-port", values["ui-port"]),
					}
				: undefined,
	};
}

function parseInteger(
	name: string,
	value: string | undefined,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	const number = Number(value);
	if (!Number.isInteger(number) || number < 0) {
		throw new Error(`${name} must be a non-negative integer, got "${value}"`);
	}
	return number;
}

function parseShard(shard: string): { current: number; total: number } {
	const match = /^(\d+)\/(\d+)$/.exec(shard);
	const current = Number(match?.[1]);
	const total = Number(match?.[2]);
	if (!match || total < 1 || current < 1 || current > total) {
		throw new Error(
			`--shard "${shard}" must be "current/total", 1-based, e.g. "3/5"`,
		);
	}
	return { current, total };
}

function resolveReporter(name: string, cwd: string): string {
	if (BUILT_IN_REPORTERS.includes(name)) {
		return name;
	}
	if (resolveReporterName(name) !== name) {
		return resolveReporterName(name);
	}
	const path = resolve(cwd, name);
	if (existsSync(path)) {
		return path;
	}
	return createRequire(resolve(cwd, "package.json")).resolve(name);
}

/** Resolves `--config`, or finds `xwright.config.*` when it names a directory or is not given. */
export function resolveConfigFile(
	config: string | undefined,
	cwd: string,
): string {
	const path = resolve(cwd, config ?? ".");
	if (!existsSync(path)) {
		throw new Error(`${path} does not exist`);
	}
	if (!statSync(path).isDirectory()) {
		return path;
	}
	for (const extension of CONFIG_EXTENSIONS) {
		const file = resolve(path, `xwright.config${extension}`);
		if (existsSync(file)) {
			return file;
		}
	}
	throw new Error(`xwright.config.ts is not found in ${path}`);
}
