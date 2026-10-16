// The internal API of Playwright Test that the runner calls, as Mobilewright does. Only the parts Xwright uses are
// declared, against the version of Playwright that Xwright pins.

declare module "playwright/lib/common" {
	export interface ConfigCLIOverrides {
		forbidOnly?: boolean;
		fullyParallel?: boolean;
		globalTimeout?: number;
		maxFailures?: number;
		outputDir?: string;
		quiet?: boolean;
		repeatEach?: number;
		retries?: number;
		reporter?: [string, unknown?][];
		shard?: { current: number; total: number };
		timeout?: number;
		tsconfig?: string;
		workers?: number | string;
	}

	export interface FullConfigInternal {
		readonly configDir: string;
	}

	export const configLoader: {
		loadConfigFromFile(
			configFile: string | undefined,
			overrides?: ConfigCLIOverrides,
			ignoreDeps?: boolean,
		): Promise<FullConfigInternal>;
	};
}

declare module "playwright/lib/runner" {
	import type { FullConfigInternal } from "playwright/lib/common";

	export interface RunOptions {
		locations?: string[];
		grep?: string;
		grepInvert?: string;
		listMode?: boolean;
		projectFilter?: string[];
		passWithNoTests?: boolean;
		lastFailed?: boolean;
	}

	export const testRunner: {
		runAllTestsWithConfig(
			config: FullConfigInternal,
			options: RunOptions,
		): Promise<"passed" | "failed" | "timedout" | "interrupted">;
	};
}
