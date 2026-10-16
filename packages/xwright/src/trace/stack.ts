import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { StackFrame } from "../trace.js";

/** The directories of Xwright and of the adapters, whose frames are left out of the stacks. */
const libraryDirectories = new Set<string>([
	dirname(dirname(fileURLToPath(import.meta.url))) + sep,
]);

/**
 * Leaves the frames in the directory out of the stacks, such as the ones of an adapter. The current directory and
 * its ancestors are not left out, as they hold the tests, for an adapter defined next to the configuration.
 */
export function addLibraryDirectory(directory: string): void {
	const path = directory.endsWith(sep) ? directory : directory + sep;
	if (!`${process.cwd()}${sep}`.startsWith(path)) {
		libraryDirectories.add(path);
	}
}

/** Returns the directory of the module that called the function that calls this. */
export function callerDirectory(): string | undefined {
	const file = parseStack(new Error().stack ?? "")[2]?.file;
	return file === undefined ? undefined : dirname(file);
}

/** Captures the stack of the caller, without the frames of Node.js, dependencies, Xwright and the adapters. */
export function captureStack(): StackFrame[] {
	return parseStack(new Error().stack ?? "").filter(
		({ file }) =>
			!file.startsWith("node:") &&
			!file.includes(`${sep}node_modules${sep}`) &&
			![...libraryDirectories].some((directory) => file.startsWith(directory)),
	);
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
