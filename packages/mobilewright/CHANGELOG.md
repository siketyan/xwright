# @xwright/mobilewright

## 0.2.0

### Minor Changes

- [#47](https://github.com/siketyan/xwright/pull/47) [`e1c788d`](https://github.com/siketyan/xwright/commit/e1c788dc4617a92047f5aa02def323cccb84dc56) Thanks [@siketyan](https://github.com/siketyan)! - Leave the commands of the driver out of the trace, such as reading the view hierarchy while an assertion waits, and keep only the operations of Mobilewright.

### Patch Changes

- Updated dependencies [[`769f907`](https://github.com/siketyan/xwright/commit/769f9075105484671ca937e2aaaf56935de67fc2), [`1161e5e`](https://github.com/siketyan/xwright/commit/1161e5ea3191523fd0c9440ea4b66e9fc3b973bb)]:
  - xwright@0.3.0

## 0.1.1

### Patch Changes

- [#43](https://github.com/siketyan/xwright/pull/43) [`54b4635`](https://github.com/siketyan/xwright/commit/54b4635f0d11c90b2f279828379146dfa135b264) Thanks [@siketyan](https://github.com/siketyan)! - Report the operations of Mobilewright as Playwright reports the calls of its API: the list reporter no longer prints them as steps of the test, and the HTML report shows them as actions and assertions.

- [#36](https://github.com/siketyan/xwright/pull/36) [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888) Thanks [@siketyan](https://github.com/siketyan)! - Add a README to the package.
- Updated dependencies [[`7adeb99`](https://github.com/siketyan/xwright/commit/7adeb990417fa4bbafb7a9ab02c05e492433b6a7), [`b73afcb`](https://github.com/siketyan/xwright/commit/b73afcbd9e546b67867062cc791af3735186a888), [`61157aa`](https://github.com/siketyan/xwright/commit/61157aaf4f783189f24f12105323284cbf7f5493), [`9b5eea5`](https://github.com/siketyan/xwright/commit/9b5eea5e45c661a502e718dd32621ffd31dfa4ad)]:
  - xwright@0.2.0

## 0.1.0

### Minor Changes

- [#27](https://github.com/siketyan/xwright/pull/27) [`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a) Thanks [@siketyan](https://github.com/siketyan)! - The first release of Xwright: drive the web, iOS and Android from a single test on Playwright Test, record what every device did on one timeline, and show the traces in the UI.

### Patch Changes

- Updated dependencies [[`475691b`](https://github.com/siketyan/xwright/commit/475691b2691e1cec947644958a154e0ac83bbc2a)]:
  - xwright@0.1.0
