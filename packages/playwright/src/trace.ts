import { closeSync, openSync, readSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import type { ActionSpan, StackFrame, Tracer } from "xwright";

/** What Playwright passes to the listeners of its client-side instrumentation for each call of the API. */
interface ApiCallData {
	title?: string;
	frames: StackFrame[];
	error?: unknown;
	stepId?: string;
}

interface ApiCallChannel {
	type: string;
	method: string;
	params?: Record<string, unknown>;
}

interface ClientInstrumentationListener {
	onApiCallBegin?(data: ApiCallData, channel: ApiCallChannel): void;
	onApiCallEnd?(data: ApiCallData): void;
}

interface ClientInstrumentation {
	addListener(listener: ClientInstrumentationListener): void;
	removeListener(listener: ClientInstrumentationListener): void;
}

/** The instrumentation of Playwright's client, which Playwright Test also listens to. */
const instrumentation = (
	createRequire(import.meta.url)("playwright") as {
		_instrumentation: ClientInstrumentation;
	}
)._instrumentation;

/**
 * Records every call of Playwright's API as an action on the track.
 *
 * The action is started in the async context of the caller, so it becomes a child of the step that made the call.
 * Its call ID is given to Playwright as the step ID, which Playwright puts on its own trace events of the call, so
 * that the logs and snapshots of the call can be put under the action.
 */
export class ApiCallRecorder {
	private readonly trace: Tracer;
	private readonly spans = new WeakMap<ApiCallData, ActionSpan>();
	private readonly listener: ClientInstrumentationListener = {
		onApiCallBegin: (data, channel) => {
			// Tracing is how this records, and is not an action of the test.
			if (channel.type === "Tracing" || !this.trace.recording) {
				return;
			}
			const span = this.trace.begin({
				title: data.title ?? `${channel.type}.${channel.method}`,
				class: channel.type,
				method: channel.method,
				params: channel.params ?? {},
				stack: data.frames,
			});
			this.spans.set(data, span);
			data.stepId = span.callId;
		},
		onApiCallEnd: (data) => {
			const span = this.spans.get(data);
			if (span !== undefined) {
				this.trace.end(span, { error: data.error });
			}
		},
	};

	constructor(trace: Tracer) {
		this.trace = trace;
	}

	/**
	 * Starts listening, after the listeners already there. Playwright Test adds its listener for every test and hook,
	 * and sets the step ID of the call to its own step, so call this at the start of each of them to set it last.
	 */
	attach(): void {
		instrumentation.removeListener(this.listener);
		instrumentation.addListener(this.listener);
	}

	detach(): void {
		instrumentation.removeListener(this.listener);
	}
}

/** The events of Playwright's trace this reads. */
interface PlaywrightEvent {
	type: string;
	[key: string]: unknown;
}

const CONSOLE_LEVELS: Record<string, string> = {
	debug: "debug",
	error: "error",
	warning: "warning",
};

/**
 * Follows the live trace of a browser context that Playwright writes to its traces directory, and converts its events
 * into the track: logs, inputs, screenshots, DOM snapshots and console messages of the calls, and the network.
 *
 * Playwright's own trace files are deleted when the conversion ends.
 */
export class LiveTraceConverter {
	private readonly trace: Tracer;
	private readonly tracesDir: string;
	private readonly name: string;
	private readonly files: TailedFile[];
	/** The call IDs of Playwright's trace, mapped to the actions of the track by the step IDs. */
	private readonly calls = new Map<string, string>();
	/** The difference to add to Playwright's monotonic times to make them the host's. */
	private clockOffset = 0;
	private timer: NodeJS.Timeout | undefined;

	constructor(trace: Tracer, tracesDir: string, name: string) {
		this.trace = trace;
		this.tracesDir = tracesDir;
		this.name = name;
		this.files = [
			new TailedFile(join(tracesDir, `${name}.trace`)),
			new TailedFile(join(tracesDir, `${name}.network`)),
		];
		this.timer = setInterval(() => this.poll(), 100);
		this.timer.unref();
	}

	/** Converts the events written since the last time. */
	poll(): void {
		for (const file of this.files) {
			for (const line of file.readLines()) {
				this.convert(JSON.parse(line) as PlaywrightEvent);
			}
		}
	}

	/** Converts the rest of the events, after Playwright flushed them, and deletes Playwright's files of the trace. */
	stop(): void {
		clearInterval(this.timer);
		this.timer = undefined;
		this.poll();
		for (const file of this.files) {
			file.close();
		}
		for (const suffix of [".trace", ".network", ".stacks"]) {
			rmSync(join(this.tracesDir, `${this.name}${suffix}`), { force: true });
		}
	}

	private convert(event: PlaywrightEvent): void {
		switch (event.type) {
			case "context-options": {
				// The pair of times of Playwright, against the host's at the same wall-clock time.
				const hostMonotonic = Number(process.hrtime.bigint()) / 1e6;
				this.clockOffset =
					hostMonotonic -
					Date.now() +
					(event.wallTime as number) -
					(event.monotonicTime as number);
				return;
			}
			case "before":
				if (typeof event.stepId === "string") {
					this.calls.set(event.callId as string, event.stepId);
				}
				return;
			case "log": {
				const callId = this.call(event.callId);
				if (callId !== undefined) {
					this.trace.raw({
						type: "log",
						callId,
						time: this.time(event.time),
						message: event.message,
					});
				}
				return;
			}
			case "input": {
				const callId = this.call(event.callId);
				if (callId !== undefined) {
					this.trace.raw({ ...event, callId });
				}
				return;
			}
			case "screenshot":
			case "aria-snapshot": {
				const file = this.copy(event.file);
				if (file !== undefined) {
					this.trace.raw({
						type: event.type,
						callId: this.call(event.callId),
						phase: event.phase,
						pageId: event.pageId,
						time: this.time(event.timestamp),
						file,
					});
				}
				return;
			}
			case "screencast-frame": {
				const file = this.copy(event.file);
				if (file !== undefined) {
					this.trace.raw({
						...event,
						timestamp: this.time(event.timestamp),
						file,
					});
				}
				return;
			}
			case "frame-snapshot":
				this.convertFrameSnapshot(event.snapshot as Record<string, unknown>);
				return;
			case "resource-snapshot":
				this.convertResource(event.snapshot as HarEntry);
				return;
			case "console":
				this.trace.raw({
					type: "message",
					time: this.time(event.time),
					level: CONSOLE_LEVELS[event.messageType as string] ?? "info",
					text: event.text,
					payload: { source: "console", location: event.location },
				});
				return;
		}
	}

	/** Keeps the DOM snapshot as Playwright writes it, with the resources it refers to. */
	private convertFrameSnapshot(snapshot: Record<string, unknown>): void {
		for (const override of (snapshot.resourceOverrides ?? []) as {
			sha1?: string;
		}[]) {
			if (override.sha1 !== undefined) {
				this.copy(`resources/${override.sha1}`);
			}
		}
		this.trace.raw({
			type: "frame-snapshot",
			snapshot: {
				...snapshot,
				callId: this.call(snapshot.callId),
				timestamp: this.time(snapshot.timestamp),
			},
		});
	}

	private convertResource(entry: HarEntry): void {
		for (const sha1 of [
			entry.request.postData?._sha1,
			entry.response.content._sha1,
		]) {
			if (sha1 !== undefined) {
				this.copy(`resources/${sha1}`);
			}
		}
		const startTime =
			entry._monotonicTime === undefined
				? Number(process.hrtime.bigint()) / 1e6
				: this.time(entry._monotonicTime);
		this.trace.resource({
			type: "xwright.http@1",
			target: entry.request.url,
			status: entry.response.status,
			request: entry.request,
			response: entry.response,
			startTime,
			endTime: startTime + Math.max(entry.time, 0),
		});
	}

	private call(callId: unknown): string | undefined {
		return typeof callId === "string" ? this.calls.get(callId) : undefined;
	}

	private time(time: unknown): number {
		return typeof time === "number" ? time + this.clockOffset : 0;
	}

	/** Copies a file of Playwright's trace into the resources of the track, under its base name. */
	private copy(file: unknown): string | undefined {
		if (typeof file !== "string") {
			return undefined;
		}
		const name = file.replaceAll("/", "-");
		try {
			return this.trace.copyResource(join(this.tracesDir, file), name);
		} catch {
			// The file is gone, such as a resource of an earlier chunk.
			return undefined;
		}
	}
}

/** The parts of an entry of HAR the network panel shows. */
interface HarEntry {
	time: number;
	_monotonicTime?: number;
	request: { url: string; postData?: { _sha1?: string } };
	response: { status: number; content: { _sha1?: string } };
}

/** Reads the lines appended to a file since the last read, keeping a line not finished yet for the next time. */
class TailedFile {
	private readonly path: string;
	private fd: number | undefined;
	private position = 0;
	private rest = "";
	private readonly decoder = new StringDecoder("utf8");

	constructor(path: string) {
		this.path = path;
	}

	readLines(): string[] {
		if (this.fd === undefined) {
			try {
				this.fd = openSync(this.path, "r");
			} catch {
				return [];
			}
		}
		const size = statSync(this.path).size;
		if (size <= this.position) {
			return [];
		}
		const buffer = Buffer.alloc(size - this.position);
		const read = readSync(this.fd, buffer, 0, buffer.length, this.position);
		this.position += read;
		const lines = (
			this.rest + this.decoder.write(buffer.subarray(0, read))
		).split("\n");
		this.rest = lines.pop() ?? "";
		return lines.filter((line) => line.length > 0);
	}

	close(): void {
		if (this.fd !== undefined) {
			closeSync(this.fd);
			this.fd = undefined;
		}
	}
}
