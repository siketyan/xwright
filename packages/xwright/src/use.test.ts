import { afterEach, describe, expect, it } from "vitest";
import { deleteTarget, setTarget } from "./runtime.js";
import { createHandle } from "./use.js";

describe("createHandle", () => {
	afterEach(() => deleteTarget("device"));

	it("forwards to the current target", () => {
		const handle = createHandle("device") as {
			value: number;
			read(): number;
		};
		setTarget("device", {
			value: 1,
			read() {
				return this.value;
			},
		});
		expect(handle.value).toBe(1);
		expect(handle.read()).toBe(1);
		expect("value" in handle).toBe(true);
		expect(Object.keys(handle)).toEqual(["value", "read"]);

		setTarget("device", { value: 2, read: () => 2 });
		expect(handle.value).toBe(2);
		handle.value = 3;
		expect(handle.value).toBe(3);
	});

	it("throws without a target", () => {
		const handle = createHandle("device") as { value: number };
		expect(() => handle.value).toThrow(/Device "device" is not available/);
	});
});
