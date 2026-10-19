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
				apiStep(title, location, async () => {
					await screenshot("before");
					try {
						return await fn();
					} finally {
						await screenshot("after");
					}
				}),
		);
}

/** The internal part of Playwright Test's `TestInfo` that adds a step, as Playwright does for the calls of its API. */
interface StepAdder {
	_addStep(data: {
		title: string;
		category: string;
		location?: { file: string; line: number; column: number };
	}): { complete(result: { error?: unknown }): void };
}

/**
 * Runs an operation of Mobilewright as a step of the test, of the same category as a call of Playwright's API, or as
 * an assertion for `expect`. Reporters then show it as Playwright's own: the list reporter prints only the steps of
 * the test, and the HTML report shows it as an action. Outside a test, the operation just runs.
 */
async function apiStep<T>(
	title: string,
	location: { file: string; line: number; column: number } | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	let info: StepAdder;
	try {
		info = test.info() as unknown as StepAdder;
	} catch {
		return await fn();
	}
	const step = info._addStep({
		title,
		category: title.startsWith("expect.") ? "expect" : "pw:api",
		location,
	});
	try {
		const result = await fn();
		step.complete({});
		return result;
	} catch (error) {
		step.complete({ error });
		throw error;
	}
}
