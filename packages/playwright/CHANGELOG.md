# @xwright/playwright

## 0.2.0

### Minor Changes

- [#60](https://github.com/siketyan/xwright/pull/60) [`addfb37`](https://github.com/siketyan/xwright/commit/addfb37dbdfc81ae0e667ecb600bfa7ec8835041) Thanks [@siketyan](https://github.com/siketyan)! - Export the types of Playwright, Mobilewright and WebdriverIO that tests use most, such as `Locator` and `Page`, so that the tests need no dependency on them of their own.

- [#61](https://github.com/siketyan/xwright/pull/61) [`53b1cd7`](https://github.com/siketyan/xwright/commit/53b1cd72338af27327865e6a734dc026388c929f) Thanks [@siketyan](https://github.com/siketyan)! - Add `xwright install`, which installs what the devices of the configuration need through their adapters, so that a project needs no dependency on Playwright or Mobilewright of its own: the browsers of Playwright, by the `browserName` or the `channel` of the devices, and the agent of Mobilewright on a device. The arguments after `--` go to the adapters of the devices taken by `--device` and `--project`, such as `--with-deps` or `-d <udid>`. An adapter installs with the new `install` hook of `@xwright/core`.

### Patch Changes

- [#54](https://github.com/siketyan/xwright/pull/54) [`06aa11e`](https://github.com/siketyan/xwright/commit/06aa11eab5cafcdf95964c92507f994435370bbc) Thanks [@siketyan](https://github.com/siketyan)! - Move the adapter SDK, `defineAdapter` and the types of the tracer, to `@xwright/core`. The official adapters depend on it instead of `xwright`, so that they are not released with every release of `xwright`. `xwright` still exports the same.

- [#45](https://github.com/siketyan/xwright/pull/45) [`c1d54d8`](https://github.com/siketyan/xwright/commit/c1d54d89b3e9f3d84bdb6507da5f201cfc78c1ae) Thanks [@siketyan](https://github.com/siketyan)! - Keep the network entry of a request finished at the end of a test in the trace.
- Updated dependencies [[`06aa11e`](https://github.com/siketyan/xwright/commit/06aa11eab5cafcdf95964c92507f994435370bbc), [`53b1cd7`](https://github.com/siketyan/xwright/commit/53b1cd72338af27327865e6a734dc026388c929f)]:
  - @xwright/core@0.1.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`9583933`](https://github.com/siketyan/xwright/commit/9583933ae0df9363d5b295d97965e574f334057c)]:
  - xwright@0.4.0

## 0.1.2

### Patch Changes

- [#46](https://github.com/siketyan/xwright/pull/46) [`316c41f`](https://github.com/siketyan/xwright/commit/316c41f231a15590e839532add67d7505fecd5cf) Thanks [@siketyan](https://github.com/siketyan)! - Keep the network entry of a request finished at the end of a test in the trace.
- Updated dependencies [[`769f907`](https://github.com/siketyan/xwright/commit/769f9075105484671ca937e2aaaf56935de67fc2), [`1161e5e`](https://github.com/siketyan/xwright/commit/1161e5ea3191523fd0c9440ea4b66e9fc3b973bb)]:
  - xwright@0.3.0

## 0.1.1

### Patch Changes

- [#36](https://github.com/siketyan/xwright/pull/36) [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888) Thanks [@siketyan](https://github.com/siketyan)! - Add a README to the package.
- Updated dependencies [[`7adeb99`](https://github.com/siketyan/xwright/commit/7adeb990417fa4bbafb7a9ab02c05e492433b6a7), [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888), [`61157aa`](https://github.com/siketyan/xwright/commit/61157aaf4f783189f24f12105323284cbf7f5493), [`9b5eea5`](https://github.com/siketyan/xwright/commit/9b5eea5e45c661a502e718dd32621ffd31dfa4ad)]:
  - xwright@0.2.0

## 0.1.0

### Minor Changes

- [#27](https://github.com/siketyan/xwright/pull/27) [`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a) Thanks [@siketyan](https://github.com/siketyan)! - The first release of Xwright: drive the web, iOS and Android from a single test on Playwright Test, record what every device did on one timeline, and show the traces in the UI.

### Patch Changes

- Updated dependencies [[`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a)]:
  - xwright@0.1.0
