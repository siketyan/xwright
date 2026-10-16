import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runFixture } from "../../xwright/test/run-fixture.js";

it("borrows a device from the pool for each file", async () => {
	const fixture = new URL("../test/fixtures/fake-device/", import.meta.url);
	const events = fileURLToPath(new URL("events.log", fixture));
	await rm(events, { force: true });
	const { code, report } = await runFixture(fixture);
	expect(report.errors).toEqual([]);
	expect(report.stats).toMatchObject({ expected: 3, unexpected: 0 });
	expect(code).toBe(0);

	expect((await readFile(events, "utf8")).trimEnd().split("\n")).toEqual([
		"runner: allocate android",
		"worker: connect fake-1",
		"worker: installApp app.apk",
		"worker: terminateApp com.example.app",
		"worker: launchApp com.example.app",
		"worker: tap 200 125",
		"worker: terminateApp com.example.app",
		"worker: launchApp com.example.app",
		"worker: disconnect",
		// The pool keeps the device and the record of the installed app until the end of the run.
		"worker: connect fake-1",
		"worker: terminateApp com.example.app",
		"worker: launchApp com.example.app",
		"worker: disconnect",
		"runner: release fake-1",
	]);
}, 60_000);
