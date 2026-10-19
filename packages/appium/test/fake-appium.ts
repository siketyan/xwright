import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

const ELEMENT = "element-6066-11e4-a52e-4f735466cecf";
// A PNG of 1x1 pixel.
const PNG =
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/**
 * Starts a server that answers the commands of the WebDriver protocol as an Appium server would, for one session,
 * and logs them as `METHOD /path body`.
 */
export async function startFakeAppium(): Promise<{
	url: string;
	log: string[];
	server: Server;
}> {
	const log: string[] = [];
	const server = createServer((request, response) => {
		let body = "";
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => {
			const path = (request.url ?? "").replace(/^\/session\/s1/, "");
			log.push(`${request.method} ${path || "/"} ${body}`.trimEnd());
			const send = (status: number, value: unknown) =>
				response
					.writeHead(status, { "content-type": "application/json" })
					.end(JSON.stringify({ value }));
			const json = body ? (JSON.parse(body) as Record<string, unknown>) : {};
			if (request.method === "POST" && request.url === "/session") {
				send(200, {
					sessionId: "s1",
					capabilities: { platformName: "Android" },
				});
			} else if (path === "/elements") {
				send(
					200,
					json.value === "missing" ? [] : [{ [ELEMENT]: `e-${json.value}` }],
				);
			} else if (path.endsWith("/displayed")) {
				send(200, true);
			} else if (path === "/screenshot") {
				send(200, PNG);
			} else if (path === "/source") {
				send(200, "<hierarchy><node text='Sign in'/></hierarchy>");
			} else {
				send(200, null);
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return { url: `http://127.0.0.1:${port}/`, log, server };
}
