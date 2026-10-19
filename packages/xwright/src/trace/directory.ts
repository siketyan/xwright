import { createHash } from "node:crypto";
import {
	closeSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { join } from "node:path";
import type { TraceMode } from "../config.js";
import { hostTime } from "./clock.js";
import { redactContent, redactValue } from "./redact.js";

/** The version of the format of the trace. */
export const TRACE_VERSION = 1;

/** The name of the track of the test, which has the steps, the errors and the output of the test. */
export const TEST_TRACK = "test";

/** What `trace.json` says about the test. */
export interface TraceTest {
	id: string;
	title: string;
	titlePath: string[];
	file: string;
	line: number;
	column: number;
	retry: number;
	project: string;
}

/** What `trace.json` says about a device. */
export interface TraceDevice {
	name: string;
	/** The ID of the adapter, such as its package name. */
	adapter: string;
	/** The NDJSON file of the track, relative to the directory. */
	file: string;
	trace: TraceMode;
}

/** The result of the test in `trace.json`, after it ended. */
export interface TraceResult {
	status: string;
	duration: number;
}

/** The content of `trace.json`. */
export interface TraceMeta {
	version: number;
	test?: TraceTest;
	/** A pair of times read at the same moment, to convert the monotonic times of the events to wall-clock times. */
	clock: { wallTime: number; monotonicTime: number };
	devices: TraceDevice[];
	/** The definitions of the types of payloads, and of how to show them. */
	types: Record<string, unknown>;
	result?: TraceResult;
}

/** Payloads up to this size in JSON are put in the events, and larger ones in resource files. */
const MAX_INLINE_PAYLOAD = 4096;

const EXTENSIONS: Record<string, string> = {
	"application/json": "json",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"text/html": "html",
	"text/plain": "txt",
};

/**
 * A track of the trace: an NDJSON file of events and a directory of resource files, which the events refer to.
 *
 * Every write is appended at once, so that a viewer can follow the file while the test runs. A resource is written
 * before the event that refers to it.
 */
export class Track {
	readonly name: string;
	private readonly directory: string;
	private fd: number | undefined;

	constructor(directory: string, name: string) {
		this.directory = directory;
		this.name = name;
		this.fd = openSync(join(directory, `${name}.ndjson`), "a");
	}

	/** Appends an event, unless the track was closed. */
	append(event: Record<string, unknown>): void {
		if (this.fd !== undefined) {
			writeSync(this.fd, `${JSON.stringify(redactValue(event))}\n`);
		}
	}

	/** Writes a resource file named by the hash of its content, and returns its path relative to the trace. */
	resource(data: Uint8Array | string, contentType: string): string {
		data = redactContent(
			typeof data === "string" ? new TextEncoder().encode(data) : data,
		);
		const hash = createHash("sha1").update(data).digest("hex");
		const extension = EXTENSIONS[contentType] ?? "bin";
		const path = `${this.name}/resources/${hash}.${extension}`;
		mkdirSync(join(this.directory, this.name, "resources"), {
			recursive: true,
		});
		writeFileSync(join(this.directory, path), data, { flag: "w" });
		return path;
	}

	/** Copies a file into the resources under the name, unless it is there, and returns its path relative to the trace. */
	copyResource(source: string, name: string): string {
		const path = `${this.name}/resources/${name}`;
		const target = join(this.directory, path);
		if (!existsSync(target)) {
			mkdirSync(join(this.directory, this.name, "resources"), {
				recursive: true,
			});
			const data = readFileSync(source);
			const redacted = redactContent(data);
			if (redacted === data) {
				copyFileSync(source, target);
			} else {
				writeFileSync(target, redacted);
			}
		}
		return path;
	}

	/**
	 * Puts a payload in the event when it is small JSON, or in a resource file otherwise. Returns the fields to merge
	 * into the event: `payload`, or `file` with `contentType`.
	 */
	payload(
		value: unknown,
		contentType?: string,
	): { payload: unknown } | { file: string; contentType: string } {
		if (value instanceof Uint8Array) {
			const type = contentType ?? "application/octet-stream";
			return { file: this.resource(value, type), contentType: type };
		}
		const json = JSON.stringify(value) ?? "null";
		if (json.length <= MAX_INLINE_PAYLOAD) {
			return { payload: value ?? null };
		}
		return {
			file: this.resource(json, "application/json"),
			contentType: "application/json",
		};
	}

	close(): void {
		if (this.fd !== undefined) {
			closeSync(this.fd);
			this.fd = undefined;
		}
	}

	/** Closes the track, and deletes its NDJSON file and resources. */
	delete(): void {
		this.close();
		rmSync(join(this.directory, `${this.name}.ndjson`), { force: true });
		rmSync(join(this.directory, this.name), { recursive: true, force: true });
	}
}

/**
 * The directory of the trace of a test: `trace.json`, `test.ndjson`, and an NDJSON file and a directory of resources
 * per device.
 */
export class TraceDirectory {
	readonly path: string;
	private readonly meta: TraceMeta;
	private readonly tracks = new Map<string, Track>();
	/** The devices whose tracks were deleted, which take no more events. */
	private readonly dropped = new Set<string>();
	private deleted = false;

	constructor(path: string, test?: TraceTest, clock = currentClock()) {
		this.path = path;
		mkdirSync(path, { recursive: true });
		this.meta = { version: TRACE_VERSION, test, clock, devices: [], types: {} };
		this.writeMeta();
	}

	/** The track of the test, or `undefined` after the directory was deleted. */
	testTrack(): Track | undefined {
		return this.deleted ? undefined : this.track(TEST_TRACK);
	}

	/**
	 * The track of the device, which is added to `trace.json` the first time, or `undefined` after the track was
	 * deleted.
	 */
	deviceTrack(device: Omit<TraceDevice, "file">): Track | undefined {
		if (this.deleted || this.dropped.has(device.name)) {
			return undefined;
		}
		if (!this.tracks.has(device.name)) {
			this.meta.devices.push({ ...device, file: `${device.name}.ndjson` });
			this.writeMeta();
		}
		return this.track(device.name);
	}

	/** Writes the result of the test to `trace.json`. */
	setResult(result: TraceResult): void {
		if (!this.deleted) {
			this.meta.result = result;
			this.writeMeta();
		}
	}

	/**
	 * Deletes the tracks of the devices that are not kept, and the whole directory when none is. Returns whether the
	 * directory is kept.
	 */
	retain(keep: (device: TraceDevice) => boolean): boolean {
		const kept = this.meta.devices.filter(keep);
		for (const device of this.meta.devices) {
			if (!kept.includes(device)) {
				this.tracks.get(device.name)?.delete();
				this.tracks.delete(device.name);
				this.dropped.add(device.name);
			}
		}
		if (kept.length === 0) {
			this.close();
			this.deleted = true;
			rmSync(this.path, { recursive: true, force: true });
			return false;
		}
		this.meta.devices = kept;
		this.writeMeta();
		return true;
	}

	close(): void {
		for (const track of this.tracks.values()) {
			track.close();
		}
		this.tracks.clear();
	}

	private track(name: string): Track {
		let track = this.tracks.get(name);
		if (track === undefined) {
			track = new Track(this.path, name);
			this.tracks.set(name, track);
		}
		return track;
	}

	/** Rewrites `trace.json` through a temporary file, so that a reader never sees it half written. */
	private writeMeta(): void {
		const file = join(this.path, "trace.json");
		writeFileSync(
			`${file}.tmp`,
			`${JSON.stringify(redactValue(this.meta), null, 2)}\n`,
		);
		renameSync(`${file}.tmp`, file);
	}
}

function currentClock(): TraceMeta["clock"] {
	return { wallTime: Date.now(), monotonicTime: hostTime() };
}
