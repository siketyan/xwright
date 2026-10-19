import { useEffect, useState } from "react";
import {
	command,
	fetchRunnerState,
	filterTests,
	isEmptyFilter,
	NO_FILTER,
	type RunnerState,
	type TestFilter,
} from "../model/runner.ts";
import { httpSource } from "../model/source.ts";
import { Filters, LiveTrace, TestTree } from "./TestList.tsx";

/** How often the state of the runner is read, in milliseconds. */
const INTERVAL = 500;

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
				<TestTree
					tests={visible}
					selectedId={selectedId}
					onSelect={(id) => {
						setFollowing(false);
						setSelectedId(id);
					}}
					run={{
						disabled: state.running,
						onRun: (id) => {
							setFollowing(false);
							setSelectedId(id);
							run([id]);
						},
					}}
				/>
			</aside>
			<section className="runner-trace">
				{selected === undefined ? (
					<p className="message">Select a test to see its trace.</p>
				) : selected.trace ? (
					<LiveTrace
						key={`${selected.id}:${selected.run}:${selected.retry}`}
						open={async () => httpSource(`trace/${selected.id}/`)}
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
