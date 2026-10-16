import { type ChildProcess, spawn } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ListedTest, RunEvent } from "./reporter.js";

const CLI = fileURLToPath(new URL("../cli.js", import.meta.url));
const REPORTER = fileURLToPath(new URL("./reporter.js", import.meta.url));

/** A test in the UI, with the result of its last run. */
export interface TestState extends ListedTest {
	status?: "running" | RunStatus;
	retry?: number;
	duration?: number;
	/** Which run the result is of, to tell a trace from the one before it. */
	run?: number;
	/** Whether the trace of the last run was found. */
	trace?: boolean;
}

type RunStatus = Extract<RunEvent, { type: "end" }>["status"];

/** What the UI shows of the runner. */
export interface RunnerState {
	running: boolean;
	/** The test the run began last. */
	last?: string;
	errors: string[];
	tests: TestState[];
}

/**
 * Lists and runs the tests for `xwright test --ui`, each time in a new `xwright test` with the arguments of the
 * command, so that the changes to the tests are picked up. Finds the trace of each test as it is written.
 */
export class UiRunner {
	private readonly args: string[];
	private readonly cwd: string;
	private tests: TestState[] = [];
	private errors: string[] = [];
	private child: ChildProcess | undefined;
	private runs = 0;
	private last: string | undefined;
	private startedAt = 0;
	/** The directories of the traces, by the ID of the test. */
	private readonly traces = new Map<string, string>();

	constructor(args: string[], cwd = process.cwd()) {
		this.args = args;
		this.cwd = cwd;
	}

	state(): RunnerState {
		return {
			running: this.child !== undefined,
			last: this.last,
			errors: this.errors,
			tests: this.tests.map((test) => ({
				...test,
				trace: this.traceOf(test.id) !== undefined,
			})),
		};
	}

	/** Lists the tests again, keeping the results of the ones still there. */
	async list(): Promise<void> {
		const previous = new Map(this.tests.map((test) => [test.id, test]));
		await this.start(["--list"], (event) => {
			if (event.type === "tests") {
				this.tests = event.tests.map((test) => ({
					...previous.get(test.id),
					...test,
				}));
			}
		});
	}

	/** Runs the tests of the IDs, or all of them. */
	async run(ids?: string[]): Promise<void> {
		const args: string[] = [];
		if (ids !== undefined) {
			const wanted = new Set(ids);
			const file = join(mkdtempSync(join(tmpdir(), "xwright-ui-")), "tests");
			// A test list of Playwright Test: `[project] › file › titles`.
			writeFileSync(
				file,
				this.tests
					.filter((test) => wanted.has(test.id))
					.map((test) =>
						[`[${test.project}]`, test.file, ...test.titles].join(" › "),
					)
					.join("\n"),
			);
			args.push("--test-list", file);
		}
		const run = ++this.runs;
		this.last = undefined;
		this.startedAt = Date.now();
		const byId = new Map(this.tests.map((test) => [test.id, test]));
		await this.start(args, (event) => {
			const test = "id" in event ? byId.get(event.id) : undefined;
			if (event.type === "tests") {
				for (const listed of event.tests) {
					const test = byId.get(listed.id);
					if (test !== undefined) {
						Object.assign(test, {
							status: undefined,
							duration: undefined,
							retry: undefined,
						});
					}
				}
			} else if (event.type === "begin" && test !== undefined) {
				Object.assign(test, {
					status: "running",
					retry: event.retry,
					duration: undefined,
					run,
				});
				this.traces.delete(test.id);
				this.last = test.id;
			} else if (event.type === "end" && test !== undefined) {
				Object.assign(test, { status: event.status, duration: event.duration });
				if (event.trace === undefined) {
					this.traces.delete(test.id);
				} else {
					this.traces.set(test.id, dirname(event.trace));
				}
			}
		});
	}

	/** Stops the run. */
	stop(): void {
		this.child?.kill("SIGINT");
	}

	/** The directory of the trace of the last run of the test, once it was written. */
	traceOf(id: string): string | undefined {
		const known = this.traces.get(id);
		if (known !== undefined && existsSync(join(known, "trace.json"))) {
			return known;
		}
		const test = this.tests.find((test) => test.id === id);
		// A test that ended without a trace has none kept.
		if (test?.status !== "running" || !existsSync(test.outputDir)) {
			return undefined;
		}
		// The output directory of the test is under the one of its project.
		for (const entry of readdirSync(test.outputDir)) {
			const dir = join(test.outputDir, entry, "xwright-trace");
			const file = join(dir, "trace.json");
			try {
				if (statSync(file).mtimeMs < this.startedAt) {
					continue;
				}
				const meta = JSON.parse(readFileSync(file, "utf8")) as {
					test?: { id: string; retry: number };
				};
				if (meta.test?.id === id && meta.test.retry === test.retry) {
					this.traces.set(id, dir);
					return dir;
				}
			} catch {}
		}
		return undefined;
	}

	/** The directories of the traces found so far. */
	traceDirectories(): string[] {
		return [...this.traces.values()];
	}

	private start(args: string[], onEvent: (event: RunEvent) => void) {
		if (this.child !== undefined) {
			return Promise.reject(new Error("The tests are running"));
		}
		this.errors = [];
		const child = spawn(
			process.execPath,
			[CLI, "test", ...this.args, ...args, "--reporter", REPORTER],
			{ cwd: this.cwd, stdio: ["ignore", "inherit", "inherit", "ipc"] },
		);
		this.child = child;
		child.on("message", (event: RunEvent) => {
			if (event.type === "error") {
				this.errors.push(event.message);
			}
			onEvent(event);
		});
		return new Promise<void>((resolve) => {
			child.on("exit", () => {
				this.child = undefined;
				// A test the run did not end, such as when it was stopped.
				for (const test of this.tests) {
					if (test.status === "running") {
						test.status = "interrupted";
					}
				}
				resolve();
			});
		});
	}
}
