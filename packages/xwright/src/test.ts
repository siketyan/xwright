import { test as base } from "playwright/test";
import { PROJECT_OPTIONS_KEY, type ProjectOptions } from "./config.js";
import { WorkerSession } from "./lifecycle.js";

/** The fixtures Xwright adds to Playwright Test. Tests do not use them directly. */
export interface XwrightFixtures {
	[PROJECT_OPTIONS_KEY]: ProjectOptions;
	_xwrightWorker: WorkerSession;
}

/**
 * Declares a test, the same as Playwright Test's `test`. Devices come from `use()` at the top level of the file, not
 * from fixtures.
 */
export const test = base.extend<{ _xwrightTest: undefined }, XwrightFixtures>({
	[PROJECT_OPTIONS_KEY]: [{ devices: {} }, { option: true, scope: "worker" }],
	_xwrightWorker: [
		async ({ xwright }, use, workerInfo) => {
			const session = new WorkerSession(workerInfo, xwright.devices);
			try {
				await use(session);
			} finally {
				await session.dispose();
			}
		},
		{ scope: "worker", auto: true, timeout: 0 },
	],
	// Set up before the user's `beforeEach` and torn down after the user's `afterEach`.
	_xwrightTest: [
		async ({ _xwrightWorker }, use, testInfo) => {
			try {
				await _xwrightWorker.beforeEach(testInfo);
				await use(undefined);
			} finally {
				await _xwrightWorker.afterEach(testInfo);
			}
		},
		{ auto: true },
	],
});
