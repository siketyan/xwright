/**
 * Renders the DOM snapshots of Playwright into HTML.
 *
 * Ported from `packages/isomorphic/trace/snapshotRenderer.ts` of Playwright 1.63:
 *
 *   Copyright (c) Microsoft Corporation.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * Playwright serves the subresources of a snapshot from a service worker. This renders a snapshot into a document
 * for a sandboxed `srcdoc` frame instead: images point to the files of the trace, and stylesheets are inlined from
 * them. Frames and canvases inside a snapshot are not rendered.
 */

import type { FrameSnapshot, NodeSnapshot, Trace } from "./trace.ts";

type ElementSnapshot = [string, Record<string, string>?, ...NodeSnapshot[]];

function isElement(node: NodeSnapshot): node is ElementSnapshot {
	return Array.isArray(node) && typeof node[0] === "string";
}

function isReference(node: NodeSnapshot): node is [[number, number]] {
	return Array.isArray(node) && Array.isArray(node[0]);
}

const ESCAPED: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHTML(text: string): string {
	return text.replace(/[&<]/g, (char) => ESCAPED[char] ?? char);
}

function escapeHTMLAttribute(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPED[char] ?? char);
}

const AUTO_CLOSING = new Set([
	"AREA",
	"BASE",
	"BR",
	"COL",
	"COMMAND",
	"EMBED",
	"HR",
	"IMG",
	"INPUT",
	"KEYGEN",
	"LINK",
	"MENUITEM",
	"META",
	"PARAM",
	"SOURCE",
	"TRACK",
	"WBR",
]);

/** The META http-equiv directives that are safe to render; not `refresh`, `set-cookie` nor a CSP. */
const ALLOWED_META_HTTP_EQUIVS = new Set([
	"content-type",
	"content-language",
	"default-style",
	"x-ua-compatible",
]);

/** The nodes of a snapshot in the order references index them: children before their parent. */
const nodesCache = new WeakMap<FrameSnapshot, NodeSnapshot[]>();

function snapshotNodes(snapshot: FrameSnapshot): NodeSnapshot[] {
	let nodes = nodesCache.get(snapshot);
	if (nodes === undefined) {
		const list: NodeSnapshot[] = [];
		const visit = (node: NodeSnapshot) => {
			if (typeof node === "string") {
				list.push(node);
			} else if (isElement(node)) {
				const [, , ...children] = node;
				for (const child of children) {
					visit(child);
				}
				list.push(node);
			}
		};
		visit(snapshot.html);
		nodes = list;
		nodesCache.set(snapshot, nodes);
	}
	return nodes;
}

/** Rewrites the URLs a snapshot must not load as they are. */
function sanitizeURL(href: string): string {
	try {
		const url = new URL(href);
		if (url.protocol === "javascript:" || url.protocol === "vbscript:") {
			return "javascript:void(0)";
		}
	} catch {
		// A relative URL.
	}
	return href;
}

/** Where the subresources of a snapshot come from: the files of the trace. */
export interface SnapshotResources {
	/** The URL to load a subresource from, or `undefined` to leave it out. */
	url(url: string): string | undefined;
	/** The text of a stylesheet, to inline it. */
	stylesheet(url: string): string | undefined;
}

