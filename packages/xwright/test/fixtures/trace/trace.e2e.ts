import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		a: { tap(target: string): Promise<void> };
		b: { tap(target: string): Promise<void> };
	}
}

const a = use("a");
const b = use("b");

test("passes", async () => {
	await step("outer", async () => {
		await step("inner", async () => {
			await a.tap("button");
		});
		await b.tap("ok");
	});
	console.log("hello from the test");
});

test("fails", async () => {
	await a.tap("button");
	await b.tap("ok");
	throw new Error("expected");
});
