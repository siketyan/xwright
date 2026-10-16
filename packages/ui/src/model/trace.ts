import type { TraceSource } from "./source.ts";

/** A frame of the stack that called an action. */
export interface StackFrame {
	file: string;
	line: number;
	column: number;
	function?: string;
}

/** What `trace.json` says about a device. */
export interface TraceDevice {
	name: string;
	adapter: string;
	file: string;
	trace: string;
}

/** The content of `trace.json`. */
export interface TraceMeta {
	version: number;
	test?: {
		id: string;
		title: string;
		titlePath: string[];
		file: string;
		line: number;
		column: number;
		retry: number;
		project: string;
	};
	clock: { wallTime: number; monotonicTime: number };
	devices: TraceDevice[];
	types: Record<string, unknown>;
	result?: { status: string; duration: number };
}

/** An event of a track, as written to its NDJSON file. */
export type TraceEvent = { type: string } & Record<string, unknown>;

/** A log of an action, such as a line of waiting. */
export interface ActionLog {
	time: number;
	message: string;
}

/** A snapshot of the state of a device, such as a screenshot or a DOM snapshot. */
export interface Snapshot {
	/** The kind of the event: `screenshot`, `aria-snapshot`, `frame-snapshot` or `snapshot`. */
	kind: string;
	/** The ID of the type of the payload, for `snapshot`. */
	type?: string;
	phase?: string;
	time: number;
	/** The file in the trace, relative to its directory. */
	file?: string;
	payload?: unknown;
	callId?: string;
}

/** An action on a track: a step of the test, a call of an API, a command of a driver or a hook of an adapter. */
export interface Action {
	callId: string;
	parentId?: string;
	track: string;
	title: string;
	class: string;
	method: string;
	params: Record<string, unknown>;
	stack: StackFrame[];
	startTime: number;
	/** The time it ended, or `undefined` while it runs or when the trace ended before it. */
	endTime?: number;
	error?: { name?: string; message: string; stack?: string };
	result?: unknown;
	input?: {
		point?: { x: number; y: number };
		box?: { x: number; y: number; width: number; height: number };
	};
	logs: ActionLog[];
	snapshots: Snapshot[];
	children: Action[];
}

/** A message of a device, such as an entry of the browser console. */
export interface Message {
	track: string;
	time: number;
	level: string;
	text: string;
	payload?: unknown;
	file?: string;
}

/** A communication of a device, such as an HTTP request. */
export interface Resource {
	track: string;
	id: string;
	type: string;
	target: string;
	status?: string | number;
	startTime: number;
	endTime: number;
	request?: unknown;
	response?: unknown;
}

/** A frame of the screencast of a device, for the filmstrip of the timeline. */
export interface ScreencastFrame {
	track: string;
	time: number;
	file: string;
	width?: number;
	height?: number;
}

/** A line the test printed. */
export interface Output {
	stream: "stdout" | "stderr";
	time: number;
	text: string;
}

/** A track of the trace: the test, or a device. */
export interface Track {
	name: string;
	/** The ID of the adapter, or `undefined` for the track of the test. */
	adapter?: string;
}

/** A trace, read from its files. */
export interface Trace {
	meta: TraceMeta;
	/** The URL to show a file of the trace with, such as a screenshot. */
	url(file: string): string;
	tracks: Track[];
	/** The actions without a parent, in the order they started. */
	actions: Action[];
	/** Every action by its call ID. */
	actionsById: Map<string, Action>;
	messages: Message[];
	resources: Resource[];
	screencast: ScreencastFrame[];
	output: Output[];
	errors: { message: string; stack?: string }[];
	/** The times the trace starts and ends at, in milliseconds of the monotonic clock of the host. */
	startTime: number;
	endTime: number;
}

/** The name of the track of the test. */
export const TEST_TRACK = "test";

