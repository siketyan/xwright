import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineAdapter, type Tracer } from "@xwright/core";
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
import { ApiCallRecorder, LiveTraceConverter } from "./trace.js";

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
	/** @internal */
	_tracesDir = mkdtempSync(join(tmpdir(), "xwright-playwright-"));
	/** @internal */
	_recorder: ApiCallRecorder | undefined;
	/** @internal */
	_converter: LiveTraceConverter | undefined;
	/** @internal */
	_chunk = 0;

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

/**
 * Starts Playwright's live trace of the context for the test, when the test is recorded, and converts it
 * into the track of the device as it is written.
 */
async function startTrace(
	handle: PlaywrightHandle,
	trace: Tracer,
): Promise<void> {
	const context = handle._context;
	if (context === undefined || !trace.recording) {
		return;
	}
	handle._chunk += 1;
	const name = `trace-${process.pid}-${handle._chunk}`;
	await context.tracing.start({
		name,
		live: true,
		screenshots: true,
		snapshots: true,
	});
	handle._converter = new LiveTraceConverter(trace, handle._tracesDir, name);
}

/**
 * Stops the trace, and converts the rest of it. Stopping the tracing, not only the chunk, waits for Playwright to write
 * the network entries it flushes, such as of a request finished just before.
 */
async function stopTrace(handle: PlaywrightHandle): Promise<void> {
	const converter = handle._converter;
	handle._converter = undefined;
	if (converter === undefined) {
		return;
	}
	await handle._context?.tracing.stop();
	converter.stop();
}

async function close(handle: PlaywrightHandle): Promise<void> {
	await stopTrace(handle);
	const context = handle._context;
	handle._context = undefined;
	handle._page = undefined;
	await context?.close();
}

/**
 * The official adapter for the web, which drives a browser through Playwright.
 *
 * When the device is traced, every call of Playwright's API is an action on its track, and Playwright's live trace of
 * the context is converted into the track: the logs and the DOM snapshots of the calls, screenshots, console messages
 * and the network.
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
	async create({ options = {}, trace }) {
		const handle = new PlaywrightHandle();
		handle._recorder = new ApiCallRecorder(trace);
		handle._recorder.attach();
		handle._browser = await browserTypes[
			options.browserName ?? "chromium"
		].launch({ ...options.launchOptions, tracesDir: handle._tracesDir });
		return handle;
	},
	async dispose(handle) {
		await close(handle);
		await handle._browser?.close();
		handle._recorder?.detach();
		rmSync(handle._tracesDir, { recursive: true, force: true });
	},
	async beforeAll(handle, { options = {} }) {
		handle._recorder?.attach();
		if (options.isolation === "file") {
			await open(handle, options);
		}
	},
	async beforeEach(handle, { options = {}, trace }) {
		handle._recorder?.attach();
		if (options.isolation !== "file") {
			await open(handle, options);
		}
		await startTrace(handle, trace);
	},
	async afterEach(handle, { options = {} }) {
		await stopTrace(handle);
		if (options.isolation !== "file") {
			await close(handle);
		}
	},
	async afterAll(handle) {
		await close(handle);
	},
});
