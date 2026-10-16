# Example: the web and mobile

A test that drives a browser and a phone, with projects for Android and iOS, and one for the web only. The global
setup serves the pages for the web on `http://localhost:3000` (`PORT` changes the port), and the phone opens its
Settings app.

It needs an Android emulator or an iOS simulator that [Mobilewright](https://mobilewright.dev) can find
(`npx mobilewright devices`), and the browsers of Playwright (`npx playwright install chromium`).

```sh
pnpm test                    # every project
pnpm test --project android  # Android and the web
pnpm test --project web-only # the web only; the test with the phone is skipped
```

The E2E workflow of this repository runs the `android` and `web-only` projects on an Android emulator.
