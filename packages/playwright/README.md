# @xwright/playwright

The official adapter of [Xwright](https://github.com/siketyan/xwright#readme) for the web, built on Playwright.

```sh
npm install --save-dev xwright @xwright/playwright
npx playwright install chromium
```

## Usage

```ts
// xwright.config.ts
import { playwright } from "@xwright/playwright";
import { defineConfig } from "xwright";

export default defineConfig({
  projects: [
    {
      name: "web",
      devices: { web: { adapter: playwright({ baseURL: "http://localhost:3000" }), trace: "retain-on-failure" } },
    },
  ],
});
```

```ts
// a test
import type { PlaywrightHandle } from "@xwright/playwright";
import { test, use } from "xwright";

declare module "xwright" {
  interface Devices {
    web: PlaywrightHandle;
  }
}

const web = use("web");

test("signs up", async () => {
  await web.page.goto("/signup");
  await web.expect(web.page.getByRole("heading")).toHaveText("Sign up");
});
```

A browser is launched per worker, and every test gets a fresh browser context and page.

## Options

`playwright(options)` takes the options of a browser context, such as `baseURL` and `viewport`, and:

- `browserName`: `chromium` (the default), `firefox` or `webkit`.
- `launchOptions`: the options to launch the browser with.
- `isolation`: `test` (the default) for a fresh context and page per test, or `file` to share them in a file.

The handle that `use()` returns is `{ browser, context, page, expect }`.

When the device is traced, every call of Playwright's API is an action, with the logs, DOM snapshots, screenshots,
console messages and network of Playwright's trace.

## License

Licensed under the [Apache License, Version 2.0](https://github.com/siketyan/xwright/blob/main/LICENSE).
