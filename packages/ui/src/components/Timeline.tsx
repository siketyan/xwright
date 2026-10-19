import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
	allActions,
	filmstripFrames,
	formatDuration,
	framesAt,
	trackColor,
} from "../model/select.ts";
import type { Action, ScreencastFrame, Trace } from "../model/trace.ts";
import common from "./common.module.css";
import { cx } from "./cx.ts";
import styles from "./Timeline.module.css";

interface Props {
	trace: Trace;
	selected: Action | undefined;
	onSelect(action: Action): void;
}

/** Where the choice to show the screenshots on the timeline is kept, in the browser. */
const SCREENSHOTS_KEY = "xwright.timeline.screenshots";

/** The width of the label of a row and the margin after its lane, in pixels, as in the stylesheet. */
const LABEL_WIDTH = 140;
const LANE_MARGIN = 12;

/** The height of a frame of a screen on the timeline, in pixels. */
const FRAME_HEIGHT = 48;

function readShowScreenshots(): boolean {
	try {
		return localStorage.getItem(SCREENSHOTS_KEY) !== "off";
	} catch {
		return true;
	}
}

/**
 * The actions on the tracks of the test and of each device, one row per track, on one time axis. The actions of a
 * device with a screencast or screenshots show the screens of the device while they ran, unless that is turned off.
 */
export function Timeline({ trace, selected, onSelect }: Props) {
	const [showScreenshots, setShowScreenshots] = useState(readShowScreenshots);
	const toggleScreenshots = () => {
		const next = !showScreenshots;
		setShowScreenshots(next);
		try {
			localStorage.setItem(SCREENSHOTS_KEY, next ? "on" : "off");
		} catch {}
	};
	const section = useRef<HTMLElement>(null);
	const [laneWidth, setLaneWidth] = useState(0);
	useEffect(() => {
		const element = section.current;
		if (element === null) {
			return;
		}
		const observer = new ResizeObserver(() =>
			setLaneWidth(element.clientWidth - LABEL_WIDTH - LANE_MARGIN),
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const span = Math.max(trace.endTime - trace.startTime, 1);
	const left = (time: number) => `${((time - trace.startTime) / span) * 100}%`;
	const width = (start: number, end: number | undefined) =>
		`max(2px, ${(((end ?? trace.endTime) - start) / span) * 100}%)`;

	// The actions that start a row of a track: the ones without a parent on the same track.
	const rows = useMemo(() => {
		const byTrack = new Map<string, Action[]>();
		for (const action of allActions(trace)) {
			const parent =
				action.parentId === undefined
					? undefined
					: trace.actionsById.get(action.parentId);
			if (parent?.track !== action.track) {
				byTrack.set(action.track, [
					...(byTrack.get(action.track) ?? []),
					action,
				]);
			}
		}
		return byTrack;
	}, [trace]);

	const ticks = Array.from({ length: 6 }, (_, i) => (span / 5) * i);
	const filmstrips = useMemo(
		() =>
			new Map(
				trace.tracks.map((track) => [
					track.name,
					filmstripFrames(trace, track.name),
				]),
			),
		[trace],
	);
	const hasFilmstrip = [...filmstrips.values()].some(
		(frames) => frames.length > 0,
	);

	return (
		<section className={styles.timeline} aria-label="Timeline" ref={section}>
			<div className={cx(styles.row, styles.axis)}>
				<div className={styles.label}>
					{hasFilmstrip && (
						<button
							type="button"
							className={styles.toggle}
							aria-pressed={showScreenshots}
							title="Show the screens of the devices over time"
							onClick={toggleScreenshots}
						>
							Screenshots
						</button>
					)}
				</div>
				<div className={styles.lane}>
					{ticks.map((tick) => (
						<span
							key={tick}
							className={styles.tick}
							style={{ left: `${(tick / span) * 100}%` }}
						>
							{formatDuration(tick)}
						</span>
					))}
				</div>
			</div>
			{trace.tracks.map((track) => {
				const frames = filmstrips.get(track.name) ?? [];
				const actions = rows.get(track.name) ?? [];
				const bar = (action: Action) => ({
					className: cx(
						styles.bar,
						action === selected && styles.selected,
						action.error && styles.failed,
					),
					title: `${action.title} (${formatDuration((action.endTime ?? trace.endTime) - action.startTime)})`,
					style: {
						left: left(action.startTime),
						width: width(action.startTime, action.endTime),
					},
					onClick: (event: MouseEvent) => {
						event.stopPropagation();
						onSelect(action);
					},
				});
				return (
					<div
						key={track.name}
						className={cx(
							styles.row,
							showScreenshots && frames.length > 0 && styles.screens,
						)}
						data-track={track.name}
					>
						<div className={styles.label} title={track.adapter ?? "the test"}>
							<span
								className={common.dot}
								style={{ background: trackColor(trace, track.name) }}
							/>
							{track.name}
						</div>
						<div className={styles.lane}>
							{showScreenshots && frames.length > 0 ? (
								<ScreenBars
									trace={trace}
									frames={frames}
									actions={actions}
									laneWidth={laneWidth}
									bar={bar}
								/>
							) : (
								actions.map((action) => {
									const { style, ...props } = bar(action);
									return (
										<button
											key={action.callId}
											type="button"
											{...props}
											style={{
												...style,
												background: trackColor(trace, track.name),
											}}
										/>
									);
								})
							)}
						</div>
					</div>
				);
			})}
		</section>
	);
}

/**
 * The actions of a device as the screens it showed while each ran, as many frames as fit in the width of the action,
 * each at the end of its share of the time.
 */
function ScreenBars({
	trace,
	frames,
	actions,
	laneWidth,
	bar,
}: {
	trace: Trace;
	frames: ScreencastFrame[];
	actions: Action[];
	laneWidth: number;
	bar(action: Action): {
		className: string;
		title: string;
		style: { left: string; width: string };
		onClick(event: MouseEvent): void;
	};
}) {
	const [first] = frames;
	// The shape of the screen, from the size of a frame of a screencast, or from the image of a screenshot.
	const [aspect, setAspect] = useState(() =>
		first?.width && first.height ? first.width / first.height : undefined,
	);
	if (first === undefined) {
		return null;
	}
	if (aspect === undefined) {
		return (
			<img
				className={styles.probe}
				src={trace.url(first.file)}
				alt=""
				onLoad={(event) => {
					const image = event.currentTarget;
					setAspect(image.naturalWidth / image.naturalHeight || 1);
				}}
			/>
		);
	}
	const span = Math.max(trace.endTime - trace.startTime, 1);
	const frameWidth = FRAME_HEIGHT * aspect;
	return actions.map((action) => {
		const end = action.endTime ?? trace.endTime;
		const barWidth = (laneWidth * (end - action.startTime)) / span;
		// A gap of 1 pixel between the frames; an action narrower than a frame shows a part of one.
		const count = Math.max(1, Math.floor(barWidth / (frameWidth + 1)));
		const { className, ...props } = bar(action);
		return (
			<button
				key={action.callId}
				type="button"
				className={cx(className, styles.screenBar)}
				{...props}
			>
				{framesAt(frames, action.startTime, end, count).map((frame, slot) => (
					<img
						// biome-ignore lint/suspicious/noArrayIndexKey: a frame can fill more than one slot, which are in order.
						key={slot}
						className={styles.frame}
						src={trace.url(frame.file)}
						alt=""
						style={{ width: frameWidth }}
					/>
				))}
			</button>
		);
	});
}
