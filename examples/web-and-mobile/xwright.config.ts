import { mobilewright } from "@xwright/mobilewright";
import { playwright } from "@xwright/playwright";
import { defineConfig } from "xwright";

export default defineConfig({
	testDir: "tests",
	retries: process.env.CI ? 1 : 0,
	projects: [
		{
			name: "android",
			devices: {
				web: { adapter: playwright({ baseURL: "https://example.com" }) },
				phone: {
					adapter: mobilewright({
						platform: "android",
						bundleId: "com.android.settings",
					}),
				},
			},
		},
		{
			name: "ios",
			devices: {
				web: { adapter: playwright({ baseURL: "https://example.com" }) },
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
			devices: {
				web: {
					adapter: playwright({
						browserName: "webkit",
						baseURL: "https://example.com",
					}),
				},
			},
		},
	],
});
