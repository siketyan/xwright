import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { defineAdapter } from "./adapter.js";
import { defineConfig } from "./config.js";

const fake = defineAdapter<{ id: string }, object>({
	name: "fake",
	create: () => ({}),
});

const globalSetup = fileURLToPath(
	new URL("./global-setup.js", import.meta.url),
);

describe("defineConfig", () => {
	it("moves the devices of each project into use, with the IDs of the adapters", () => {
		const shared = fake({ id: "shared" });
		const other = fake({ id: "other" });
		expect(
			defineConfig({
				workers: 2,
				globalSetup: "./setup.ts",
				projects: [
					{
						name: "web",
						devices: { web: { adapter: shared, trace: "on" } },
					},
					{
						name: "both",
						devices: { web: { adapter: shared }, phone: { adapter: other } },
					},
					{ name: "empty" },
				],
			}),
		).toEqual({
			workers: 2,
			globalSetup: [globalSetup, "./setup.ts"],
			projects: [
				{
					name: "web",
					use: {
						xwright: {
							devices: { web: { adapter: shared, trace: "on", id: "0" } },
						},
					},
				},
				{
					name: "both",
					use: {
						xwright: {
							devices: {
								web: { adapter: shared, id: "0" },
								phone: { adapter: other, id: "1" },
							},
						},
					},
				},
				{ name: "empty", use: { xwright: { devices: {} } } },
			],
		});
	});

	it("makes a project without devices when there are no projects", () => {
		expect(defineConfig({})).toEqual({
			globalSetup: [globalSetup],
			projects: [{ use: { xwright: { devices: {} } } }],
		});
	});
});
