import { step, test, use } from "xwright";

// Runs in every project, as they all have the web and a washer.
const web = use("web");
const washer = use("washer");

test("resets a washer that broke down from the dashboard", async () => {
	await web.page.goto("/");
	const row = web.page.getByRole("row", { name: `Washer ${washer.number}` });
	await web.expect(row).toContainText("Idle");

	await step("the washer breaks down", async () => {
		await washer.fail("E21");
		await web.expect(row).toContainText("Error E21");
	});

	await step("reset it on the dashboard", async () => {
		await row.getByRole("button", { name: "Reset" }).click();
		await washer.waitForCommand("reset");
		await web.expect(row).toContainText("Idle");
	});
});

test("shows the door of a washer", async () => {
	await web.page.goto("/");
	const row = web.page.getByRole("row", { name: `Washer ${washer.number}` });
	await washer.openDoor();
	await web.expect(row).toContainText("Open");
	await washer.closeDoor();
	await web.expect(row).toContainText("Closed");
});
