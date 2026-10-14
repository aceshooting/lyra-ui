---
'@aceshooting/lyra-ui': patch
---

Prevent visually hidden content from creating blank document scroll areas outside nested scroll containers. Keep pagination's hidden page mirror within its navigation wrapper, and anchor shared hidden text, announcement sinks and hidden utilities without changing keyboard reveal or page announcements.

Refresh affected bundle-size canaries from the rebuilt outputs to account for the shared accessibility styles, retaining zero additional headroom and unchanged measurement settings.

Schedule upgrade-feed verification explicitly after successful publication and bind it to the verified release tag, so delayed registry metadata cannot make the previous version satisfy the new release's check.
