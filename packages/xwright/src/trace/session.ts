import { join } from "node:path";
import type { Tracer } from "@xwright/core";
import type { TestInfo, WorkerInfo } from "playwright/test";
import type { ResolvedDevice, TraceMode } from "../config.js";
import { hostTime } from "./clock.js";
import { TraceDirectory, type Track } from "./directory.js";
import { createTracer } from "./tracer.js";

/** Whether a device with the mode records the run of a test with the retry. */
function records(mode: TraceMode | undefined, retry: number): boolean {
	switch (mode) {
		case "on":
		case "retain-on-failure":
			return true;
		case "on-first-retry":
			return retry === 1;
		default:
			return false;
	}
}

/** Whether the trace of a device with the mode is kept after the test ended. */
function keeps(mode: TraceMode, failed: boolean): boolean {
	return mode !== "retain-on-failure" || failed;
}

interface TestTrace {
	readonly testInfo: TestInfo;
	directory: TraceDirectory | undefined;
	/** Whether the retention was applied, after which the tracks still kept take the events of `afterAll`. */
	ended: boolean;
}

/** The test whose trace takes the events of the tracers, shared by the step() of the worker. */
let current: TraceSession | undefined;

/** The track of the test of the running trace session, for `step()`. */
export function currentTestTrack(): Track | undefined {
	return current?.testTrack();
}

/**
 * Writes the traces in a worker: one directory per test, which takes the events of `beforeAll` of its file when it is
 * the first test of the file, and of `afterAll` when it is the last one, and one directory for the worker, which
 * takes the events of `create` and `dispose`.
 *
 * A test is recorded when a device of its project records it by its trace mode. The trace is put in `xwright-trace`
 * of the output directory of the test, and kept by the modes of the devices when the test ends.
 */
export class TraceSession {
	private readonly workerInfo: WorkerInfo;
	private readonly devices: Record<string, ResolvedDevice>;
	private test: TestTrace | undefined;
	private worker: TraceDirectory | undefined;
	/** The devices whose events go to the trace of the worker, while they are created or disposed. */
	private readonly inWorker = new Set<string>();
	private restoreOutput: (() => void) | undefined;

	constructor(workerInfo: WorkerInfo, devices: Record<string, ResolvedDevice>) {
		this.workerInfo = workerInfo;
		this.devices = devices;
		current = this;
	}

	/** Makes the tracer of a device, which writes to the trace of the running test or of the worker. */
	tracer(name: string): Tracer {
		return createTracer(() => this.deviceTrack(name));
	}

	/** Records the events of the device in the trace of the worker while `fn` runs. */
	async inWorkerScope<T>(name: string, fn: () => Promise<T>): Promise<T> {
		this.inWorker.add(name);
		try {
			return await fn();
		} finally {
			this.inWorker.delete(name);
		}
	}

	/**
	 * Makes the test the one the events go to. When it differs from the previous one, that trace is finished first,
	 * so call this after the events of the previous test, such as its `afterAll`, were recorded.
	 */
	enter(testInfo: TestInfo): void {
		if (
			this.test?.testInfo.testId === testInfo.testId &&
			this.test.testInfo.retry === testInfo.retry
		) {
			return;
		}
		this.finish();
		this.test = { testInfo, directory: undefined, ended: false };
	}

	/** Starts recording the output of the test on its track. */
	captureOutput(): void {
		this.restoreOutput?.();
		const restore = [process.stdout, process.stderr].map((stream) => {
			const type = stream === process.stdout ? "stdout" : "stderr";
			const write = stream.write;
			stream.write = ((chunk: unknown, ...args: unknown[]) => {
				this.testTrack()?.append({
					type,
					timestamp: hostTime(),
					text: typeof chunk === "string" ? chunk : String(chunk),
				});
				return (write as (...a: unknown[]) => boolean).call(
					stream,
					chunk,
					...args,
				);
			}) as typeof stream.write;
			return () => {
				stream.write = write;
			};
		});
		this.restoreOutput = () => {
			for (const fn of restore) {
				fn();
			}
			this.restoreOutput = undefined;
		};
	}

	/**
	 * Ends the test: stops recording its output, records its errors, keeps the tracks by the modes of the devices, and
	 * attaches the trace to the report. Events of `afterAll` still go to the tracks kept.
	 */
	endTest(testInfo: TestInfo): void {
		this.restoreOutput?.();
		const test = this.test;
		if (test === undefined || test.testInfo !== testInfo || test.ended) {
			return;
		}
		test.ended = true;
		const directory = test.directory;
		if (directory === undefined) {
			return;
		}
		const track = directory.testTrack();
		for (const error of testInfo.errors) {
			track?.append({
				type: "error",
				message: error.message ?? error.value ?? "",
				...(error.stack === undefined ? {} : { stack: error.stack }),
			});
		}
		const failed = testInfo.status !== testInfo.expectedStatus;
		directory.setResult({ status: testInfo.status ?? "passed", duration: 0 });
		if (directory.retain((device) => keeps(device.trace, failed))) {
			testInfo.attachments.push({
				name: "xwright-trace",
				contentType: "application/json",
				path: join(directory.path, "trace.json"),
			});
		}
	}

	/** Finishes the trace of the test and of the worker. */
	close(): void {
		this.finish();
		this.restoreOutput?.();
		this.worker?.close();
		this.worker = undefined;
		if (current === this) {
			current = undefined;
		}
	}

	/** The track of the running test, when its project records it. */
	testTrack(): Track | undefined {
		return this.testDirectory()?.testTrack();
	}

	private deviceTrack(name: string): Track | undefined {
		const device = this.devices[name];
		if (device === undefined) {
			return undefined;
		}
		const info = {
			name,
			adapter: device.adapter.definition.name,
			trace: device.trace ?? "off",
		};
		if (this.inWorker.has(name) || this.test === undefined) {
			return info.trace === "off"
				? undefined
				: this.workerDirectory().deviceTrack(info);
		}
		if (!records(device.trace, this.test.testInfo.retry)) {
			return undefined;
		}
		return this.testDirectory()?.deviceTrack(info);
	}

	/** The directory of the running test, made when the first event comes. */
	private testDirectory(): TraceDirectory | undefined {
		const test = this.test;
		if (test === undefined) {
			return undefined;
		}
		if (test.directory === undefined && !test.ended) {
			const recorded = Object.values(this.devices).some((device) =>
				records(device.trace, test.testInfo.retry),
			);
			if (!recorded) {
				return undefined;
			}
			const { testInfo } = test;
			test.directory = new TraceDirectory(
				testInfo.outputPath("xwright-trace"),
				{
					id: testInfo.testId,
					title: testInfo.title,
					titlePath: testInfo.titlePath,
					file: testInfo.file,
					line: testInfo.line,
					column: testInfo.column,
					retry: testInfo.retry,
					project: testInfo.project.name,
				},
			);
		}
		return test.directory;
	}

	private workerDirectory(): TraceDirectory {
		if (this.worker === undefined) {
			this.worker = new TraceDirectory(
				join(
					this.workerInfo.project.outputDir,
					`xwright-worker-${this.workerInfo.workerIndex}`,
				),
			);
		}
		return this.worker;
	}

	/** Writes the duration of the previous test, and closes its trace. */
	private finish(): void {
		const test = this.test;
		this.test = undefined;
		if (test?.directory === undefined) {
			return;
		}
		const { testInfo } = test;
		test.directory.setResult({
			status: testInfo.status ?? "passed",
			duration: testInfo.duration,
		});
		test.directory.close();
	}
}
