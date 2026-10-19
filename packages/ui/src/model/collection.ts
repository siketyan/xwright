import type { RunnerTest } from "./runner.ts";
import { type FoundTrace, httpSource, type TraceSource } from "./source.ts";
import type { TraceMeta } from "./trace.ts";

/** A trace of several shown together, such as the ones under `test-results`, with its `trace.json`. */
export interface TraceEntry {
	id: string;
	label: string;
	meta?: TraceMeta;
	/** Whether the trace may still be written, so that one without a result is of a test running. */
	live: boolean;
	open(): Promise<TraceSource>;
}

/** The traces `xwright show-trace` serves, or `undefined` when it serves one trace or none. */
export async function fetchTraces(): Promise<TraceEntry[] | undefined> {
	const response = await fetch("api/traces").catch(() => undefined);
	if (!response?.ok) {
		return undefined;
	}
	const list = (await response.json()) as {
		id: string;
		label: string;
		meta?: TraceMeta;
	}[];
	return list.map((entry) => ({
		...entry,
		live: true,
		open: async () => httpSource(`trace/${entry.id}/`),
	}));
}

/** The traces found in a ZIP file, with the `trace.json` of each. */
export async function openFound(found: FoundTrace[]): Promise<TraceEntry[]> {
	return await Promise.all(
		found.map(async (trace, index) => {
			const source = await trace.open();
			const text = await source.text("trace.json");
			return {
				id: String(index),
				label: trace.label,
				meta: text === undefined ? undefined : (JSON.parse(text) as TraceMeta),
				live: false,
				open: async () => source,
			};
		}),
	);
}

const STATUSES = new Set<string>([
	"passed",
	"failed",
	"timedOut",
	"skipped",
	"interrupted",
]);

/**
 * The tests of the traces to list, by file and line, each retry as a test of its own. The traces of the workers,
 * which are of no test, are left out.
 */
export function testsOf(entries: TraceEntry[]): RunnerTest[] {
	const tests: RunnerTest[] = [];
	for (const entry of entries) {
		const test = entry.meta?.test;
		if (test === undefined) {
			continue;
		}
		const [file = test.file, ...titles] = test.titlePath;
		const result = entry.meta?.result?.status;
		tests.push({
			id: entry.id,
			project: test.project,
			file,
			line: test.line,
			titles:
				test.retry > 0
					? [...titles.slice(0, -1), `${titles.at(-1)} (retry #${test.retry})`]
					: titles,
			tags: [],
			status:
				result !== undefined && STATUSES.has(result)
					? (result as RunnerTest["status"])
					: entry.live
						? "running"
						: "interrupted",
			retry: test.retry,
		});
	}
	return tests.sort(
		(a, b) =>
			a.file.localeCompare(b.file) ||
			a.line - b.line ||
			a.titles.join(" › ").localeCompare(b.titles.join(" › ")) ||
			a.project.localeCompare(b.project),
	);
}
