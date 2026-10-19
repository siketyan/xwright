import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { MobilecliDriver } from "@mobilewright/driver-mobilecli";
import { defineAdapter, runNodeCli } from "@xwright/core";
import {
	type AllocationHandle,
	connectDevice,
	createDevicePoolClient,
	DEFAULT_ALLOCATION_TIMEOUT,
	DEFAULT_INSTALL_TIMEOUT,
	type Device,
	type DevicePoolClient,
	expect,
	type MobilewrightDriver,
	type Screen,
	terminateAppIfRunning,
	toArray,
} from "mobilewright";
import { startDevicePool, stopDevicePool } from "./device-pool.js";
import { createStepFn, type ScreenshotPhase } from "./trace.js";

/** The types of Mobilewright that tests use most, so that they need no dependency on Mobilewright of their own. */
export type {
	Device,
	Dialog,
	Locator,
	MobileWebViewLocator,
	MobileWebViewPage,
	Page,
	Role,
	Screen,
	WebLocator,
} from "mobilewright";
export type { ScreenshotPhase };

/** The options of {@link mobilewright}, the same as Mobilewright's `use` and `expect` options. */
export interface MobilewrightOptions {
	platform: "ios" | "android";
	/** A specific device identifier, for local drivers. */
	deviceId?: string;
	/** A regular expression the device name must match. */
	deviceName?: RegExp;
	deviceType?: "simulator" | "emulator" | "real";
	/** An OS version constraint, e.g. "17", "26.0" or ">=17 <19". */
	osVersion?: string;
	/** The app to launch before each test. */
	bundleId?: string;
	/** The apps (APK / IPA) to install, once per device in the run. */
	installApps?: string | string[];
	/** Terminates and launches the app of `bundleId` before each test. Defaults to `true`. */
	autoAppLaunch?: boolean;
	/** The system animations of the device. Left unchanged if omitted. */
	animations?: "on" | "off";
	/** The driver, e.g. `new MobileNextDriver({ apiKey })`. Defaults to `new MobilecliDriver()`. */
	driver?: MobilewrightDriver;
	/** The timeout of actions such as tap and fill, in milliseconds. */
	actionTimeout?: number;
	/** The timeout of assertions, in milliseconds. */
	expectTimeout?: number;
	/** The timeout of connecting to the device, in milliseconds. */
	connectTimeout?: number;
	appLaunchTimeout?: number;
	installTimeout?: number;
	/** The timeout of waiting for a device from the pool, in milliseconds. Defaults to 15 minutes. */
	allocationTimeout?: number;
	/**
	 * When to take a screenshot around each operation, such as a tap, when the device is traced. Defaults to `after`
	 * only, as a screenshot takes hundreds of milliseconds.
	 */
	screenshots?: ScreenshotPhase[];
	/** When to record the view hierarchy, when the device is traced. Defaults to `on-failure`. */
	viewTree?: "on-failure" | "off";
}

/** What `use()` returns for a device with {@link mobilewright}. */
export class MobilewrightHandle {
	/** The `expect` of Mobilewright, with the matchers for locators. */
	readonly expect = expect;

	/** @internal */
	_client: DevicePoolClient | undefined;
	/** @internal */
	_allocation: AllocationHandle | undefined;
	/** @internal */
	_device: Device | undefined;
	/** @internal */
	_driver: MobilewrightDriver | undefined;

	/** The device borrowed for the file. */
	get device(): Device {
		if (this._device === undefined) {
			throw new Error("The device is available only inside tests and hooks");
		}
		return this._device;
	}

	/** The screen of the device. */
	get screen(): Screen {
		return this.device.screen;
	}
}

/**
 * The official adapter for iOS and Android, which drives a device through Mobilewright.
 *
 * A device is borrowed from Mobilewright's device pool for each file, and the app is relaunched before each test.
 *
 * When the device is traced, each operation of Mobilewright, such as a tap or an assertion, is an action on its
 * track, with a screenshot after it, and the view hierarchy is recorded when a test failed. The commands the driver
 * sends for an operation, such as reading the view hierarchy while an assertion waits, are not recorded.
 *
 * ```ts
 * devices: { phone: { adapter: mobilewright({ platform: "android", bundleId: "com.example.app" }) } }
 * ```
 */
