import { existsSync, readFileSync, statSync } from "node:fs";
import {
	createServer,
	type IncomingMessage,
	type Server,
	type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import {
	basename,
	dirname,
	extname,
	join,
	normalize,
	relative,
	sep,
} from "node:path";
import { findTraces, listFiles, readZip } from "./zip.js";

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
export interface TraceFiles {
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

/** A trace found at a path, with the path to show. */
export interface FoundTrace {
	label: string;
	files: TraceFiles;
}

/**
 * Finds the traces at the path: the trace of a directory with `trace.json`, the traces under a directory such as the
 * output directory of the tests, or the traces in a ZIP file, also in the ZIP files in it as in an artifact of CI.
 */
export function openTraces(path: string): FoundTrace[] {
	if (!existsSync(path)) {
		throw new Error(`${path} does not exist`);
	}
	if (!statSync(path).isDirectory()) {
		return zipTraces(basename(path), readZip(path));
	}
	const directories = findTraces([path]);
	const found = directories.map((dir) => ({
		label: relative(path, dir).split(sep).join("/") || basename(dir),
		files: { read: (file: string) => readInside(dir, file) },
	}));
	// The ZIP files of `xwright export-trace`, unless the directory of the trace is there too.
	for (const file of listFiles(path)) {
		if (file.endsWith(".zip") && !directories.includes(file.slice(0, -4))) {
			found.push(
				...zipTraces(relative(path, file).split(sep).join("/"), readZip(file)),
			);
		}
	}
	return found.sort((a, b) => a.label.localeCompare(b.label));
}

/** The traces in the entries of a ZIP file, under the label of the file. */
function zipTraces(label: string, entries: Map<string, Buffer>): FoundTrace[] {
	const found: FoundTrace[] = [];
	for (const [name, data] of entries) {
		if (name === "trace.json" || name.endsWith("/trace.json")) {
			const prefix = name.slice(0, -"trace.json".length);
			found.push({
				label: prefix === "" ? label : `${label}/${prefix.slice(0, -1)}`,
				files: { read: (file) => entries.get(prefix + file) },
			});
		} else if (name.endsWith(".zip")) {
			found.push(...zipTraces(`${label}/${name}`, readZip(data)));
		}
	}
	return found;
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
export function sourceFiles(trace: TraceFiles): Set<string> {
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

/** What the server of the UI serves besides the UI. */
export interface UiContent {
	/** A file of the trace, under `/trace/`. */
	trace(path: string): Buffer | undefined;
	/** Whether the UI may read the source file, at `/source?file=`. */
	source(file: string): boolean;
	/** Handles a request of another path, or returns `false`. */
	handle?(
		request: IncomingMessage,
		response: ServerResponse,
		url: URL,
	): boolean;
}

/**
 * Serves the UI at `/`, the files of the trace under `/trace/`, and the sources its stacks point to at
 * `/source?file=`, on the loopback interface. Returns the URL. Without a trace, the UI opens a dropped one.
 */
export async function serveTrace(
	trace: TraceFiles | undefined,
	options: { host?: string; port?: number } = {},
): Promise<{ url: string; server: Server }> {
	const sources = trace === undefined ? new Set<string>() : sourceFiles(trace);
	return await serveUi(
		{
			trace: (path) => trace?.read(path),
			source: (file) => sources.has(file),
		},
		options,
	);
}

/**
 * Serves the UI with the traces: their list at `/api/traces`, as `{ id, label, meta }` with the `trace.json` of each,
 * and the files of each under `/trace/<id>/`. The UI lists the tests of the traces to show them one at a time.
 */
export async function serveTraces(
	traces: FoundTrace[],
	options: { host?: string; port?: number } = {},
): Promise<{ url: string; server: Server }> {
	const byId = (id: string) =>
		/^\d+$/.test(id) ? traces[Number(id)] : undefined;
	return await serveUi(
		{
			trace: (path) => {
				const [id = "", ...rest] = path.split("/");
				return byId(id)?.files.read(rest.join("/"));
			},
			// Read each time, since a trace may still be written.
			source: (file) =>
				traces.some((trace) => sourceFiles(trace.files).has(file)),
			handle: (_request, response, url) => {
				if (url.pathname !== "/api/traces") {
					return false;
				}
				const list = traces.map((trace, id) => ({
					id: String(id),
					label: trace.label,
					meta: readMeta(trace.files),
				}));
				response
					.writeHead(200, {
						"content-type": "application/json; charset=utf-8",
						"cache-control": "no-store",
					})
					.end(JSON.stringify(list));
				return true;
			},
		},
		options,
	);
}

/** The `trace.json` of the trace, or `undefined` when it cannot be read, such as while it is rewritten. */
function readMeta(trace: TraceFiles): unknown {
	try {
		return JSON.parse(trace.read("trace.json")?.toString("utf8") ?? "");
	} catch {
		return undefined;
	}
}

/** Serves the UI and the content, on the loopback interface by default. Returns the URL. */
export async function serveUi(
	content: UiContent,
	options: { host?: string; port?: number } = {},
): Promise<{ url: string; server: Server }> {
	const ui = uiDirectory();
	const server = createServer((request, response) => {
		const url = new URL(request.url ?? "/", "http://localhost");
		const send = (body: Buffer | undefined, path: string) => {
			if (body === undefined) {
				response.writeHead(404).end();
				return;
			}
			const headers = {
				"content-type":
					CONTENT_TYPES[extname(path)] ?? "application/octet-stream",
				"cache-control": "no-store",
				"accept-ranges": "bytes",
			};
			// The live UI reads only what was appended to a file since it last read it.
			const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
			if (range === null) {
				response.writeHead(200, headers).end(body);
				return;
			}
			const start = Number(range[1]);
			const end = range[2]
				? Math.min(Number(range[2]), body.length - 1)
				: body.length - 1;
			if (start >= body.length || start > end) {
				response
					.writeHead(416, {
						...headers,
						"content-range": `bytes */${body.length}`,
					})
					.end();
				return;
			}
			response
				.writeHead(206, {
					...headers,
					"content-range": `bytes ${start}-${end}/${body.length}`,
				})
				.end(body.subarray(start, end + 1));
		};
		const path = decodeURIComponent(url.pathname);
		if (path.startsWith("/trace/")) {
			send(content.trace(path.slice("/trace/".length)), path);
		} else if (path === "/source") {
			const file = url.searchParams.get("file") ?? "";
			send(
				content.source(file) && existsSync(file)
					? readFileSync(file)
					: undefined,
				".txt",
			);
		} else if (!content.handle?.(request, response, url)) {
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
