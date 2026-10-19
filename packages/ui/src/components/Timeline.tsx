import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
	allActions,
	filmstripFrames,
	formatDuration,
	framesAt,
	trackColor,
} from "../model/select.ts";
import type { Action, ScreencastFrame, Trace } from "../model/trace.ts";

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

/** The height of a frame of a filmstrip, in pixels. */
const FRAME_HEIGHT = 48;

function readShowScreenshots(): boolean {
	try {
		return localStorage.getItem(SCREENSHOTS_KEY) !== "off";
	} catch {
		return true;
	}
}

/**
 * The actions on the tracks of the test and of each device, one row per track, on one time axis. Under the row of a
 * device with a screencast or screenshots, a filmstrip shows its screen over time, unless it is turned off.
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
		<section className="timeline" aria-label="Timeline" ref={section}>
			<div className="timeline-row timeline-axis">
				<div className="timeline-label">
					{hasFilmstrip && (
						<button
							type="button"
							className="timeline-toggle"
							aria-pressed={showScreenshots}
							title="Show the screens of the devices over time"
							onClick={toggleScreenshots}
						>
							Screenshots
						</button>
					)}
				</div>
				<div className="timeline-lane">
					{ticks.map((tick) => (
						<span
							key={tick}
							className="timeline-tick"
							style={{ left: `${(tick / span) * 100}%` }}
						>
							{formatDuration(tick)}
						</span>
					))}
				</div>
			</div>
			{trace.tracks.map((track) => {
				const frames = filmstrips.get(track.name) ?? [];
				return (
					<div key={track.name} className="timeline-track">
						<div className="timeline-row" data-track={track.name}>
							<div
								className="timeline-label"
								title={track.adapter ?? "the test"}
							>
								<span
									className="dot"
									style={{ background: trackColor(trace, track.name) }}
								/>
								{track.name}
							</div>
							<div className="timeline-lane">
								{(rows.get(track.name) ?? []).map((action) => (
									<button
										key={action.callId}
										type="button"
										className={`timeline-bar${action === selected ? " selected" : ""}${action.error ? " failed" : ""}`}
										title={`${action.title} (${formatDuration((action.endTime ?? trace.endTime) - action.startTime)})`}
										style={{
											left: left(action.startTime),
											width: width(action.startTime, action.endTime),
											background: trackColor(trace, track.name),
										}}
										onClick={(event: MouseEvent) => {
											event.stopPropagation();
											onSelect(action);
										}}
									/>
								))}
							</div>
						</div>
						{showScreenshots && frames.length > 0 && (
							<div
								className="timeline-row timeline-filmstrip"
								data-filmstrip={track.name}
								title={`The screens of ${track.name}`}
							>
								<div className="timeline-label" />
								<div className="timeline-lane">
									<Filmstrip trace={trace} frames={frames} width={laneWidth} />
								</div>
							</div>
						)}
					</div>
				);
			})}
		</section>
	);
}

/** The frames of a device over the time of the trace, as many as fit in the width, each at its share of the time. */
function Filmstrip({
	trace,
	frames,
	width,
}: {
	trace: Trace;
	frames: ScreencastFrame[];
	width: number;
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
				className="timeline-thumb"
				src={trace.url(first.file)}
				alt=""
				onLoad={(event) => {
					const image = event.currentTarget;
					setAspect(image.naturalWidth / image.naturalHeight || 1);
				}}
			/>
		);
	}
	const frameWidth = FRAME_HEIGHT * aspect;
	// A gap of 2 pixels between the frames.
	const count = Math.max(1, Math.floor(width / (frameWidth + 2)));
	return framesAt(frames, trace.startTime, trace.endTime, count).map(
		(frame, slot) => (
			<img
				// biome-ignore lint/suspicious/noArrayIndexKey: a frame can fill more than one slot, which are in order.
				key={slot}
				className="timeline-thumb"
				src={trace.url(frame.file)}
				alt=""
				style={{ left: slot * (frameWidth + 2), width: frameWidth }}
			/>
		),
	);
}
