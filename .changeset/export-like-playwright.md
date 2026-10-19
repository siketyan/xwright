---
"xwright": minor
---

`xwright export-trace` deletes the directory of each trace after writing its ZIP file, so that each trace is in one ZIP file, as Playwright's `trace.zip`. A ZIP file of the output directory of the tests no longer has each trace twice. `xwright show-trace` without a path also finds the exported traces in `test-results`.
