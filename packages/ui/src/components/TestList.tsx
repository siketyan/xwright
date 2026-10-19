import { type ReactNode, useEffect, useState } from "react";
import { watchTrace } from "../model/live.ts";
import type { RunnerTest, StatusFilter, TestFilter } from "../model/runner.ts";
import type { TraceSource } from "../model/source.ts";
import type { Trace } from "../model/trace.ts";
import common from "./common.module.css";
import { cx } from "./cx.ts";
import { Splitter, usePaneSize } from "./Splitter.tsx";
import styles from "./TestList.module.css";
import { TraceView } from "./TraceView.tsx";

const STATUS_ICONS: Record<NonNullable<RunnerTest["status"]> | "none", string> =
	{
		none: "○",
		running: "◌",
		passed: "✓",
		failed: "✗",
		timedOut: "✗",
		skipped: "–",
		interrupted: "⊘",
	};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
	{ value: "passed", label: "Passed" },
	{ value: "failed", label: "Failed" },
	{ value: "skipped", label: "Skipped" },
	{ value: "none", label: "Not run" },
];

/**
 * The layout of a list of tests: the list on the left, resized by dragging the bar next to it, and the trace of the
 * selected test.
 */
export function TestsLayout({
	sidebar,
	children,
}: {
	sidebar: ReactNode;
	children: ReactNode;
}) {
	const [width, setWidth] = usePaneSize("tests", "300px");
	return (
		<div
			className={styles.layout}
			style={{ gridTemplateColumns: `${width} auto minmax(0, 1fr)` }}
		>
			<aside className={styles.tests} aria-label="Tests">
				{sidebar}
			</aside>
			<Splitter
				orientation="vertical"
				label="Resize the tests"
				onResize={setWidth}
			/>
			<section className={styles.trace}>{children}</section>
		</div>
	);
}

/** The number of the tests in the list, of all of them when a filter is set. */
export function TestCount({
	visible,
	total,
	filtered,
}: {
	visible: number;
	total: number;
	filtered: boolean;
}) {
	return (
		<p className={styles.count}>
			{filtered ? `${visible} of ${total} tests` : `${total} tests`}
		</p>
	);
}

/** The tests, grouped by file, to select one, and to run one when `run` is given. */
export function TestTree({
	tests,
	selectedId,
	onSelect,
	run,
}: {
	tests: RunnerTest[];
	selectedId: string | undefined;
	onSelect(id: string): void;
	run?: { disabled: boolean; onRun(id: string): void };
}) {
	const files = new Map<string, RunnerTest[]>();
	for (const test of tests) {
		files.set(test.file, [...(files.get(test.file) ?? []), test]);
	}
	return (
		<ul>
			{[...files].map(([file, tests]) => (
				<li key={file}>
					<h2 className={styles.file}>{file}</h2>
					<ul>
						{tests.map((test) => {
							const title = test.titles.join(" › ");
							return (
								<li
									key={test.id}
									className={cx(
										styles.test,
										test.id === selectedId && styles.selected,
									)}
								>
									<button
										type="button"
										className={styles.title}
										aria-current={test.id === selectedId ? "true" : undefined}
										onClick={() => onSelect(test.id)}
									>
										<span
											className={cx(
												styles.status,
												common[test.status ?? "none"],
											)}
											title={test.status ?? "not run"}
										>
											{STATUS_ICONS[test.status ?? "none"]}
										</span>
										{title}
										<span className={common.project}>{test.project}</span>
									</button>
									{run !== undefined && (
										<button
											type="button"
											className={styles.run}
											aria-label={`Run ${title} in ${test.project}`}
											disabled={run.disabled}
											onClick={() => run.onRun(test.id)}
										>
											▶
										</button>
									)}
								</li>
							);
						})}
					</ul>
				</li>
			))}
		</ul>
	);
}

/** The filters of the list of tests: the words to search, and the projects, tags and statuses to show. */
export function Filters({
	tests,
	filter,
	onChange,
	notRun = true,
}: {
	tests: RunnerTest[];
	filter: TestFilter;
	onChange(filter: TestFilter): void;
	/** Whether a test can be not run, as in the runner, not in traces. */
	notRun?: boolean;
}) {
	const projects = [...new Set(tests.map((test) => test.project))].sort();
	const tags = [...new Set(tests.flatMap((test) => test.tags))].sort();
	const toggle = <T,>(values: ReadonlySet<T>, value: T): Set<T> => {
		const next = new Set(values);
		if (!next.delete(value)) {
			next.add(value);
		}
		return next;
	};
	return (
		<div className={styles.filters}>
			<input
				type="search"
				aria-label="Filter tests"
				placeholder="Filter (e.g. text, @tag)"
				value={filter.text}
				onChange={(event) => onChange({ ...filter, text: event.target.value })}
			/>
			<FilterGroup
				label="Status"
				options={
					notRun
						? STATUS_FILTERS
						: STATUS_FILTERS.filter((option) => option.value !== "none")
				}
				selected={filter.statuses}
				onToggle={(value) =>
					onChange({ ...filter, statuses: toggle(filter.statuses, value) })
				}
			/>
			{projects.length > 1 && (
				<FilterGroup
					label="Projects"
					options={projects.map((project) => ({
						value: project,
						label: project,
					}))}
					selected={filter.projects}
					onToggle={(value) =>
						onChange({ ...filter, projects: toggle(filter.projects, value) })
					}
				/>
			)}
			{tags.length > 0 && (
				<FilterGroup
					label="Tags"
					options={tags.map((tag) => ({ value: tag, label: tag }))}
					selected={filter.tags}
					onToggle={(value) =>
						onChange({ ...filter, tags: toggle(filter.tags, value) })
					}
				/>
			)}
		</div>
	);
}

function FilterGroup<T extends string>({
	label,
	options,
	selected,
	onToggle,
}: {
	label: string;
	options: { value: T; label: string }[];
	selected: ReadonlySet<T>;
	onToggle(value: T): void;
}) {
	return (
		<fieldset className={styles.filterGroup}>
			<legend>{label}</legend>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={selected.has(option.value)}
					onClick={() => onToggle(option.value)}
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}

/** The trace of the source, followed while it is written. */
export function LiveTrace({ open }: { open(): Promise<TraceSource> }) {
	const [trace, setTrace] = useState<Trace>();
	const [error, setError] = useState<string>();
	// biome-ignore lint/correctness/useExhaustiveDependencies: the trace is opened once; a key makes a new one.
	useEffect(() => {
		const controller = new AbortController();
		open()
			.then((source) => watchTrace(source, setTrace, controller.signal))
			.catch((error: unknown) =>
				setError(error instanceof Error ? error.message : String(error)),
			);
		return () => controller.abort();
	}, []);
	if (trace !== undefined) {
		return <TraceView trace={trace} />;
	}
	return <p className={common.message}>{error ?? "Loading the trace…"}</p>;
}
