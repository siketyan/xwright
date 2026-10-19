import { useMemo, useState } from "react";
import { type TraceEntry, testsOf } from "../model/collection.ts";
import { filterTests, isEmptyFilter, NO_FILTER } from "../model/runner.ts";
import { Filters, LiveTrace, TestTree } from "./TestList.tsx";

/** The tests of several traces, as `xwright test --ui` lists them, with the trace of the selected one. */
export function TraceList({ entries }: { entries: TraceEntry[] }) {
	const tests = useMemo(() => testsOf(entries), [entries]);
	// The first test that failed is the one to look at first.
	const [selectedId, setSelectedId] = useState(
		() =>
			tests.find(
				(test) => test.status === "failed" || test.status === "timedOut",
			)?.id,
	);
	const [filter, setFilter] = useState(NO_FILTER);
	const visible = filterTests(tests, filter);
	const selected = entries.find((entry) => entry.id === selectedId);

	return (
		<div className="runner">
			<aside className="tests" aria-label="Tests">
				<Filters
					tests={tests}
					filter={filter}
					onChange={setFilter}
					notRun={false}
				/>
				<p className="test-count">
					{isEmptyFilter(filter)
						? `${tests.length} tests`
						: `${visible.length} of ${tests.length} tests`}
				</p>
				<TestTree
					tests={visible}
					selectedId={selectedId}
					onSelect={setSelectedId}
				/>
			</aside>
			<section className="runner-trace">
				{selected === undefined ? (
					<p className="message">Select a test to see its trace.</p>
				) : (
					<LiveTrace key={selected.id} open={selected.open} />
				)}
			</section>
		</div>
	);
}
