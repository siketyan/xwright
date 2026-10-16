import { test, use } from "xwright";

const phone = use("phone");

test("borrows the device again", async () => {
	await phone.expect(phone.screen.getByText("Hello")).toBeVisible();
});
