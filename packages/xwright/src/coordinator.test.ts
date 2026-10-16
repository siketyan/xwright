import { afterEach, describe, expect, it, vi } from "vitest";
import { defineAdapter } from "./adapter.js";
import {
	COORDINATOR_URL_ENV,
	Coordinator,
	requestShared,
} from "./coordinator.js";

describe("Coordinator", () => {
	afterEach(() => {
		delete process.env[COORDINATOR_URL_ENV];
	});

	it("runs createOnce once for the workers, and disposeOnce at the end", async () => {
		const createOnce = vi.fn(({ options }: { options: string }) => ({
			value: options,
		}));
		const disposeOnce = vi.fn();
		const adapter = defineAdapter<string, object, { value: string }>({
			name: "fake",
			createOnce,
			disposeOnce,
			create: () => ({}),
		});
		const coordinator = new Coordinator(
			new Map([
				["0", adapter("first")],
				["1", adapter("unused")],
			]),
		);
		process.env[COORDINATOR_URL_ENV] = await coordinator.listen();

		const values = await Promise.all([requestShared("0"), requestShared("0")]);
		expect(values).toEqual([{ value: "first" }, { value: "first" }]);
		expect(createOnce).toHaveBeenCalledTimes(1);

		await coordinator.close();
		expect(disposeOnce).toHaveBeenCalledExactlyOnceWith(
			{ value: "first" },
			{ options: "first" },
		);
	});

	it("passes the error of createOnce to the workers", async () => {
		const adapter = defineAdapter<undefined, object, null>({
			name: "fake",
			createOnce: () => {
				throw new Error("no devices");
			},
			disposeOnce: () => {
				throw new Error("must not be called");
			},
			create: () => ({}),
		});
		const coordinator = new Coordinator(new Map([["0", adapter()]]));
		process.env[COORDINATOR_URL_ENV] = await coordinator.listen();

		await expect(requestShared("0")).rejects.toThrow(/no devices/);
		await expect(requestShared("1")).rejects.toThrow(/Unknown adapter "1"/);
		await coordinator.close();
	});

	it("requires the coordinator", async () => {
		await expect(requestShared("0")).rejects.toThrow(COORDINATOR_URL_ENV);
	});
});
