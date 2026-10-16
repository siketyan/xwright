import { playwright } from "@xwright/playwright";
import { defineConfig } from "xwright";

// Set in environments whose installed browser is not the revision Playwright expects.
const executablePath =
	process.env.XWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
	testMatch: "*.e2e.ts",
	outputDir: "test-results",
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [
		{
			name: "traced",
			devices: {
				web: {
					adapter: playwright({ launchOptions: { executablePath } }),
					trace: "on",
				},
			},
		},
	],
});
