import { expect } from "playwright/test";
import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		phone: { name: string };
	}
}

const phone = use("phone");

test("runs only in the projects with the device", async () => {
	expect(test.info().project.name).toBe("with-phone");
	const value = await step("outer", async () => {
		return await step("inner", () => 42);
	});
	expect(value).toBe(42);
});

test("has no device outside the lifecycle", () => {
	expect(() => phone.name).toThrow(/Device "phone" is not available here/);
});
