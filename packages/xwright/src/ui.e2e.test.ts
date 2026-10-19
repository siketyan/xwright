import { existsSync, mkdirSync, mkdtempSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { afterAll, beforeAll, it } from "vitest";
import { TraceDirectory } from "./trace/directory.js";
import {
	openTrace,
	openTraces,
	serveTrace,
	serveTraces,
} from "./trace/server.js";
import { zipDirectory } from "./trace/zip.js";

const executable = "/opt/pw-browsers/chromium";
// A PNG of 1x1 pixel.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
	"base64",
);

/** Writes a trace of a step with a failing tap on a phone, which made a request. */
function makeTrace(project = "android"): string {
	const dir = join(mkdtempSync(join(tmpdir(), "xwright-ui-")), "xwright-trace");
	const trace = new TraceDirectory(
		dir,
		{
			id: "id",
			title: "signs in",
			titlePath: ["auth.spec.ts", "signs in"],
			file: import.meta.filename,
			line: 1,
			column: 1,
			retry: 0,
			project,
		},
		{ wallTime: 0, monotonicTime: 1000 },
	);
	const test = trace.testTrack();
	const phone = trace.deviceTrack({
		name: "phone",
		adapter: "fake",
		trace: "on",
	});
	test?.append({
		type: "before",
		callId: "call@1",
		startTime: 1000,
		title: "sign in",
		class: "Test",
		method: "step",
	});
	phone?.append({
		type: "before",
		callId: "call@2",
		parentId: "call@1",
		startTime: 1010,
		title: "tap Sign in",
		class: "Mobilewright",
		method: "step",
		stack: [{ file: import.meta.filename, line: 3, column: 1 }],
	});
	phone?.append({
		type: "log",
		callId: "call@2",
		time: 1015,
		message: "waiting for Sign in",
	});
	phone?.append({
		type: "screenshot",
		callId: "call@2",
		phase: "after",
		time: 1050,
		file: phone.resource(PNG, "image/png"),
	});
	phone?.append({
		type: "after",
		callId: "call@2",
		endTime: 1060,
		error: { message: "not visible" },
	});
	phone?.append({
		type: "resource",
		id: "resource@1",
		resourceType: "xwright.http@1",
		target: "https://api.test/login",
		status: 401,
		startTime: 1020,
		endTime: 1030,
	});
	test?.append({ type: "after", callId: "call@1", endTime: 1100 });
	test?.append({ type: "error", message: "Error: not visible" });
	trace.setResult({ status: "failed", duration: 100 });
	trace.close();
	return dir;
}

/** Writes a trace into a ZIP file, as `export-trace` does, and returns its path. */
function makeZippedTrace(project?: string): string {
	const dir = makeTrace(project);
	zipDirectory(dir, `${dir}.zip`);
	return `${dir}.zip`;
}

let url = "";
let close = () => {};

beforeAll(async () => {
	const served = await serveTrace(openTrace(makeTrace()));
	url = served.url;
	close = () => served.server.close();
});

afterAll(() => close());

it("shows the actions, the screen and the details of a trace", async () => {
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(url);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"auth.spec.ts › signs in",
		);
		await expect(page.getByText("failed · 100ms")).toBeVisible();

		const timeline = page.getByRole("region", { name: "Timeline" });
		await expect(timeline.getByText("test", { exact: true })).toBeVisible();
		await expect(timeline.getByText("phone", { exact: true })).toBeVisible();

		// The action of the phone is under the step, with the screenshot after it.
		const actions = page.getByRole("navigation", { name: "Actions" });
		await expect(
			actions.getByRole("button", { name: "sign in", exact: true }),
		).toBeVisible();
		await actions.getByRole("button", { name: "tap Sign in" }).click();
		await expect(
			page.getByRole("img", { name: "The screen of phone" }),
		).toBeVisible();
		await expect(page.getByText("phone · screenshot (after)")).toBeVisible();
		const panel = page.getByRole("tabpanel");
		await expect(panel).toContainText("Mobilewright.step");
		await expect(panel).toContainText("not visible");

		await page.getByRole("tab", { name: "Log" }).click();
		await expect(panel).toContainText("waiting for Sign in");

		await page.getByRole("tab", { name: "Network (1)" }).click();
		await expect(panel).toContainText("https://api.test/login");
		await expect(panel).toContainText("401");

		// The line of this file the stack points to.
		await page.getByRole("tab", { name: "Source" }).click();
		await expect(panel.locator("li.current")).toHaveText(
			'import { join } from "node:path";',
		);

		await page.getByRole("tab", { name: "Errors (2)" }).click();
		await expect(panel).toContainText("Error: not visible");
	} finally {
		await browser.close();
	}
}, 60_000);

