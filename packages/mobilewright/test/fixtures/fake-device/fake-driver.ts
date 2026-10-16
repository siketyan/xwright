import { appendFileSync } from "node:fs";
import type { MobilewrightDriver } from "mobilewright";

/** Appends a call of the driver to `events.log`, with the process it happened in. */
function log(event: string): void {
	const where =
		process.env.TEST_WORKER_INDEX === undefined ? "runner" : "worker";
	appendFileSync("events.log", `${where}: ${event}\n`);
}

const screen = {
	type: "Window",
	isVisible: true,
	isEnabled: true,
	bounds: { x: 0, y: 0, width: 400, height: 800 },
	children: [
		{
			type: "TextView",
			text: "Hello",
			isVisible: true,
			isEnabled: true,
			bounds: { x: 100, y: 100, width: 200, height: 50 },
			children: [],
		},
	],
};

const driver: Partial<Record<keyof MobilewrightDriver, unknown>> = {
	async allocate(criteria: { platform: string }) {
		log(`allocate ${criteria.platform}`);
		return {
			deviceId: "fake-1",
			platform: criteria.platform,
			type: "emulator",
		};
	},
	async release(deviceId: string) {
		log(`release ${deviceId}`);
	},
	async connect(config: { deviceId: string; platform: string }) {
		log(`connect ${config.deviceId}`);
		return { deviceId: config.deviceId, platform: config.platform };
	},
	async disconnect() {
		log("disconnect");
	},
	async installApp(path: string) {
		log(`installApp ${path}`);
	},
	async terminateApp(bundleId: string) {
		log(`terminateApp ${bundleId}`);
	},
	async launchApp(bundleId: string) {
		log(`launchApp ${bundleId}`);
	},
	async getForegroundApp() {
		return { bundleId: "com.example.app", name: "Example" };
	},
	async getViewHierarchy() {
		return [screen];
	},
	async getScreenSize() {
		return { width: 400, height: 800, scale: 1 };
	},
	async tap(x: number, y: number) {
		log(`tap ${x} ${y}`);
	},
};

/** A driver of a fake Android device that shows "Hello", for testing without devices. */
export function createFakeDriver(): MobilewrightDriver {
	return { ...driver } as MobilewrightDriver;
}
