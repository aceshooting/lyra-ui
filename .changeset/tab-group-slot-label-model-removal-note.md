---
"@aceshooting/lyra-ui": patch
---

Document `<lr-tab-group>`'s removed `slot`/`label` child model, a 9.0.0 breaking change that shipped
without a changelog entry.

9.0.0 removed the pre-9.0 attribute child model, in which a direct `<div slot="x" label="…">` child
became a tab captioned by its `label` with its own content as the panel, and a sibling
`slot="x-icon"` child supplied that tab's leading icon. `<lr-tab-group>` now builds its tab list
only from `<lr-tab panel="x">` descriptors paired with `<lr-tab-panel name="x">` panels; any other
child element is skipped regardless of its `slot`/`label` attributes, so markup still written in the
old shape renders an empty tab strip with no console warning.

The removal itself is unchanged and intentional — this entry only records it, because the 9.0.0 notes
omitted it while `README.md` continued to state that the `slot`/`label` shape "still works
unchanged". Both README claims are corrected (the 7.x → 8.0.0 rename table and the component/mirror
table), which also clears the same stale claim from three generated `llms/migration.md` rows
(`<wa-tab>`, `<wa-tab-panel>`, `<sl-tab-panel>`) and the packaged skill reference. `llms/layout.md`
already described the removal correctly and is unchanged.

To migrate, rewrite each former child as one descriptor plus one panel, folding any former
`slot="x-icon"` sibling's content into the `<lr-tab>`'s own default slot:

```html
<!-- removed in 9.0.0 -->
<lr-tab-group>
  <div slot="general" label="General">General settings</div>
</lr-tab-group>

<!-- 9.0.0 and later -->
<lr-tab-group>
  <lr-tab panel="general">General</lr-tab>
  <lr-tab-panel name="general">General settings</lr-tab-panel>
</lr-tab-group>
```

A regression test now asserts a plain `slot`/`label` child produces no tab and no rendered panel, so
the behavior cannot drift back into being documented as supported.
