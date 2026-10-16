import { useCallback, useEffect, useState } from "react";
import { TraceView } from "./components/TraceView.tsx";
import {
	type FoundTrace,
	findTraces,
	httpSource,
	readZip,
	type TraceSource,
} from "./model/source.ts";
import { loadTrace, type Trace } from "./model/trace.ts";

type State =
	| { kind: "loading" }
	| { kind: "empty"; error?: string }
	| { kind: "pick"; name: string; traces: FoundTrace[] }
	| { kind: "trace"; trace: Trace };

/** The directory of the trace to show: `?trace=` of the URL, or `trace/` next to the UI. */
function traceUrl(): string {
	return new URLSearchParams(location.search).get("trace") ?? "trace/";
}

export function App() {
	const [state, setState] = useState<State>({ kind: "loading" });
	const [dragging, setDragging] = useState(false);

	const open = useCallback(async (source: TraceSource) => {
		setState({ kind: "loading" });
		const trace = await loadTrace(source);
		document.title = `${trace.meta.test?.title ?? "Trace"} · Xwright`;
		setState({ kind: "trace", trace });
	}, []);

	const fail = useCallback(
		(error: unknown) =>
			setState({
				kind: "empty",
				error: error instanceof Error ? error.message : String(error),
			}),
		[],
	);

	// A ZIP file of a trace, of `export-trace`, or of an artifact of CI with traces in it.
	const openFile = useCallback(
		async (file: File) => {
			setState({ kind: "loading" });
			const traces = findTraces(
				file.name,
				await readZip(await file.arrayBuffer()),
			);
			const [first] = traces;
			if (first === undefined) {
				throw new Error(`${file.name} has no trace`);
			}
			if (traces.length === 1) {
				await open(await first.open());
			} else {
				setState({ kind: "pick", name: file.name, traces });
			}
		},
		[open],
	);

	useEffect(() => {
		// Without a trace on the server, such as `xwright show-trace` without a path, wait for one to be dropped.
		open(httpSource(traceUrl())).catch(() => setState({ kind: "empty" }));
	}, [open]);

	// A trace can be dropped anywhere, also to replace the one shown.
	useEffect(() => {
		const over = (event: DragEvent) => {
			event.preventDefault();
			setDragging(true);
		};
		const leave = (event: DragEvent) => {
			if (event.relatedTarget === null) {
				setDragging(false);
			}
		};
		const drop = (event: DragEvent) => {
			event.preventDefault();
			setDragging(false);
			const file = event.dataTransfer?.files[0];
			if (file !== undefined) {
				openFile(file).catch(fail);
			}
		};
		window.addEventListener("dragover", over);
		window.addEventListener("dragleave", leave);
		window.addEventListener("drop", drop);
		return () => {
			window.removeEventListener("dragover", over);
			window.removeEventListener("dragleave", leave);
			window.removeEventListener("drop", drop);
		};
	}, [openFile, fail]);

	return (
		<div className="root">
			{state.kind === "loading" && (
				<p className="message">Loading the trace…</p>
			)}
			{state.kind === "empty" && (
				<DropZone
					error={state.error}
					onFile={(file) => openFile(file).catch(fail)}
				/>
			)}
			{state.kind === "pick" && (
				<section className="picker">
					<h1>Traces in {state.name}</h1>
					<ul>
						{state.traces.map((found) => (
							<li key={found.label}>
								<button
									type="button"
									onClick={() => found.open().then(open).catch(fail)}
								>
									{found.label}
								</button>
							</li>
						))}
					</ul>
				</section>
			)}
			{state.kind === "trace" && (
				<TraceView key={state.trace.meta.test?.id} trace={state.trace} />
			)}
			{dragging && <div className="drop-overlay">Drop a trace to open it</div>}
		</div>
	);
}

function DropZone({
	error,
	onFile,
}: {
	error?: string;
	onFile(file: File): void;
}) {
	return (
		<section className="drop-zone">
			<h1>Xwright Trace Viewer</h1>
			<p>
				Drop a ZIP file of a trace here, such as one of{" "}
				<code>xwright export-trace</code> or the <code>traces</code> artifact of
				CI.
			</p>
			<label className="file-button">
				Open a file
				<input
					type="file"
					accept=".zip,application/zip"
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file !== undefined) {
							onFile(file);
						}
					}}
				/>
			</label>
			{error !== undefined && (
				<p role="alert" className="error">
					{error}
				</p>
			)}
		</section>
	);
}
