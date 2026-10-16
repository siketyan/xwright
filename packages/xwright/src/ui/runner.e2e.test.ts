import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { it } from "vitest";
// The runner starts the built CLI with the built reporter.
import { UiRunner } from "../../dist/ui/runner.js";
import { serveRunner } from "../../dist/ui/server.js";

const executable = "/opt/pw-browsers/chromium";
const fixture = fileURLToPath(
	new URL("../../test/fixtures/ui/", import.meta.url),
);

it("runs the tests and shows the trace of the one running", async () => {
	await rm(`${fixture}test-results`, { recursive: true, force: true });
	const runner = new UiRunner([], fixture);
	await runner.list();
	const { url, server } = await serveRunner(runner);
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(url);
		const tests = page.getByRole("complementary", { name: "Tests" });
		await expect(
			tests.getByRole("heading", { name: "ui.e2e.ts" }),
		).toBeVisible();
		const slow = tests.getByRole("button", { name: /^\S taps slowly/ });
		await expect(slow).toContainText("phone");
		await expect(slow.getByTitle("not run")).toBeVisible();

		// The selection follows the test running, and its trace is shown as it is written.
		await tests.getByRole("button", { name: "Run all" }).click();
		await expect(slow).toHaveAttribute("aria-current", "true");
		await expect(slow.getByTitle("running")).toBeVisible();
		const actions = page.getByRole("navigation", { name: "Actions" });
		await expect(
			actions.getByRole("button", { name: "tap first" }),
		).toBeVisible();
		await expect(page.getByText("running…")).toBeVisible();

		const fails = tests.getByRole("button", { name: /^\S fails/ });
		await expect(fails.getByTitle("failed")).toBeVisible({ timeout: 15_000 });
		await expect(slow.getByTitle("passed")).toBeVisible();
		await expect(fails).toHaveAttribute("aria-current", "true");
		await expect(page.getByText("failed · ")).toBeVisible();
		await expect(tests.getByRole("button", { name: "Run all" })).toBeEnabled();

		// A test runs alone, and the other keeps its result.
		await tests
			.getByRole("button", { name: "Run taps slowly in phone" })
			.click();
		await expect(slow).toHaveAttribute("aria-current", "true");
		await expect(slow.getByTitle("running")).toBeVisible();
		await expect(fails.getByTitle("failed")).toBeVisible();
		await expect(slow.getByTitle("passed")).toBeVisible({ timeout: 15_000 });
		await expect(actions.getByRole("button", { name: "then" })).toBeVisible();
	} finally {
		await browser.close();
		server.close();
		runner.stop();
	}
}, 90_000);
