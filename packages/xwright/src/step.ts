import { fileURLToPath } from "node:url";
import type { Location, TestStepInfo } from "playwright/test";
import { test } from "./test.js";
import { currentTestTrack } from "./trace/session.js";
import { createTracer } from "./trace/tracer.js";

/** Options of {@link step}, the same as `test.step`'s. */
export interface StepOptions {
	box?: boolean;
	location?: Location;
	timeout?: number;
}

/** Records the steps on the track of the test. */
const tracer = createTracer(currentTestTrack);

/**
 * Declares a step of the test, the same as `test.step`. The step is shown in the report of Playwright Test and on the
 * timeline of the trace, around the actions of every device in it.
 */
export async function step<T>(
	title: string,
	body: (step: TestStepInfo) => T | Promise<T>,
	options: StepOptions = {},
): Promise<T> {
	const location = options.location ?? callerLocation();
	return await tracer.action({ title, class: "Test", method: "step" }, () =>
		test.step(title, body, { ...options, location }),
	);
}

/** Finds where `step()` was called, which `test.step` would otherwise take as somewhere in Xwright. */
function callerLocation(): Location | undefined {
	const holder: { stack?: string } = {};
	Error.captureStackTrace(holder, step);
	const frame = holder.stack?.split("\n")[1];
	const match =
		frame && /\(?((?:file:\/\/)?[^\s()]+):(\d+):(\d+)\)?$/.exec(frame);
	if (!match?.[1]) {
		return undefined;
	}
	return {
		file: match[1].startsWith("file://") ? fileURLToPath(match[1]) : match[1],
		line: Number(match[2]),
		column: Number(match[3]),
	};
}
