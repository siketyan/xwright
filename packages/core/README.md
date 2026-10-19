# @xwright/core

The SDK to write adapters of [Xwright](https://github.com/siketyan/xwright#readme): `defineAdapter` and the types of
the adapters and of the tracer that records what a device does.

```sh
npm install @xwright/core
```

An adapter depends on this package instead of `xwright`, so that it does not need a release for every release of
`xwright`. `xwright` exports the same, for an adapter written next to the tests.

```ts
import { defineAdapter } from "@xwright/core";

export const band = defineAdapter<{ address: string }, BandHandle>({
  name: "my-band",
  create: ({ options, trace }) => new BandHandle(options.address, trace),
  beforeEach: (band) => band.reset(),
  dispose: (band) => band.close(),
});
```

See the [README of the repository](https://github.com/siketyan/xwright#adapters) for the hooks and the tracer.

## License

Licensed under the [Apache License, Version 2.0](https://github.com/siketyan/xwright/blob/main/LICENSE).
