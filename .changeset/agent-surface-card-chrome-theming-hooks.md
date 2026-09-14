---
"@aceshooting/lyra-ui": minor
---

Give every framed agent-surface component the card-chrome theming hooks its density knobs already
implied, so retuning a nested card no longer needs a `::part(base)` override. Each hook is an
inline `var()` fallback at its point of use, so an unset component paints exactly as before, and
any of them can be set on the element itself or on an ancestor transcript:

- `<lr-activity-feed>`: `--lr-activity-feed-background`, `--lr-activity-feed-border-color`,
  `--lr-activity-feed-radius`. The border-colour hook also covers the header/body divider that
  `frame="plain"` keeps, so a retuned card no longer strands a mismatched rule inside itself.
- `<lr-agent-run>`, `<lr-result-card>`, `<lr-stack-trace>`, `<lr-task-list>`,
  `<lr-thinking-panel>`: `--lr-<tag>-background`, `--lr-<tag>-border-color` and `--lr-<tag>-radius`
  on `[part="base"]`, with the border colour reaching each component's own interior divider
  (`lr-result-card`'s header rule, `lr-task-list`'s and `lr-thinking-panel`'s header/body rule).
- `<lr-commit-card>`: `--lr-commit-card-border-color` and `--lr-commit-card-radius`, plus
  `--lr-commit-card-background`, which defaults to `transparent` — this card has never painted a
  fill of its own, so it still takes the surface it sits on unless a consumer opts in.
- `<lr-terminal>`: `--lr-terminal-border-color` and `--lr-terminal-radius` join the pre-existing
  `--lr-terminal-surface-color` fill, the border colour also covering the toolbar/log divider.
  `--lr-terminal-surface-color` keeps its name; nothing is renamed or deprecated.
- `<lr-subagent-panel>`: `--lr-subagent-panel-background`, `--lr-subagent-panel-hover-background`,
  `--lr-subagent-panel-border-color` and `--lr-subagent-panel-radius` for each run row's border,
  radius, resting and hovered fill, and action divider. Hover is a separate hook because a panel
  retuned to a dark resting fill would otherwise flash the stock raised surface under the pointer;
  the pressed fill mixes from the hover hook, so retuning hover carries the press with it. A
  selected row still takes its border from `--lr-subagent-panel-selected-border`.
- `<lr-chat-composer>`: `--lr-chat-composer-background`, `--lr-chat-composer-border-color` and
  `--lr-chat-composer-radius`, so a composer docked into a themed panel can match it. The
  `:focus-within` border keeps its brand colour — that is state paint, not card chrome.

`frame="plain"` still removes the outer border, radius and fill on every one of these components,
so the hooks tune the card presentation rather than reinstating chrome a consumer asked to drop.
`<lr-commit-card>`'s plain rule now clears the fill as well: with no fill of its own it never had
one to clear, and without that line the new background hook would have been the one way to get a
filled "plain" card. Unset, every component paints exactly as before.
