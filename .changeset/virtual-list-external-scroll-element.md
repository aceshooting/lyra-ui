---
'@aceshooting/lyra-ui': minor
---

`lr-virtual-list` can virtualize against an external scroll container.

The new `scrollElement?: Element | Window` property points the whole windowing loop at an ancestor
that already owns a scrollbar — or at the window itself — for a list embedded in a longer scrolling
page rather than sized as its own panel. Previously the only scrollport was the component's own
`[part="base"]`, so such a page ended up with a nested second scrollbar, and the only escape was to
give the list an artificially huge `--lr-virtual-list-height` and lose virtualization entirely.

While `scrollElement` is set, `[part="base"]` stops scrolling and grows to the list's full virtual
extent, so the page's single scrollbar spans the whole list and `[part="sticky-group"]` sticks to
that outer scrollport. Everything expressed in list coordinates keeps answering in list coordinates —
`offsetForIndex()`, `indexAtOffset()`, `scrollToIndex()`, `active-item-id` scroll-into-view, and
`lr-virtual-scroll`'s `scrollTop` are all still measured from the top of the list, with the component
converting to and from the external scroller's position. Auto-height scroll anchoring moves the
external scroller too, so measuring a row above the viewport no longer makes the page jump.

There is deliberately no ancestor auto-detection: the scroller is the element you name and nothing
else, so adding an unrelated `overflow` rule to some wrapper can never silently take the job over.
Two consequences are worth knowing. `[part="base"]` drops its `tabindex` and its hover outline,
because it is no longer a scrollable region and a focus stop that scrolls nothing is worse than none;
keyboard scrolling belongs to the external scroller. And horizontal scrolling of row content that
opted out of wrapping becomes the external scroller's responsibility, since CSS cannot leave one axis
visible while the other scrolls.

Two things stay the consumer's own: while `renderStickyGroup` is set, mirror
`scroll-padding-block-start` onto the external scroller, because this component writes that inset on
`[part="base"]`, where it no longer has any effect, and will not style an element it does not own
(programmatic scrolling already subtracts the band arithmetically; native keyboard scrolling is what
would otherwise park a row under it). And the list's position inside the scroller is re-read on
scroll, on either box resizing, and whenever `scrollElement` changes — a layout change *above* the
list that shifts it without any of those is not observable, so clear and re-set the property
(`el.scrollElement = undefined; el.scrollElement = scroller`) to force a re-read.

Listeners follow the property: re-pointing `scrollElement`, disconnecting, and reconnecting all
rebind against the current target and leave nothing behind on the previous one. A value that is
neither an `Element` nor a `Window` is ignored and the list keeps scrolling its own viewport, so
wiring this from a ref that is still empty on a first render is safe. Leaving `scrollElement` unset
is unchanged in every respect.
