import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FullConfig } from "playwright/test";
import type { Adapter, Json } from "./adapter.js";

/** The environment variable that tells workers the URL of the coordinator. */
export const COORDINATOR_URL_ENV = "XWRIGHT_COORDINATOR_URL";

/**
 * Runs `createOnce` and `disposeOnce` of the adapters in the runner's process.
 *
 * Playwright Test runs the global setup before it loads the tests, so the runner cannot tell yet which devices the
 * tests that will run use. Instead, a worker asks the coordinator for the shared value of an adapter when it creates
 * the device for the first time, and the coordinator runs `createOnce` then, once for the whole run.
 */
export class Coordinator {
	private readonly adapters: ReadonlyMap<string, Adapter>;
	private readonly config: FullConfig;
	private readonly results = new Map<string, Promise<Json>>();
	private server: Server | undefined;

	constructor(adapters: ReadonlyMap<string, Adapter>, config: FullConfig) {
		this.adapters = adapters;
		this.config = config;
	}

	/** Starts listening on a random port of the loopback interface, and returns the URL. */
	async listen(): Promise<string> {
		const server = createServer((request, response) => {
			const id = new URL(
				request.url ?? "/",
				"http://localhost",
			).searchParams.get("id");
			if (request.method !== "POST" || id === null) {
				response.writeHead(404).end();
				return;
			}
			this.createOnce(id).then(
				(value) => {
					response
						.writeHead(200, { "content-type": "application/json" })
						.end(JSON.stringify({ value }));
				},
				(error: unknown) => {
					response.writeHead(500, { "content-type": "application/json" }).end(
						JSON.stringify({
							error:
								error instanceof Error
									? (error.stack ?? error.message)
									: String(error),
						}),
					);
				},
			);
		});
		this.server = server;
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	}

	/** Runs `createOnce` of the adapter, or returns the result of the first run. */
	createOnce(id: string): Promise<Json> {
		let result = this.results.get(id);
		if (result === undefined) {
			const adapter = this.adapters.get(id);
			if (adapter === undefined) {
				return Promise.reject(new Error(`Unknown adapter "${id}"`));
			}
			result = (async () =>
				(await adapter.definition.createOnce?.({
					options: adapter.options,
					config: this.config,
				})) ?? null)();
			this.results.set(id, result);
		}
		return result;
	}

	/** Runs `disposeOnce` of the adapters `createOnce` succeeded for, in reverse order, and stops listening. */
	async close(): Promise<void> {
		await new Promise<void>((resolve) => {
			if (this.server === undefined) {
				resolve();
				return;
			}
			this.server.close(() => resolve());
			this.server.closeAllConnections();
		});

		const errors: unknown[] = [];
		for (const [id, result] of [...this.results].reverse()) {
			const adapter = this.adapters.get(id);
			const shared = await result.then(
				(value) => ({ value }),
				() => undefined,
			);
			if (adapter === undefined || shared === undefined) {
				continue;
			}
			try {
				await adapter.definition.disposeOnce?.(shared.value as never, {
					options: adapter.options,
					config: this.config,
				});
			} catch (error) {
				errors.push(error);
			}
		}
		this.results.clear();
		if (errors.length > 0) {
			throw new AggregateError(errors, "disposeOnce failed");
		}
	}
}

/** Asks the coordinator of the run for the shared value of the adapter. */
export async function requestShared(id: string): Promise<Json> {
	const url = process.env[COORDINATOR_URL_ENV];
	if (!url) {
		throw new Error(
			`${COORDINATOR_URL_ENV} is not set. Run the tests with \`xwright test\` and a configuration made by defineConfig().`,
		);
	}
	const response = await fetch(`${url}/once?id=${encodeURIComponent(id)}`, {
		method: "POST",
	});
	const body = (await response.json()) as { value?: Json; error?: string };
	if (!response.ok) {
		throw new Error(`createOnce failed in the runner:\n${body.error}`);
	}
	return body.value ?? null;
}
