import { useState } from "react";
import { formatDuration } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";
import { ActionTree } from "./ActionTree.tsx";
import { SnapshotView } from "./SnapshotView.tsx";
import { Tabs } from "./Tabs.tsx";
import { Timeline } from "./Timeline.tsx";

/** The screen of a trace: the header, the timeline, the actions, the snapshot and the tabs. */
export function TraceView({ trace }: { trace: Trace }) {
	const [selected, setSelected] = useState<Action>();
	const { test, result } = trace.meta;
	return (
		<div className="app">
			<header>
				<h1>{test?.titlePath.join(" › ") ?? "Trace"}</h1>
				{test !== undefined && <span className="project">{test.project}</span>}
				{result !== undefined && (
					<span className={`status status-${result.status}`}>
						{result.status} · {formatDuration(result.duration)}
					</span>
				)}
			</header>
			<Timeline trace={trace} selected={selected} onSelect={setSelected} />
			<div className="main">
				<ActionTree trace={trace} selected={selected} onSelect={setSelected} />
				<SnapshotView trace={trace} action={selected} />
			</div>
			<Tabs trace={trace} action={selected} />
		</div>
	);
}
