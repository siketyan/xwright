import { useEffect, useState } from "react";
import { watchTrace } from "../model/live.ts";
import {
	command,
	fetchRunnerState,
	filterTests,
	isEmptyFilter,
	NO_FILTER,
	type RunnerState,
	type RunnerTest,
	type StatusFilter,
	type TestFilter,
} from "../model/runner.ts";
import { httpSource } from "../model/source.ts";
import type { Trace } from "../model/trace.ts";
import { TraceView } from "./TraceView.tsx";

/** How often the state of the runner is read, in milliseconds. */
const INTERVAL = 500;

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

/** The UI of `xwright test --ui`: the tests to run, and the trace of the selected one as it runs. */
export function Runner({ initial }: { initial: RunnerState }) {
	const [state, setState] = useState(initial);
	const [selectedId, setSelectedId] = useState<string>();
	// After "Run all", the selection follows the test running.
	const [following, setFollowing] = useState(false);
	const [filter, setFilter] = useState<TestFilter>(NO_FILTER);

	useEffect(() => {
		let stopped = false;
		const poll = async () => {
			while (!stopped) {
				await new Promise((resolve) => setTimeout(resolve, INTERVAL));
				const next = await fetchRunnerState();
				if (next !== undefined && !stopped) {
					setState(next);
				}
			}
		};
		poll();
		return () => {
			stopped = true;
		};
	}, []);

	useEffect(() => {
		if (!following) {
			return;
		}
		if (state.last !== undefined) {
			setSelectedId(state.last);
		}
		if (!state.running) {
			setFollowing(false);
		}
	}, [state, following]);

	const selected = state.tests.find((test) => test.id === selectedId);
	const visible = filterTests(state.tests, filter);
	const filtered = !isEmptyFilter(filter);
	const files = new Map<string, RunnerTest[]>();
	for (const test of visible) {
		files.set(test.file, [...(files.get(test.file) ?? []), test]);
	}
	const run = (ids?: string[]) => {
		command("run", { ids });
		setState({ ...state, running: true });
	};

	return (
		<div className="runner">
			<aside className="tests" aria-label="Tests">
				<div className="toolbar">
					<button
						type="button"
						disabled={state.running}
						onClick={() => {
							setFollowing(true);
							// With a filter, only the tests in the list.
							run(filtered ? visible.map((test) => test.id) : undefined);
						}}
					>
						▶ {filtered ? "Run filtered" : "Run all"}
					</button>
					<button
						type="button"
						disabled={!state.running}
						onClick={() => command("stop")}
					>
						■ Stop
					</button>
					<button
						type="button"
						disabled={state.running}
						onClick={() => command("list")}
					>
						↻ Reload
					</button>
				</div>
				<Filters tests={state.tests} filter={filter} onChange={setFilter} />
				<p className="test-count">
					{filtered
						? `${visible.length} of ${state.tests.length} tests`
						: `${state.tests.length} tests`}
				</p>
				{state.errors.map((error) => (
					<pre key={error} role="alert" className="error">
						{error}
					</pre>
				))}
				<ul>
					{[...files].map(([file, tests]) => (
						<li key={file}>
							<h2 className="test-file">{file}</h2>
							<ul>
								{tests.map((test) => {
									const title = test.titles.join(" › ");
									return (
										<li
											key={test.id}
											className={`test${test.id === selectedId ? " selected" : ""}`}
										>
											<button
												type="button"
												className="test-title"
												aria-current={
													test.id === selectedId ? "true" : undefined
												}
												onClick={() => {
													setFollowing(false);
													setSelectedId(test.id);
												}}
											>
												<span
													className={`test-status status-${test.status ?? "none"}`}
													title={test.status ?? "not run"}
												>
													{STATUS_ICONS[test.status ?? "none"]}
												</span>
												{title}
												<span className="project">{test.project}</span>
											</button>
											<button
												type="button"
												className="test-run"
												aria-label={`Run ${title} in ${test.project}`}
												disabled={state.running}
												onClick={() => {
													setFollowing(false);
													setSelectedId(test.id);
													run([test.id]);
												}}
											>
												▶
											</button>
										</li>
									);
								})}
							</ul>
						</li>
					))}
				</ul>
			</aside>
			<section className="runner-trace">
				{selected === undefined ? (
					<p className="message">Select a test to see its trace.</p>
				) : selected.trace ? (
					<LiveTrace
						key={`${selected.id}:${selected.run}:${selected.retry}`}
						url={`trace/${selected.id}/`}
					/>
				) : (
					<p className="message">
						{selected.status === "running"
							? "Waiting for the trace…"
							: selected.status === undefined
								? "Run the test to see its trace."
								: "The test has no trace. A device records one by its trace mode."}
					</p>
				)}
			</section>
		</div>
	);
}

/** The filters of the list of tests: the words to search, and the projects, tags and statuses to show. */
function Filters({
	tests,
	filter,
	onChange,
}: {
	tests: RunnerTest[];
	filter: TestFilter;
	onChange(filter: TestFilter): void;
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
		<div className="filters">
			<input
				type="search"
				aria-label="Filter tests"
				placeholder="Filter (e.g. text, @tag)"
				value={filter.text}
				onChange={(event) => onChange({ ...filter, text: event.target.value })}
			/>
			<FilterGroup
				label="Status"
				options={STATUS_FILTERS}
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
		<fieldset className="filter-group">
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

/** The trace at the URL, followed while it is written. */
function LiveTrace({ url }: { url: string }) {
	const [trace, setTrace] = useState<Trace>();
	const [error, setError] = useState<string>();
	useEffect(() => {
		const controller = new AbortController();
		watchTrace(httpSource(url), setTrace, controller.signal).catch(
			(error: unknown) =>
				setError(error instanceof Error ? error.message : String(error)),
		);
		return () => controller.abort();
	}, [url]);
	if (trace !== undefined) {
		return <TraceView trace={trace} />;
	}
	return <p className="message">{error ?? "Loading the trace…"}</p>;
}
