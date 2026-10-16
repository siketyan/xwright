import { dataSnapshots, previewOf } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";

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
	const preview = previewOf(trace, action);
	const data = dataSnapshots(action);
	return (
		<section className="snapshot" aria-label="Snapshot">
			{preview === undefined ? (
				<p className="empty">No screen was recorded for this action.</p>
			) : (
				<figure>
					<figcaption>
						{preview.track} · {preview.label}
					</figcaption>
					<div className="screen">
						<img
							src={`trace/${preview.file}`}
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
						<a href={`trace/${snapshot.file}`}>{snapshot.file}</a>
					) : (
						<pre>{JSON.stringify(snapshot.payload, null, 2)}</pre>
					)}
				</details>
			))}
		</section>
	);
}
