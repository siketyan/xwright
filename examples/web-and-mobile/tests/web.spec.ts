import "./devices.ts";
import { test, use } from "xwright";

// Runs in every project, as they all have the web.
const web = use("web");

test("follows the link", async () => {
	await web.page.goto("/");
	await web.page.getByRole("link").click();
	await web.expect(web.page).not.toHaveURL("https://example.com/");
});
