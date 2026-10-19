import { describe, expect, it } from "vitest";
import { type TraceEntry, testsOf } from "./collection.ts";
import type { TraceMeta } from "./trace.ts";

function entry(
	id: string,
	test: Partial<NonNullable<TraceMeta["test"]>> | undefined,
	result?: string,
	live = false,
): TraceEntry {
	return {
		id,
		label: id,
		live,
		meta: {
			version: 1,
			test:
				test === undefined
					? undefined
					: {
							id: "t",
							title: "signs in",
							titlePath: ["auth.spec.ts", "signs in"],
							file: "/app/auth.spec.ts",
							line: 1,
							column: 1,
							retry: 0,
							project: "web",
							...test,
						},
			clock: { wallTime: 0, monotonicTime: 0 },
			devices: [],
			types: {},
			result:
				result === undefined ? undefined : { status: result, duration: 0 },
		},
		open: async () => {
			throw new Error("not opened");
		},
	};
}

describe("testsOf", () => {
	it("lists the tests of the traces by file and line, without the traces of the workers", () => {
		const tests = testsOf([
			entry("worker", undefined),
			entry(
				"pays",
				{ titlePath: ["pay.spec.ts", "checkout", "pays"], line: 3 },
				"passed",
			),
			entry(
				"signs out",
				{ titlePath: ["auth.spec.ts", "signs out"], line: 9 },
				"failed",
			),
			entry("signs in", {}, "passed"),
		]);
		expect(tests.map((test) => [test.file, test.titles, test.status])).toEqual([
			["auth.spec.ts", ["signs in"], "passed"],
			["auth.spec.ts", ["signs out"], "failed"],
			["pay.spec.ts", ["checkout", "pays"], "passed"],
		]);
	});

	it("tells a retry from the first try", () => {
		const tests = testsOf([
			entry("first", {}, "failed"),
			entry("retry", { retry: 1 }, "passed"),
		]);
		expect(tests.map((test) => test.titles)).toEqual([
			["signs in"],
			["signs in (retry #1)"],
		]);
	});

	it("takes a trace without a result as of a test running, or interrupted when it does not change", () => {
		expect(testsOf([entry("a", {}, undefined, true)])[0]?.status).toBe(
			"running",
		);
		expect(testsOf([entry("a", {})])[0]?.status).toBe("interrupted");
	});
});
