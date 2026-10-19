import { writeFileSync } from "node:fs";
import type {
	Reporter,
	TestCase,
	TestResult,
	TestStep,
} from "playwright/types/testReporter";

interface StepEntry {
	title: string;
	category: string;
	steps: StepEntry[];
}

/** Writes the steps of each test with their categories to `steps.json`, which the JSON reporter leaves out. */
export default class StepsReporter implements Reporter {
	private readonly tests: Record<string, StepEntry[]> = {};

	onTestEnd(test: TestCase, result: TestResult): void {
		const entry = (step: TestStep): StepEntry => ({
			title: step.title,
			category: step.category,
			steps: step.steps.map(entry),
		});
		this.tests[test.title] = result.steps.map(entry);
	}

	onEnd(): void {
		writeFileSync("steps.json", JSON.stringify(this.tests, null, 2));
	}
}
