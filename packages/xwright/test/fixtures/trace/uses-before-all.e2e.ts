import { test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		a: { tap(target: string): Promise<void> };
	}
}

const a = use("a");

test.describe(() => {
	test.beforeAll(async () => {
		await a.tap("sign in");
		throw new Error("beforeAll failed");
	});

	test("fails in beforeAll", async () => {
		await a.tap("button");
	});
});
