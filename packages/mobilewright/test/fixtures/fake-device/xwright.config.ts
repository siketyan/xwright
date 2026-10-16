import { mobilewright } from "@xwright/mobilewright";
import { defineConfig } from "xwright";
import { createFakeDriver } from "./fake-driver.ts";

export default defineConfig({
	testMatch: "*.e2e.ts",
	workers: 1,
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [
		{
			name: "android",
			devices: {
				phone: {
					adapter: mobilewright({
						platform: "android",
						bundleId: "com.example.app",
						installApps: "app.apk",
						driver: createFakeDriver(),
					}),
				},
			},
		},
	],
});
