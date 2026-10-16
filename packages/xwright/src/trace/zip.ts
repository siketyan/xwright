import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

/** 1980-01-01 00:00 in the MS-DOS format of ZIP, the earliest valid one, so that archives of the same files match. */
const DOS_EPOCH = ((1 << 5) | 1) << 16;

/** Lists the files under the directory, recursively, in a stable order. */
function listFiles(dir: string): string[] {
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

/**
 * Writes the files of the directory into a ZIP archive, with their paths relative to the directory. The archive is
 * plain ZIP without ZIP64, which is enough for a trace.
 */
export function zipDirectory(dir: string, output: string): void {
	const locals: Buffer[] = [];
	const centrals: Buffer[] = [];
	let offset = 0;

	for (const file of listFiles(dir)) {
		const name = Buffer.from(relative(dir, file).split(sep).join("/"));
		const data = readFileSync(file);
		const compressed = deflateRawSync(data);
		const crc = crc32(data);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0); // Local file header signature
		local.writeUInt16LE(20, 4); // Version needed to extract
		local.writeUInt16LE(0x0800, 6); // Flags: names in UTF-8
		local.writeUInt16LE(8, 8); // Compression: deflate
		local.writeUInt32LE(DOS_EPOCH, 10); // Modification time and date
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(compressed.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28); // Extra field length
		locals.push(local, name, compressed);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0); // Central directory header signature
		central.writeUInt16LE(20, 4); // Version made by
		central.writeUInt16LE(20, 6); // Version needed to extract
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(8, 10);
		central.writeUInt32LE(DOS_EPOCH, 12);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(compressed.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42); // Offset of the local header; the fields between are zero
		centrals.push(central, name);

		offset += local.length + name.length + compressed.length;
	}

	const centralDirectory = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0); // End of central directory signature
	end.writeUInt16LE(centrals.length / 2, 8);
	end.writeUInt16LE(centrals.length / 2, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	writeFileSync(output, Buffer.concat([...locals, centralDirectory, end]));
}

/** Finds the directories of traces under the paths, which have `trace.json`, such as the output directory of tests. */
export function findTraces(paths: string[]): string[] {
	const traces = new Set<string>();
	for (const path of paths) {
		if (!existsSync(path)) {
			continue;
		}
		if (existsSync(join(path, "trace.json"))) {
			traces.add(path);
			continue;
		}
		for (const file of listFiles(path)) {
			if (basename(file) === "trace.json") {
				traces.add(dirname(file));
			}
		}
	}
	return [...traces].sort();
}

/** Reads the entries of a ZIP archive written by {@link zipDirectory}, or by other tools without ZIP64. */
export function readZip(file: string): Map<string, Buffer> {
	const zip = readFileSync(file);
	const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
	if (end < 0) {
		throw new Error(`${file} is not a ZIP archive`);
	}
	const count = zip.readUInt16LE(end + 10);
	let position = zip.readUInt32LE(end + 16);
	const entries = new Map<string, Buffer>();
	for (let i = 0; i < count; i++) {
		const method = zip.readUInt16LE(position + 10);
		const compressedSize = zip.readUInt32LE(position + 20);
		const nameLength = zip.readUInt16LE(position + 28);
		const extraLength = zip.readUInt16LE(position + 30);
		const commentLength = zip.readUInt16LE(position + 32);
		const offset = zip.readUInt32LE(position + 42);
		const name = zip.toString(
			"utf8",
			position + 46,
			position + 46 + nameLength,
		);
		const start =
			offset +
			30 +
			zip.readUInt16LE(offset + 26) +
			zip.readUInt16LE(offset + 28);
		const data = zip.subarray(start, start + compressedSize);
		if (!name.endsWith("/")) {
			entries.set(
				name,
				method === 8 ? inflateRawSync(data) : Buffer.from(data),
			);
		}
		position += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}
