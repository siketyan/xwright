import { getTarget } from "./runtime.js";
import { test } from "./test.js";

/**
 * The handles of devices by name, which `use()` returns. Declare the devices of your configuration here:
 *
 * ```ts
 * import type { MobilewrightHandle } from "@xwright/mobilewright";
 * import type { PlaywrightHandle } from "@xwright/playwright";
 *
 * declare module "xwright" {
 *   interface Devices {
 *     web: PlaywrightHandle;
 *     phone: MobilewrightHandle;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: augmented by users.
export interface Devices {}

/**
 * Declares that the tests of this file use a device, and returns its handle. Call it at the top level of a test file.
 *
 * The tests run in every project that has all the devices they use, and are skipped in the others. The handle points
 * to the device of the running test, so use it inside tests and hooks. The hooks of the adapter run outside the
 * user's: before the user's `beforeAll` and `beforeEach`, and after the user's `afterEach` and `afterAll`.
 */
export function use<Name extends keyof Devices & string>(
	name: Name,
): Devices[Name] {
	// Playwright Test reads the names of fixtures from the source of the function, so they cannot be computed.
	test.skip(
		({ xwright }) => !Object.hasOwn(xwright.devices, name),
		`The project does not have device "${name}"`,
	);
	test.beforeAll(async ({ xwright, _xwrightWorker }, testInfo) => {
		const device = xwright.devices[name];
		if (device) {
			await _xwrightWorker.beforeAll(name, device, testInfo);
		}
	});
	test.afterEach(async ({ _xwrightWorker }, testInfo) => {
		await _xwrightWorker.onFailure(testInfo);
	});
	test.afterAll(({ _xwrightWorker }, testInfo) => {
		_xwrightWorker.afterAll(name, testInfo);
	});
	return createHandle(name) as Devices[Name];
}

/** Makes a proxy that forwards every operation to the current target of the device. */
export function createHandle(name: string): object {
	return new Proxy(Object.create(null) as object, {
		get(_, property) {
			const target = getTarget(name);
			const value: unknown = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
		set(_, property, value) {
			const target = getTarget(name);
			return Reflect.set(target, property, value, target);
		},
		has(_, property) {
			return Reflect.has(getTarget(name), property);
		},
		ownKeys() {
			return Reflect.ownKeys(getTarget(name));
		},
		getOwnPropertyDescriptor(_, property) {
			const descriptor = Reflect.getOwnPropertyDescriptor(
				getTarget(name),
				property,
			);
			// The proxy's own target has no properties, so report them as configurable to keep the proxy invariants.
			return descriptor && { ...descriptor, configurable: true };
		},
		deleteProperty(_, property) {
			return Reflect.deleteProperty(getTarget(name), property);
		},
	});
}
