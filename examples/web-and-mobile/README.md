# Example: the web and mobile

A test that drives a browser and a phone, with projects for Android and iOS, and one for the web only.

It needs an Android emulator or an iOS simulator that [Mobilewright](https://mobilewright.dev) can find
(`npx mobilewright devices`), and the browsers of Playwright (`npx playwright install`).

```sh
pnpm test                    # every project
pnpm test --project android  # Android and the web
pnpm test --project web-only # the web only; the test with the phone is skipped
```