/** Builds the model of a trace from `trace.json` and the events of its tracks. */
export function parseTrace(
	meta: TraceMeta,
	tracks: { name: string; events: TraceEvent[] }[],
	url: (file: string) => string = (file) => file,
): Trace {
	const actionsById = new Map<string, Action>();
	const trace: Trace = {
		meta,
		url,
		tracks: tracks.map(({ name }) => ({
			name,
			adapter: meta.devices.find((device) => device.name === name)?.adapter,
		})),
		actions: [],
		actionsById,
		messages: [],
		resources: [],
		screencast: [],
		output: [],
		errors: [],
		startTime: Number.POSITIVE_INFINITY,
		endTime: Number.NEGATIVE_INFINITY,
	};
	// Events of an action can come before the action, such as when another tool wrote them.
	const pending = new Map<string, ((action: Action) => void)[]>();
	const withAction = (callId: unknown, fn: (action: Action) => void) => {
		if (typeof callId !== "string") {
			return;
		}
		const action = actionsById.get(callId);
		if (action !== undefined) {
			fn(action);
		} else {
			pending.set(callId, [...(pending.get(callId) ?? []), fn]);
		}
	};
	const see = (time: unknown) => {
		if (typeof time === "number" && time > 0) {
			trace.startTime = Math.min(trace.startTime, time);
			trace.endTime = Math.max(trace.endTime, time);
		}
	};

	for (const { name: track, events } of tracks) {
		for (const event of events) {
			switch (event.type) {
				case "before": {
					const action: Action = {
						callId: event.callId as string,
						parentId: event.parentId as string | undefined,
						track,
						title: event.title as string,
						class: (event.class as string | undefined) ?? "",
						method: (event.method as string | undefined) ?? "",
						params: (event.params as Record<string, unknown> | undefined) ?? {},
						stack: (event.stack as StackFrame[] | undefined) ?? [],
						startTime: event.startTime as number,
						logs: [],
						snapshots: [],
						children: [],
					};
					actionsById.set(action.callId, action);
					for (const fn of pending.get(action.callId) ?? []) {
						fn(action);
					}
					pending.delete(action.callId);
					see(action.startTime);
					break;
				}
				case "after":
					see(event.endTime);
					withAction(event.callId, (action) => {
						action.endTime = event.endTime as number;
						action.error = event.error as Action["error"];
						action.result = event.result;
					});
					break;
				case "input":
					withAction(event.callId, (action) => {
						const input: NonNullable<Action["input"]> = {
							point: event.point as { x: number; y: number } | undefined,
							box: event.box as
								| { x: number; y: number; width: number; height: number }
								| undefined,
						};
						action.input = input;
					});
					break;
				case "log":
					see(event.time);
					withAction(event.callId, (action) => {
						action.logs.push({
							time: event.time as number,
							message: event.message as string,
						});
					});
					break;
				case "screenshot":
				case "aria-snapshot":
				case "snapshot":
				case "frame-snapshot": {
					const snapshot = toSnapshot(event);
					see(snapshot.time);
					withAction(snapshot.callId, (action) => {
						action.snapshots.push(snapshot);
					});
					break;
				}
				case "screencast-frame":
					see(event.timestamp);
					trace.screencast.push({
						track,
						time: event.timestamp as number,
						file: event.file as string,
						width: event.width as number | undefined,
						height: event.height as number | undefined,
					});
					break;
				case "message":
					see(event.time);
					trace.messages.push({
						track,
						time: event.time as number,
						level: (event.level as string | undefined) ?? "info",
						text: event.text as string,
						payload: event.payload,
						file: event.file as string | undefined,
					});
					break;
				case "resource":
					see(event.startTime);
					see(event.endTime);
					trace.resources.push({
						track,
						id: event.id as string,
						type: event.resourceType as string,
						target: event.target as string,
						status: event.status as string | number | undefined,
						startTime: event.startTime as number,
						endTime: event.endTime as number,
						request: event.request,
						response: event.response,
					});
					break;
				case "stdout":
				case "stderr":
					see(event.timestamp);
					trace.output.push({
						stream: event.type,
						time: event.timestamp as number,
						text: event.text as string,
					});
					break;
				case "error":
					trace.errors.push({
						message: event.message as string,
						stack: event.stack as string | undefined,
					});
					break;
			}
		}
	}

	for (const action of actionsById.values()) {
		const parent =
			action.parentId === undefined
				? undefined
				: actionsById.get(action.parentId);
		(parent?.children ?? trace.actions).push(action);
	}
	const byStart = (a: { startTime: number }, b: { startTime: number }) =>
		a.startTime - b.startTime;
	for (const action of actionsById.values()) {
		action.children.sort(byStart);
		action.snapshots.sort((a, b) => a.time - b.time);
	}
	trace.actions.sort(byStart);
	trace.messages.sort((a, b) => a.time - b.time);
	trace.resources.sort(byStart);
	trace.screencast.sort((a, b) => a.time - b.time);
	if (trace.startTime > trace.endTime) {
		trace.startTime = meta.clock.monotonicTime;
		trace.endTime = meta.clock.monotonicTime;
	}
	return trace;
}

function toSnapshot(event: TraceEvent): Snapshot {
	if (event.type === "frame-snapshot") {
		const snapshot = event.snapshot as Record<string, unknown>;
		return {
			kind: event.type,
			phase: snapshot.snapshotName as string | undefined,
			time: snapshot.timestamp as number,
			payload: snapshot,
			callId: snapshot.callId as string | undefined,
		};
	}
	return {
		kind: event.type,
		type: event.snapshotType as string | undefined,
		phase: event.phase as string | undefined,
		time: (event.time ?? event.timestamp) as number,
		file: event.file as string | undefined,
		payload: event.payload,
		callId: event.callId as string | undefined,
	};
}

/** Parses the lines of an NDJSON file, skipping a last line not written to the end yet. */
export function parseEvents(text: string): TraceEvent[] {
	const events: TraceEvent[] = [];
	for (const line of text.split("\n")) {
		if (line.trim() === "") {
			continue;
		}
		try {
			events.push(JSON.parse(line) as TraceEvent);
		} catch {
			// A line still being written.
		}
	}
	return events;
}

/** Loads the trace from its source. */
export async function loadTrace(source: TraceSource): Promise<Trace> {
	const text = await source.text("trace.json");
	if (text === undefined) {
		throw new Error(`${source.name} has no trace.json`);
	}
	const meta = JSON.parse(text) as TraceMeta;
	const files = [
		{ name: TEST_TRACK, file: `${TEST_TRACK}.ndjson` },
		...meta.devices.map(({ name, file }) => ({ name, file })),
	];
	const tracks = await Promise.all(
		files.map(async ({ name, file }) => ({
			name,
			events: parseEvents((await source.text(file)) ?? ""),
		})),
	);
	return parseTrace(meta, tracks, (file) => source.url(file));
}