it("opens a trace dropped on it, also from an artifact with traces in it", async () => {
	const served = await serveTrace(undefined);
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(served.url);
		await expect(
			page.getByRole("heading", { name: "Xwright Trace Viewer" }),
		).toBeVisible();

		// A ZIP file of one trace opens at once.
		await page.getByLabel("Open a file").setInputFiles(makeZippedTrace());
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"auth.spec.ts › signs in",
		);

		// An artifact of CI has the ZIP files of the traces in directories.
		const artifact = mkdtempSync(join(tmpdir(), "xwright-artifact-"));
		for (const project of ["android", "web"]) {
			mkdirSync(join(artifact, "content", project), { recursive: true });
			renameSync(
				makeZippedTrace(project),
				join(artifact, "content", project, "xwright-trace.zip"),
			);
		}
		zipDirectory(join(artifact, "content"), join(artifact, "traces.zip"));
		await page.goto(served.url);
		await page
			.getByLabel("Open a file")
			.setInputFiles(join(artifact, "traces.zip"));

		// The tests of the traces are listed, and the first that failed is shown.
		const tests = page.getByRole("complementary", { name: "Tests" });
		await expect(tests.getByText("2 tests")).toBeVisible();
		const android = tests.getByRole("button", { name: /signs in\s*android/ });
		const web = tests.getByRole("button", { name: /signs in\s*web/ });
		await expect(android).toHaveAttribute("aria-current", "true");
		await expect(android.getByTitle("failed")).toBeVisible();
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"auth.spec.ts › signs in",
		);
		await web.click();
		await expect(web).toHaveAttribute("aria-current", "true");
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(
			"auth.spec.ts › signs in",
		);
	} finally {
		await browser.close();
		served.server.close();
	}
}, 60_000);

it("lists the tests of the traces under a directory, as the UI of the runner does", async () => {
	// The output directory of the tests, with the trace of a worker, which is of no test.
	const results = mkdtempSync(join(tmpdir(), "xwright-results-"));
	for (const project of ["android", "web"]) {
		renameSync(
			join(makeTrace(project), ".."),
			join(results, `auth-signs-in-${project}`),
		);
	}
	new TraceDirectory(join(results, "xwright-worker-0")).close();
	const traces = openTraces(results);
	expect(traces.map((trace) => trace.label)).toEqual([
		"auth-signs-in-android/xwright-trace",
		"auth-signs-in-web/xwright-trace",
		"xwright-worker-0",
	]);

	const served = await serveTraces(traces);
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(served.url);
		const tests = page.getByRole("complementary", { name: "Tests" });
		await expect(
			tests.getByRole("heading", { name: "auth.spec.ts" }),
		).toBeVisible();
		await expect(tests.getByText("2 tests")).toBeVisible();

		// A filter of the projects, as in the runner.
		await tests
			.getByRole("group", { name: "Projects" })
			.getByRole("button", { name: "web" })
			.click();
		await expect(tests.getByText("1 of 2 tests")).toBeVisible();
		await tests.getByRole("button", { name: /signs in\s*web/ }).click();
		const actions = page.getByRole("navigation", { name: "Actions" });
		await expect(
			actions.getByRole("button", { name: "tap Sign in" }),
		).toBeVisible();
	} finally {
		await browser.close();
		served.server.close();
	}
}, 60_000);