/** Renders the snapshot at the index among the snapshots of its frame into a document. */
export function renderSnapshot(
	snapshots: FrameSnapshot[],
	index: number,
	resources: SnapshotResources,
	point?: { x: number; y: number },
): string {
	const snapshot = snapshots[index];
	if (snapshot === undefined) {
		return "";
	}
	const result: string[] = [];
	const visit = (
		node: NodeSnapshot,
		snapshotIndex: number,
		parentTag: string | undefined,
		parentAttrs: [string, string][] | undefined,
	): void => {
		if (typeof node === "string") {
			result.push(escapeHTML(node));
			return;
		}
		if (isReference(node)) {
			// A node of an earlier snapshot of the frame, which did not change.
			const referenceIndex = snapshotIndex - node[0][0];
			const reference = snapshots[referenceIndex];
			if (
				referenceIndex >= 0 &&
				referenceIndex <= snapshotIndex &&
				reference !== undefined
			) {
				const nodes = snapshotNodes(reference);
				const target = nodes[node[0][1]];
				if (target !== undefined) {
					visit(target, referenceIndex, parentTag, parentAttrs);
				}
			}
			return;
		}
		if (!isElement(node)) {
			return;
		}
		const [name, nodeAttrs, ...children] = node;
		const upperName = name.toUpperCase();
		// Scripts are stripped when captured, but a crafted trace could have them.
		if (upperName === "SCRIPT") {
			return;
		}
		// <noscript> would not render with scripts enabled.
		const nodeName = upperName === "NOSCRIPT" ? "X-NOSCRIPT" : name;
		const attrs = Object.entries(nodeAttrs ?? {});

		// A stylesheet of the trace is inlined, as the frame cannot load it as a stylesheet.
		if (upperName === "LINK") {
			const rel = attrs.find(([attr]) => attr.toLowerCase() === "rel")?.[1];
			const href = attrs.find(([attr]) => attr.toLowerCase() === "href")?.[1];
			const css = href === undefined ? undefined : resources.stylesheet(href);
			if (rel?.toLowerCase() === "stylesheet" && css !== undefined) {
				// As Playwright does with styles, the script puts the text in, so that it is never parsed as HTML.
				result.push(
					'<style __playwright_style_content__="',
					escapeHTMLAttribute(css),
					'"></style>',
				);
				return;
			}
		}

		const currentSrc = "__playwright_current_src__";
		const isAnchor = upperName === "A";
		const isImg = upperName === "IMG";
		const isImgWithCurrentSrc =
			isImg && attrs.some(([attr]) => attr === currentSrc);
		const isSourceWithCurrentSrc =
			upperName === "SOURCE" &&
			parentTag === "PICTURE" &&
			parentAttrs?.some(([attr]) => attr === currentSrc);
		const hasUnsafeHttpEquiv =
			upperName === "META" &&
			attrs.some(
				([attr, value]) =>
					attr.toLowerCase() === "http-equiv" &&
					!ALLOWED_META_HTTP_EQUIVS.has(value.trim().toLowerCase()),
			);

		result.push("<", nodeName);
		for (const [attr, value] of attrs) {
			const lower = attr.toLowerCase();
			let attrName = attr;
			// Event handlers are emptied when captured, but a crafted trace could have them.
			if (lower.startsWith("on")) {
				continue;
			}
			// Frames, objects and embeds are not rendered.
			if (
				((upperName === "IFRAME" || upperName === "FRAME") &&
					(lower === "src" || lower === "srcdoc" || lower === "sandbox")) ||
				(upperName === "OBJECT" && lower === "data") ||
				(upperName === "EMBED" && lower === "src")
			) {
				attrName = `__playwright_${lower}__`;
			}
			if (isImg && attr === currentSrc) {
				// The source the image showed, rather than one srcset may pick now.
				attrName = "src";
			}
			if (
				(lower === "src" || lower === "srcset") &&
				(isImgWithCurrentSrc || isSourceWithCurrentSrc)
			) {
				attrName = `_${attrName}`;
			}
			if (
				hasUnsafeHttpEquiv &&
				(lower === "http-equiv" || lower === "content")
			) {
				attrName = `_${attr}`;
			}
			let attrValue = value;
			if (
				!isAnchor &&
				(lower === "href" || lower === "src" || attr === currentSrc)
			) {
				attrValue = sanitizeURL(value);
				if (attrName === "src" || attrName === "href") {
					attrValue = resources.url(attrValue) ?? attrValue;
				}
			}
			result.push(" ", attrName, '="', escapeHTMLAttribute(attrValue), '"');
		}
		if (upperName === "STYLE") {
			// A style has exactly one text node, which the script puts back.
			const content = typeof children[0] === "string" ? children[0] : "";
			result.push(
				' __playwright_style_content__="',
				escapeHTMLAttribute(content),
				'"></',
				nodeName,
				">",
			);
			return;
		}
		result.push(">");
		for (const child of children) {
			visit(child, snapshotIndex, nodeName, attrs);
		}
		if (!AUTO_CLOSING.has(upperName)) {
			result.push("</", nodeName, ">");
		}
	};

	visit(snapshot.html, index, undefined, undefined);
	// A doctype only has letters and digits, unless crafted.
	const doctype = snapshot.doctype?.replace(/[^a-zA-Z0-9]/g, "");
	return [
		doctype ? `<!DOCTYPE ${doctype}>` : "",
		// Hidden until the script applied the state of the elements, to avoid flickering.
		"<style>*,*::before,*::after { visibility: hidden }</style>",
		`<script>(${applySnapshotState.toString()})(${safeJSON(point ?? null)})</script>`,
		...result,
	].join("");
}

