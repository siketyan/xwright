---
"@xwright/core": minor
"xwright": minor
"@xwright/playwright": minor
"@xwright/mobilewright": minor
---

Add `xwright install`, which installs what the devices of the configuration need through their adapters, so that a project needs no dependency on Playwright or Mobilewright of its own: the browsers of Playwright, by the `browserName` or the `channel` of the devices, and the agent of Mobilewright on a device. The arguments after `--` go to the adapters of the devices taken by `--device` and `--project`, such as `--with-deps` or `-d <udid>`. An adapter installs with the new `install` hook of `@xwright/core`.
