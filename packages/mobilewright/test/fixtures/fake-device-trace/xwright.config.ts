import { mobilewright } from "@xwright/mobilewright";
import { defineConfig } from "xwright";
import { createFakeDriver } from "../fake-device/fake-driver.ts";

export default defineConfig({
	testMatch: "*.e2e.ts",
	outputDir: "test-results",
	workers: 1,
	reporter: [["json", { outputFile: "results.json" }], ["./steps-reporter.ts"]],
	projects: [
		{
			name: "android",
			devices: {
				phone: {
					adapter: mobilewright({
						platform: "android",
						bundleId: "com.example.app",
						driver: createFakeDriver(),
					}),
					trace: "on",
				},
			},
		},
	],
});
