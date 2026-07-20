---
"@aceshooting/lyra-ui": patch
---

`lr-thread-list` and `lr-chat-viewport` now size their virtual list to their own height.

Both composed an `lr-virtual-list` without ever setting `--lr-virtual-list-height`, so the list
scrolled inside that token's 24rem default no matter how tall the surrounding pane was -- a
`<lr-thread-list>` in a 700px sidebar showed a 384px scroller with dead space underneath, and every
consumer had to hand-set `--lr-virtual-list-height` to work around it. Both now fill the height they
are given with no consumer CSS. `lr-thread-list` degrades safely: in a container with no resolvable
height the internal viewport still renders at exactly the 24rem it does today (the shipped default
becomes the list's flex-basis rather than a percentage that would collapse to zero or grow to the
full un-virtualized content height). `lr-chat-viewport`'s virtual mode uses a percentage -- the
slotted list lives in the consumer's light DOM, out of reach of `::part()` -- so it, like slotted
mode's own scroll container, needs a height-bounded parent. A consumer rule or inline style setting
`--lr-virtual-list-height` on the list still wins in both components.

Also fixes `lr-chat-viewport`'s virtual-mode layout rules, which were written as
`:host(:has(> lr-virtual-list))`. `:has()` is invalid inside `:host()`, so those rules were silently
dropped: in virtual mode `[part="scroll"]` kept the padding and `overflow-y: auto` it is documented
to give up, and `[part="content"]` never got the height the slotted list sizes against.