/** Writes a trace of a click on a page with a stylesheet, with the DOM snapshots before and after it. */
function makeWebTrace(): string {
	const dir = join(mkdtempSync(join(tmpdir(), "xwright-ui-")), "xwright-trace");
	const trace = new TraceDirectory(dir, undefined, {
		wallTime: 0,
		monotonicTime: 1000,
	});
	const web = trace.deviceTrack({ name: "web", adapter: "fake", trace: "on" });
	const css = web?.resource("button { color: rgb(255, 0, 0); }", "text/plain");
	web?.append({
		type: "resource",
		id: "resource@1",
		resourceType: "xwright.http@1",
		target: "https://app.test/app.css",
		status: 200,
		startTime: 1005,
		endTime: 1006,
		response: {
			payload: { status: 200, content: { _file: css, mimeType: "text/css" } },
		},
	});
	web?.append({
		type: "before",
		callId: "call@1",
		startTime: 1010,
		title: "click",
		class: "Frame",
		method: "click",
	});
	const snapshot = (phase: string, label: string) => ({
		type: "frame-snapshot",
		snapshot: {
			callId: "call@1",
			phase,
			pageId: "page",
			frameId: "frame",
			frameUrl: "https://app.test/",
			html: [
				"HTML",
				{},
				["HEAD", {}, ["LINK", { rel: "stylesheet", href: "/app.css" }]],
				["BODY", {}, ["BUTTON", { onclick: "" }, label]],
			],
			viewport: { width: 800, height: 600 },
			timestamp: phase === "before" ? 1011 : 1019,
			isMainFrame: true,
			resourceOverrides: [],
		},
	});
	web?.append(snapshot("before", "Click"));
	web?.append(snapshot("after", "Clicked"));
	web?.append({ type: "after", callId: "call@1", endTime: 1020 });
	trace.close();
	return dir;
}

it("renders the DOM snapshots of an action with the stylesheets of the trace", async () => {
	const served = await serveTrace(openTrace(makeWebTrace()));
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(served.url);
		await page.getByRole("button", { name: "click", exact: true }).click();

		// The snapshot after the action is shown first.
		await expect(
			page.getByRole("button", { name: "DOM after" }),
		).toHaveAttribute("aria-pressed", "true");
		const snapshot = page.frameLocator('iframe[title="DOM snapshot"]');
		const button = snapshot.getByRole("button");
		await expect(button).toHaveText("Clicked");
		await expect(button).toHaveCSS("color", "rgb(255, 0, 0)");

		await page.getByRole("button", { name: "DOM before" }).click();
		await expect(button).toHaveText("Click");
	} finally {
		await browser.close();
		served.server.close();
	}
}, 60_000);

it("follows a trace while it is written", async () => {
	const dir = join(mkdtempSync(join(tmpdir(), "xwright-ui-")), "xwright-trace");
	const trace = new TraceDirectory(
		dir,
		{
			id: "live",
			title: "runs",
			titlePath: ["live.spec.ts", "runs"],
			file: import.meta.filename,
			line: 1,
			column: 1,
			retry: 0,
			project: "web",
		},
		{ wallTime: 0, monotonicTime: 1000 },
	);
	const test = trace.testTrack();
	test?.append({
		type: "before",
		callId: "call@1",
		startTime: 1000,
		title: "first step",
	});
	const served = await serveTrace(openTrace(dir));
	const browser = await chromium.launch(
		existsSync(executable) ? { executablePath: executable } : {},
	);
	try {
		const page = await browser.newPage();
		await page.goto(served.url);
		const actions = page.getByRole("navigation", { name: "Actions" });
		await expect(
			actions.getByRole("button", { name: "first step" }),
		).toBeVisible();
		await expect(page.getByText("running…")).toBeVisible();

		// A device added, an action of it, and a line written in two parts.
		const web = trace.deviceTrack({
			name: "web",
			adapter: "fake",
			trace: "on",
		});
		web?.append({
			type: "before",
			callId: "call@2",
			parentId: "call@1",
			startTime: 1010,
			title: "click",
		});
		await actions.getByRole("button", { name: "first step" }).click();
		await expect(actions.getByRole("button", { name: "click" })).toBeVisible();
		await expect(
			page.getByRole("region", { name: "Timeline" }).getByText("web"),
		).toBeVisible();

		test?.append({ type: "after", callId: "call@1", endTime: 1100 });
		trace.setResult({ status: "passed", duration: 0 });
		trace.setResult({ status: "passed", duration: 100 });
		await expect(page.getByText("passed · 100ms")).toBeVisible();
		await expect(page.getByText("running…")).toBeHidden();
		// The selection stays.
		await expect(
			actions.getByRole("button", { name: "first step" }),
		).toHaveAttribute("aria-current", "true");
	} finally {
		trace.close();
		await browser.close();
		served.server.close();
	}
}, 60_000);
