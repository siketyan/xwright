import { useState } from "react";
import { dataSnapshots, domViews, previewOf } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";
import { DomSnapshot } from "./DomSnapshot.tsx";

/** The screen of the device of the selected action, and the snapshots of it that are data. */
export function SnapshotView({
	trace,
	action,
}: {
	trace: Trace;
	action: Action | undefined;
}) {
	if (action === undefined) {
		return (
			<section className="snapshot empty">
				Select an action to see the device.
			</section>
		);
	}
	return <ActionSnapshots key={action.callId} trace={trace} action={action} />;
}

/** The views of the device for an action: its DOM snapshots by phase, and the image of its screen. */
function ActionSnapshots({ trace, action }: { trace: Trace; action: Action }) {
	const preview = previewOf(trace, action);
	const data = dataSnapshots(action);
	const doms = domViews(action);
	const views = [
		...doms.map((dom) => dom.phase),
		...(preview === undefined ? [] : ["screen"]),
	];
	// The DOM after the action is the closest to what the screen showed, as in Playwright.
	const [view, setView] = useState(
		doms.find((dom) => dom.phase === "after")?.phase ?? views[0] ?? "screen",
	);
	const dom = doms.find((candidate) => candidate.phase === view);
	return (
		<section className="snapshot" aria-label="Snapshot">
			{views.length > 1 && (
				<fieldset className="snapshot-views" aria-label="Views">
					{views.map((name) => (
						<button
							key={name}
							type="button"
							aria-pressed={view === name}
							onClick={() => setView(name)}
						>
							{name === "screen" ? "Screen" : `DOM ${name}`}
						</button>
					))}
				</fieldset>
			)}
			{dom !== undefined ? (
				<DomSnapshot
					trace={trace}
					snapshot={dom.snapshot}
					point={dom.action.input?.point}
				/>
			) : preview === undefined ? (
				<p className="empty">No screen was recorded for this action.</p>
			) : (
				<figure>
					<figcaption>
						{preview.track} · {preview.label}
					</figcaption>
					<div className="screen">
						<img
							src={trace.url(preview.file)}
							alt={`The screen of ${preview.track}`}
						/>
						{preview.point !== undefined &&
							preview.width !== undefined &&
							preview.height !== undefined && (
								<span
									className="point"
									style={{
										left: `${(preview.point.x / preview.width) * 100}%`,
										top: `${(preview.point.y / preview.height) * 100}%`,
									}}
								/>
							)}
					</div>
				</figure>
			)}
			{data.map((snapshot) => (
				<details key={`${snapshot.kind}-${snapshot.time}`}>
					<summary>
						{snapshot.type ?? snapshot.kind}
						{snapshot.phase ? ` (${snapshot.phase})` : ""}
					</summary>
					{snapshot.file !== undefined ? (
						<a href={trace.url(snapshot.file)}>{snapshot.file}</a>
					) : (
						<pre>{JSON.stringify(snapshot.payload, null, 2)}</pre>
					)}
				</details>
			))}
		</section>
	);
}
