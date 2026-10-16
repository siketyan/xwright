import type { MobilewrightHandle } from "@xwright/mobilewright";
import { test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		phone: MobilewrightHandle;
	}
}

const phone = use("phone");

test("taps a text", async () => {
	await phone.expect(phone.screen.getByText("Hello")).toBeVisible();
	await phone.screen.getByText("Hello").tap();
});

test("relaunches the app", async () => {
	await phone.expect(phone.screen.getByText("Hello")).toBeVisible();
});
