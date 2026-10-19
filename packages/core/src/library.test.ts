import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	addLibraryDirectory,
	callerDirectory,
	libraryDirectories,
} from "./library.js";

describe("libraryDirectories", () => {
	it("keeps the directories on the global object, for every copy of the package", () => {
		const directory = join(sep, "opt", "adapter", "dist");
		addLibraryDirectory(directory);
		const shared = (
			globalThis as unknown as Record<symbol, Set<string> | undefined>
		)[Symbol.for("xwright.libraryDirectories")];
		expect(shared).toBe(libraryDirectories());
		// With the sources of a built package, which source maps point to.
		expect([...(shared ?? [])]).toEqual(
			expect.arrayContaining([
				`${directory}${sep}`,
				`${join(sep, "opt", "adapter", "src")}${sep}`,
			]),
		);
	});

	it("does not leave out the directory of the tests", () => {
		addLibraryDirectory(process.cwd());
		expect(libraryDirectories().has(`${process.cwd()}${sep}`)).toBe(false);
	});
});

describe("callerDirectory", () => {
	it("returns the directory of the module that called the caller", () => {
		const caller = () => callerDirectory();
		expect(caller()).toBe(import.meta.dirname);
	});
});
