import type { ActionSpan, Tracer } from "@xwright/core";

/** The events WebdriverIO emits for each command of the WebDriver protocol. */
interface CommandEvent {
	command: string;
	method: string;
	endpoint: string;
	body: Record<string, unknown>;
}

interface ResultEvent extends CommandEvent {
	result: { error?: unknown; value?: unknown } | unknown;
}

/** What the browser of WebdriverIO offers to listen to its commands, and to take a screenshot. */
export interface CommandEmitter {
	on(event: "command", listener: (event: CommandEvent) => void): unknown;
	on(event: "result", listener: (event: ResultEvent) => void): unknown;
	takeScreenshot(): Promise<string>;
}

/** The commands that change the screen, after which a screenshot is taken. */
const INTERACTIONS = new Set([
	"elementClick",
	"elementClear",
	"elementSendKeys",
	"performActions",
	"releaseActions",
	"back",
	"navigateTo",
	"executeScript",
	"executeAsyncScript",
]);

/** The title of a command, with the most telling of its parameters, e.g. `findElement accessibility id=Sign in`. */
function title({ command, body }: CommandEvent): string {
	if (typeof body.using === "string" && typeof body.value === "string") {
		return `${command} ${body.using}=${body.value}`;
	}
	if (typeof body.script === "string" && body.script.startsWith("mobile:")) {
		return `${command} ${body.script}`;
	}
	return command;
}

/**
 * Records every command WebdriverIO sends to the Appium server as an action on the track, under the step of the test
 * that sent it, with a screenshot after the commands that change the screen.
 *
 * A screenshot is requested when WebdriverIO reports the result, before the test gets it, so that the Appium server,
 * which runs the commands of a session one after another, takes it before the next command of the test.
 */
export function traceCommands(
	driver: CommandEmitter,
	trace: Tracer,
	screenshots: boolean,
): void {
	const spans = new Map<string, ActionSpan[]>();
	// The screenshots this adapter takes, which are not commands of the test.
	let ownScreenshots = 0;
	const key = (event: CommandEvent) => `${event.method} ${event.endpoint}`;

	driver.on("command", (event) => {
		if (!trace.recording) {
			return;
		}
		if (event.command === "takeScreenshot" && ownScreenshots > 0) {
			return;
		}
		const span = trace.begin({
			title: title(event),
			class: "Appium",
			method: event.command,
			params: { method: event.method, endpoint: event.endpoint, ...event.body },
		});
		spans.set(key(event), [...(spans.get(key(event)) ?? []), span]);
	});

	driver.on("result", (event) => {
		if (event.command === "takeScreenshot" && ownScreenshots > 0) {
			ownScreenshots--;
			return;
		}
		const queue = spans.get(key(event));
		const span = queue?.shift();
		if (span === undefined) {
			return;
		}
		const result = event.result as { error?: unknown; value?: unknown };
		const error = result?.error ?? undefined;
		trace.end(span, error === undefined ? {} : { error });
		if (
			!screenshots ||
			error !== undefined ||
			!INTERACTIONS.has(event.command)
		) {
			return;
		}
		ownScreenshots++;
		driver.takeScreenshot().then(
			(base64) =>
				trace.snapshot({
					type: "xwright.screenshot@1",
					phase: "after",
					callId: span.callId,
					payload: Buffer.from(base64, "base64"),
					contentType: "image/png",
				}),
			() => {
				// The session may be gone, such as after the app crashed.
			},
		);
	});
}
