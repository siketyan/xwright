import { relative, sep } from "node:path";
import type {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestError,
	TestResult,
	TestStep,
} from "playwright/types/testReporter";

/** The categories of the steps shown in the tree: the steps of the test, the calls of the APIs and the assertions. */
const SHOWN = new Set(["test.step", "pw:api", "expect"]);

/** The categories of the steps shown only when a step under them is shown or failed: the hooks and the fixtures. */
const CONTAINERS = new Set(["hook", "fixture"]);

const CODES = {
	bold: [1, 22],
	dim: [2, 22],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
} as const;

type Style = keyof typeof CODES;

/**
 * Whether to color the output: on a terminal, on GitHub Actions, whose log shows colors, or with `FORCE_COLOR`, but not
 * with `NO_COLOR` or `FORCE_COLOR=0`.
 */
function colorEnabled(): boolean {
	const force = process.env.FORCE_COLOR;
	if (process.env.NO_COLOR || force === "0") {
		return false;
	}
	return (
		force !== undefined ||
		process.stdout.isTTY === true ||
		process.env.GITHUB_ACTIONS === "true"
	);
}

/** A node of the tree of a test: a step, with the steps under it to show. */
interface Node {
	step: TestStep;
	children: Node[];
}

/**
 * Prints each test with its steps as a tree when the test ends, so that the output of tests running in parallel does not
 * interleave. On GitHub Actions, the steps of each test are in a group of the log, with the errors after it.
 *
 * ```ts
 * reporter: [["tree"]]
 * ```
 */
export default class TreeReporter implements Reporter {
	private readonly colors = colorEnabled();
	private readonly github = process.env.GITHUB_ACTIONS === "true";
	private rootDir = "";
	private startTime = 0;
	private readonly failed: TestCase[] = [];
	private readonly flaky: TestCase[] = [];
	private passed = 0;
	private skipped = 0;

	onBegin(config: FullConfig, suite: Suite): void {
		this.rootDir = config.rootDir;
		this.startTime = Date.now();
		const tests = suite.allTests().length;
		const workers = config.workers;
		this.print(
			`Running ${tests} ${tests === 1 ? "test" : "tests"} using ${workers} ${workers === 1 ? "worker" : "workers"}\n`,
		);
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		const willRetry =
			result.status !== "passed" &&
			result.status !== "skipped" &&
			result.retry < test.retries;
		const header = this.header(test, result, willRetry);
		const lines = this.tree(this.nodes(result.steps), "");
		for (const chunk of [...result.stdout, ...result.stderr]) {
			const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
			for (const line of text.replace(/\n$/, "").split("\n")) {
				lines.push(this.style("dim", `│ ${line}`));
			}
		}
		if (this.github) {
			// The header is the title of the group, colored as the other lines of the log.
			this.print(`::group::${header}`);
			this.printLines(lines);
			this.print("::endgroup::");
		} else {
			this.print(header);
			this.printLines(lines);
		}
		for (const error of result.errors) {
			this.print(this.formatError(error));
		}
		if (!willRetry) {
			this.count(test);
		}
	}

	onError(error: TestError): void {
		this.print(this.formatError(error));
	}

	onEnd(result: FullResult): void {
		const duration = formatDuration(Date.now() - this.startTime);
		this.print("");
		if (this.failed.length > 0) {
			this.print(this.style("red", `  ${this.failed.length} failed`));
			for (const test of this.failed) {
				this.print(this.style("red", `    ${this.title(test)}`));
			}
		}
		if (this.flaky.length > 0) {
			this.print(this.style("yellow", `  ${this.flaky.length} flaky`));
			for (const test of this.flaky) {
				this.print(this.style("yellow", `    ${this.title(test)}`));
			}
		}
		if (this.skipped > 0) {
			this.print(this.style("yellow", `  ${this.skipped} skipped`));
		}
		this.print(
			this.style(
				"green",
				`  ${this.passed} passed ${this.style("dim", `(${duration})`)}`,
			),
		);
		if (result.status === "interrupted") {
			this.print(this.style("red", "  Interrupted"));
		}
	}

	printsToStdio(): boolean {
		return true;
	}

