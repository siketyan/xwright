import { describe, expect, it } from "vitest";
import {
	filmstripFrames,
	formatDuration,
	framesAt,
	previewOf,
} from "./select.ts";
import { parseTrace, type TraceMeta } from "./trace.ts";

const meta: TraceMeta = {
	version: 1,
	clock: { wallTime: 0, monotonicTime: 0 },
	devices: [{ name: "web", adapter: "fake", file: "web.ndjson", trace: "on" }],
	types: {},
};

describe("previewOf", () => {
	it("shows the last screenshot of the action and its descendants", () => {
		const trace = parseTrace(meta, [
			{
				name: "test",
				events: [{ type: "before", callId: "s", startTime: 0, title: "step" }],
			},
			{
				name: "web",
				events: [
					{
						type: "before",
						callId: "a",
						parentId: "s",
						startTime: 1,
						title: "tap",
					},
					{ type: "input", callId: "a", point: { x: 5, y: 6 } },
					{
						type: "screenshot",
						callId: "a",
						phase: "before",
						time: 2,
						file: "web/resources/1.png",
					},
					{
						type: "screenshot",
						callId: "a",
						phase: "after",
						time: 2,
						file: "web/resources/2.png",
					},
				],
			},
		]);
		const step = trace.actionsById.get("s");
		expect(step && previewOf(trace, step)).toEqual({
			track: "web",
			file: "web/resources/2.png",
			label: "screenshot (after)",
			point: { x: 5, y: 6 },
		});
	});

	it("falls back to the frame of the screencast when the action ended", () => {
		const trace = parseTrace(meta, [
			{
				name: "web",
				events: [
					{
						type: "screencast-frame",
						timestamp: 1,
						file: "web/resources/f1.jpeg",
						width: 100,
						height: 50,
					},
					{ type: "before", callId: "a", startTime: 2, title: "goto" },
					{
						type: "screencast-frame",
						timestamp: 3,
						file: "web/resources/f2.jpeg",
						width: 100,
						height: 50,
					},
					{ type: "after", callId: "a", endTime: 4 },
					{
						type: "screencast-frame",
						timestamp: 5,
						file: "web/resources/f3.jpeg",
						width: 100,
						height: 50,
					},
				],
			},
		]);
		const action = trace.actionsById.get("a");
		expect(action && previewOf(trace, action)).toMatchObject({
			file: "web/resources/f2.jpeg",
			label: "screencast",
		});
	});
});

describe("formatDuration", () => {
	it("formats milliseconds and seconds", () => {
		expect([
			formatDuration(12.4),
			formatDuration(1500),
			formatDuration(undefined),
		]).toEqual(["12ms", "1.5s", "—"]);
	});
});

describe("filmstripFrames", () => {
	it("takes the screencast of a device, or its screenshots without one", () => {
		const trace = parseTrace(
			{
				...meta,
				devices: [
					...meta.devices,
					{ name: "phone", adapter: "fake", file: "phone.ndjson", trace: "on" },
				],
			},
			[
				{
					name: "web",
					events: [
						{ type: "screencast-frame", timestamp: 2, file: "web/frame.jpeg" },
						{ type: "screenshot", time: 1, file: "web/shot.png" },
					],
				},
				{
					name: "phone",
					events: [
						{ type: "screenshot", time: 3, file: "phone/b.png" },
						{ type: "screenshot", time: 1, file: "phone/a.png" },
					],
				},
			],
		);
		expect(filmstripFrames(trace, "web").map((frame) => frame.file)).toEqual([
			"web/frame.jpeg",
		]);
		expect(filmstripFrames(trace, "phone").map((frame) => frame.file)).toEqual([
			"phone/a.png",
			"phone/b.png",
		]);
	});
});

describe("framesAt", () => {
	const frames = [
		{ track: "phone", time: 10, file: "a" },
		{ track: "phone", time: 50, file: "b" },
		{ track: "phone", time: 90, file: "c" },
	];

	it("shows the last frame up to each time, or the first before any", () => {
		// The times are 10, 30, 50, 70 and 90.
		expect(framesAt(frames, 0, 100, 5).map((frame) => frame.file)).toEqual([
			"a",
			"a",
			"b",
			"b",
			"c",
		]);
		expect(framesAt(frames, 0, 10, 2).map((frame) => frame.file)).toEqual([
			"a",
			"a",
		]);
	});

	it("shows nothing without frames or slots", () => {
		expect(framesAt([], 0, 100, 5)).toEqual([]);
		expect(framesAt(frames, 0, 100, 0)).toEqual([]);
	});
});
