# Xwright

Xwright (pronounced "cross-wright") is an end-to-end testing framework that drives the web, mobile and other devices
from a single test, and records what every device did on one timeline.

It runs on Playwright Test, uses Playwright for the web and Mobilewright for mobile, and lets you add any other device
through adapters.

> [!WARNING]
> Xwright is in early development and not usable yet.

## Packages

| Package | Description |
| --- | --- |
| [`xwright`](./packages/xwright) | The CLI, the runner, `use()` and `step()`, and the adapter SDK |
| [`@xwright/playwright`](./packages/playwright) | The official adapter for the web, built on Playwright |
| [`@xwright/mobilewright`](./packages/mobilewright) | The official adapter for iOS and Android, built on Mobilewright |

## Development

```sh
pnpm install
pnpm build
pnpm check
pnpm test
```

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
