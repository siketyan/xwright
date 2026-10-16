import { basename } from "node:path";
import { defineAdapter, defineConfig } from "xwright";
import { log } from "./log.ts";

const recorder = defineAdapter<
	{ label: string },
	{ name: string },
	{ token: string }
>({
	name: "recorder",
	createOnce: ({ options }) => {
		log(`createOnce ${options.label}`);
		return { token: `token-${options.label}` };
	},
	disposeOnce: (shared, { options }) => {
		log(`disposeOnce ${options.label} ${shared.token}`);
	},
	create: ({ name, shared }) => {
		log(`create ${name} ${shared.token}`);
		return { name };
	},
	dispose: (handle) => log(`dispose ${handle.name}`),
	beforeAll: (handle, { testInfo }) =>
		log(`beforeAll ${handle.name} ${basename(testInfo.file)}`),
	beforeEach: (handle, { testInfo }) =>
		log(`beforeEach ${handle.name} ${testInfo.title}`),
	onFailure: (handle, { testInfo }) =>
		log(`onFailure ${handle.name} ${testInfo.title}`),
	afterEach: (handle, { testInfo }) =>
		log(`afterEach ${handle.name} ${testInfo.title} ${testInfo.status}`),
	afterAll: (handle, { testInfo }) =>
		log(`afterAll ${handle.name} ${basename(testInfo.file)}`),
});

const shared = recorder({ label: "shared" });

export default defineConfig({
	testMatch: "*.e2e.ts",
	workers: 1,
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [
		{
			name: "devices",
			devices: {
				a: { adapter: shared },
				b: { adapter: shared },
				unused: { adapter: recorder({ label: "unused" }) },
			},
		},
	],
});
