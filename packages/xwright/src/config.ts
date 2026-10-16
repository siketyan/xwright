import type {
	PlaywrightTestConfig,
	PlaywrightTestProject,
} from "playwright/test";
import type { Adapter } from "./adapter.js";

/** When to keep the trace of a device. */
export type TraceMode = "on" | "off" | "retain-on-failure" | "on-first-retry";

/** A device of a project. */
export interface DeviceConfig {
	/** The adapter that drives the device, e.g. `playwright({ browserName: "chromium" })`. */
	adapter: Adapter;
	/** When to keep the trace of the device. Defaults to `off`. */
	trace?: TraceMode;
}

/** A project, the same as Playwright Test's but with devices in place of `use`. */
export interface ProjectConfig extends Omit<PlaywrightTestProject, "use"> {
	/**
	 * The devices of the project, by the names tests ask for them with `use()`. A test runs in every project that has
	 * all the devices it uses, and is skipped in the others.
	 */
	devices?: Record<string, DeviceConfig>;
}

/** The configuration of Xwright, the same as Playwright Test's except for `use`, `webServer` and `projects`. */
export interface Config
	extends Omit<PlaywrightTestConfig, "use" | "webServer" | "projects"> {
	projects?: ProjectConfig[];
}

/** What Xwright puts in `use` of each Playwright Test project. */
export interface ProjectOptions {
	devices: Record<string, DeviceConfig>;
}

/** The key of {@link ProjectOptions} in `use` of each Playwright Test project. */
export const PROJECT_OPTIONS_KEY = "xwright";

/** Defines the configuration in `xwright.config.ts`, and turns it into the one of Playwright Test. */
export function defineConfig(
	config: Config,
): PlaywrightTestConfig<object, { [PROJECT_OPTIONS_KEY]: ProjectOptions }> {
	const { projects, ...rest } = config;
	return {
		...rest,
		projects: (projects ?? [{}]).map(({ devices, ...project }) => ({
			...project,
			use: {
				[PROJECT_OPTIONS_KEY]: {
					devices: devices ?? {},
				} satisfies ProjectOptions,
			},
		})),
	};
}
