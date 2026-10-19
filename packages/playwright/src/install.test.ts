import { expect, it } from "vitest";
import { browsersToInstall } from "./index.js";

it("installs the channel or the browser of each device, chromium by default", () => {
	expect(
		browsersToInstall([
			undefined,
			{ browserName: "firefox" },
			{ launchOptions: { channel: "chrome" } },
			{ browserName: "chromium" },
		]),
	).toEqual(["chrome", "chromium", "firefox"]);
});
