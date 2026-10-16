#!/usr/bin/env node
import { parseTestArgs, USAGE } from "./args.js";

async function main(argv: string[]): Promise<number> {
	const [command, ...args] = argv;
	if (command !== "test") {
		console.log(USAGE);
		return command === undefined || command === "--help" || command === "-h"
			? 0
			: 1;
	}

	const parsed = parseTestArgs(args);
	if (parsed === "help") {
		console.log(USAGE);
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

main(process.argv.slice(2)).then(
	(code) => process.exit(code),
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	},
);
