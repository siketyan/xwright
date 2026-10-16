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

/** A snapshot of the device's state, taken before, during or after an action. */
export interface SnapshotEvent {
	/** The ID of the type of the payload, e.g. `xwright.screenshot@1`. */
	type: string;
	/** When the snapshot was taken, relative to the action. */
	phase?: "before" | "action" | "after";
	/** The action the snapshot belongs to. */
	callId?: string;
	payload: unknown;
	t?: number;
}

/** A log line of the device, such as an entry of logcat or the browser console. */
export interface LogEvent {
	level?: "debug" | "info" | "warning" | "error";
	text: string;
	/** The action the log belongs to, for logs of waiting. */
	callId?: string;
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
 * Adapters hook into the driver of the device and write to this. The trace is not written yet, so every method only
 * runs the given function and records nothing.
 */
export interface Tracer {
	/** Records an action around `fn`. Actions started inside `fn` become its children. */
	action<T>(meta: ActionMeta, fn: () => T | Promise<T>): Promise<T>;
	/** Starts an action explicitly, for drivers that report the start and the end separately. */
	begin(meta: ActionMeta): ActionSpan;
	/** Ends an action started by {@link Tracer.begin}. */
	end(span: ActionSpan, options?: EndOptions): void;
	snapshot(event: SnapshotEvent): void;
	log(event: LogEvent): void;
	resource(event: ResourceEvent): void;
}

let nextCallId = 0;

/** A tracer that records nothing, until the trace is written. */
export function createTracer(): Tracer {
	return {
		async action(_meta, fn) {
			return await fn();
		},
		begin() {
			nextCallId += 1;
			return { callId: `call@${nextCallId}` };
		},
		end() {},
		snapshot() {},
		log() {},
		resource() {},
	};
}
