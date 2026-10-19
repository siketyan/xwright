import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	parseExportArgs,
	parseInstallArgs,
	parseShowArgs,
	parseTestArgs,
	resolveConfigFile,
	withoutUiArgs,
} from "./args.js";

function withConfig(name = "xwright.config.ts"): string {
	const dir = mkdtempSync(join(tmpdir(), "xwright-"));
	writeFileSync(join(dir, name), "export default {};\n");
	return dir;
}

describe("parseTestArgs", () => {
	it("passes the options of playwright test to Playwright Test", () => {
		const cwd = withConfig();
		const parsed = parseTestArgs(
			[
				"tests/a.spec.ts",
				"--project",
				"web",
				"--project",
				"phone",
				"-g",
				"login",
				"-j",
				"2",
				"--retries",
				"1",
				"--shard",
				"2/3",
				"--reporter",
				"list,json",
				"-x",
			],
			cwd,
		);
		expect(parsed).toEqual({
			configFile: join(cwd, "xwright.config.ts"),
			overrides: {
				maxFailures: 1,
				reporter: [["list"], ["json"]],
				retries: 1,
				shard: { current: 2, total: 3 },
				workers: "2",
			},
			options: {
				locations: ["tests/a.spec.ts"],
				grep: "login",
				grepInvert: undefined,
				listMode: false,
				projectFilter: ["web", "phone"],
				passWithNoTests: false,
				lastFailed: false,
			},
		});
	});

	it("takes the options of the UI, which its runs go without", () => {
		const cwd = withConfig();
		const args = ["a.spec.ts", "--ui", "--ui-port", "9323", "--ui-host=::1"];
		expect(parseTestArgs(args, cwd)).toMatchObject({
			ui: { host: "::1", port: 9323 },
		});
		expect(withoutUiArgs(args)).toEqual(["a.spec.ts"]);
	});

	it("takes a test list", () => {
		expect(
			parseTestArgs(["--test-list", "tests.txt"], withConfig()),
		).toMatchObject({
			options: { testList: expect.stringMatching(/tests\.txt$/) },
		});
	});

	it("rejects a malformed shard", () => {
		expect(() => parseTestArgs(["--shard", "4/3"], withConfig())).toThrow(
			/--shard/,
		);
	});

	it("rejects a malformed number", () => {
		expect(() => parseTestArgs(["--retries", "two"], withConfig())).toThrow(
			/--retries/,
		);
	});

	it("returns help", () => {
		expect(parseTestArgs(["--help"], withConfig())).toBe("help");
	});
});

describe("resolveConfigFile", () => {
	it("finds xwright.config.* in the directory", () => {
		const cwd = withConfig("xwright.config.mjs");
		expect(resolveConfigFile(undefined, cwd)).toBe(
			join(cwd, "xwright.config.mjs"),
		);
	});

	it("takes a file as is", () => {
		const cwd = withConfig("custom.config.ts");
		expect(resolveConfigFile("custom.config.ts", cwd)).toBe(
			join(cwd, "custom.config.ts"),
		);
	});

	it("does not fall back to playwright.config.*", () => {
		const cwd = withConfig("playwright.config.ts");
		expect(() => resolveConfigFile(undefined, cwd)).toThrow(
			/xwright\.config\.ts is not found/,
		);
	});
});

describe("parseExportArgs", () => {
	it("defaults to test-results", () => {
		expect(parseExportArgs([], "/app")).toEqual({
			paths: ["/app/test-results"],
			output: undefined,
		});
	});

	it("takes paths and an output", () => {
		expect(parseExportArgs(["out/a", "-o", "trace.zip"], "/app")).toEqual({
			paths: ["/app/out/a"],
			output: "/app/trace.zip",
		});
	});
});

describe("parseShowArgs", () => {
	it("takes the path and where to listen", () => {
		expect(parseShowArgs(["trace.zip", "--port", "9323"], "/app")).toEqual({
			path: "/app/trace.zip",
			host: undefined,
			port: 9323,
		});
	});

	it("takes no path, or one", () => {
		expect(parseShowArgs([], "/app")).toMatchObject({ path: undefined });
		expect(() => parseShowArgs(["a", "b"], "/app")).toThrow(/one path/);
	});
});

describe("parseInstallArgs", () => {
	it("takes the projects and the devices, and the arguments after -- for the adapters", () => {
		const cwd = withConfig();
		expect(
			parseInstallArgs(
				["--project", "ios", "--device", "phone", "--", "-d", "udid"],
				cwd,
			),
		).toEqual({
			configFile: join(cwd, "xwright.config.ts"),
			projects: ["ios"],
			devices: ["phone"],
			args: ["-d", "udid"],
		});
		expect(parseInstallArgs(["--help"], cwd)).toBe("help");
	});

	it("rejects an option of an adapter before --", () => {
		expect(() => parseInstallArgs(["--with-deps"], withConfig())).toThrow(
			/with-deps/,
		);
	});
});
