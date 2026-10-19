---
"xwright": minor
---

Add the `tree` reporter, which prints each test with its steps as a tree when the test ends, so that the output of tests running in parallel does not interleave. On GitHub Actions, the steps of each test are in a group of the log, titled by the test with its status colored, with the errors after it.
