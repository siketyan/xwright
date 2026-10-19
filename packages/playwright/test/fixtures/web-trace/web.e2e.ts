import type { PlaywrightHandle } from "@xwright/playwright";
import { secret, step, test, use } from "xwright";

declare module "xwright" {
	interface Devices {
		web: PlaywrightHandle;
	}
}

const web = use("web");

test("clicks a button", async () => {
	await web.page.route("https://xwright.test/", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<button onclick=\"console.log('clicked'); this.textContent = 'Clicked'\">Click</button>",
		}),
	);
	await step("open the page", async () => {
		await web.page.goto("https://xwright.test/");
	});
	await web.page.getByRole("button").click();
	await web.expect(web.page.getByRole("button")).toHaveText("Clicked");
});

test("keeps the secrets out of the trace", async () => {
	await web.page.route("https://xwright.test/login", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: `<input type="password" id="password">
<button onclick="fetch('/api', { method: 'POST', headers: { Authorization: 'Bearer ' + password.value, 'X-Api-Key': 'api-key-1234' }, body: password.value }).then((response) => response.text()).then((token) => { document.title = token; console.log(token); })">Sign in</button>`,
		}),
	);
	// A token known only during the test.
	const token = secret(`token-${Date.now()}`);
	await web.page.route("https://xwright.test/api", (route) =>
		route.fulfill({ contentType: "text/plain", body: token }),
	);
	await web.page.goto("https://xwright.test/login");
	await web.page.fill("#password", "correct horse battery staple");
	console.log("signing in with correct horse battery staple");
	// The request is finished, with its entry of the network, before the test ends.
	const finished = web.page.waitForEvent("requestfinished", (request) =>
		request.url().endsWith("/api"),
	);
	await web.page.getByRole("button").click();
	await finished;
	await web.expect(web.page).toHaveTitle(token);
	console.log(`TOKEN_LENGTH=${token.length}`);
});
