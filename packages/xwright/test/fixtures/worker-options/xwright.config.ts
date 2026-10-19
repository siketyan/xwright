import { appendFileSync } from "node:fs";
import { defineAdapter, defineConfig } from "xwright";

function log(event: string): void {
	const where =
		process.env.TEST_WORKER_INDEX === undefined ? "runner" : "worker";
	appendFileSync("events.log", `${where}: ${event}\n`);
}

const recorder = defineAdapter<
	{ label: string },
	{ label: string },
	{ label: string }
>({
	name: "recorder",
	createOnce: ({ options }) => {
		log(`createOnce ${options.label}`);
		return { label: options.label };
	},
	disposeOnce: (_shared, { options }) => log(`disposeOnce ${options.label}`),
	create: ({ options }) => {
		log(`create ${options.label}`);
		return { label: options.label };
	},
});

export default defineConfig({
	testMatch: "*.e2e.ts",
	workers: 2,
	fullyParallel: true,
	reporter: [["json", { outputFile: "results.json" }]],
	projects: [
		{
			name: "per-worker",
			devices: {
				device: {
					// Each worker gets its own options.
					adapter: recorder(({ parallelIndex }) => ({
						label: `slot-${parallelIndex}`,
					})),
				},
			},
		},
	],
});
