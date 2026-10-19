import { useState } from "react";
import { formatDuration, trackColor } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";
import styles from "./ActionTree.module.css";
import common from "./common.module.css";
import { cx } from "./cx.ts";

interface Props {
	trace: Trace;
	selected: Action | undefined;
	onSelect(action: Action): void;
}

/** The actions of every track as a tree: steps, and the actions of devices under them. */
export function ActionTree({ trace, selected, onSelect }: Props) {
	return (
		<nav className={styles.actions} aria-label="Actions">
			<ul>
				{trace.actions.map((action) => (
					<ActionItem
						key={action.callId}
						trace={trace}
						action={action}
						selected={selected}
						onSelect={onSelect}
						depth={0}
					/>
				))}
			</ul>
		</nav>
	);
}

function ActionItem({
	trace,
	action,
	selected,
	onSelect,
	depth,
}: Props & { action: Action; depth: number }) {
	// Steps and hooks start expanded, the commands of drivers under an operation collapsed.
	const [expanded, setExpanded] = useState(depth < 2);
	const hasChildren = action.children.length > 0;
	return (
		<li>
			<div
				className={cx(
					styles.action,
					action === selected && styles.selected,
					action.error && styles.failed,
				)}
				style={{ paddingLeft: `${depth * 14 + 4}px` }}
			>
				<button
					type="button"
					className={styles.twisty}
					aria-label={expanded ? "Collapse" : "Expand"}
					aria-expanded={hasChildren ? expanded : undefined}
					disabled={!hasChildren}
					onClick={() => setExpanded(!expanded)}
				>
					{hasChildren ? (expanded ? "▾" : "▸") : ""}
				</button>
				<button
					type="button"
					className={styles.title}
					aria-current={action === selected ? "true" : undefined}
					onClick={() => onSelect(action)}
				>
					<span
						className={common.dot}
						style={{ background: trackColor(trace, action.track) }}
					/>
					{action.title}
				</button>
				<span className={styles.duration}>
					{formatDuration((action.endTime ?? trace.endTime) - action.startTime)}
				</span>
			</div>
			{hasChildren && expanded && (
				<ul>
					{action.children.map((child) => (
						<ActionItem
							key={child.callId}
							trace={trace}
							action={child}
							selected={selected}
							onSelect={onSelect}
							depth={depth + 1}
						/>
					))}
				</ul>
			)}
		</li>
	);
}
