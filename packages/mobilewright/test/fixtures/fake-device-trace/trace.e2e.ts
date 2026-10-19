import type { MobilewrightHandle } from "@xwright/mobilewright";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		phone: MobilewrightHandle;
	}
}

const phone = use("phone");

test("taps a text", async () => {
	await phone.screen.getByText("Hello").tap();
});

test("fails", async () => {
	await phone.expect(phone.screen.getByText("Hello")).toBeVisible();
	throw new Error("expected");
});

test("taps in a step", async () => {
	await step("greet", async () => {
		await phone.screen.getByText("Hello").tap();
		await phone.expect(phone.screen.getByText("Hello")).toBeVisible();
	});
});
