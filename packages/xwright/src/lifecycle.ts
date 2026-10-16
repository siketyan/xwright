import type { TestInfo, WorkerInfo } from "playwright/test";
import type {
	Adapter,
	AdapterDefinition,
	Json,
	TestContext,
	WorkerContext,
} from "./adapter.js";
import type { ResolvedDevice } from "./config.js";
import { requestShared } from "./coordinator.js";
import { deleteTarget, setTarget } from "./runtime.js";
import { createTracer } from "./trace/tracer.js";

type AnyDefinition = AdapterDefinition<unknown, object, Json>;

interface Device {
	readonly definition: AnyDefinition;
	readonly context: WorkerContext<unknown, Json>;
	readonly handle: Promise<object>;
}

interface FileState {
	readonly file: string;
	/** The devices `beforeAll` ran for, in the order of `use()`. */
	readonly devices: string[];
	/** The devices whose `afterAll` is due, with the test it belongs to. */
	readonly ended: Map<string, TestInfo>;
}

/**
 * Runs the hooks of the adapters in a worker.
 *
 * The hooks run outside the user's: `beforeAll` and `onFailure` are hooks that `use()` registers before any of the
 * user's, `beforeEach` and `afterEach` are an automatic fixture around the user's `beforeEach` and `afterEach`, and
 * `create` and `dispose` follow the worker. Playwright Test runs `afterAll` hooks in the order they were registered,
 * so `afterAll` of the adapters is put off until the user's `afterAll` finished: until the next file starts, or the
 * worker ends.
 */
export class WorkerSession {
	private readonly workerInfo: WorkerInfo;
	private readonly devices = new Map<string, Device>();
	private file: FileState | undefined;
	private readonly failed = new WeakSet<TestInfo>();
	private readonly deferredErrors: unknown[] = [];

	constructor(workerInfo: WorkerInfo) {
		this.workerInfo = workerInfo;
	}

	/** Runs `beforeAll` of the device for the file of the test, creating the device first in the worker. */
	async beforeAll(
		name: string,
		config: ResolvedDevice,
		testInfo: TestInfo,
	): Promise<void> {
		if (this.file?.file !== testInfo.file) {
			await this.endFile();
			this.file = { file: testInfo.file, devices: [], ended: new Map() };
		}
		const device = this.device(name, config);
		const handle = await device.handle;
		await device.definition.beforeAll?.(handle, {
			...device.context,
			testInfo,
		});
		this.file.devices.push(name);
	}

	/** Runs `beforeEach` of the devices of the file, in the order of `use()`. */
	async beforeEach(testInfo: TestInfo): Promise<void> {
		if (this.file?.file !== testInfo.file) {
			await this.endFile();
		}
		for (const name of this.fileDevices(testInfo)) {
			await this.run(name, "beforeEach", testInfo);
		}
	}

	/** Runs `onFailure` of the devices of the file in parallel, once for the test, when it failed. */
	async onFailure(testInfo: TestInfo): Promise<void> {
		if (
			testInfo.status === testInfo.expectedStatus ||
			this.failed.has(testInfo)
		) {
			return;
		}
		this.failed.add(testInfo);
		await settleAll(
			this.fileDevices(testInfo).map((name) =>
				this.run(name, "onFailure", testInfo),
			),
		);
	}

	/** Runs `afterEach` of the devices of the file in parallel. */
	async afterEach(testInfo: TestInfo): Promise<void> {
		await settleAll(
			this.fileDevices(testInfo).map((name) =>
				this.run(name, "afterEach", testInfo),
			),
		);
	}

	/** Marks `afterAll` of the device due, to run after the user's `afterAll`. */
	afterAll(name: string, testInfo: TestInfo): void {
		if (this.file?.file === testInfo.file) {
			this.file.ended.set(name, testInfo);
		}
	}

	/** Runs `afterAll` that is due, and forgets the file. Errors are reported when the worker ends. */
	async endFile(): Promise<void> {
		const file = this.file;
		this.file = undefined;
		if (file === undefined) {
			return;
		}
		for (const name of [...file.devices].reverse()) {
			const testInfo = file.ended.get(name);
			if (testInfo === undefined) {
				continue;
			}
			try {
				await this.run(name, "afterAll", testInfo);
			} catch (error) {
				this.deferredErrors.push(error);
			}
		}
	}

	/** Runs `afterAll` that is due and `dispose` of every device, in the reverse order of creation. */
	async dispose(): Promise<void> {
		await this.endFile();
		const errors = this.deferredErrors.splice(0);
		for (const [name, device] of [...this.devices].reverse()) {
			deleteTarget(name);
			try {
				const handle = await device.handle.catch(() => undefined);
				if (handle !== undefined) {
					await device.definition.dispose?.(handle, device.context);
				}
			} catch (error) {
				errors.push(error);
			}
		}
		this.devices.clear();
		if (errors.length === 1) {
			throw errors[0];
		}
		if (errors.length > 1) {
			throw new AggregateError(errors, "Cleaning up the devices failed");
		}
	}

	/** The devices `beforeAll` ran for in the file of the test. */
	private fileDevices(testInfo: TestInfo): string[] {
		return this.file?.file === testInfo.file ? this.file.devices : [];
	}

	private device(name: string, config: ResolvedDevice): Device {
		let device = this.devices.get(name);
		if (device === undefined) {
			const adapter = config.adapter as Adapter<unknown, object, Json>;
			const definition = adapter.definition;
			const context: WorkerContext<unknown, Json> = {
				name,
				options: adapter.options,
				shared: null,
				trace: createTracer(() => undefined),
				workerInfo: this.workerInfo,
			};
			// A failure is kept, so that every file that uses the device in this worker fails at once.
			const handle = (async () => {
				if (definition.createOnce) {
					context.shared = await requestShared(config.id);
				}
				const handle = await definition.create(context);
				setTarget(name, handle);
				return handle;
			})();
			handle.catch(() => {});
			device = { definition, context, handle };
			this.devices.set(name, device);
		}
		return device;
	}

	private async run(
		name: string,
		hook: "beforeEach" | "onFailure" | "afterEach" | "afterAll",
		testInfo: TestInfo,
	): Promise<void> {
		const device = this.devices.get(name);
		if (device === undefined) {
			return;
		}
		const context: TestContext<unknown, Json> = {
			...device.context,
			testInfo,
		};
		await device.definition[hook]?.(await device.handle, context);
	}
}

/** Waits for all the promises, and throws the first error if any of them failed. */
async function settleAll(promises: Promise<void>[]): Promise<void> {
	const results = await Promise.allSettled(promises);
	const rejected = results.find((result) => result.status === "rejected");
	if (rejected) {
		throw rejected.reason;
	}
}
