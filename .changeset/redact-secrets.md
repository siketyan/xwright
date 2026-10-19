---
"xwright": minor
---

Keep secrets out of the traces: `redact.secrets` of the configuration and `secret()` replace passwords and tokens with `[redacted]` in every event and text resource, and the values of `Authorization`, `Cookie` and other sensitive headers are always left out.
