import { step, test, use } from "xwright";

// Runs in the projects with a phone, "android" and "ios".
const web = use("web");
const phone = use("phone");
const washer = use("washer");

test("starts a wash on the app and tells when it is done", async () => {
	await step("pay and start on the app", async () => {
		await phone.screen
			.getByRole("button", { name: `Washer ${washer.number}` })
			.tap();
		await phone.screen.getByRole("button", { name: "Standard" }).tap();
		await phone.screen.getByRole("button", { name: "Pay and start" }).tap();
	});

	await step("the washer starts", async () => {
		const command = await washer.waitForCommand("start");
		test
			.expect(command)
			.toEqual({ type: "start", course: "standard", minutes: 40 });
		await phone.expect(phone.screen.getByText("40 min left")).toBeVisible();
	});

	await step("the dashboard follows the washer", async () => {
		await web.page.goto("/");
		const row = web.page.getByRole("row", { name: `Washer ${washer.number}` });
		await web.expect(row).toContainText("Running (40 min left)");
		await washer.advance(30);
		await web.expect(row).toContainText("Running (10 min left)");
		await phone.expect(phone.screen.getByText("10 min left")).toBeVisible();
	});

	await step("the cycle finishes", async () => {
		await washer.finishCycle();
		await phone
			.expect(phone.screen.getByText("Your laundry is ready"))
			.toBeVisible();
		await washer.openDoor();
		await web
			.expect(web.page.getByRole("row", { name: `Washer ${washer.number}` }))
			.toContainText("Idle");
	});
});

test("does not start while the door is open", async () => {
	await washer.openDoor();
	await phone.screen
		.getByRole("button", { name: `Washer ${washer.number}` })
		.tap();
	await phone.screen.getByRole("button", { name: "Pay and start" }).tap();
	await phone
		.expect(phone.screen.getByText("Close the door and try again."))
		.toBeVisible();
	test.expect(washer.commands).toEqual([]);
});
