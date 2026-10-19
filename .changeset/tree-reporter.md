---
"xwright": minor
---

Add the `tree` reporter, which prints each test with its steps as a tree when the test ends, so that the output of tests running in parallel does not interleave. On GitHub Actions, the steps of each test are in a group of the log, with the errors after it, and the statuses are colored.
