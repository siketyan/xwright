import { test, use } from "xwright";

// Runs in every project, as they all have the web.
const web = use("web");

test("follows the link", async () => {
	await web.page.goto("/");
	await web.page.getByRole("link", { name: "Next" }).click();
	await web.expect(web.page.getByRole("heading")).toHaveText("Next page");
});
