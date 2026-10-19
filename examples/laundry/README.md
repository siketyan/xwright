# Example: a coin laundry

A coin laundry app tested across the web, a phone and a washer, which Xwright drives from a single test:

| Device | Package | Role |
| --- | --- | --- |
| `web` | [`web`](./web) (Next.js) | The dashboard of the owner, and the server the app and the washers talk to |
| `phone` | [`app`](./app) (React Native, Expo) | The app of the customer, to pay for a course and start a washer |
| `washer` | [`fake-washer`](./fake-washer) | A fake washer, connected to the server like a real one |

The washer is not a real one but an adapter written with `defineAdapter`, as an adapter of a physical device would be.
It connects to the server, takes the commands such as `start`, and reports its state. A test also acts as a person
or the machine: it opens the door, lets time pass, or breaks the washer.

```ts
await phone.screen.getByRole("button", { name: "Pay and start" }).tap();
await washer.waitForCommand("start");
await washer.advance(30); // 30 minutes pass at once
await washer.fail("E11"); // a water supply error
```

Each worker connects its own washer, `Washer 1`, `Washer 2` and so on, so tests in parallel never share one. Time
does not pass on its own, so no test waits for a cycle.

## How the parts talk

- The washer receives commands as server-sent events from `GET /api/devices/:id/commands`, and reports its state to
  `POST /api/devices/:id/status`.
- The app and the dashboard call the API of `web`, and poll it every second.
- The state is kept in memory by the server, for as long as it runs.

## Running

It needs an Android emulator or an iOS simulator that [Mobilewright](https://mobilewright.dev) can find
(`npx mobilewright devices`), and the browsers of Playwright (`pnpm exec xwright install --device web`).

```sh
pnpm build                   # build the server
pnpm build:android           # build the APK of the app, with the Android SDK
pnpm build:ios               # build the app for the iOS simulator, with Xcode
pnpm test                    # every project; the global setup starts the server on port 3000 (`PORT`)
pnpm test --project android  # the web, Android and the washer
pnpm test --project ios      # the web, iOS and the washer
pnpm test --project web-only # the web and the washer; the tests with the phone are skipped
```

The `android` project installs the APK built by `pnpm build:android`, or the one in `LAUNDRY_APP`. The app reaches the
server at `10.0.2.2:3000` on the Android emulator and at `localhost:3000` elsewhere; set `EXPO_PUBLIC_API_URL` when
building it to change that. The `ios` project expects the app on the booted simulator: install the one built by
`pnpm build:ios` with `xcrun simctl install booted app/ios/build/Build/Products/Release-iphonesimulator/Laundry.app`,
or set `LAUNDRY_APP` to an app for Mobilewright to install.

The E2E workflow of this repository builds the app and runs the `android` and `web-only` projects on an Android
emulator, and the `ios` project on an iOS simulator. It uploads the traces as the `laundry-android-traces` and
`laundry-ios-traces` artifacts.
