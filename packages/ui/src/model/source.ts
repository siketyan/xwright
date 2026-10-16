/** Where the files of a trace are read from: the server, or a ZIP file opened in the browser. */
export interface TraceSource {
	/** A name of the source to show, such as the name of the dropped file. */
	readonly name: string;
	/** Reads a file of the trace as text, or `undefined` when it is missing. */
	text(path: string): Promise<string | undefined>;
	/** The URL to show a file of the trace with, such as in an image. */
	url(path: string): string;
}

/** The trace in the directory at the URL, such as `trace/` of `xwright show-trace`. */
export function httpSource(base: string): TraceSource {
	const root = new URL(base, location.href);
	const url = (path: string) => new URL(path, root).href;
	return {
		name: base,
		async text(path) {
			const response = await fetch(url(path), { cache: "no-store" });
			return response.ok ? await response.text() : undefined;
		},
		url,
	};
}

const CONTENT_TYPES: Record<string, string> = {
	css: "text/css",
	html: "text/html",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	json: "application/json",
	png: "image/png",
	svg: "image/svg+xml",
	webp: "image/webp",
};

/** A trace in a ZIP file, with its files under the prefix, such as `xwright-trace/`. */
export function zipSource(
	name: string,
	entries: Map<string, Uint8Array>,
	prefix = "",
): TraceSource {
	const urls = new Map<string, string>();
	const decoder = new TextDecoder();
	return {
		name,
		async text(path) {
			const data = entries.get(prefix + path);
			return data === undefined ? undefined : decoder.decode(data);
		},
		url(path) {
			let url = urls.get(path);
			if (url === undefined) {
				const data = entries.get(prefix + path) ?? new Uint8Array();
				const type =
					CONTENT_TYPES[path.split(".").pop() ?? ""] ??
					"application/octet-stream";
				url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
				urls.set(path, url);
			}
			return url;
		},
	};
}

/** Reads the entries of a ZIP file, without ZIP64, inflating them with the browser. */
export async function readZip(
	data: ArrayBuffer,
): Promise<Map<string, Uint8Array>> {
	const bytes = new Uint8Array(data);
	const view = new DataView(data);
	let end = -1;
	for (let i = bytes.length - 22; i >= 0; i--) {
		if (view.getUint32(i, true) === 0x06054b50) {
			end = i;
			break;
		}
	}
	if (end < 0) {
		throw new Error("The file is not a ZIP archive");
	}
	const count = view.getUint16(end + 10, true);
	let position = view.getUint32(end + 16, true);
	const decoder = new TextDecoder();
	const entries = new Map<string, Uint8Array>();
	for (let i = 0; i < count; i++) {
		const method = view.getUint16(position + 10, true);
		const compressedSize = view.getUint32(position + 20, true);
		const nameLength = view.getUint16(position + 28, true);
		const extraLength = view.getUint16(position + 30, true);
		const commentLength = view.getUint16(position + 32, true);
		const offset = view.getUint32(position + 42, true);
		const name = decoder.decode(
			bytes.subarray(position + 46, position + 46 + nameLength),
		);
		const start =
			offset +
			30 +
			view.getUint16(offset + 26, true) +
			view.getUint16(offset + 28, true);
		const compressed = bytes.subarray(start, start + compressedSize);
		if (!name.endsWith("/")) {
			entries.set(
				name,
				method === 8 ? await inflate(compressed) : compressed.slice(),
			);
		}
		position += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A trace found in a ZIP file: directly, in a directory of it, or in a ZIP file in it, as in an artifact of CI. */
export interface FoundTrace {
	/** The path to show, such as `test-results/login-android/xwright-trace`. */
	label: string;
	open(): Promise<TraceSource>;
}

/** Finds the traces in the entries of a ZIP file. */
export function findTraces(
	name: string,
	entries: Map<string, Uint8Array>,
): FoundTrace[] {
	const found: FoundTrace[] = [];
	for (const [path, data] of entries) {
		if (path === "trace.json" || path.endsWith("/trace.json")) {
			const prefix = path.slice(0, -"trace.json".length);
			found.push({
				label: prefix === "" ? name : prefix.slice(0, -1),
				open: async () => zipSource(name, entries, prefix),
			});
		} else if (path.endsWith(".zip")) {
			found.push({
				label: path.slice(0, -".zip".length),
				open: async () => {
					const inner = await readZip(data.slice().buffer as ArrayBuffer);
					const traces = findTraces(path, inner);
					const first = traces[0];
					if (first === undefined) {
						throw new Error(`${path} has no trace`);
					}
					return await first.open();
				},
			});
		}
	}
	return found.sort((a, b) => a.label.localeCompare(b.label));
}
