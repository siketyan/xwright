import { useEffect, useState } from "react";
import { type Action, loadTrace, type Trace } from "./model/trace.ts";

/** The directory of the trace to show: `?trace=` of the URL, or `trace/` next to the UI. */
function traceUrl(): string {
	return new URLSearchParams(location.search).get("trace") ?? "trace/";
}

export function App() {
	const [trace, setTrace] = useState<Trace>();
	const [error, setError] = useState<string>();

	useEffect(() => {
		loadTrace(traceUrl()).then(setTrace, (error: unknown) =>
			setError(String(error)),
		);
	}, []);

	if (error !== undefined) {
		return <p role="alert">{error}</p>;
	}
	if (trace === undefined) {
		return <p>Loading the trace…</p>;
	}
	return (
		<main>
			<h1>{trace.meta.test?.title ?? "Trace"}</h1>
			<ActionList actions={trace.actions} />
		</main>
	);
}

function ActionList({ actions }: { actions: Action[] }) {
	return (
		<ul>
			{actions.map((action) => (
				<li key={action.callId}>
					{action.title}
					{action.children.length > 0 && (
						<ActionList actions={action.children} />
					)}
				</li>
			))}
		</ul>
	);
}
