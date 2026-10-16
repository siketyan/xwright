import { useEffect, useRef, useState } from "react";
import { renderSnapshot, snapshotResources } from "../model/dom.ts";
import type { Snapshot, Trace } from "../model/trace.ts";

/** A DOM snapshot of Playwright, rendered in a sandboxed frame scaled to fit. */
export function DomSnapshot({
	trace,
	snapshot,
	point,
}: {
	trace: Trace;
	snapshot: Snapshot;
	point?: { x: number; y: number };
}) {
	const [html, setHtml] = useState<string>();
	const [width, setWidth] = useState(0);
	const container = useRef<HTMLDivElement>(null);
	const frame = (snapshot.payload as { frameId: string } | undefined)?.frameId;
	const snapshots =
		frame === undefined ? undefined : trace.frameSnapshots.get(frame);
	const viewport = snapshots?.[snapshot.frameIndex ?? 0]?.viewport ?? {
		width: 1280,
		height: 720,
	};

	useEffect(() => {
		let cancelled = false;
		setHtml(undefined);
		if (snapshots === undefined || snapshot.frameIndex === undefined) {
			return;
		}
		const index = snapshot.frameIndex;
		snapshotResources(trace, snapshots, index).then((resources) => {
			if (!cancelled) {
				setHtml(renderSnapshot(snapshots, index, resources, point));
			}
		});
		return () => {
			cancelled = true;
		};
	}, [trace, snapshots, snapshot.frameIndex, point]);

	useEffect(() => {
		const element = container.current;
		if (element === null) {
			return;
		}
		const observer = new ResizeObserver(([entry]) =>
			setWidth(entry?.contentRect.width ?? 0),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const scale = width > 0 ? Math.min(1, width / viewport.width) : 1;
	return (
		<div
			ref={container}
			className="dom-snapshot"
			style={{ height: viewport.height * scale }}
		>
			{html !== undefined && (
				<iframe
					title="DOM snapshot"
					// Scripts of the snapshot are removed; this runs only the script that puts back its state, in an
					// opaque origin.
					sandbox="allow-scripts"
					srcDoc={html}
					style={{
						width: viewport.width,
						height: viewport.height,
						transform: `scale(${scale})`,
					}}
				/>
			)}
		</div>
	);
}