export const mobilewright = defineAdapter<
	MobilewrightOptions,
	MobilewrightHandle,
	{ url: string }
>({
	name: "@xwright/mobilewright",
	async install({ args }) {
		// The CLI of the Mobilewright the adapter pins, next to its entry point. It installs the agent of Mobilewright on
		// the device of `-d <id>`.
		const cli = join(
			dirname(createRequire(import.meta.url).resolve("mobilewright")),
			"cli.js",
		);
		await runNodeCli(cli, ["install", ...args]);
	},
	async createOnce({ options, config }) {
		const url = await startDevicePool({
			driver: options.driver ?? new MobilecliDriver(),
			maxSlots: config.workers,
			allocationTimeoutMs:
				options.allocationTimeout ?? DEFAULT_ALLOCATION_TIMEOUT,
		});
		return { url };
	},
	async disposeOnce({ url }) {
		await stopDevicePool(url);
	},
	create({ shared, options }) {
		// Mobilewright's client of the device pool finds the pool from the environment variable.
		process.env.MOBILEWRIGHT_COORDINATOR_URL = shared.url;
		const handle = new MobilewrightHandle();
		handle._client = createDevicePoolClient();
		handle._driver = options.driver ?? new MobilecliDriver();
		return handle;
	},
	async beforeAll(handle, { options, testInfo, trace }) {
		// Waiting for a device has its own timeout, which can be longer than the one of the hook.
		testInfo.setTimeout(0);
		const client = handle._client as DevicePoolClient;
		const installApps = toArray(options.installApps);
		const allocation = await allocate(client, options);
		handle._allocation = allocation;
		testInfo.annotations.push({
			type: "device.id",
			description: allocation.deviceId,
		});

		const device = await connectDevice({
			platform: allocation.platform,
			deviceId: allocation.deviceId,
			deviceType: allocation.type,
			driver: handle._driver,
			timeout: options.connectTimeout,
			actionTimeout: options.actionTimeout,
			expectTimeout: options.expectTimeout,
			appLaunchTimeout: options.appLaunchTimeout,
			installTimeout: options.installTimeout ?? DEFAULT_INSTALL_TIMEOUT,
			deviceSettings: { animations: options.animations },
		});
		handle._device = device;
		device.setStepFn(
			createStepFn(
				trace,
				handle._driver as MobilewrightDriver,
				options.screenshots ?? ["after"],
			),
		);

		// Install each app once per device in the run, as Mobilewright does.
		for (const app of installApps) {
			if (!(await client.isAppInstalled(allocation.allocationId, app))) {
				await device.installApp(app);
				await client.recordAppInstalled(allocation.allocationId, app);
			}
		}
	},
	async beforeEach(handle, { options }) {
		if (options.bundleId && options.autoAppLaunch !== false) {
			await terminateAppIfRunning(handle.device, options.bundleId);
			await handle.device.launchApp(options.bundleId);
		}
	},
	async onFailure(handle, { options, trace }) {
		if ((options.viewTree ?? "on-failure") === "off" || !trace.recording) {
			return;
		}
		try {
			trace.snapshot({
				type: "xwright.view-tree@1",
				phase: "after",
				payload: await handle._driver?.getViewHierarchy(),
			});
		} catch {
			// The device may be gone, such as after the app crashed.
		}
	},
	async afterAll(handle) {
		const device = handle._device;
		const allocation = handle._allocation;
		handle._device = undefined;
		handle._allocation = undefined;
		try {
			await device?.disconnect();
		} finally {
			if (allocation) {
				await handle._client?.release(allocation.allocationId);
			}
		}
	},
});

async function allocate(
	client: DevicePoolClient,
	options: MobilewrightOptions,
): Promise<AllocationHandle> {
	const timeout = options.allocationTimeout ?? DEFAULT_ALLOCATION_TIMEOUT;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		return await client.allocate(
			{
				platform: options.platform,
				deviceId: options.deviceId,
				deviceNamePattern: options.deviceName?.source,
				deviceType: options.deviceType,
				osVersion: options.osVersion,
				installApps: toArray(options.installApps),
			},
			controller.signal,
		);
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error(
				`Waiting for a device timed out after ${timeout}ms (allocationTimeout)`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timer);
	}
}
