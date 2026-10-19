import { describe, expect, it } from "vitest";
import { defineAdapter, type InstallContext } from "./adapter.js";
import { PROJECT_OPTIONS_KEY } from "./config.js";
import { installDevices } from "./install.js";

/** An adapter that records the calls of its `install`. */
function recorder(name: string, calls: [string, InstallContext<unknown>][]) {
	return defineAdapter<{ browser: string } | undefined, object>({
		name,
		install: (ctx) => {
			calls.push([name, ctx]);
		},
		create: () => ({}),
	});
}

function project(name: string, devices: Record<string, [string, unknown]>) {
	return {
		name,
		use: {
			[PROJECT_OPTIONS_KEY]: {
				devices: Object.fromEntries(
					Object.entries(devices).map(([device, [id, adapter]]) => [
						device,
						{ id, adapter },
					]),
				),
			},
		},
	};
}

describe("installDevices", () => {
	const calls: [string, InstallContext<unknown>][] = [];
	const web = recorder("web-adapter", calls);
	const phone = recorder("phone-adapter", calls);
	const none = defineAdapter({ name: "none", create: () => ({}) });
	const chromium = web({ browser: "chromium" });
	const projects = [
		project("android", {
			web: ["0", chromium],
			phone: ["1", phone()],
			washer: ["2", none()],
		}),
		project("ios", { web: ["0", chromium], phone: ["3", phone()] }),
		project("firefox", { web: ["4", web(() => ({ browser: "firefox" }))] }),
	];
	const log = () => {};

	it("installs once for each adapter, with the options of all its devices", async () => {
		calls.length = 0;
		const installed = await installDevices(
			projects,
			{ projects: [], devices: [] },
			["--with-deps"],
			log,
		);
		expect(installed).toEqual(["web-adapter", "phone-adapter"]);
		expect(calls).toEqual([
			[
				"web-adapter",
				{
					options: [{ browser: "chromium" }, { browser: "firefox" }],
					args: ["--with-deps"],
				},
			],
			[
				"phone-adapter",
				{ options: [undefined, undefined], args: ["--with-deps"] },
			],
		]);
	});

	it("takes only the projects and the devices given", async () => {
		calls.length = 0;
		await installDevices(
			projects,
			{ projects: ["ios"], devices: ["phone"] },
			["-d", "udid"],
			log,
		);
		expect(calls).toEqual([
			["phone-adapter", { options: [undefined], args: ["-d", "udid"] }],
		]);
	});

	it("refuses a project or a device that is not there", async () => {
		await expect(
			installDevices(projects, { projects: ["web"], devices: [] }, [], log),
		).rejects.toThrow(/project "web"/);
		await expect(
			installDevices(
				projects,
				{ projects: ["firefox"], devices: ["phone"] },
				[],
				log,
			),
		).rejects.toThrow(/device "phone"/);
	});
});
