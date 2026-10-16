import {
	type Browser,
	type BrowserContext,
	type BrowserContextOptions,
	chromium,
	firefox,
	type LaunchOptions,
	type Page,
	webkit,
} from "playwright";
import { expect } from "playwright/test";
import { defineAdapter } from "xwright";

/** The options of {@link playwright}. */
export interface PlaywrightOptions extends BrowserContextOptions {
	/** The browser to launch. Defaults to `chromium`. */
	browserName?: "chromium" | "firefox" | "webkit";
	/** The options to launch the browser with. */
	launchOptions?: LaunchOptions;
	/**
	 * What shares a browser context and a page. With `test` (the default), every test starts with a fresh context and
	 * page. With `file`, the tests of a file share them, keeping the page where the previous test left it.
	 */
	isolation?: "test" | "file";
}

/** What `use()` returns for a device with {@link playwright}. */
export class PlaywrightHandle {
	/** The `expect` of Playwright Test, with the matchers for pages and locators. */
	readonly expect = expect;

	/** @internal */
	_browser: Browser | undefined;
	/** @internal */
	_context: BrowserContext | undefined;
	/** @internal */
	_page: Page | undefined;

	/** The browser, shared in the worker. */
	get browser(): Browser {
		return available("browser", this._browser);
	}

	/** The browser context of the test, or of the file with `isolation: "file"`. */
	get context(): BrowserContext {
		return available("context", this._context);
	}

	/** The page of the test, or of the file with `isolation: "file"`. */
	get page(): Page {
		return available("page", this._page);
	}
}

function available<T>(name: string, value: T | undefined): T {
	if (value === undefined) {
		throw new Error(`The ${name} is available only inside tests and hooks`);
	}
	return value;
}

const browserTypes = { chromium, firefox, webkit };

async function open(
	handle: PlaywrightHandle,
	{
		browserName,
		launchOptions,
		isolation,
		...contextOptions
	}: PlaywrightOptions,
): Promise<void> {
	handle._context = await handle.browser.newContext(contextOptions);
	handle._page = await handle._context.newPage();
}

async function close(handle: PlaywrightHandle): Promise<void> {
	const context = handle._context;
	handle._context = undefined;
	handle._page = undefined;
	await context?.close();
}

/**
 * The official adapter for the web, which drives a browser through Playwright.
 *
 * ```ts
 * devices: { web: { adapter: playwright({ browserName: "chromium", baseURL: "http://localhost:3000" }) } }
 * ```
 */
export const playwright = defineAdapter<
	PlaywrightOptions | undefined,
	PlaywrightHandle
>({
	name: "@xwright/playwright",
	async create({ options = {} }) {
		const handle = new PlaywrightHandle();
		handle._browser = await browserTypes[
			options.browserName ?? "chromium"
		].launch(options.launchOptions);
		return handle;
	},
	async dispose(handle) {
		await close(handle);
		await handle._browser?.close();
	},
	async beforeAll(handle, { options = {} }) {
		if (options.isolation === "file") {
			await open(handle, options);
		}
	},
	async beforeEach(handle, { options = {} }) {
		if (options.isolation !== "file") {
			await open(handle, options);
		}
	},
	async afterEach(handle, { options = {} }) {
		if (options.isolation !== "file") {
			await close(handle);
		}
	},
	async afterAll(handle) {
		await close(handle);
	},
});
