import { AsyncLocalStorage } from "node:async_hooks";
import type { ActionMeta, ActionSpan, EndOptions, Tracer } from "../trace.js";
import { hostTime } from "./clock.js";
import type { Track } from "./directory.js";
import { captureStack } from "./stack.js";

/** The action running in the current async context, which becomes the parent of the actions started in it. */
const currentAction = new AsyncLocalStorage<string>();

let lastCallId = 0;

function nextCallId(): string {
	lastCallId += 1;
	return `call@${lastCallId}`;
}

/**
 * Makes a tracer that writes to the track `resolve` returns at the time of each event, such as the track of the
 * device in the trace of the running test. It records nothing while `resolve` returns `undefined`.
 */
export function createTracer(resolve: () => Track | undefined): Tracer {
	const begin = (meta: ActionMeta): ActionSpan => {
		const callId = nextCallId();
		const parentId = currentAction.getStore();
		resolve()?.append({
			type: "before",
			callId,
			...(parentId === undefined ? {} : { parentId }),
			startTime: meta.t ?? hostTime(),
			title: meta.title,
			class: meta.class ?? "Device",
			method: meta.method ?? meta.title,
			params: meta.params ?? {},
			stack: meta.stack ?? captureStack(),
		});
		return { callId };
	};

	const end = (span: ActionSpan, options: EndOptions = {}): void => {
		resolve()?.append({
			type: "after",
			callId: span.callId,
			endTime: options.t ?? hostTime(),
			...(options.error === undefined
				? {}
				: { error: serializeError(options.error) }),
			...(options.result === undefined ? {} : { result: options.result }),
		});
	};

	return {
		async action(meta, fn) {
			const span = begin(meta);
			try {
				const result = await currentAction.run(span.callId, fn);
				end(span);
				return result;
			} catch (error) {
				end(span, { error });
				throw error;
			}
		},
		begin,
		end,
		input(event) {
			resolve()?.append({ type: "input", ...event });
		},
		snapshot({ type, phase, callId, payload, contentType, t }) {
			const track = resolve();
			if (track === undefined) {
				return;
			}
			const time = t ?? hostTime();
			// A snapshot taken inside an action belongs to it.
			callId ??= currentAction.getStore();
			if (type === "xwright.screenshot@1") {
				const { file } = track.payload(payload, contentType ?? "image/png") as {
					file?: string;
				};
				track.append({ type: "screenshot", callId, phase, time, file });
				return;
			}
			track.append({
				type: "snapshot",
				snapshotType: type,
				callId,
				phase,
				time,
				...track.payload(payload, contentType),
			});
		},
		log({ level, text, callId, payload, t }) {
			const track = resolve();
			const time = t ?? hostTime();
			if (callId !== undefined) {
				track?.append({ type: "log", callId, time, message: text });
				return;
			}
			track?.append({
				type: "message",
				time,
				level: level ?? "info",
				text,
				...(payload === undefined ? {} : track.payload(payload)),
			});
		},
		resource({ type, target, status, request, response, startTime, endTime }) {
			const track = resolve();
			lastCallId += 1;
			track?.append({
				type: "resource",
				id: `resource@${lastCallId}`,
				resourceType: type,
				startTime: startTime ?? hostTime(),
				endTime: endTime ?? hostTime(),
				target,
				...(status === undefined ? {} : { status }),
				...(request === undefined ? {} : { request: track.payload(request) }),
				...(response === undefined
					? {}
					: { response: track.payload(response) }),
			});
		},
	};
}

/** The parts of an error the viewer shows. */
export function serializeError(error: unknown): {
	name?: string;
	message: string;
	stack?: string;
} {
	if (error instanceof Error) {
		return { name: error.name, message: error.message, stack: error.stack };
	}
	return { message: String(error) };
}
