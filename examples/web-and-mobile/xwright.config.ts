import { mobilewright } from "@xwright/mobilewright";
import { playwright } from "@xwright/playwright";
import { defineConfig } from "xwright";
import { PORT } from "./global-setup.ts";

const web = playwright({ baseURL: `http://localhost:${PORT}` });

export default defineConfig({
	testDir: "tests",
	timeout: 60_000,
	retries: process.env.CI ? 1 : 0,
	// Show each step of the tests, also on CI where Playwright Test prints only dots by default.
	reporter: [["list", { printSteps: true }]],
	globalSetup: "./global-setup.ts",
	projects: [
		{
			name: "android",
			devices: {
				web: { adapter: web },
				phone: {
					adapter: mobilewright({
						platform: "android",
						bundleId: "com.android.settings",
						animations: "off",
					}),
				},
			},
		},
		{
			name: "ios",
			devices: {
				web: { adapter: web },
				phone: {
					adapter: mobilewright({
						platform: "ios",
						bundleId: "com.apple.Preferences",
					}),
				},
			},
		},
		{
			name: "web-only",
			devices: { web: { adapter: web } },
		},
	],
});
