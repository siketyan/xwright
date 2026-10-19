import { defineAdapter, defineConfig } from "xwright";

const fake = defineAdapter({
	name: "fake",
	create: () => ({}),
});

export default defineConfig({
	testMatch: "*.e2e.ts",
	workers: 1,
	retries: 1,
	reporter: [
		["tree", { actions: process.env.TREE_ACTIONS === "1" }],
		["json", { outputFile: "results.json" }],
	],
	projects: [{ name: "phone", devices: { phone: { adapter: fake() } } }],
});
