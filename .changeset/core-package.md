---
"@xwright/core": minor
"xwright": patch
"@xwright/playwright": patch
"@xwright/mobilewright": patch
---

Move the adapter SDK, `defineAdapter` and the types of the tracer, to `@xwright/core`. The official adapters depend on it instead of `xwright`, so that they are not released with every release of `xwright`. `xwright` still exports the same.
