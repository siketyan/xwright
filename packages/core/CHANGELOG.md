# @xwright/core

## 0.1.0

### Minor Changes

- [#54](https://github.com/siketyan/xwright/pull/54) [`06aa11e`](https://github.com/siketyan/xwright/commit/06aa11eab5cafcdf95964c92507f994435370bbc) Thanks [@siketyan](https://github.com/siketyan)! - Move the adapter SDK, `defineAdapter` and the types of the tracer, to `@xwright/core`. The official adapters depend on it instead of `xwright`, so that they are not released with every release of `xwright`. `xwright` still exports the same.

- [#61](https://github.com/siketyan/xwright/pull/61) [`53b1cd7`](https://github.com/siketyan/xwright/commit/53b1cd72338af27327865e6a734dc026388c929f) Thanks [@siketyan](https://github.com/siketyan)! - Add `xwright install`, which installs what the devices of the configuration need through their adapters, so that a project needs no dependency on Playwright or Mobilewright of its own: the browsers of Playwright, by the `browserName` or the `channel` of the devices, and the agent of Mobilewright on a device. The arguments after `--` go to the adapters of the devices taken by `--device` and `--project`, such as `--with-deps` or `-d <udid>`. An adapter installs with the new `install` hook of `@xwright/core`.
