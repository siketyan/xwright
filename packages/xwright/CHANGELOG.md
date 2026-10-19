# xwright

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
