# xwright

## 0.5.0

### Minor Changes

- [#56](https://github.com/siketyan/xwright/pull/56) [`90b4957`](https://github.com/siketyan/xwright/commit/90b49572eb6ea665542accf0bb3a259e02ba2d8a) Thanks [@siketyan](https://github.com/siketyan)! - `xwright export-trace` deletes the directory of each trace after writing its ZIP file, so that each trace is in one ZIP file, as Playwright's `trace.zip`. A ZIP file of the output directory of the tests no longer has each trace twice. `xwright show-trace` without a path also finds the exported traces in `test-results`.

- [#62](https://github.com/siketyan/xwright/pull/62) [`5fc1a1c`](https://github.com/siketyan/xwright/commit/5fc1a1c5928aa8f6b3b46d0eb4fd98dafacdf353) Thanks [@siketyan](https://github.com/siketyan)! - The `tree` reporter shows only the steps of `step()` by default, with the calls and assertions under them only when they failed; `["tree", { showActions: true }]` shows all of them

- [#61](https://github.com/siketyan/xwright/pull/61) [`53b1cd7`](https://github.com/siketyan/xwright/commit/53b1cd72338af27327865e6a734dc026388c929f) Thanks [@siketyan](https://github.com/siketyan)! - Add `xwright install`, which installs what the devices of the configuration need through their adapters, so that a project needs no dependency on Playwright or Mobilewright of its own: the browsers of Playwright, by the `browserName` or the `channel` of the devices, and the agent of Mobilewright on a device. The arguments after `--` go to the adapters of the devices taken by `--device` and `--project`, such as `--with-deps` or `-d <udid>`. An adapter installs with the new `install` hook of `@xwright/core`.

### Patch Changes

- [#54](https://github.com/siketyan/xwright/pull/54) [`06aa11e`](https://github.com/siketyan/xwright/commit/06aa11eab5cafcdf95964c92507f994435370bbc) Thanks [@siketyan](https://github.com/siketyan)! - Move the adapter SDK, `defineAdapter` and the types of the tracer, to `@xwright/core`. The official adapters depend on it instead of `xwright`, so that they are not released with every release of `xwright`. `xwright` still exports the same.
- Updated dependencies [[`62e128e`](https://github.com/siketyan/xwright/commit/62e128e775f7d155e1de0659ccbf71c6f27b20d6), [`06aa11e`](https://github.com/siketyan/xwright/commit/06aa11eab5cafcdf95964c92507f994435370bbc), [`c7f4439`](https://github.com/siketyan/xwright/commit/c7f4439e323bbf4eca178d22a50f446089f0c6c4), [`86d6210`](https://github.com/siketyan/xwright/commit/86d621077bead6c2fcba8cebbc0004e2a5226e3f), [`53b1cd7`](https://github.com/siketyan/xwright/commit/53b1cd72338af27327865e6a734dc026388c929f)]:
  - @xwright/ui@0.5.0
  - @xwright/core@0.1.0

## 0.4.0

### Minor Changes

- [#53](https://github.com/siketyan/xwright/pull/53) [`9583933`](https://github.com/siketyan/xwright/commit/9583933ae0df9363d5b295d97965e574f334057c) Thanks [@siketyan](https://github.com/siketyan)! - Add the `tree` reporter, which prints each test with its steps as a tree when the test ends, so that the output of tests running in parallel does not interleave. On GitHub Actions, the steps of each test are in a group of the log, titled by the test with its status colored, with the errors after it.

### Patch Changes

- Updated dependencies [[`6d8eaa0`](https://github.com/siketyan/xwright/commit/6d8eaa0ab985a84793f27d622bbd6df3bc7fc8ff)]:
  - @xwright/ui@0.4.0

## 0.3.0

### Minor Changes

- [#50](https://github.com/siketyan/xwright/pull/50) [`769f907`](https://github.com/siketyan/xwright/commit/769f9075105484671ca937e2aaaf56935de67fc2) Thanks [@siketyan](https://github.com/siketyan)! - `xwright show-trace` shows all the traces at the path, or in `test-results` by default, with the list of their tests and the filters of `xwright test --ui`. A ZIP file dropped with several traces, such as an artifact of CI, is listed the same way.

### Patch Changes

- [#49](https://github.com/siketyan/xwright/pull/49) [`1161e5e`](https://github.com/siketyan/xwright/commit/1161e5ea3191523fd0c9440ea4b66e9fc3b973bb) Thanks [@siketyan](https://github.com/siketyan)! - Keep the trace of a test that failed in `beforeAll`, which `xwright test --ui` showed as having no trace.
- Updated dependencies [[`769f907`](https://github.com/siketyan/xwright/commit/769f9075105484671ca937e2aaaf56935de67fc2)]:
  - @xwright/ui@0.3.0

## 0.2.0

### Minor Changes

- [#38](https://github.com/siketyan/xwright/pull/38) [`7adeb99`](https://github.com/siketyan/xwright/commit/7adeb990417fa4bbafb7a9ab02c05e492433b6a7) Thanks [@siketyan](https://github.com/siketyan)! - `xwright test --ui` filters the tests by words, statuses, projects and tags, and "Run filtered" runs only the tests in the list.

- [#42](https://github.com/siketyan/xwright/pull/42) [`61157aa`](https://github.com/siketyan/xwright/commit/61157aaf4f783189f24f12105323284cbf7f5493) Thanks [@siketyan](https://github.com/siketyan)! - Keep secrets out of the traces: `redact.secrets` of the configuration and `secret()` replace passwords and tokens with `[redacted]` in every event and text resource, and the values of `Authorization`, `Cookie` and other sensitive headers are always left out.

- [#44](https://github.com/siketyan/xwright/pull/44) [`9b5eea5`](https://github.com/siketyan/xwright/commit/9b5eea5e45c661a502e718dd32621ffd31dfa4ad) Thanks [@siketyan](https://github.com/siketyan)! - The options of an adapter can be a function of the worker, `({ parallelIndex, workerIndex }) => options`, to give every worker its own account or port.

### Patch Changes

- [#36](https://github.com/siketyan/xwright/pull/36) [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888) Thanks [@siketyan](https://github.com/siketyan)! - Add a README to the package.
- Updated dependencies [[`7adeb99`](https://github.com/siketyan/xwright/commit/7adeb990417fa4bbafb7a9ab02c05e492433b6a7), [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888)]:
  - @xwright/ui@0.2.0

## 0.1.0

### Minor Changes

- [#27](https://github.com/siketyan/xwright/pull/27) [`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a) Thanks [@siketyan](https://github.com/siketyan)! - The first release of Xwright: drive the web, iOS and Android from a single test on Playwright Test, record what every device did on one timeline, and show the traces in the UI.

### Patch Changes

- Updated dependencies [[`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a)]:
  - @xwright/ui@0.1.0
