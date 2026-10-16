/** A test of `xwright test --ui`, with the result of its last run. */
export interface RunnerTest {
	id: string;
	project: string;
	file: string;
	line: number;
	titles: string[];
	status?:
		| "running"
		| "passed"
		| "failed"
		| "timedOut"
		| "skipped"
		| "interrupted";
	retry?: number;
	duration?: number;
	run?: number;
	trace?: boolean;
}

/** What the server of `xwright test --ui` says at `api/state`. */
export interface RunnerState {
	running: boolean;
	/** The test the run began last. */
	last?: string;
	errors: string[];
	tests: RunnerTest[];
}

/** Reads the state of the runner, or `undefined` when the UI is not served by `xwright test --ui`. */
export async function fetchRunnerState(): Promise<RunnerState | undefined> {
	const response = await fetch("api/state").catch(() => undefined);
	return response?.ok ? ((await response.json()) as RunnerState) : undefined;
}

/** Asks the runner to run the tests of the IDs, or all of them, to stop, or to list the tests again. */
export async function command(
	name: "run" | "stop" | "list",
	body?: { ids?: string[] },
): Promise<void> {
	await fetch(`api/${name}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body ?? {}),
	});
}
