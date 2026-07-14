---
"@aceshooting/lyra-ui": minor
---

Add `lyra-phone-input`, a form-associated country/telephone field that keeps canonical form values in E.164 while preserving partial editable input. Numbering metadata stays opt-in through an injected adapter or the consumer-loaded `loadLibphonenumberAdapter()` helper; `libphonenumber-js` is an optional peer and international E.164 input works without a formatter.
