import { appium } from "@xwright/appium";
import { defineConfig } from "xwright";

export default defineConfig({
	testMatch: "*.e2e.ts",
	outputDir: "test-results",
	workers: 1,
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [
		{
			name: "android",
			devices: {
				phone: {
					adapter: appium({
						url: process.env.FAKE_APPIUM_URL,
						capabilities: {
							platformName: "Android",
							"appium:automationName": "UiAutomator2",
						},
						appId: "com.example.app",
						// Not to wait long for the element that is missing.
						remoteOptions: { waitforTimeout: 500 },
					}),
					trace: "on",
				},
			},
		},
	],
});
