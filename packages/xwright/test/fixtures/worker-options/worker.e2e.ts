import { appendFileSync } from "node:fs";
import { test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		device: { label: string };
	}
}

const device = use("device");

for (const name of ["a", "b", "c", "d"]) {
	test(name, async () => {
		appendFileSync(
			"events.log",
			`worker: test ${device.label} parallelIndex=${test.info().parallelIndex}\n`,
		);
		// Long enough for the other worker to start.
		await new Promise((resolve) => setTimeout(resolve, 300));
	});
}
