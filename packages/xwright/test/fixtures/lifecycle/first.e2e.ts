import { test, use } from "xwright";
import { log } from "./log.ts";

declare module "xwright" {
	interface Devices {
		a: { name: string };
		b: { name: string };
	}
}

const a = use("a");
use("b");

test.beforeAll(() => log(`user beforeAll ${a.name}`));
test.beforeEach(() => log(`user beforeEach ${a.name}`));
test.afterEach(() => log(`user afterEach ${a.name}`));
test.afterAll(() => log(`user afterAll ${a.name}`));

test("passes", () => log("test passes"));

test("fails", () => {
	log("test fails");
	throw new Error("expected");
});
