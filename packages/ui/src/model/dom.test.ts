import { describe, expect, it } from "vitest";
import { renderSnapshot, snapshotResources } from "./dom.ts";
import { type FrameSnapshot, parseTrace, type TraceMeta } from "./trace.ts";

function frame(
	html: FrameSnapshot["html"],
	overrides: Partial<FrameSnapshot> = {},
): FrameSnapshot {
	return {
		pageId: "page",
		frameId: "frame",
		frameUrl: "https://app.test/login",
		html,
		viewport: { width: 800, height: 600 },
		timestamp: 100,
		isMainFrame: true,
		resourceOverrides: [],
		...overrides,
	};
}

const none = { url: () => undefined, stylesheet: () => undefined };

/** The rendered document without the leading style and script of the renderer. */
function body(html: string): string {
	return html.slice(html.indexOf("</script>") + "</script>".length);
}

describe("renderSnapshot", () => {
	it("renders elements, text and references to earlier snapshots", () => {
		const first = frame(["HTML", {}, ["BODY", {}, ["P", {}, "a < b"], ["BR"]]]);
		// The paragraph is the second node of the first snapshot, after its text.
		const second = frame([
			"HTML",
			{},
			["BODY", {}, [[1, 1]], ["SPAN", { title: 'say "hi"' }, "new"]],
		]);
		expect(body(renderSnapshot([first, second], 1, none))).toBe(
			'<HTML><BODY><P>a &lt; b</P><SPAN title="say &quot;hi&quot;">new</SPAN></BODY></HTML>',
		);
	});

	it("leaves out scripts and event handlers", () => {
		const html = renderSnapshot(
			[
				frame([
					"BODY",
					{},
					["SCRIPT", {}, "alert(1)"],
					["IMG", { src: "x", onerror: "alert(1)" }],
				]),
			],
			0,
			none,
		);
		expect(body(html)).toBe('<BODY><IMG src="x"></BODY>');
		expect(html).not.toContain("onerror");
	});

	it("points subresources to the trace and inlines stylesheets", () => {
		const html = renderSnapshot(
			[
				frame([
					"HEAD",
					{},
					["LINK", { rel: "stylesheet", href: "/app.css" }],
					["IMG", { src: "/logo.png" }],
				]),
			],
			0,
			{
				url: (url) => (url === "/logo.png" ? "blob:logo" : undefined),
				stylesheet: (url) =>
					url === "/app.css" ? 'a::after { content: "</style>" }' : undefined,
			},
		);
		expect(body(html)).toBe(
			'<HEAD><style __playwright_style_content__="a::after { content: &quot;&lt;/style&gt;&quot; }"></style><IMG src="blob:logo"></HEAD>',
		);
	});
});

describe("snapshotResources", () => {
	it("takes the responses before the snapshot, and the overrides", async () => {
		const meta: TraceMeta = {
			version: 1,
			clock: { wallTime: 0, monotonicTime: 0 },
			devices: [
				{ name: "web", adapter: "fake", file: "web.ndjson", trace: "on" },
			],
			types: {},
		};
		const resource = (
			target: string,
			startTime: number,
			file: string,
			mimeType: string,
		) => ({
			type: "resource",
			id: target,
			resourceType: "xwright.http@1",
			target,
			startTime,
			endTime: startTime + 1,
			response: {
				payload: { status: 200, content: { _file: file, mimeType } },
			},
		});
		const trace = parseTrace(
			meta,
			[
				{
					name: "web",
					events: [
						resource(
							"https://app.test/logo.png",
							10,
							"web/resources/logo",
							"image/png",
						),
						resource(
							"https://app.test/app.css",
							20,
							"web/resources/old.css",
							"text/css",
						),
						resource(
							"https://app.test/late.png",
							200,
							"web/resources/late",
							"image/png",
						),
					],
				},
			],
			(file) => `served/${file}`,
			async (file) => `/* ${file} */`,
		);
		const snapshots = [
			frame(["HTML"], {
				resourceOverrides: [
					{ url: "https://app.test/app.css", file: "web/resources/new.css" },
				],
			}),
			frame(["HTML"], {
				resourceOverrides: [{ url: "https://app.test/app.css", ref: 1 }],
			}),
		];
		const resources = await snapshotResources(trace, snapshots, 1);
		expect(resources.url("/logo.png")).toBe("served/web/resources/logo");
		expect(resources.url("https://app.test/late.png")).toBeUndefined();
		expect(resources.stylesheet("app.css")).toBe("/* web/resources/new.css */");
	});
});
