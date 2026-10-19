import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { StackFrame } from "./trace.js";

/**
 * The directories of Xwright and of the adapters, whose frames are left out of the stacks. They are kept on the global
 * object, so that every copy of this package in the process, such as an older one of an adapter, adds to the same.
 */
const KEY = Symbol.for("xwright.libraryDirectories");

/** The directories whose frames are left out of the stacks. */
export function libraryDirectories(): Set<string> {
	const global = globalThis as { [KEY]?: Set<string> };
	global[KEY] ??= new Set();
	return global[KEY];
}

/**
 * Leaves the frames in the directory out of the stacks, such as the ones of an adapter. The current directory and
 * its ancestors are not left out, as they hold the tests, for an adapter defined next to the configuration.
 */
export function addLibraryDirectory(directory: string): void {
	const path = directory.endsWith(sep) ? directory : directory + sep;
	if (`${process.cwd()}${sep}`.startsWith(path)) {
		return;
	}
	const directories = libraryDirectories();
	directories.add(path);
	// Source maps point the frames of a built package to its sources.
	if (basename(directory) === "dist") {
		directories.add(join(dirname(directory), "src") + sep);
	}
}

addLibraryDirectory(dirname(dirname(fileURLToPath(import.meta.url))));

/** Returns the directory of the module that called the function that calls this. */
export function callerDirectory(): string | undefined {
	const file = parseStack(new Error().stack ?? "")[2]?.file;
	return file === undefined ? undefined : dirname(file);
}

const FRAME = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/;

/** Parses the frames of a V8 stack trace. */
export function parseStack(stack: string): StackFrame[] {
	const frames: StackFrame[] = [];
	for (const line of stack.split("\n")) {
		const match = FRAME.exec(line);
		if (!match?.[2]) {
			continue;
		}
		const file = match[2].startsWith("file://")
			? fileURLToPath(match[2])
			: match[2];
		frames.push({
			file,
			line: Number(match[3]),
			column: Number(match[4]),
			...(match[1] ? { function: match[1] } : {}),
		});
	}
	return frames;
}
