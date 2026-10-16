import type { PlaywrightHandle } from "@xwright/playwright";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		web: PlaywrightHandle;
	}
}

const web = use("web");

test("clicks a button", async () => {
	await web.page.route("https://xwright.test/", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<button onclick=\"console.log('clicked'); this.textContent = 'Clicked'\">Click</button>",
		}),
	);
	await step("open the page", async () => {
		await web.page.goto("https://xwright.test/");
	});
	await web.page.getByRole("button").click();
	await web.expect(web.page.getByRole("button")).toHaveText("Clicked");
});