	private count(test: TestCase): void {
		switch (test.outcome()) {
			case "expected":
				this.passed += 1;
				break;
			case "flaky":
				this.flaky.push(test);
				break;
			case "skipped":
				this.skipped += 1;
				break;
			default:
				this.failed.push(test);
		}
	}

	/** The line of the test: its status, project, location, titles, retry and duration. */
	private header(
		test: TestCase,
		result: TestResult,
		willRetry: boolean,
	): string {
		const retry =
			result.retry > 0 ? this.style("yellow", ` (retry #${result.retry})`) : "";
		const duration = this.style("dim", ` (${formatDuration(result.duration)})`);
		const title = `${this.title(test)}${retry}`;
		switch (result.status) {
			case "passed":
				return `${this.style(result.retry > 0 ? "yellow" : "green", "✓")} ${title}${duration}`;
			case "skipped":
				return `${this.style("dim", "-")} ${this.style("dim", title)}`;
			default:
				return `${this.style(willRetry ? "yellow" : "red", "✘")} ${this.style(willRetry ? "yellow" : "red", title)}${duration}`;
		}
	}

	/** `[project] › file:line › titles`, as Playwright's reporters show a test. */
	private title(test: TestCase): string {
		const project = test.parent.project()?.name;
		const file = relative(this.rootDir, test.location.file)
			.split(sep)
			.join("/");
		const titles = test.titlePath().slice(3);
		return [
			...(project ? [`[${project}]`] : []),
			`${file}:${test.location.line}`,
			...titles,
		].join(" › ");
	}

	/** The steps to show: the shown ones, and the hooks and fixtures with shown or failed steps under them. */
	private nodes(steps: TestStep[]): Node[] {
		const nodes: Node[] = [];
		for (const step of steps) {
			const children = this.nodes(step.steps);
			if (SHOWN.has(step.category)) {
				nodes.push({ step, children });
			} else if (CONTAINERS.has(step.category)) {
				if (step.category === "fixture") {
					// A fixture is set up inside a hook, so its steps are put under the hook.
					nodes.push(...children);
				} else if (children.length > 0 || step.error !== undefined) {
					nodes.push({ step, children });
				}
			}
		}
		return nodes;
	}

	private tree(nodes: Node[], indent: string): string[] {
		const lines: string[] = [];
		nodes.forEach((node, index) => {
			const last = index === nodes.length - 1;
			const { step } = node;
			const failed = step.error !== undefined;
			const title = failed
				? this.style("red", `✘ ${step.title}`)
				: step.category === "hook"
					? this.style("dim", step.title)
					: step.title;
			lines.push(
				`${this.style("dim", `${indent}${last ? "└─ " : "├─ "}`)}${title}${this.style("dim", ` (${formatDuration(step.duration)})`)}`,
			);
			lines.push(
				...this.tree(node.children, `${indent}${last ? "   " : "│  "}`),
			);
		});
		return lines;
	}

	private formatError(error: TestError): string {
		const lines: string[] = [];
		const message = error.message ?? error.value ?? "";
		lines.push(...message.split("\n"));
		if (error.snippet !== undefined) {
			lines.push("", ...error.snippet.split("\n"));
		}
		if (error.location !== undefined) {
			const file = relative(this.rootDir, error.location.file)
				.split(sep)
				.join("/");
			lines.push(
				"",
				this.style(
					"dim",
					`at ${file}:${error.location.line}:${error.location.column}`,
				),
			);
		}
		const text = `${lines.map((line) => `    ${line}`).join("\n")}\n`;
		// The errors of the workers are colored by Playwright.
		return this.colors ? text : stripAnsi(text);
	}

	private style(style: Style, text: string): string {
		if (!this.colors) {
			return text;
		}
		const [open, close] = CODES[style];
		return `\u001b[${open}m${text}\u001b[${close}m`;
	}

	private printLines(lines: string[]): void {
		for (const line of lines) {
			this.print(`  ${line}`);
		}
	}

	private print(text: string): void {
		process.stdout.write(`${text}\n`);
	}
}

function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	if (ms < 60_000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${(ms / 60_000).toFixed(1)}m`;
}

function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: the escape sequences of the colors.
	return text.replace(/\u001b\[[0-9;]*m/g, "");
}
