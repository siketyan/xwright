import { step, test, use } from "xwright";

// Runs in the projects with a phone, "android" and "ios".
const web = use("web");
const phone = use("phone");
const washer = use("washer");

test("refunds a wash that the washer could not finish", async () => {
	await step("start a wash on the app", async () => {
		await phone.screen
			.getByRole("button", { name: `Washer ${washer.number}` })
			.tap();
		await phone.screen.getByRole("button", { name: "Pay and start" }).tap();
		await washer.waitForCommand("start");
	});

	await step("the washer breaks down", async () => {
		await washer.fail("E11");
		await phone
			.expect(phone.screen.getByText("The washer stopped with error E11"))
			.toBeVisible();
	});

	await step("refund on the dashboard", async () => {
		await web.page.goto("/");
		const session = web.page
			.getByRole("row")
			.filter({ hasText: `Washer ${washer.number}` })
			.filter({ hasText: "Failed" });
		await session.getByRole("button", { name: "Refund" }).click();
		await phone.expect(phone.screen.getByText("Refunded ¥500")).toBeVisible();
	});
});
