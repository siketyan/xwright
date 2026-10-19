import { afterEach, describe, expect, it } from "vitest";
import {
	configureRedaction,
	REDACTED,
	redactContent,
	redactText,
	redactValue,
	resetRedaction,
	secret,
} from "./redact.js";

afterEach(() => resetRedaction());

describe("redactText", () => {
	it("replaces the secrets as they are, as in a URL and as in JSON", () => {
		configureRedaction({ secrets: ['p@ss "word"', undefined, ""] });
		expect(redactText('login p@ss "word"')).toBe(`login ${REDACTED}`);
		expect(redactText("password=p%40ss%20%22word%22")).toBe(
			`password=${REDACTED}`,
		);
		expect(redactText(JSON.stringify({ password: 'p@ss "word"' }))).toBe(
			`{"password":"${REDACTED}"}`,
		);
	});

	it("replaces a secret inside another as the longer one", () => {
		configureRedaction({ secrets: ["abc", "abcdef"] });
		expect(redactText("xabcdefx abc")).toBe(`x${REDACTED}x ${REDACTED}`);
	});

	it("takes the secrets added during a test", () => {
		expect(secret("token-1")).toBe("token-1");
		expect(redactText("Bearer token-1")).toBe(`Bearer ${REDACTED}`);
	});
});

describe("redactValue", () => {
	it("replaces the secrets in the strings, and the sensitive headers", () => {
		configureRedaction({ secrets: ["hunter2"], headers: ["X-Api-Key"] });
		expect(
			redactValue({
				params: { value: "hunter2", count: 1, nested: ["a hunter2"] },
				headers: [
					{ name: "Authorization", value: "Basic dXNlcjpwYXNz" },
					{ name: "x-api-key", value: "k" },
					{ name: "Accept", value: "*/*" },
				],
				extra: { Cookie: "session=1", Host: "a" },
			}),
		).toEqual({
			params: { value: REDACTED, count: 1, nested: [`a ${REDACTED}`] },
			headers: [
				{ name: "Authorization", value: REDACTED },
				{ name: "x-api-key", value: REDACTED },
				{ name: "Accept", value: "*/*" },
			],
			extra: { Cookie: REDACTED, Host: "a" },
		});
	});
});

describe("redactContent", () => {
	it("replaces the secrets in text, and leaves binary content", () => {
		configureRedaction({ secrets: ["hunter2"] });
		const text = new TextEncoder().encode("password=hunter2");
		expect(new TextDecoder().decode(redactContent(text))).toBe(
			`password=${REDACTED}`,
		);
		const binary = new Uint8Array([0x89, 0x50, 0x00, ...text]);
		expect(redactContent(binary)).toBe(binary);
	});
});
