import { createServer } from "node:http";

export const PORT = Number(process.env.PORT ?? 3000);

const pages: Record<string, string> = {
	"/": '<h1>Xwright example</h1><a href="/next">Next</a>',
	"/next": "<h1>Next page</h1>",
};

/** Serves the pages the tests open on the web, for the whole run. */
export default async function globalSetup(): Promise<() => Promise<void>> {
	const server = createServer((request, response) => {
		const page = pages[request.url ?? "/"];
		response
			.writeHead(page === undefined ? 404 : 200, {
				"content-type": "text/html; charset=utf-8",
			})
			.end(
				`<!doctype html><title>Xwright example</title>${page ?? "<h1>Not found</h1>"}`,
			);
	});
	await new Promise<void>((resolve) => server.listen(PORT, resolve));
	return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
