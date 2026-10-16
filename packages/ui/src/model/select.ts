import type { Action, Snapshot, Trace } from "./trace.ts";

/** The action and its descendants, depth first. */
export function* descendants(action: Action): Generator<Action> {
	yield action;
	for (const child of action.children) {
		yield* descendants(child);
	}
}

/** Every action of the trace, depth first in the order they started. */
export function* allActions(trace: Trace): Generator<Action> {
	for (const action of trace.actions) {
		yield* descendants(action);
	}
}

/** What the center shows for an action: an image of the screen of its device, and where it comes from. */
export interface Preview {
	track: string;
	file: string;
	/** What the image is, e.g. `screenshot (after)` or `screencast`. */
	label: string;
	/** Where the action acted, to mark on the image. */
	point?: { x: number; y: number };
	width?: number;
	height?: number;
}

const PHASE_ORDER: Record<string, number> = { before: 0, action: 1, after: 2 };

/**
 * Picks the image to show for the action: the last screenshot of the action or its descendants, which is what the
 * screen looked like after it, or else the frame of the screencast of its device at the time it ended.
 */
export function previewOf(trace: Trace, action: Action): Preview | undefined {
	// The latest screenshot, and of two at the same time, the one of the later phase.
	const rank = (snapshot: Snapshot) =>
		snapshot.time * 10 + (PHASE_ORDER[snapshot.phase ?? ""] ?? 1);
	let best: { snapshot: Snapshot; owner: Action } | undefined;
	for (const owner of descendants(action)) {
		for (const snapshot of owner.snapshots) {
			if (
				snapshot.kind === "screenshot" &&
				snapshot.file !== undefined &&
				(best === undefined || rank(snapshot) >= rank(best.snapshot))
			) {
				best = { snapshot, owner };
			}
		}
	}
	if (best !== undefined && best.snapshot.file !== undefined) {
		return {
			track: best.owner.track,
			file: best.snapshot.file,
			label: `screenshot${best.snapshot.phase ? ` (${best.snapshot.phase})` : ""}`,
			point: best.owner.input?.point,
		};
	}

	const time = action.endTime ?? action.startTime;
	const tracks = new Set([...descendants(action)].map((a) => a.track));
	let frame: Trace["screencast"][number] | undefined;
	for (const candidate of trace.screencast) {
		if (tracks.has(candidate.track) && candidate.time <= time) {
			frame = candidate;
		}
	}
	if (frame === undefined) {
		return undefined;
	}
	return {
		track: frame.track,
		file: frame.file,
		label: "screencast",
		point: action.input?.point,
		width: frame.width,
		height: frame.height,
	};
}

/** The snapshots of the action that are data, such as a view hierarchy, rather than images. */
export function dataSnapshots(action: Action): Snapshot[] {
	return [...descendants(action)].flatMap((a) =>
		a.snapshots.filter(
			(snapshot) =>
				snapshot.kind === "snapshot" || snapshot.kind === "aria-snapshot",
		),
	);
}

/** Formats a duration in milliseconds, e.g. `12ms` or `1.5s`. */
export function formatDuration(ms: number | undefined): string {
	if (ms === undefined || !Number.isFinite(ms)) {
		return "—";
	}
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

/** The color of a track, picked by its order. */
export function trackColor(trace: Trace, track: string): string {
	const palette = [
		"#6b7280",
		"#2563eb",
		"#16a34a",
		"#db2777",
		"#d97706",
		"#7c3aed",
		"#0891b2",
	];
	const index = trace.tracks.findIndex((t) => t.name === track);
	return palette[Math.max(index, 0) % palette.length] ?? "#6b7280";
}
