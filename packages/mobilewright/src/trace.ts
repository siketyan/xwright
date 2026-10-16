import type { Device, MobilewrightDriver } from "mobilewright";
import { test } from "playwright/test";
import type { Tracer } from "xwright";

/** When to take a screenshot around an operation of Mobilewright. */
export type ScreenshotPhase = "before" | "after";

/** The methods of a driver that are not commands to the device. */
const NOT_COMMANDS = new Set([
	"allocate",
	"release",
	"prepare",
	"dispose",
	"observer",
	"webViewBridge",
]);

/**
 * Wraps a driver, so that every command it sends to the device is an action on the track, under the operation of
 * Mobilewright that sent it.
 */
export function traceDriver(
	driver: MobilewrightDriver,
	trace: Tracer,
): MobilewrightDriver {
	return new Proxy(driver, {
		get(target, property, receiver) {
			const value: unknown = Reflect.get(target, property, receiver);
			if (
				typeof value !== "function" ||
				typeof property !== "string" ||
				NOT_COMMANDS.has(property)
			) {
				return value;
			}
			return (...args: unknown[]) =>
				trace.action(
					{
						title: property,
						class: "Driver",
						method: property,
						params: { args: args.map(describe) },
						stack: [],
					},
					() => (value as (...a: unknown[]) => unknown).apply(target, args),
				);
		},
	});
}

/** Describes an argument of a command for the trace, without bytes or functions. */
function describe(value: unknown): unknown {
	if (value instanceof Uint8Array) {
		return `<${value.byteLength} bytes>`;
	}
	if (value instanceof RegExp) {
		return value.toString();
	}
	if (typeof value === "function") {
		return "<function>";
	}
	return value;
}

/**
 * Makes the step function of Mobilewright, which runs each operation such as a tap or an assertion. The operation is
 * a step of Playwright Test, and an action on the track with the screenshots of the phases taken by the driver.
 */
export function createStepFn(
	trace: Tracer,
	driver: MobilewrightDriver,
	screenshots: readonly ScreenshotPhase[],
): Parameters<Device["setStepFn"]>[0] {
	const screenshot = async (phase: ScreenshotPhase): Promise<void> => {
		if (!screenshots.includes(phase) || !trace.recording) {
			return;
		}
		try {
			// The driver itself, so that the screenshot is not a command of the operation.
			trace.snapshot({
				type: "xwright.screenshot@1",
				phase,
				payload: await driver.screenshot(),
				contentType: "image/png",
			});
		} catch {
			// The device may be gone, such as after the app crashed.
		}
	};

	return (title, fn, location) =>
		trace.action(
			{
				title,
				class: "Mobilewright",
				method: "step",
				stack: location === undefined ? [] : [location],
			},
			() =>
				test.step(
					title,
					async () => {
						await screenshot("before");
						try {
							return await fn();
						} finally {
							await screenshot("after");
						}
					},
					{ location },
				),
		);
}
