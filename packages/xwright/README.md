# xwright

Xwright (pronounced "cross-wright") is an end-to-end testing framework that drives the web, mobile and other devices
from a single test, and records what every device did on one timeline. It runs on Playwright Test.

This package is the CLI, the runner, `use()` and `step()`, and the SDK to write adapters. Install it with the
adapters of the devices to drive:

```sh
npm install --save-dev xwright @xwright/playwright @xwright/mobilewright
```

## Usage

Declare the devices in the projects of `xwright.config.ts`, ask for them with `use()`, and drive them in a test:

```ts
import { step, test, use } from "xwright";

const web = use("web");
const phone = use("phone");

test("signs in on the phone after signing up on the web", async () => {
  await step("sign up on the web", async () => {
    await web.page.goto("/signup");
  });
  await phone.screen.getByRole("button", { name: "Sign in" }).tap();
});
```

## Commands

- `xwright test` runs the tests, with the options of `playwright test`. `--ui` runs them in the browser instead,
  with the trace of each test as it runs.
- `xwright show-trace [path]` shows a trace, its directory or a ZIP file of it, in the browser.
- `xwright export-trace [path...]` writes the traces into ZIP files, to upload from CI.

See the [README of the repository](https://github.com/siketyan/xwright#readme) for the configuration, the traces and the adapters.

## License

Licensed under the [Apache License, Version 2.0](https://github.com/siketyan/xwright/blob/main/LICENSE).
