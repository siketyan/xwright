import { step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		a: { tap(target: string): Promise<void> };
	}
}

const a = use("a");

test("taps slowly", async () => {
	await a.tap("first");
	// Long enough for the UI to show the test running.
	await new Promise((resolve) => setTimeout(resolve, 2000));
	await step("then", async () => {
		await a.tap("second");
	});
});

test("fails", async () => {
	await a.tap("button");
	throw new Error("expected");
});
