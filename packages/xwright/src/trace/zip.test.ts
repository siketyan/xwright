import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { exportTrace, findTraces, readZip, zipDirectory } from "./zip.js";

/** Reads the entries of a ZIP archive through its central directory, checking their CRC-32. */
function unzip(file: string): Record<string, string> {
	const zip = readFileSync(file);
	const end = zip.length - 22;
	expect(zip.readUInt32LE(end)).toBe(0x06054b50);
	const count = zip.readUInt16LE(end + 10);
	let position = zip.readUInt32LE(end + 16);
	const entries: Record<string, string> = {};
	for (let i = 0; i < count; i++) {
		expect(zip.readUInt32LE(position)).toBe(0x02014b50);
		const crc = zip.readUInt32LE(position + 16);
		const compressedSize = zip.readUInt32LE(position + 20);
		const nameLength = zip.readUInt16LE(position + 28);
		const offset = zip.readUInt32LE(position + 42);
		const name = zip.toString(
			"utf8",
			position + 46,
			position + 46 + nameLength,
		);
		const dataStart = offset + 30 + zip.readUInt16LE(offset + 26);
		const data = inflateRawSync(
			zip.subarray(dataStart, dataStart + compressedSize),
		);
		expect(crc32(data)).toBe(crc);
		entries[name] = data.toString("utf8");
		position += 46 + nameLength;
	}
	return entries;
}

function makeTrace(root: string, name: string): string {
	const dir = join(root, name, "xwright-trace");
	mkdirSync(join(dir, "web", "resources"), { recursive: true });
	writeFileSync(join(dir, "trace.json"), "{}\n");
	writeFileSync(join(dir, "web.ndjson"), '{"type":"before"}\n');
	writeFileSync(join(dir, "web", "resources", "abc.png"), "png");
	return dir;
}

describe("zipDirectory", () => {
	it("writes the files with their relative paths", () => {
		const root = mkdtempSync(join(tmpdir(), "xwright-zip-"));
		const trace = makeTrace(root, "test");
		zipDirectory(trace, join(root, "trace.zip"));
		expect(unzip(join(root, "trace.zip"))).toEqual({
			"trace.json": "{}\n",
			"web.ndjson": '{"type":"before"}\n',
			"web/resources/abc.png": "png",
		});
	});
});

describe("exportTrace", () => {
	it("writes the trace into a ZIP file in place of its directory", () => {
		const root = mkdtempSync(join(tmpdir(), "xwright-zip-"));
		const trace = makeTrace(root, "test");
		exportTrace(trace, `${trace}.zip`);
		expect(existsSync(trace)).toBe(false);
		expect(unzip(`${trace}.zip`)).toMatchObject({ "trace.json": "{}\n" });
		// The output directory of the test is left, as Playwright's.
		expect(readdirSync(join(root, "test"))).toEqual(["xwright-trace.zip"]);
	});

	it("refuses to write the ZIP file into the trace it deletes", () => {
		const root = mkdtempSync(join(tmpdir(), "xwright-zip-"));
		const trace = makeTrace(root, "test");
		expect(() => exportTrace(trace, join(trace, "trace.zip"))).toThrow(
			/is in the trace/,
		);
		expect(existsSync(join(trace, "trace.json"))).toBe(true);
	});
});

describe("readZip", () => {
	it("reads what zipDirectory wrote", () => {
		const root = mkdtempSync(join(tmpdir(), "xwright-zip-"));
		zipDirectory(makeTrace(root, "test"), join(root, "trace.zip"));
		const entries = readZip(join(root, "trace.zip"));
		expect(
			Object.fromEntries(
				[...entries].map(([name, data]) => [name, data.toString("utf8")]),
			),
		).toEqual(unzip(join(root, "trace.zip")));
	});
});

describe("findTraces", () => {
	it("finds the traces under the paths", () => {
		const root = mkdtempSync(join(tmpdir(), "xwright-zip-"));
		const a = makeTrace(root, "a");
		const b = makeTrace(root, "b");
		expect(findTraces([root, join(root, "missing")])).toEqual([a, b]);
		expect(findTraces([a])).toEqual([a]);
	});
});
