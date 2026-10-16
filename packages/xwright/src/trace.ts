/** A frame of the stack that called an action, to jump to the source from the trace. */
export interface StackFrame {
	file: string;
	line: number;
	column: number;
	function?: string;
}

/** Metadata of an action recorded on a device's track. */
export interface ActionMeta {
	/** The title shown in the action list, e.g. `tap` or `goto`. */
	title: string;
	/** The class of the API that was called, e.g. `Locator`. */
	class?: string;
	/** The method of the API that was called, e.g. `tap`. */
	method?: string;
	/** The parameters the API was called with. */
	params?: Record<string, unknown>;
	/** The stack that called the action. Defaults to the current one, without the frames of Xwright and adapters. */
	stack?: StackFrame[];
	/** The host time the action started at, in milliseconds of the monotonic clock. */
	t?: number;
}

/** An action started by {@link Tracer.begin}, to be finished by {@link Tracer.end}. */
export interface ActionSpan {
	readonly callId: string;
}

/** Options of {@link Tracer.end}. */
export interface EndOptions {
	/** The error the action failed with. */
	error?: unknown;
	/** The value the action returned. */
	result?: unknown;
	/** The host time the action ended at, in milliseconds of the monotonic clock. */
	t?: number;
}

/** Where an action acted on the screen, such as the point of a tap. */
export interface InputEvent {
	callId: string;
	point?: { x: number; y: number };
	box?: { x: number; y: number; width: number; height: number };
}

/** A snapshot of the device's state, taken before, during or after an action. */
export interface SnapshotEvent {
	/** The ID of the type of the payload, e.g. `xwright.screenshot@1`. */
	type: string;
	/** When the snapshot was taken, relative to the action. */
	phase?: "before" | "action" | "after";
	/** The action the snapshot belongs to. */
	callId?: string;
	/** A value that `JSON.stringify` takes, or the bytes of a file such as a PNG. */
	payload: unknown;
	/** The media type of the payload when it is bytes, e.g. `image/png`. */
	contentType?: string;
	t?: number;
}

/** A log line of the device, such as an entry of logcat or the browser console. */
export interface LogEvent {
	level?: "debug" | "info" | "warning" | "error";
	text: string;
	/** The action the log belongs to, for logs of waiting. */
	callId?: string;
	/** Structured data of the log. */
	payload?: unknown;
	t?: number;
}

/** A communication of the device, such as an HTTP request, shown in the network panel. */
export interface ResourceEvent {
	/** The ID of the type of the resource, e.g. `xwright.http@1`. */
	type: string;
	target: string;
	status?: string | number;
	request?: unknown;
	response?: unknown;
	startTime?: number;
	endTime?: number;
}

/**
 * Records what a device did on its track of the trace.
 *
 * Adapters hook into the driver of the device and write to this. Times are of the monotonic clock of the host by
 * default; an adapter of a device with its own clock passes `t`, converted to the host's.
 */
export interface Tracer {
	/** Records an action around `fn`. Actions started inside `fn` become its children. */
	action<T>(meta: ActionMeta, fn: () => T | Promise<T>): Promise<T>;
	/** Starts an action explicitly, for drivers that report the start and the end separately. */
	begin(meta: ActionMeta): ActionSpan;
	/** Ends an action started by {@link Tracer.begin}. */
	end(span: ActionSpan, options?: EndOptions): void;
	input(event: InputEvent): void;
	snapshot(event: SnapshotEvent): void;
	log(event: LogEvent): void;
	resource(event: ResourceEvent): void;
}
