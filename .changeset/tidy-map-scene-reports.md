---
"@aceshooting/lyra-ui": patch
---

Keep an installed map scene ready when its active renderer delivers a delayed status report for an older scene revision. Reject reports for future revisions as well, and recheck ownership after reading renderer-controlled report fields.

The revision and ownership checks add 15 gzip bytes to the media barrel (382,597 bytes measured). Its ceiling advances from 382,592 to the next 64-byte boundary, 382,656 bytes; all other bundle ceilings and coverage settings stay unchanged.
