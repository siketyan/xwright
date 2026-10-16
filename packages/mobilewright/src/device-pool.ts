import type { MobilewrightDriver } from "mobilewright";

interface DevicePool {
	shutdown(): Promise<void>;
}

interface DevicePoolHttpServer {
	listen(): Promise<number>;
	close(): Promise<void>;
}

interface DevicePoolModule {
	DevicePool: new (options: {
		driver: MobilewrightDriver;
		maxSlots: number;
		allocationTimeoutMs?: number;
	}) => DevicePool;
}

interface HttpServerModule {
	DevicePoolHttpServer: new (options: {
		pool: DevicePool;
	}) => DevicePoolHttpServer;
}

/** The device pools started in this process, by their URLs. */
const pools = new Map<
	string,
	{ pool: DevicePool; server: DevicePoolHttpServer }
>();

/**
 * Starts Mobilewright's device pool and its HTTP server, which workers borrow devices from, and returns the URL.
 *
 * Mobilewright starts them only from its own global setup, which reads `mobilewright.config.ts`, so this loads its
 * modules by path; they are not in the exports of the package.
 */
export async function startDevicePool(options: {
	driver: MobilewrightDriver;
	maxSlots: number;
	allocationTimeoutMs: number;
}): Promise<string> {
	const entry = import.meta.resolve("mobilewright");
	const { DevicePool } = (await import(
		new URL("./device-pool/application/device-pool.js", entry).href
	)) as DevicePoolModule;
	const { DevicePoolHttpServer } = (await import(
		new URL("./device-pool/adapters/http-server.js", entry).href
	)) as HttpServerModule;

	await options.driver.prepare?.();
	const pool = new DevicePool(options);
	const server = new DevicePoolHttpServer({ pool });
	const url = `http://127.0.0.1:${await server.listen()}`;
	pools.set(url, { pool, server });
	return url;
}

/** Stops the device pool started by {@link startDevicePool}, which disposes its driver as well. */
export async function stopDevicePool(url: string): Promise<void> {
	const started = pools.get(url);
	pools.delete(url);
	await started?.pool.shutdown();
	await started?.server.close();
}
