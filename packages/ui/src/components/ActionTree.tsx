import {
	type UIEvent,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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

/** How close to the end of the list counts as at its end, to follow a trace being written, in pixels. */
const END_THRESHOLD = 24;

/** Whether the action is a step of the test, of `step()`. */
function isStep(action: Action): boolean {
	return action.class === "Test" && action.method === "step";
}

/**
 * The actions of every track as a tree: steps, and the actions of devices under them. Only the steps with steps under
 * them start expanded, so that the steps are seen first; the ones above the selected action are expanded to show it.
 * While the test runs, the list follows the actions as they come, unless it was scrolled up.
 */
export function ActionTree({ trace, selected, onSelect }: Props) {
	const list = useRef<HTMLElement>(null);
	const following = useRef(true);
	const running = trace.meta.result === undefined;

	// The actions above the selected one.
	const revealed = useMemo(() => {
		const ids = new Set<string>();
		let parentId = selected?.parentId;
		while (parentId !== undefined && !ids.has(parentId)) {
			ids.add(parentId);
			parentId = trace.actionsById.get(parentId)?.parentId;
		}
		return ids;
	}, [trace, selected]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: the list follows each read of the trace.
	useLayoutEffect(() => {
		const element = list.current;
		if (running && following.current && element !== null) {
			element.scrollTop = element.scrollHeight;
		}
	}, [trace, running]);

	const onScroll = (event: UIEvent<HTMLElement>) => {
		const element = event.currentTarget;
		following.current =
			element.scrollTop + element.clientHeight >=
			element.scrollHeight - END_THRESHOLD;
	};

	return (
		<nav
			ref={list}
			className={styles.actions}
			aria-label="Actions"
			onScroll={onScroll}
		>
			<ul>
				{trace.actions.map((action) => (
					<ActionItem
						key={action.callId}
						trace={trace}
						action={action}
						selected={selected}
						onSelect={onSelect}
						revealed={revealed}
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
	revealed,
	depth,
}: Props & { action: Action; revealed: Set<string>; depth: number }) {
	const [expanded, setExpanded] = useState(
		() => isStep(action) && action.children.some(isStep),
	);
	const isRevealed = revealed.has(action.callId);
	useEffect(() => {
		if (isRevealed) {
			setExpanded(true);
		}
	}, [isRevealed]);
	const row = useRef<HTMLDivElement>(null);
	const isSelected = action === selected;
	useEffect(() => {
		if (isSelected) {
			row.current?.scrollIntoView({ block: "nearest" });
		}
	}, [isSelected]);
	const hasChildren = action.children.length > 0;
	return (
		<li>
			<div
				ref={row}
				className={cx(
					styles.action,
					isSelected && styles.selected,
					action.error && styles.failed,
				)}
				style={{ paddingLeft: `${depth * 14 + 4}px` }}
			>
				{hasChildren ? (
					<button
						type="button"
						className={styles.twisty}
						aria-label={`${expanded ? "Collapse" : "Expand"} ${action.title}`}
						aria-expanded={expanded}
						onClick={() => setExpanded(!expanded)}
					>
						{expanded ? "▾" : "▸"}
					</button>
				) : (
					<span className={styles.twisty} />
				)}
				<button
					type="button"
					className={styles.title}
					aria-current={isSelected ? "true" : undefined}
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
							revealed={revealed}
							depth={depth + 1}
						/>
					))}
				</ul>
			)}
		</li>
	);
}
