---
'@aceshooting/lyra-ui': major
---

- In `lr-node-palette`, use plain arrows to navigate and enable `reorderable` for Ctrl/Meta reorder shortcuts. Confirm a requested reorder with the next `items` assignment.
- In `lr-neighbor-list`, relationships to the same node now appear separately by relation and direction. Group rows by node ID before assignment when one result per neighbor is desired.
- Graph source navigation and embedding selection surfaces expose distinct accessible names. Use the localized records name for graph navigation and the plot or list name for embedding selection.
- Graphs, search results, embedding bins and palettes preserve browser and IME shortcuts. Palette placement fires once per keypress. If a placement listener replaces the catalog or removes the palette, the retired item no longer emits a follow-up selection.
- Neighbor rows wrap long labels and relations and support keyboard movement between the primary and expand actions. Graph source rows expose incident actions for the current row. Revealing either kind of row keeps scrolling inside its list.
- Keyboard navigation skips unavailable graph rows. Replacing the source or changing the page prevents an old graph or neighbor row from moving focus into the new results.
- Graph source search has a localized clear action and styleable search, filter and row controls. Default graph and neighbor views load pagination on demand. The knowledge graph explorer loads detail components on selection.
- Graphs bound accessible data summaries and canvas buffer allocation, position tooltips in scaled layouts and preserve paired node and edge hover events during camera or pointer movement.
- Graph and embedding renderers resolve colors in their owner document. Graph renderer failures fall back to the built-in view. The 3D graph canvas exposes keyboard controls to assistive technology.
- The knowledge graph explorer supports accent-insensitive search and a cancelable `lr-hidden-types-change-request` event for legend changes.
- Graph nodes, embedding markers and legend swatches preserve their data colors in forced-colors mode. Embedding and graph legends share scalable swatches, and embedding focus changes reuse unchanged point labels.
- Retrieval controls expose hover and selection colors. Mind maps distinguish expandable nodes, fit long labels and source diagrams, follow inherited direction and show a focus ring on keyboard focus.
- Path strips announce directed relations, mirror their arrows in RTL and leave nested scroll controls operable.
- Palette icons sit beside labels. The list scrolls inside a fixed-height palette and filter announcements resume after reconnection.
