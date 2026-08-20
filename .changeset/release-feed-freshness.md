---
"@aceshooting/lyra-ui": patch
---

The release process now fails when the published upgrade feed lags npm.

The documented upgrade workflow tells consumers — and upgrading agents — to fetch
`https://www.lyra-ui.com/changelog.json` and read every release between their installed version and
its `latest`. That feed is built from this package's `CHANGELOG.md` by the sibling website and
deployed separately, after the release, so between `npm publish` and that deploy it advertises the
*previous* release as current.

Consumers reported that window twice, from two different projects, on two consecutive releases: the
site said 11.0.0 while npm had 11.1.0, then 11.1.0 while npm had 11.2.0. It fails silently and it
inverts the workflow's own advice — a reader who trusts the feed concludes they are already current
and never reads the new release. One release skipped that way contained a fix the reader was
waiting for. Both reporters caught it only by reading the installed tarball's `CHANGELOG.md`
instead, which is what the workflow tells them they should not have to do.

`release-integrity.mjs verify-site-freshness` now checks npm's dist-tag, the published feed's
`latest`, the presence of the new version in its `releases` array (it went missing entirely once,
which defeats even a reader who ignores `latest`), and the component catalog's `catalog_version` —
which rides the same deploy and was caught a release behind at the same time. The release script
waits on it, so a stale feed is now a loud, actionable release failure rather than something a
consumer discovers weeks later.

No published component surface changes.
