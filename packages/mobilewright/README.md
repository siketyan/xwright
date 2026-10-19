# @xwright/mobilewright

The official adapter of [Xwright](https://github.com/siketyan/xwright#readme) for iOS and Android, built on
[Mobilewright](https://mobilewright.dev).

```sh
npm install --save-dev xwright @xwright/mobilewright
```

`xwright install` installs the agent of Mobilewright on a device, with the Mobilewright the adapter pins. Arguments
after `--` go to `mobilewright install`, such as the ID of the device:

```sh
npx xwright install --device phone -- -d <udid>
```

## Usage

```ts
// xwright.config.ts
import { mobilewright } from "@xwright/mobilewright";
import { defineConfig } from "xwright";

export default defineConfig({
  projects: [
    {
      name: "android",
      devices: {
        phone: {
          adapter: mobilewright({ platform: "android", bundleId: "com.example.app", installApps: "app.apk" }),
          trace: "retain-on-failure",
        },
      },
    },
  ],
});
```

```ts
// a test
import type { MobilewrightHandle } from "@xwright/mobilewright";
import { test, use } from "xwright";

declare module "xwright" {
  interface Devices {
    phone: MobilewrightHandle;
  }
}

const phone = use("phone");

test("signs in", async () => {
  await phone.screen.getByRole("button", { name: "Sign in" }).tap();
  await phone.expect(phone.screen.getByText("Welcome")).toBeVisible();
});
```

A device is borrowed from Mobilewright's device pool for each file, the apps of `installApps` are installed once per
device, and the app of `bundleId` is relaunched before each test.

## Options

`mobilewright(options)` takes the options of Mobilewright, such as `platform`, `deviceName`, `osVersion`,
`bundleId`, `installApps`, `driver` and the timeouts, and:

- `screenshots`: when to take a screenshot around each operation when traced. Defaults to `["after"]`.
- `viewTree`: `on-failure` (the default) to record the view hierarchy when a test failed, or `off`.

The handle that `use()` returns is `{ device, screen, expect }`.

The types of Mobilewright that tests use most are exported too, so that the tests need no dependency on Mobilewright
of their own: `Device`, `Screen`, `Locator`, `Role`, `Dialog`, and `Page`, `WebLocator`, `MobileWebViewPage` and
`MobileWebViewLocator` of web views.

```ts
import type { Locator, Screen } from "@xwright/mobilewright";
```

When the device is traced, each operation such as a tap is an action, with a screenshot after it. The commands the
driver sends for an operation, such as reading the view hierarchy while an assertion waits, are left out.

## License

Licensed under the [Apache License, Version 2.0](https://github.com/siketyan/xwright/blob/main/LICENSE).
