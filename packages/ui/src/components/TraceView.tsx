import { useState } from "react";
import { formatDuration } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";
import { ActionTree } from "./ActionTree.tsx";
import common from "./common.module.css";
import { SnapshotView } from "./SnapshotView.tsx";
import { Splitter, usePaneSize } from "./Splitter.tsx";
import { Tabs } from "./Tabs.tsx";
import { Timeline } from "./Timeline.tsx";
import styles from "./TraceView.module.css";

/**
 * The screen of a trace: the header, the timeline, the actions, the snapshot and the tabs. The list of the actions and
 * the tabs are resized by dragging the bars next to them.
 */
export function TraceView({ trace }: { trace: Trace }) {
	// By its call ID, so that the selection stays while a live trace is read again.
	const [selectedId, setSelectedId] = useState<string>();
	const selected =
		selectedId === undefined ? undefined : trace.actionsById.get(selectedId);
	const setSelected = (action: Action) => setSelectedId(action.callId);
	const [actionsWidth, setActionsWidth] = usePaneSize("actions", "28%");
	const [tabsHeight, setTabsHeight] = usePaneSize("tabs", "28vh");
	const { test, result } = trace.meta;
	const running = result === undefined;
	return (
		<div
			className={styles.app}
			style={{
				gridTemplateRows: `auto auto minmax(0, 1fr) auto ${tabsHeight}`,
			}}
		>
			<header className={styles.header}>
				<h1>{test?.titlePath.join(" › ") ?? "Trace"}</h1>
				{test !== undefined && (
					<span className={common.project}>{test.project}</span>
				)}
				{running && <span className={common.running}>running…</span>}
				{result !== undefined && (
					<span className={common[result.status]}>
						{result.status} · {formatDuration(result.duration)}
					</span>
				)}
			</header>
			<Timeline trace={trace} selected={selected} onSelect={setSelected} />
			<div
				className={styles.main}
				style={{ gridTemplateColumns: `${actionsWidth} auto minmax(0, 1fr)` }}
			>
				<ActionTree trace={trace} selected={selected} onSelect={setSelected} />
				<Splitter
					orientation="vertical"
					label="Resize the actions"
					onResize={setActionsWidth}
				/>
				<SnapshotView trace={trace} action={selected} />
			</div>
			<Splitter
				orientation="horizontal"
				label="Resize the details"
				after
				onResize={setTabsHeight}
			/>
			<Tabs trace={trace} action={selected} />
		</div>
	);
}
