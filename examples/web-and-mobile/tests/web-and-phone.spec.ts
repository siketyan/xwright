import { step, test, use } from "xwright";

// Runs in the projects with both devices, "android" and "ios", and is skipped in "web-only".
const web = use("web");
const phone = use("phone");

test("opens a page on the web and the settings on the phone", async () => {
	await step("open the page on the web", async () => {
		await web.page.goto("/");
		await web
			.expect(web.page.getByRole("heading"))
			.toHaveText("Xwright example");
	});

	await step("see the settings on the phone", async () => {
		const platform = test.info().project.name;
		await phone
			.expect(
				phone.screen.getByText(
					platform === "ios" ? "General" : "Network & internet",
				),
			)
			.toBeVisible();
	});
});
