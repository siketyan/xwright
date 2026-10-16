import { fileURLToPath } from "node:url";
import { mobilewright } from "@xwright/mobilewright";
import { playwright } from "@xwright/playwright";
import { fakeWasher } from "example-laundry-fake-washer";
import { defineConfig } from "xwright";
import { baseURL } from "./global-setup.ts";

const bundleId = "dev.xwright.example.laundry";

const web = { adapter: playwright({ baseURL }), trace: "on" } as const;
const washer = { adapter: fakeWasher({ baseURL }), trace: "on" } as const;

export default defineConfig({
	testDir: "tests",
	timeout: 60_000,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list", { printSteps: true }]],
	globalSetup: "./global-setup.ts",
	projects: [
		{
			name: "android",
			devices: {
				web,
				washer,
				phone: {
					adapter: mobilewright({
						platform: "android",
						bundleId,
						installApps:
							process.env.LAUNDRY_APP ??
							fileURLToPath(
								new URL(
									"app/android/app/build/outputs/apk/release/app-release.apk",
									import.meta.url,
								),
							),
						animations: "off",
					}),
					trace: "on",
				},
			},
		},
		{
			name: "ios",
			devices: {
				web,
				washer,
				phone: {
					adapter: mobilewright({
						platform: "ios",
						bundleId,
						// The app built by `pnpm build:ios` is installed on the simulator by `xcrun simctl install` beforehand.
						installApps: process.env.LAUNDRY_APP
							? [process.env.LAUNDRY_APP]
							: [],
						// Without animations, the view hierarchy is read without waiting for the app to settle.
						animations: "off",
					}),
					trace: "on",
				},
			},
		},
		{
			name: "web-only",
			devices: { web, washer },
		},
	],
});
