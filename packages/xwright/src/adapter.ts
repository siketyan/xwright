import type { FullConfig, TestInfo, WorkerInfo } from "playwright/test";
import { addLibraryDirectory, callerDirectory } from "./trace/stack.js";
import type { Tracer } from "./trace.js";

/** A value that survives `JSON.stringify` unchanged. */
export type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };

/** The worker that the options of an adapter are made for, by {@link AdapterOptions} given as a function. */
export interface WorkerSlot {
	/**
	 * The index of the worker among the ones running at once, from 0 to the number of workers - 1. It stays the same
	 * when the worker is recreated after a failure, so it is the one to choose an account or a port by.
	 */
	parallelIndex: number;
	/** The unique index of the worker in the run, which a worker recreated after a failure gets anew. */
	workerIndex: number;
}

/**
 * The options of an adapter, or a function that makes them for each worker, such as to give every worker its own
 * account or port: `playwright(({ parallelIndex }) => ({ ... }))`.
 *
 * `createOnce` and `disposeOnce` run in the runner, outside the workers, and get the options of the indices 0.
 */
export type AdapterOptions<Options> =
	| Options
	| ((worker: WorkerSlot) => Options);

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

/** The context of {@link AdapterDefinition.createOnce} and {@link AdapterDefinition.disposeOnce}. */
export interface OnceContext<Options> {
	/** The options the adapter was configured with. */
	options: Options;
	/** The resolved configuration of Playwright Test, such as the number of workers. */
	config: FullConfig;
}

/** The context of the hooks that run in a worker. */
export interface WorkerContext<Options, Shared extends Json> {
	/** The name of the device in the configuration, e.g. `phone`. */
	name: string;
	/** The options the adapter was configured with. */
	options: Options;
	/** The value {@link AdapterDefinition.createOnce} returned, or `undefined` without it. */
	shared: Shared;
	/** Records what the device did on its track of the trace. */
	trace: Tracer;
	workerInfo: WorkerInfo;
}

/** The context of the hooks that run for a test file or a test. */
export interface TestContext<Options, Shared extends Json>
	extends WorkerContext<Options, Shared> {
	/** The test, or the first or last test of the file for `beforeAll` and `afterAll`. */
	testInfo: TestInfo;
}

/**
 * The definition of an adapter, which brings a device into Xwright.
 *
 * Every hook is optional; what to do in each one is up to the adapter.
 */
export interface AdapterDefinition<
	Options,
	Handle extends object,
	Shared extends Json = never,
> {
	/** The ID of the adapter, such as its package name. */
	name: string;
	/**
	 * Called once in the whole run, in the runner's process, only when a test that will run uses the device. The
	 * return value is passed to every worker as `shared`, such as the URL of a coordinator of a device pool.
	 */
	createOnce?(ctx: OnceContext<Options>): Shared | Promise<Shared>;
	/** Called once at the end of the run, in the runner's process, after `createOnce`. */
	disposeOnce?(shared: Shared, ctx: OnceContext<Options>): void | Promise<void>;
	/**
	 * Called once in a worker, when the first file that uses the device comes. The return value is what the handle
	 * that `use()` returns points to, shared in the worker.
	 */
	create(ctx: WorkerContext<Options, Shared>): Handle | Promise<Handle>;
	/** Called when the worker ends, after `create`. */
	dispose?(
		handle: Handle,
		ctx: WorkerContext<Options, Shared>,
	): void | Promise<void>;
	/**
	 * Called for each file that uses the device, before the user's `beforeAll`. As in Playwright, it runs again when
	 * the worker is recreated after a failure or for a retry.
	 */
	beforeAll?(
		handle: Handle,
		ctx: TestContext<Options, Shared>,
	): void | Promise<void>;
	/** Called before each test, before the user's `beforeEach`. */
	beforeEach?(
		handle: Handle,
		ctx: TestContext<Options, Shared>,
	): void | Promise<void>;
	/**
	 * Called when a test failed, before the user's `afterEach`, for all devices in parallel. It is called on a
	 * timeout as well.
	 */
	onFailure?(
		handle: Handle,
		ctx: TestContext<Options, Shared>,
	): void | Promise<void>;
	/** Called after each test, after the user's `afterEach`, for all devices in parallel. */
	afterEach?(
		handle: Handle,
		ctx: TestContext<Options, Shared>,
	): void | Promise<void>;
	/** Called for each file that uses the device, after the user's `afterAll`. */
	afterAll?(
		handle: Handle,
		ctx: TestContext<Options, Shared>,
	): void | Promise<void>;
}

/** An adapter configured with its options, to be put on a device in the configuration. */
export interface Adapter<
	Options = unknown,
	Handle extends object = object,
	Shared extends Json = Json,
> {
	readonly definition: AdapterDefinition<Options, Handle, Shared>;
	readonly options: AdapterOptions<Options>;
}

/** The type of the handle `use()` returns for a device with the adapter. */
export type HandleOf<A> =
	A extends Adapter<unknown, infer Handle> ? Handle : never;

/**
 * Defines an adapter. The returned function takes the options of the adapter, or a function that makes them for
 * each worker, and makes an {@link Adapter} to put on a device in the configuration. The options can be omitted when
 * they accept `undefined`.
 */
export function defineAdapter<
	Options,
	Handle extends object,
	Shared extends Json = never,
>(
	definition: AdapterDefinition<Options, Handle, Shared>,
): (
	...args: undefined extends Options
		? [options?: AdapterOptions<Options>]
		: [options: AdapterOptions<Options>]
) => Adapter<Options, Handle, Shared> {
	// The stacks of actions point to the tests, not to the adapter.
	const directory = callerDirectory();
	if (directory !== undefined) {
		addLibraryDirectory(directory);
	}
	return (...[options]) => ({
		definition,
		options: options as AdapterOptions<Options>,
	});
}
