# @xwright/ui

## 0.5.0

### Minor Changes

- [#59](https://github.com/siketyan/xwright/pull/59) [`62e128e`](https://github.com/siketyan/xwright/commit/62e128e775f7d155e1de0659ccbf71c6f27b20d6) Thanks [@siketyan](https://github.com/siketyan)! - Follow the actions as they come in the list of a test running, unless the list was scrolled up. The actions under a step start collapsed, so that the steps are seen first, and the steps above an action selected on the timeline are expanded to show it.

- [#57](https://github.com/siketyan/xwright/pull/57) [`c7f4439`](https://github.com/siketyan/xwright/commit/c7f4439e323bbf4eca178d22a50f446089f0c6c4) Thanks [@siketyan](https://github.com/siketyan)! - Resize the panes of the UI by dragging the bars between them, or with the arrow keys: the list of the tests, the list of the actions and the tabs. The sizes are remembered in the browser. The list of the actions and the tabs start smaller.

### Patch Changes

- [#58](https://github.com/siketyan/xwright/pull/58) [`86d6210`](https://github.com/siketyan/xwright/commit/86d621077bead6c2fcba8cebbc0004e2a5226e3f) Thanks [@siketyan](https://github.com/siketyan)! - Show the logo of Xwright as the favicon of the UI

## 0.4.0

### Minor Changes

- [#51](https://github.com/siketyan/xwright/pull/51) [`6d8eaa0`](https://github.com/siketyan/xwright/commit/6d8eaa0ab985a84793f27d622bbd6df3bc7fc8ff) Thanks [@siketyan](https://github.com/siketyan)! - Show on the timeline the screens of each device while its actions ran, from its screencast or its screenshots, in place of the bars of the actions. The button "Screenshots" turns them back into bars, and the choice is remembered in the browser.

## 0.3.0

### Minor Changes

- [#50](https://github.com/siketyan/xwright/pull/50) [`769f907`](https://github.com/siketyan/xwright/commit/769f9075105484671ca937e2aaaf56935de67fc2) Thanks [@siketyan](https://github.com/siketyan)! - `xwright show-trace` shows all the traces at the path, or in `test-results` by default, with the list of their tests and the filters of `xwright test --ui`. A ZIP file dropped with several traces, such as an artifact of CI, is listed the same way.

## 0.2.0

### Minor Changes

- [#38](https://github.com/siketyan/xwright/pull/38) [`7adeb99`](https://github.com/siketyan/xwright/commit/7adeb990417fa4bbafb7a9ab02c05e492433b6a7) Thanks [@siketyan](https://github.com/siketyan)! - `xwright test --ui` filters the tests by words, statuses, projects and tags, and "Run filtered" runs only the tests in the list.

### Patch Changes

- [#36](https://github.com/siketyan/xwright/pull/36) [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888) Thanks [@siketyan](https://github.com/siketyan)! - Add a README to the package.

## 0.1.0

### Minor Changes

- [#27](https://github.com/siketyan/xwright/pull/27) [`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a) Thanks [@siketyan](https://github.com/siketyan)! - The first release of Xwright: drive the web, iOS and Android from a single test on Playwright Test, record what every device did on one timeline, and show the traces in the UI.
