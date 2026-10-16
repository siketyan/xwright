#!/usr/bin/env node
import { relative } from "node:path";
import {
	EXPORT_USAGE,
	parseExportArgs,
	parseTestArgs,
	TEST_USAGE,
	USAGE,
} from "./args.js";
import { findTraces, zipDirectory } from "./trace/zip.js";

async function test(args: string[]): Promise<number> {
	const parsed = parseTestArgs(args);
	if (parsed === "help") {
		console.log(TEST_USAGE);
		return 0;
	}

	// Playwright Test has no public API to run tests, so call the internal one that `playwright test` calls, as
	// Mobilewright does.
	const { configLoader } = await import("playwright/lib/common");
	const { testRunner } = await import("playwright/lib/runner");
	const config = await configLoader.loadConfigFromFile(
		parsed.configFile,
		parsed.overrides,
	);
	const status = await testRunner.runAllTestsWithConfig(config, parsed.options);
	return status === "interrupted" ? 130 : status === "passed" ? 0 : 1;
}

function exportTrace(args: string[]): number {
	const parsed = parseExportArgs(args);
	if (parsed === "help") {
		console.log(EXPORT_USAGE);
		return 0;
	}
	const traces = findTraces(parsed.paths);
	if (parsed.output !== undefined && traces.length !== 1) {
		throw new Error(
			`--output needs exactly one trace, but ${traces.length} were found`,
		);
	}
	for (const trace of traces) {
		const output = parsed.output ?? `${trace}.zip`;
		zipDirectory(trace, output);
		console.log(relative(process.cwd(), output));
	}
	return 0;
}

async function main(argv: string[]): Promise<number> {
	const [command, ...args] = argv;
	switch (command) {
		case "test":
			return await test(args);
		case "export-trace":
			return exportTrace(args);
		case undefined:
		case "--help":
		case "-h":
			console.log(USAGE);
			return 0;
		default:
			console.error(USAGE);
			return 1;
	}
}

main(process.argv.slice(2)).then(
	(code) => process.exit(code),
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	},
);
