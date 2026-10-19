import { defineAdapter } from "@xwright/core";
import { expect } from "expect-webdriverio";
import { remote } from "webdriverio";
import { type CommandEmitter, traceCommands } from "./trace.js";

/** The options of a session of WebdriverIO, such as `logLevel` and `connectionRetryTimeout`. */
type RemoteOptions = Omit<
	Parameters<typeof remote>[0],
	"capabilities" | "hostname" | "port" | "path" | "protocol"
>;

/** The options of {@link appium}. */
export interface AppiumOptions {
	/** The URL of the Appium server. Defaults to `http://127.0.0.1:4723`. */
	url?: string;
	/**
	 * The capabilities of the session, such as `platformName`, `appium:automationName`, `appium:app` and
	 * `appium:udid`. Give each worker its own device with options for each worker, by `parallelIndex`.
	 */
	capabilities: Record<string, unknown>;
	/** The app to launch again before each test: the package on Android, or the bundle ID on iOS. */
	appId?: string;
	/** Terminates and activates the app of `appId` before each test. Defaults to `true`. */
	autoAppLaunch?: boolean;
	/** Takes a screenshot after each command that changes the screen, when the device is traced. Defaults to `true`. */
	screenshots?: boolean;
	/** When to record the source of the page, the hierarchy of the views. Defaults to `on-failure`. */
	pageSource?: "on-failure" | "off";
	/** Other options of the session of WebdriverIO. */
	remoteOptions?: RemoteOptions;
}

/** The types of WebdriverIO that tests use most, so that they need no dependency on WebdriverIO of their own. */
export type {
	ChainablePromiseArray,
	ChainablePromiseElement,
	Selector,
} from "webdriverio";

/** A session of WebdriverIO, the `driver` of the handle. */
export type Browser = WebdriverIO.Browser;

/** An element found by a session of WebdriverIO, such as with `driver.$()`. */
export type Element = WebdriverIO.Element;

/** What `use()` returns for a device with {@link appium}. */
export class AppiumHandle {
	/** The `expect` of WebdriverIO, with the matchers for elements, e.g. `toBeDisplayed()`. */
	readonly expect = expect;

	/** @internal */
	_driver: Browser | undefined;

	/** The session of WebdriverIO, shared in the worker: `driver.$("~Sign in").click()`. */
	get driver(): Browser {
		if (this._driver === undefined) {
			throw new Error("The driver is available only inside tests and hooks");
		}
		return this._driver;
	}
}

function isAndroid(capabilities: Record<string, unknown>): boolean {
	return String(capabilities.platformName).toLowerCase() === "android";
}

/**
 * The official adapter for Appium, which drives a device through WebdriverIO.
 *
 * A session is created per worker, and the app is launched again before each test. When the device is traced, every
 * command sent to the Appium server is an action on its track, with a screenshot after the ones that change the
 * screen, and the source of the page is recorded when a test failed.
 *
 * ```ts
 * devices: {
 *   phone: {
 *     adapter: appium(({ parallelIndex }) => ({
 *       capabilities: { platformName: "Android", "appium:automationName": "UiAutomator2", "appium:udid": udids[parallelIndex] },
 *       appId: "com.example.app",
 *     })),
 *   },
 * }
 * ```
 */
export const appium = defineAdapter<AppiumOptions, AppiumHandle>({
	name: "@xwright/appium",
	async create({ options, trace }) {
		const url = new URL(options.url ?? "http://127.0.0.1:4723");
		const driver = await trace.action(
			{ title: "Create a session", class: "Appium", method: "createSession" },
			() =>
				remote({
					logLevel: "warn",
					...options.remoteOptions,
					protocol: url.protocol.replace(":", ""),
					hostname: url.hostname,
					port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
					path: url.pathname,
					capabilities: options.capabilities as never,
				}),
		);
		traceCommands(
			driver as unknown as CommandEmitter,
			trace,
			options.screenshots ?? true,
		);
		const handle = new AppiumHandle();
		handle._driver = driver;
		return handle;
	},
	async beforeEach(handle, { options }) {
		if (options.appId === undefined || options.autoAppLaunch === false) {
			return;
		}
		// The arguments are named after the platform.
		const app = isAndroid(options.capabilities)
			? { appId: options.appId }
			: { bundleId: options.appId };
		await handle.driver.execute("mobile: terminateApp", app);
		await handle.driver.execute("mobile: activateApp", app);
	},
	async onFailure(handle, { options, trace }) {
		if ((options.pageSource ?? "on-failure") === "off" || !trace.recording) {
			return;
		}
		try {
			trace.snapshot({
				type: "appium.page-source@1",
				phase: "after",
				payload: await handle.driver.getPageSource(),
			});
		} catch {
			// The session may be gone, such as after the app crashed.
		}
	},
	async dispose(handle) {
		const driver = handle._driver;
		handle._driver = undefined;
		await driver?.deleteSession();
	},
});
