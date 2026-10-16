import type { FullConfig } from "playwright/test";
import type { Adapter } from "./adapter.js";
import { PROJECT_OPTIONS_KEY, type ProjectOptions } from "./config.js";
import { COORDINATOR_URL_ENV, Coordinator } from "./coordinator.js";

/** Starts the coordinator of `createOnce` and `disposeOnce`, as the global setup of Playwright Test. */
export default async function globalSetup(
	config: FullConfig,
): Promise<() => Promise<void>> {
	const adapters = new Map<string, Adapter>();
	for (const project of config.projects) {
		const options = (project.use as Record<string, unknown>)[
			PROJECT_OPTIONS_KEY
		] as ProjectOptions | undefined;
		for (const device of Object.values(options?.devices ?? {})) {
			adapters.set(device.id, device.adapter);
		}
	}

	const coordinator = new Coordinator(adapters, config);
	process.env[COORDINATOR_URL_ENV] = await coordinator.listen();
	return async () => {
		delete process.env[COORDINATOR_URL_ENV];
		await coordinator.close();
	};
}
