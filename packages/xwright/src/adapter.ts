import type { AdapterOptions, WorkerSlot } from "@xwright/core";

export type {
	Adapter,
	AdapterDefinition,
	AdapterOptions,
	HandleOf,
	Json,
	OnceContext,
	TestContext,
	WorkerContext,
	WorkerSlot,
} from "@xwright/core";
export { defineAdapter } from "@xwright/core";

/** The slot `createOnce` and `disposeOnce` make the options for, in the runner. */
export const RUNNER_SLOT: WorkerSlot = { parallelIndex: 0, workerIndex: 0 };

/** Makes the options of the adapter for the worker. */
export function resolveOptions<Options>(
	options: AdapterOptions<Options>,
	worker: WorkerSlot,
): Options {
	return typeof options === "function"
		? (options as (worker: WorkerSlot) => Options)(worker)
		: options;
}
