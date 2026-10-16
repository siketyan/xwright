import { describe, expect, it } from "vitest";
import { parseStack } from "./stack.js";

describe("parseStack", () => {
	it("parses the frames of V8", () => {
		expect(
			parseStack(
				[
					"Error: boom",
					"    at tap (/app/tests/a.spec.ts:3:5)",
					"    at file:///app/tests/b.spec.ts:7:9",
					"    at node:internal/process/task_queues:95:5",
				].join("\n"),
			),
		).toEqual([
			{ file: "/app/tests/a.spec.ts", line: 3, column: 5, function: "tap" },
			{ file: "/app/tests/b.spec.ts", line: 7, column: 9 },
			{ file: "node:internal/process/task_queues", line: 95, column: 5 },
		]);
	});
});
