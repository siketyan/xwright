import { useEffect, useState } from "react";
import {
	allActions,
	descendants,
	formatDuration,
	trackColor,
} from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";

const TABS = ["Call", "Log", "Network", "Source", "Errors"] as const;
type Tab = (typeof TABS)[number];

/** The details of the selected action and of the trace, in tabs. */
export function Tabs({
	trace,
	action,
}: {
	trace: Trace;
	action: Action | undefined;
}) {
	const [tab, setTab] = useState<Tab>("Call");
	const errors =
		trace.errors.length + [...allActions(trace)].filter((a) => a.error).length;
	return (
		<section className="tabs">
			<div role="tablist">
				{TABS.map((name) => (
					<button
						key={name}
						type="button"
						role="tab"
						aria-selected={tab === name}
						onClick={() => setTab(name)}
					>
						{name}
						{name === "Errors" && errors > 0 ? ` (${errors})` : ""}
						{name === "Network" && trace.resources.length > 0
							? ` (${trace.resources.length})`
							: ""}
					</button>
				))}
			</div>
			<div role="tabpanel" aria-label={tab}>
				{tab === "Call" && <CallTab trace={trace} action={action} />}
				{tab === "Log" && <LogTab trace={trace} action={action} />}
				{tab === "Network" && <NetworkTab trace={trace} action={action} />}
				{tab === "Source" && <SourceTab action={action} />}
				{tab === "Errors" && <ErrorsTab trace={trace} />}
			</div>
		</section>
	);
}

function CallTab({
	trace,
	action,
}: {
	trace: Trace;
	action: Action | undefined;
}) {
	if (action === undefined) {
		return <p className="empty">Select an action.</p>;
	}
	const rows: [string, string][] = [
		["Track", action.track],
		["Call", `${action.class}.${action.method}`],
		["Start", formatDuration(action.startTime - trace.startTime)],
		[
			"Duration",
			formatDuration((action.endTime ?? trace.endTime) - action.startTime),
		],
	];
	return (
		<div className="call">
			<h2>{action.title}</h2>
			<dl>
				{rows.map(([key, value]) => (
					<div key={key}>
						<dt>{key}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
			{Object.keys(action.params).length > 0 && (
				<>
					<h3>Parameters</h3>
					<pre>{JSON.stringify(action.params, null, 2)}</pre>
				</>
			)}
			{action.result !== undefined && (
				<>
					<h3>Result</h3>
					<pre>{JSON.stringify(action.result, null, 2)}</pre>
				</>
			)}
			{action.error !== undefined && (
				<>
					<h3>Error</h3>
					<pre className="error">
						{action.error.stack ?? action.error.message}
					</pre>
				</>
			)}
		</div>
	);
}

function LogTab({
	trace,
	action,
}: {
	trace: Trace;
	action: Action | undefined;
}) {
	// The logs of the action and its descendants, and the messages and output while it ran.
	const start = action?.startTime ?? trace.startTime;
	const end = action?.endTime ?? trace.endTime;
	const lines = [
		...(action === undefined ? [] : [...descendants(action)]).flatMap((a) =>
			a.logs.map((log) => ({
				track: a.track,
				time: log.time,
				level: "log",
				text: log.message,
			})),
		),
		...trace.messages
			.filter((message) => message.time >= start && message.time <= end)
			.map((message) => ({ ...message })),
		...trace.output
			.filter((output) => output.time >= start && output.time <= end)
			.map((output) => ({
				track: "test",
				time: output.time,
				level: output.stream,
				text: output.text,
			})),
	].sort((a, b) => a.time - b.time);
	if (lines.length === 0) {
		return <p className="empty">No logs.</p>;
	}
	return (
		<ol className="log">
			{lines.map((line, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own.
				<li key={i} className={`level-${line.level}`}>
					<span className="time">
						{formatDuration(line.time - trace.startTime)}
					</span>
					<span
						className="dot"
						style={{ background: trackColor(trace, line.track) }}
						title={line.track}
					/>
					<span className="text">{line.text}</span>
				</li>
			))}
		</ol>
	);
}

function NetworkTab({
	trace,
	action,
}: {
	trace: Trace;
	action: Action | undefined;
}) {
	if (trace.resources.length === 0) {
		return <p className="empty">No communications.</p>;
	}
	const start = action?.startTime ?? Number.NEGATIVE_INFINITY;
	const end = action?.endTime ?? Number.POSITIVE_INFINITY;
	return (
		<table className="network">
			<thead>
				<tr>
					<th>Device</th>
					<th>Target</th>
					<th>Status</th>
					<th>Start</th>
					<th>Duration</th>
				</tr>
			</thead>
			<tbody>
				{trace.resources.map((resource) => (
					<tr
						key={`${resource.track}-${resource.id}`}
						className={
							resource.endTime >= start && resource.startTime <= end
								? ""
								: "dimmed"
						}
					>
						<td>{resource.track}</td>
						<td title={resource.type}>{resource.target}</td>
						<td>{resource.status ?? ""}</td>
						<td>{formatDuration(resource.startTime - trace.startTime)}</td>
						<td>{formatDuration(resource.endTime - resource.startTime)}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function SourceTab({ action }: { action: Action | undefined }) {
	const frame = action?.stack[0];
	const [source, setSource] = useState<string>();
	useEffect(() => {
		setSource(undefined);
		if (frame === undefined) {
			return;
		}
		const controller = new AbortController();
		fetch(`source?file=${encodeURIComponent(frame.file)}`, {
			signal: controller.signal,
		})
			.then((response) =>
				response.ok ? response.text() : Promise.reject(new Error()),
			)
			.then(setSource, () => setSource(""));
		return () => controller.abort();
	}, [frame]);

	if (frame === undefined) {
		return <p className="empty">No source for this action.</p>;
	}
	return (
		<div className="source">
			<p className="source-path">
				{frame.file}:{frame.line}
			</p>
			{source === undefined ? null : source === "" ? (
				<p className="empty">The source cannot be read.</p>
			) : (
				<ol className="source-lines">
					{source.split("\n").map((line, i) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: lines of a file are identified by their numbers.
							key={i}
							className={i + 1 === frame.line ? "current" : ""}
							ref={
								i + 1 === frame.line
									? (element) => element?.scrollIntoView({ block: "center" })
									: undefined
							}
						>
							<code>{line}</code>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}

function ErrorsTab({ trace }: { trace: Trace }) {
	const failed = [...allActions(trace)].filter((action) => action.error);
	if (trace.errors.length === 0 && failed.length === 0) {
		return <p className="empty">No errors.</p>;
	}
	return (
		<div className="errors">
			{trace.errors.map((error, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: errors have no identity of their own.
				<pre key={i} className="error">
					{error.stack ?? error.message}
				</pre>
			))}
			{failed.map((action) => (
				<div key={action.callId}>
					<h3>
						{action.track}: {action.title}
					</h3>
					<pre className="error">{action.error?.message}</pre>
				</div>
			))}
		</div>
	);
}
