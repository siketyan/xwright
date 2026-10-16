import { useEffect, useState } from "react";
import { ActionTree } from "./components/ActionTree.tsx";
import { SnapshotView } from "./components/SnapshotView.tsx";
import { Tabs } from "./components/Tabs.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { formatDuration } from "./model/select.ts";
import { type Action, loadTrace, type Trace } from "./model/trace.ts";

/** The directory of the trace to show: `?trace=` of the URL, or `trace/` next to the UI. */
function traceUrl(): string {
	return new URLSearchParams(location.search).get("trace") ?? "trace/";
}

export function App() {
	const [trace, setTrace] = useState<Trace>();
	const [error, setError] = useState<string>();
	const [selected, setSelected] = useState<Action>();

	useEffect(() => {
		loadTrace(traceUrl()).then(
			(trace) => {
				setTrace(trace);
				document.title = `${trace.meta.test?.title ?? "Trace"} · Xwright`;
			},
			(error: unknown) => setError(String(error)),
		);
	}, []);

	if (error !== undefined) {
		return (
			<p role="alert" className="message">
				{error}
			</p>
		);
	}
	if (trace === undefined) {
		return <p className="message">Loading the trace…</p>;
	}

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
