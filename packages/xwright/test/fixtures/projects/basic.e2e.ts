import { expect, test } from "playwright/test";

test("runs in each project", () => {
	expect(["first", "second"]).toContain(test.info().project.name);
});
