import { expect } from "playwright/test";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		phone: object;
	}
}

use("phone");

test("signs in", async () => {
	await step("open the app", async () => {
		await step("tap Sign in", async () => {
			expect(1).toBe(1);
		});
	});
	console.log("signed in");
});

test("fails", async () => {
	await step("check the title", async () => {
		expect("Home").toBe("Welcome");
	});
});

test("is flaky", async () => {
	expect(test.info().retry).toBe(1);
});

test.skip("is skipped", async () => {});
