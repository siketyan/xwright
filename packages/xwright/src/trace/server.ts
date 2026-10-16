import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { dirname, extname, join, normalize, sep } from "node:path";
import { readZip } from "./zip.js";

const CONTENT_TYPES: Record<string, string> = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".ndjson": "application/x-ndjson; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp",
};

/** The files of a trace, from its directory or from a ZIP archive of it. */
interface TraceFiles {
	read(path: string): Buffer | undefined;
}

/** Opens the trace at the path: a directory with `trace.json`, or a ZIP file of one. */
export function openTrace(path: string): TraceFiles {
	if (!existsSync(path)) {
		throw new Error(`${path} does not exist`);
	}
	if (statSync(path).isDirectory()) {
		if (!existsSync(join(path, "trace.json"))) {
			throw new Error(`${path} has no trace.json`);
		}
		return { read: (file) => readInside(path, file) };
	}
	const entries = readZip(path);
	if (!entries.has("trace.json")) {
		throw new Error(`${path} has no trace.json`);
	}
	return { read: (file) => entries.get(file) };
}

/** Reads a file under the directory, refusing paths that go out of it. */
function readInside(directory: string, file: string): Buffer | undefined {
	const path = normalize(join(directory, file));
	if (!path.startsWith(normalize(directory) + sep)) {
		return undefined;
	}
	try {
		return statSync(path).isFile() ? readFileSync(path) : undefined;
	} catch {
		return undefined;
	}
}

/** The directory of the build of the UI. */
function uiDirectory(): string {
	const require = createRequire(import.meta.url);
	return join(dirname(require.resolve("@xwright/ui/package.json")), "dist");
}

/** The source files the stacks of the trace point to, which are the only ones the UI may read. */
function sourceFiles(trace: TraceFiles): Set<string> {
	const files = new Set<string>();
	const meta = JSON.parse(
		trace.read("trace.json")?.toString("utf8") ?? "{}",
	) as {
		test?: { file?: string };
		devices?: { file: string }[];
	};
	if (meta.test?.file !== undefined) {
		files.add(meta.test.file);
	}
	for (const track of [
		"test.ndjson",
		...(meta.devices ?? []).map((device) => device.file),
	]) {
		const text = trace.read(track)?.toString("utf8") ?? "";
		for (const match of text.matchAll(/"file":"((?:[^"\\]|\\.)*)","line":/g)) {
			files.add(JSON.parse(`"${match[1]}"`) as string);
		}
	}
	return files;
}

/**
 * Serves the UI at `/`, the files of the trace under `/trace/`, and the sources its stacks point to at
 * `/source?file=`, on the loopback interface. Returns the URL.
 */
export async function serveTrace(
	trace: TraceFiles,
	options: { host?: string; port?: number } = {},
): Promise<{ url: string; server: Server }> {
	const ui = uiDirectory();
	const sources = sourceFiles(trace);
	const server = createServer((request, response) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		const send = (body: Buffer | undefined, path: string) => {
			if (body === undefined) {
				response.writeHead(404).end();
				return;
			}
			response
				.writeHead(200, {
					"content-type":
						CONTENT_TYPES[extname(path)] ?? "application/octet-stream",
					"cache-control": "no-store",
				})
				.end(body);
		};
		const path = decodeURIComponent(url.pathname);
		if (path.startsWith("/trace/")) {
			send(trace.read(path.slice("/trace/".length)), path);
		} else if (path === "/source") {
			const file = url.searchParams.get("file") ?? "";
			send(
				sources.has(file) && existsSync(file) ? readFileSync(file) : undefined,
				".txt",
			);
		} else {
			send(
				readInside(ui, path === "/" ? "index.html" : path.slice(1)),
				path === "/" ? "index.html" : path,
			);
		}
	});
	const host = options.host ?? "127.0.0.1";
	await new Promise<void>((resolve) =>
		server.listen(options.port ?? 0, host, resolve),
	);
	const { port } = server.address() as AddressInfo;
	return { url: `http://${host}:${port}/`, server };
}
