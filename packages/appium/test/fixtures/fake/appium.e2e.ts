import type { AppiumHandle } from "@xwright/appium";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		phone: AppiumHandle;
	}
}

const phone = use("phone");

test("signs in", async () => {
	await step("sign in", async () => {
		await phone.driver.$("~Sign in").click();
		await phone.driver.$("~Name").setValue("Ada");
	});
	await phone.expect(phone.driver.$("~Welcome")).toBeDisplayed();
});

test("fails", async () => {
	await phone.driver.$("~missing").click();
});
