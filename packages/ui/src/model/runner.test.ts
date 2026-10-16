import { describe, expect, it } from "vitest";
import { filterTests, NO_FILTER, type RunnerTest } from "./runner.ts";

function test(id: string, overrides: Partial<RunnerTest> = {}): RunnerTest {
	return {
		id,
		project: "web",
		file: "auth.spec.ts",
		line: 1,
		titles: [id],
		tags: [],
		...overrides,
	};
}

const tests = [
	test("signs in", { status: "passed", tags: ["@smoke"] }),
	test("signs out", { project: "android", status: "failed" }),
	test("pays", { file: "pay.spec.ts", status: "timedOut", tags: ["@slow"] }),
	test("refunds", { file: "pay.spec.ts", project: "android" }),
	test("waits", { status: "running" }),
];

const ids = (filter: Partial<typeof NO_FILTER>) =>
	filterTests(tests, { ...NO_FILTER, ...filter }).map((test) => test.id);

describe("filterTests", () => {
	it("lets every test through without a filter", () => {
		expect(ids({})).toHaveLength(tests.length);
	});

	it("searches the words in the file, the titles and the tags", () => {
		expect(ids({ text: "SIGNS" })).toEqual(["signs in", "signs out"]);
		expect(ids({ text: "pay.spec refunds" })).toEqual(["refunds"]);
		expect(ids({ text: "@smoke" })).toEqual(["signs in"]);
	});

	it("shows the tests of any of the projects and tags", () => {
		expect(ids({ projects: new Set(["android"]) })).toEqual([
			"signs out",
			"refunds",
		]);
		expect(ids({ tags: new Set(["@smoke", "@slow"]) })).toEqual([
			"signs in",
			"pays",
		]);
	});

	it("counts a timeout as a failure, and keeps a test running", () => {
		expect(ids({ statuses: new Set(["failed"]) })).toEqual([
			"signs out",
			"pays",
			"waits",
		]);
		expect(ids({ statuses: new Set(["none"]) })).toEqual(["refunds", "waits"]);
	});

	it("needs a test to match every part of the filter", () => {
		expect(
			ids({
				projects: new Set(["android"]),
				statuses: new Set(["failed", "none"]),
				text: "refunds",
			}),
		).toEqual(["refunds"]);
	});
});
