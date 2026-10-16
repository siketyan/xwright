import { defineAdapter, defineConfig, type Tracer } from "xwright";

/** A device that records a tap with a screenshot and a log on its track. */
class FakeDevice {
	private readonly trace: Tracer;

	constructor(trace: Tracer) {
		this.trace = trace;
	}

	async tap(target: string): Promise<void> {
		await this.trace.action(
			{ title: `tap ${target}`, class: "Fake", method: "tap" },
			async () => {
				this.trace.log({ text: `tapped ${target}` });
				this.trace.snapshot({
					type: "xwright.screenshot@1",
					phase: "after",
					payload: new Uint8Array([137, 80, 78, 71]),
				});
			},
		);
	}
}

const fake = defineAdapter({
	name: "fake",
	create: ({ trace }) => new FakeDevice(trace),
});

export default defineConfig({
	testMatch: "*.e2e.ts",
	outputDir: "test-results",
	workers: 1,
	projects: [
		{ name: "phone", devices: { a: { adapter: fake(), trace: "on" } } },
	],
});