/** Serializes a value into a script, so that it cannot close the script. */
function safeJSON(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Runs in the frame of a snapshot: puts back the state Playwright recorded in attributes, such as values, scrolling
 * and shadow roots, highlights the target of the action, and marks the point of the input.
 */
function applySnapshotState(point: { x: number; y: number } | null): void {
	const scrollTops: Element[] = [];
	const scrollLefts: Element[] = [];
	const targets: Element[] = [];

	const visit = (root: Document | ShadowRoot) => {
		scrollTops.push(...root.querySelectorAll("[__playwright_scroll_top_]"));
		scrollLefts.push(...root.querySelectorAll("[__playwright_scroll_left_]"));
		for (const element of root.querySelectorAll(
			"style[__playwright_style_content__]",
		)) {
			element.textContent = element.getAttribute(
				"__playwright_style_content__",
			);
			element.removeAttribute("__playwright_style_content__");
		}
		for (const element of root.querySelectorAll("[__playwright_value_]")) {
			const input = element as HTMLInputElement;
			if (input.type !== "file") {
				input.value = input.getAttribute("__playwright_value_") ?? "";
			}
			element.removeAttribute("__playwright_value_");
		}
		for (const element of root.querySelectorAll("[__playwright_checked_]")) {
			(element as HTMLInputElement).checked =
				element.getAttribute("__playwright_checked_") === "true";
			element.removeAttribute("__playwright_checked_");
		}
		for (const element of root.querySelectorAll("[__playwright_selected_]")) {
			(element as HTMLOptionElement).selected =
				element.getAttribute("__playwright_selected_") === "true";
			element.removeAttribute("__playwright_selected_");
		}
		for (const element of root.querySelectorAll('[__playwright_target__=""]')) {
			const style = (element as HTMLElement).style;
			style.outline = "2px solid #006ab1";
			style.backgroundColor = "#6fa8dc7f";
			targets.push(element);
		}
		const body = root.querySelector("body[__playwright_custom_elements__]");
		if (body !== null && window.customElements) {
			for (const name of (
				body.getAttribute("__playwright_custom_elements__") ?? ""
			).split(",")) {
				if (name !== "" && !window.customElements.get(name)) {
					window.customElements.define(name, class extends HTMLElement {});
				}
			}
		}
		for (const element of root.querySelectorAll(
			"template[__playwright_shadow_root_]",
		)) {
			const template = element as HTMLTemplateElement;
			const shadowRoot = template.parentElement?.attachShadow({ mode: "open" });
			if (shadowRoot !== undefined) {
				shadowRoot.appendChild(template.content);
				template.remove();
				visit(shadowRoot);
			}
		}
		for (const element of root.querySelectorAll("a")) {
			element.addEventListener("click", (event) => event.preventDefault());
		}
	};

	const onLoad = () => {
		for (const element of scrollTops) {
			element.scrollTop = Number(
				element.getAttribute("__playwright_scroll_top_"),
			);
			element.removeAttribute("__playwright_scroll_top_");
		}
		for (const element of scrollLefts) {
			element.scrollLeft = Number(
				element.getAttribute("__playwright_scroll_left_"),
			);
			element.removeAttribute("__playwright_scroll_left_");
		}
		const hiding = document.styleSheets[0];
		if (hiding !== undefined) {
			hiding.disabled = true;
		}
		if (point !== null) {
			// The center of the target, as layouts can differ from the recording.
			const box = targets[0]?.getBoundingClientRect();
			const pointer = document.createElement("x-pw-pointer");
			Object.assign(pointer.style, {
				position: "fixed",
				left: `${box ? box.left + box.width / 2 : point.x}px`,
				top: `${box ? box.top + box.height / 2 : point.y}px`,
				width: "20px",
				height: "20px",
				margin: "-10px 0 0 -10px",
				borderRadius: "10px",
				backgroundColor: "#f44336",
				zIndex: "2147483646",
			});
			document.documentElement.appendChild(pointer);
		}
	};

	window.addEventListener("DOMContentLoaded", () => visit(document));
	window.addEventListener("load", onLoad);
}

/**
 * The subresources of the snapshot from the communications of the trace: the last response to each URL before the
 * snapshot, or the content the snapshot overrode it with, such as a stylesheet changed by a script.
 */
export async function snapshotResources(
	trace: Trace,
	snapshots: FrameSnapshot[],
	index: number,
): Promise<SnapshotResources> {
	const snapshot = snapshots[index];
	const files = new Map<string, string>();
	const styles = new Set<string>();
	for (const resource of trace.resources) {
		if (snapshot === undefined || resource.startTime >= snapshot.timestamp) {
			continue;
		}
		const content = (
			resource.response as
				| { content?: { _file?: string; mimeType?: string } }
				| undefined
		)?.content;
		if (content?._file !== undefined) {
			files.set(resource.target, content._file);
			if (content.mimeType?.includes("css")) {
				styles.add(resource.target);
			}
		}
	}
	for (const override of snapshot?.resourceOverrides ?? []) {
		let file = override.file;
		if (override.ref !== undefined) {
			// The same content as the override of the snapshot `ref` back.
			file = snapshots[index - override.ref]?.resourceOverrides.find(
				(o) => o.url === override.url,
			)?.file;
		}
		if (file !== undefined) {
			files.set(override.url, file);
			// Overrides are of stylesheets changed by scripts.
			styles.add(override.url);
		}
	}

	const base = snapshot?.frameUrl;
	const absolute = (url: string) => {
		try {
			return new URL(url, base).href;
		} catch {
			return url;
		}
	};
	// Stylesheets are read before rendering, so that they can be inlined.
	const stylesheets = new Map<string, string>();
	await Promise.all(
		[...styles].map(async (url) => {
			const file = files.get(url);
			const text = file === undefined ? undefined : await trace.text(file);
			if (text !== undefined) {
				stylesheets.set(url, text);
			}
		}),
	);
	return {
		url(url) {
			const file = files.get(absolute(url));
			return file === undefined ? undefined : trace.url(file);
		},
		stylesheet(url) {
			return stylesheets.get(absolute(url));
		},
	};
}
