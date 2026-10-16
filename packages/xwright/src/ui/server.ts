import type { Server } from "node:http";
import { openTrace, serveUi, sourceFiles } from "../trace/server.js";
import type { UiRunner } from "./runner.js";

/**
 * Serves the UI of `xwright test --ui`: the trace of each test under `/trace/<id>/`, and an API to run the tests:
 *
 * - `GET /api/state`: the tests and their results, as `RunnerState`
 * - `POST /api/run`: runs the tests of `{ ids }`, or all of them
 * - `POST /api/stop`: stops the run
 * - `POST /api/list`: lists the tests again
 */
export async function serveRunner(
	runner: UiRunner,
	options: { host?: string; port?: number } = {},
): Promise<{ url: string; server: Server }> {
	return await serveUi(
		{
			trace: (path) => {
				const [id = "", ...rest] = path.split("/");
				const dir = runner.traceOf(id);
				return dir === undefined
					? undefined
					: openTrace(dir).read(rest.join("/"));
			},
			source: (file) =>
				runner
					.traceDirectories()
					.some((dir) => sourceFiles(openTrace(dir)).has(file)),
			handle: (request, response, url) => {
				const json = (status: number, body?: unknown) =>
					response
						.writeHead(status, {
							"content-type": "application/json; charset=utf-8",
							"cache-control": "no-store",
						})
						.end(JSON.stringify(body ?? {}));
				// A run takes as long as the tests, so it is answered when it started.
				const start = (task: () => Promise<void>) => {
					if (runner.state().running) {
						json(409, { error: "The tests are running" });
						return;
					}
					task().catch(() => {});
					json(202);
				};
				switch (`${request.method} ${url.pathname}`) {
					case "GET /api/state":
						json(200, runner.state());
						return true;
					case "POST /api/stop":
						runner.stop();
						json(202);
						return true;
					case "POST /api/list":
						start(() => runner.list());
						return true;
					case "POST /api/run": {
						let body = "";
						request.setEncoding("utf8");
						request.on("data", (chunk: string) => {
							body += chunk;
						});
						request.on("end", () => {
							const { ids } = JSON.parse(body || "{}") as { ids?: string[] };
							start(() => runner.run(ids));
						});
						return true;
					}
					default:
						if (!url.pathname.startsWith("/api/")) {
							return false;
						}
						json(404);
						return true;
				}
			},
		},
		options,
	);
}
