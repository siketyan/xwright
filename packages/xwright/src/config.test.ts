import { describe, expect, it } from "vitest";
import { defineAdapter } from "./adapter.js";
import { defineConfig } from "./config.js";

const fake = defineAdapter<{ id: string }, object>({
	name: "fake",
	create: () => ({}),
});

describe("defineConfig", () => {
	it("moves the devices of each project into use", () => {
		const adapter = fake({ id: "a" });
		expect(
			defineConfig({
				workers: 2,
				projects: [
					{ name: "web", devices: { web: { adapter, trace: "on" } } },
					{ name: "empty" },
				],
			}),
		).toEqual({
			workers: 2,
			projects: [
				{
					name: "web",
					use: { xwright: { devices: { web: { adapter, trace: "on" } } } },
				},
				{ name: "empty", use: { xwright: { devices: {} } } },
			],
		});
	});

	it("makes a project without devices when there are no projects", () => {
		expect(defineConfig({}).projects).toEqual([
			{ use: { xwright: { devices: {} } } },
		]);
	});
});
