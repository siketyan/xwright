# @xwright/appium

The official adapter of [Xwright](https://github.com/siketyan/xwright#readme) for [Appium](https://appium.io), which
drives iOS, Android and other devices through [WebdriverIO](https://webdriver.io).

```sh
npm install --save-dev xwright @xwright/appium
```

Start an Appium server with the drivers of your devices, such as `appium driver install uiautomator2`, then `appium`.

## Usage

```ts
// xwright.config.ts
import { appium } from "@xwright/appium";
import { defineConfig } from "xwright";

export default defineConfig({
  projects: [
    {
      name: "android",
      devices: {
        phone: {
          adapter: appium({
            capabilities: {
              platformName: "Android",
              "appium:automationName": "UiAutomator2",
              "appium:app": "app.apk",
            },
            appId: "com.example.app",
          }),
          trace: "retain-on-failure",
        },
      },
    },
  ],
});
```

```ts
// a test
import type { AppiumHandle } from "@xwright/appium";
import { test, use } from "xwright";

declare module "xwright" {
  interface Devices {
    phone: AppiumHandle;
  }
}

const phone = use("phone");

test("signs in", async () => {
  await phone.driver.$("~Sign in").click();
  await phone.expect(phone.driver.$("~Welcome")).toBeDisplayed();
});
```

A session is created per worker, and the app of `appId` is launched again before each test. To give each worker its
own device, make the options for each worker:

```ts
adapter: appium(({ parallelIndex }) => ({
  capabilities: { platformName: "Android", "appium:udid": udids[parallelIndex] },
})),
```

## Options

- `url`: the URL of the Appium server. Defaults to `http://127.0.0.1:4723`.
- `capabilities`: the capabilities of the session.
- `appId`: the app to launch again before each test, the package on Android or the bundle ID on iOS.
  `autoAppLaunch: false` turns it off.
- `screenshots`: whether to take a screenshot after each command that changes the screen when traced. Defaults to
  `true`.
- `pageSource`: `on-failure` (the default) to record the source of the page when a test failed, or `off`.
- `remoteOptions`: other options of the session of WebdriverIO, such as `waitforTimeout`.

The handle that `use()` returns is `{ driver, expect }`: the session of WebdriverIO, and its `expect`.

When the device is traced, every command sent to the Appium server is an action, under the step of the test that sent
it, with a screenshot after the ones that change the screen.

## License

Licensed under the [Apache License, Version 2.0](https://github.com/siketyan/xwright/blob/main/LICENSE).
