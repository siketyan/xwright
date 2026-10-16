import { appendFileSync } from "node:fs";

/** Appends an event to `events.log`, with the process it happened in. */
export function log(event: string): void {
	const where =
		process.env.TEST_WORKER_INDEX === undefined ? "runner" : "worker";
	appendFileSync("events.log", `${where}: ${event}\n`);
}
