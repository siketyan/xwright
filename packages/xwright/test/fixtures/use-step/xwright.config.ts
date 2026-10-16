import { defineAdapter, defineConfig } from "xwright";

const fake = defineAdapter({
	name: "fake",
	create: ({ name }) => ({ name }),
});

export default defineConfig({
	testMatch: "*.e2e.ts",
	reporter: [["json", { outputFile: "results.json" }], ["./steps-reporter.ts"]],
	projects: [
		{ name: "with-phone", devices: { phone: { adapter: fake() } } },
		{ name: "without-phone", devices: {} },
	],
});
