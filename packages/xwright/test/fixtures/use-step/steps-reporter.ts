import { writeFileSync } from "node:fs";
import type { Reporter, TestStep } from "playwright/types/testReporter";

/** Writes where each step was declared to `steps.json`. */
export default class StepsReporter implements Reporter {
	private readonly steps: { title: string; line?: number }[] = [];

	onStepBegin(_test: unknown, _result: unknown, step: TestStep): void {
		if (step.category === "test.step") {
			this.steps.push({ title: step.title, line: step.location?.line });
		}
	}

	onEnd(): void {
		writeFileSync("steps.json", JSON.stringify(this.steps));
	}
}
