/** A test of `xwright test --ui`, with the result of its last run. */
export interface RunnerTest {
	id: string;
	project: string;
	file: string;
	line: number;
	titles: string[];
	tags: string[];
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

/** What the list of tests is filtered by. An empty set lets every test through. */
export interface TestFilter {
	/** Words that the file, the titles or the tags of a test all contain, case-insensitively. */
	text: string;
	projects: ReadonlySet<string>;
	tags: ReadonlySet<string>;
	/** The statuses, with `none` for a test not run, and `failed` also for a test that timed out. */
	statuses: ReadonlySet<StatusFilter>;
}

export type StatusFilter = "passed" | "failed" | "skipped" | "none";

export const NO_FILTER: TestFilter = {
	text: "",
	projects: new Set(),
	tags: new Set(),
	statuses: new Set(),
};

/** Whether the filter lets every test through. */
export function isEmptyFilter(filter: TestFilter): boolean {
	return (
		filter.text.trim() === "" &&
		filter.projects.size === 0 &&
		filter.tags.size === 0 &&
		filter.statuses.size === 0
	);
}

function statusOf(test: RunnerTest): StatusFilter | undefined {
	switch (test.status) {
		case undefined:
			return "none";
		case "passed":
		case "skipped":
			return test.status;
		case "failed":
		case "timedOut":
			return "failed";
		default:
			return undefined;
	}
}

/**
 * The tests the filter lets through: a test must match each part of the filter that is set, and one of the values
 * of a part, such as one of the projects.
 */
export function filterTests(
	tests: RunnerTest[],
	filter: TestFilter,
): RunnerTest[] {
	const words = filter.text.toLowerCase().split(/\s+/).filter(Boolean);
	return tests.filter((test) => {
		const text = [test.file, ...test.titles, ...test.tags]
			.join(" ")
			.toLowerCase();
		const status = statusOf(test);
		return (
			words.every((word) => text.includes(word)) &&
			(filter.projects.size === 0 || filter.projects.has(test.project)) &&
			(filter.tags.size === 0 ||
				test.tags.some((tag) => filter.tags.has(tag))) &&
			(filter.statuses.size === 0 ||
				// A test running keeps the place it had, not to jump out of the list.
				test.status === "running" ||
				(status !== undefined && filter.statuses.has(status)))
		);
	});
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
