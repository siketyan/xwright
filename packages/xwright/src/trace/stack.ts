import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
	addLibraryDirectory,
	libraryDirectories,
	parseStack,
	type StackFrame,
} from "@xwright/core";

export { addLibraryDirectory, parseStack };

addLibraryDirectory(dirname(dirname(fileURLToPath(import.meta.url))));

/** Captures the stack of the caller, without the frames of Node.js, dependencies, Xwright and the adapters. */
export function captureStack(): StackFrame[] {
	return filterStack(parseStack(new Error().stack ?? ""));
}

/** Leaves out the frames of Node.js, dependencies, Xwright and the adapters. */
export function filterStack(frames: StackFrame[]): StackFrame[] {
	const directories = [...libraryDirectories()];
	return frames.filter(
		({ file }) =>
			!file.startsWith("node:") &&
			!file.includes(`${sep}node_modules${sep}`) &&
			!directories.some((directory) => file.startsWith(directory)),
	);
}
