import { relative, sep } from "node:path";
import type {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestError,
	TestResult,
} from "playwright/types/testReporter";

/** A test as the UI lists it. */
export interface ListedTest {
	id: string;
	project: string;
	/** The file of the test, relative to the root directory of the configuration, with `/`. */
	file: string;
	line: number;
	/** The titles of the describes and of the test, in the file. */
	titles: string[];
	/** The output directory of the project, under which the output directory of the test is. */
	outputDir: string;
}

/** What a run tells the UI that started it. */
export type RunEvent =
	| { type: "tests"; tests: ListedTest[] }
	| { type: "begin"; id: string; retry: number }
	| {
			type: "end";
			id: string;
			retry: number;
			status: TestResult["status"];
			duration: number;
			/** The `trace.json` of the trace, when it was kept. */
			trace?: string;
	  }
	| { type: "error"; message: string }
	| { type: "done"; status: FullResult["status"] };

/** Reports a run of `xwright test --ui` to the process that started it, over IPC. */
export default class UiReporter implements Reporter {
	private rootDir = "";

	onBegin(config: FullConfig, suite: Suite): void {
		this.rootDir = config.rootDir;
		send({
			type: "tests",
			tests: suite.allTests().map((test) => this.listed(test)),
		});
	}

	onTestBegin(test: TestCase, result: TestResult): void {
		send({ type: "begin", id: test.id, retry: result.retry });
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		send({
			type: "end",
			id: test.id,
			retry: result.retry,
			status: result.status,
			duration: result.duration,
			trace: result.attachments.find(
				(attachment) => attachment.name === "xwright-trace",
			)?.path,
		});
	}

	onError(error: TestError): void {
		send({ type: "error", message: error.message ?? error.value ?? "" });
	}

	onEnd(result: FullResult): void {
		send({ type: "done", status: result.status });
	}

	printsToStdio(): boolean {
		return false;
	}

	private listed(test: TestCase): ListedTest {
		const project = test.parent.project();
		return {
			id: test.id,
			project: project?.name ?? "",
			file: relative(this.rootDir, test.location.file).split(sep).join("/"),
			line: test.location.line,
			// The root, the project and the file come first.
			titles: test.titlePath().slice(3),
			outputDir: project?.outputDir ?? "",
		};
	}
}

function send(event: RunEvent): void {
	process.send?.(event);
}
