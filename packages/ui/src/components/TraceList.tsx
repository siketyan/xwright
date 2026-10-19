import { useMemo, useState } from "react";
import { type TraceEntry, testsOf } from "../model/collection.ts";
import { filterTests, isEmptyFilter, NO_FILTER } from "../model/runner.ts";
import common from "./common.module.css";
import {
	Filters,
	LiveTrace,
	TestCount,
	TestsLayout,
	TestTree,
} from "./TestList.tsx";

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
		<TestsLayout
			sidebar={
				<>
					<Filters
						tests={tests}
						filter={filter}
						onChange={setFilter}
						notRun={false}
					/>
					<TestCount
						visible={visible.length}
						total={tests.length}
						filtered={!isEmptyFilter(filter)}
					/>
					<TestTree
						tests={visible}
						selectedId={selectedId}
						onSelect={setSelectedId}
					/>
				</>
			}
		>
			{selected === undefined ? (
				<p className={common.message}>Select a test to see its trace.</p>
			) : (
				<LiveTrace key={selected.id} open={selected.open} />
			)}
		</TestsLayout>
	);
}
