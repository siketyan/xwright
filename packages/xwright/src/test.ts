import { test as base } from "playwright/test";
import { PROJECT_OPTIONS_KEY, type ProjectOptions } from "./config.js";

/** The fixtures Xwright adds to Playwright Test. Tests do not use them directly. */
export interface XwrightFixtures {
	[PROJECT_OPTIONS_KEY]: ProjectOptions;
}

/**
 * Declares a test, the same as Playwright Test's `test`. Devices come from `use()` at the top level of the file, not
 * from fixtures.
 */
export const test = base.extend<object, XwrightFixtures>({
	[PROJECT_OPTIONS_KEY]: [{ devices: {} }, { option: true, scope: "worker" }],
});
