/** What replaces a secret in the traces. */
export const REDACTED = "[redacted]";

/** What is kept out of the traces. */
export interface RedactOptions {
	/**
	 * Values written nowhere in the traces, such as passwords and tokens, e.g. `process.env.PASSWORD`. An undefined
	 * or empty value is skipped. Values known only during a test can be added with `secret()`.
	 */
	secrets?: (string | undefined)[];
	/**
	 * The names of HTTP headers whose values are left out, besides `authorization`, `proxy-authorization`, `cookie`
	 * and `set-cookie`. Case-insensitive.
	 */
	headers?: string[];
}

const DEFAULT_HEADERS = [
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
];

const secrets = new Set<string>();
const headers = new Set(DEFAULT_HEADERS);
/** The forms of the secrets to replace, the longest first so that a secret inside another is not replaced first. */
let patterns: string[] = [];

function update(): void {
	const forms = new Set<string>();
	for (const value of secrets) {
		forms.add(value);
		// As in a URL or a form, and as in a JSON string.
		forms.add(encodeURIComponent(value));
		forms.add(JSON.stringify(value).slice(1, -1));
	}
	patterns = [...forms].sort((a, b) => b.length - a.length);
}

/** Sets what is kept out of the traces of this process, from the configuration. */
export function configureRedaction(options: RedactOptions = {}): void {
	for (const value of options.secrets ?? []) {
		if (value) {
			secrets.add(value);
		}
	}
	for (const name of options.headers ?? []) {
		headers.add(name.toLowerCase());
	}
	update();
}

/**
 * Keeps the value out of the traces from now on, and returns it: `await page.fill("#token", secret(token))`.
 * For values known only during a test; the ones known before go in `redact.secrets` of the configuration.
 */
export function secret<T extends string>(value: T): T {
	if (value && !secrets.has(value)) {
		secrets.add(value);
		update();
	}
	return value;
}

/** Replaces the secrets in the text. */
export function redactText(text: string): string {
	let result = text;
	for (const pattern of patterns) {
		if (result.includes(pattern)) {
			result = result.replaceAll(pattern, REDACTED);
		}
	}
	return result;
}

function isHeader(name: unknown): boolean {
	return typeof name === "string" && headers.has(name.toLowerCase());
}

/**
 * Replaces the secrets in the strings of the value, and the values of the sensitive headers, either as a property or
 * as `{ name, value }` as in HAR.
 */
export function redactValue(value: unknown): unknown {
	if (typeof value === "string") {
		return redactText(value);
	}
	if (Array.isArray(value)) {
		return value.map(redactValue);
	}
	if (
		value === null ||
		typeof value !== "object" ||
		ArrayBuffer.isView(value)
	) {
		return value;
	}
	const record = value as Record<string, unknown>;
	const pair = isHeader(record.name) && "value" in record;
	return Object.fromEntries(
		Object.entries(record).map(([key, item]) => [
			key,
			(pair && key === "value") || isHeader(key) ? REDACTED : redactValue(item),
		]),
	);
}

/**
 * Replaces the secrets in the content of a file when it is text, which is valid UTF-8 without NUL. Returns the
 * content as is when it is binary, such as an image, or when nothing was replaced.
 */
export function redactContent(data: Uint8Array): Uint8Array {
	if (patterns.length === 0 || data.includes(0)) {
		return data;
	}
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true }).decode(data);
	} catch {
		return data;
	}
	const redacted = redactText(text);
	return redacted === text ? data : new TextEncoder().encode(redacted);
}

/** @internal Forgets the secrets and the headers, for tests. */
export function resetRedaction(): void {
	secrets.clear();
	headers.clear();
	for (const name of DEFAULT_HEADERS) {
		headers.add(name);
	}
	update();
}
