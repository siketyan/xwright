import { type MouseEvent, useMemo } from "react";
import { allActions, formatDuration, trackColor } from "../model/select.ts";
import type { Action, Trace } from "../model/trace.ts";

interface Props {
	trace: Trace;
	selected: Action | undefined;
	onSelect(action: Action): void;
}

/** The actions on the tracks of the test and of each device, one row per track, on one time axis. */
export function Timeline({ trace, selected, onSelect }: Props) {
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

	return (
		<section className="timeline" aria-label="Timeline">
			<div className="timeline-row timeline-axis">
				<div className="timeline-label" />
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
				const frames = trace.screencast.filter(
					(frame) => frame.track === track.name,
				);
				// Up to 20 frames spread over the trace.
				const step = Math.max(1, Math.ceil(frames.length / 20));
				return (
					<div
						key={track.name}
						className="timeline-row"
						data-track={track.name}
					>
						<div className="timeline-label" title={track.adapter ?? "the test"}>
							<span
								className="dot"
								style={{ background: trackColor(trace, track.name) }}
							/>
							{track.name}
						</div>
						<div className="timeline-lane">
							{frames
								.filter((_, i) => i % step === 0)
								.map((frame) => (
									<img
										key={frame.file}
										className="timeline-frame"
										src={`trace/${frame.file}`}
										alt=""
										style={{ left: left(frame.time) }}
									/>
								))}
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
				);
			})}
		</section>
	);
}
