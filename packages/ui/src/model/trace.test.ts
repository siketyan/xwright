import { describe, expect, it } from "vitest";
import { parseEvents, parseTrace, type TraceMeta } from "./trace.ts";

const meta: TraceMeta = {
	version: 1,
	clock: { wallTime: 1000, monotonicTime: 100 },
	devices: [
		{
			name: "web",
			adapter: "@xwright/playwright",
			file: "web.ndjson",
			trace: "on",
		},
	],
	types: {},
};

describe("parseTrace", () => {
	it("builds the tree of actions across the tracks", () => {
		const trace = parseTrace(meta, [
			{
				name: "test",
				events: [
					{
						type: "before",
						callId: "call@1",
						startTime: 110,
						title: "open",
						class: "Test",
						method: "step",
					},
					{ type: "stdout", timestamp: 115, text: "hello\n" },
					{ type: "after", callId: "call@1", endTime: 140 },
					{ type: "error", message: "Error: boom" },
				],
			},
			{
				name: "web",
				events: [
					// A log written before the action it belongs to.
					{ type: "log", callId: "call@2", time: 121, message: "waiting" },
					{
						type: "before",
						callId: "call@2",
						parentId: "call@1",
						startTime: 120,
						title: "goto",
					},
					{ type: "input", callId: "call@2", point: { x: 1, y: 2 } },
					{
						type: "screenshot",
						callId: "call@2",
						phase: "after",
						time: 125,
						file: "web/resources/a.png",
					},
					{
						type: "frame-snapshot",
						snapshot: {
							callId: "call@2",
							snapshotName: "before@call@2",
							timestamp: 119,
						},
					},
					{
						type: "after",
						callId: "call@2",
						endTime: 130,
						error: { message: "gone" },
					},
					{ type: "message", time: 126, level: "error", text: "oops" },
					{
						type: "resource",
						id: "r1",
						resourceType: "xwright.http@1",
						target: "https://a/",
						status: 200,
						startTime: 122,
						endTime: 128,
					},
					{
						type: "screencast-frame",
						timestamp: 150,
						file: "web/resources/f.jpeg",
					},
				],
			},
		]);

		expect(trace.tracks).toEqual([
			{ name: "test", adapter: undefined },
			{ name: "web", adapter: "@xwright/playwright" },
		]);
		expect(trace.actions.map((action) => action.title)).toEqual(["open"]);
		const [goto] = trace.actions[0]?.children ?? [];
		expect(goto).toMatchObject({
			track: "web",
			title: "goto",
			startTime: 120,
			endTime: 130,
			error: { message: "gone" },
			input: { point: { x: 1, y: 2 } },
			logs: [{ time: 121, message: "waiting" }],
		});
		expect(
			goto?.snapshots.map((snapshot) => [snapshot.kind, snapshot.time]),
		).toEqual([
			["frame-snapshot", 119],
			["screenshot", 125],
		]);
		expect(trace.messages).toEqual([
			{
				track: "web",
				time: 126,
				level: "error",
				text: "oops",
				payload: undefined,
				file: undefined,
			},
		]);
		expect(trace.resources[0]).toMatchObject({
			type: "xwright.http@1",
			status: 200,
		});
		expect(trace.screencast).toHaveLength(1);
		expect(trace.output).toEqual([
			{ stream: "stdout", time: 115, text: "hello\n" },
		]);
		expect(trace.errors).toEqual([
			{ message: "Error: boom", stack: undefined },
		]);
		expect([trace.startTime, trace.endTime]).toEqual([110, 150]);
	});

	it("keeps an action that is not ended", () => {
		const trace = parseTrace(meta, [
			{
				name: "web",
				events: [
					{ type: "before", callId: "call@1", startTime: 1, title: "tap" },
				],
			},
		]);
		expect(trace.actions[0]?.endTime).toBeUndefined();
	});
});

describe("parseEvents", () => {
	it("skips a line being written", () => {
		expect(parseEvents('{"type":"before"}\n{"type":"af')).toEqual([
			{ type: "before" },
		]);
	});
});
