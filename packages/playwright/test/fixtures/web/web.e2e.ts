import type { PlaywrightHandle } from "@xwright/playwright";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		web: PlaywrightHandle;
	}
}

const web = use("web");

test("drives the page", async () => {
	await step("open the page", async () => {
		await web.page.setContent(
			"<button onclick=\"this.textContent = 'Clicked'\">Click</button>",
		);
	});
	await web.page.getByRole("button").click();
	await web.expect(web.page.getByRole("button")).toHaveText("Clicked");
});

test("keeps the page only in the file isolation", async () => {
	const content = await web.page.content();
	web
		.expect(content.includes("Clicked"))
		.toBe(test.info().project.name === "file");
	web
		.expect(web.page.viewportSize()?.width)
		.toBe(test.info().project.name === "test" ? 640 : 1280);
});
