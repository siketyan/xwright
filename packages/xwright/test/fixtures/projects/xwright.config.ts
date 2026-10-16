import { defineConfig } from "xwright";

export default defineConfig({
	testMatch: "*.e2e.ts",
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [{ name: "first" }, { name: "second" }],
});
