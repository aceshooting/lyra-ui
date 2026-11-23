---
'@aceshooting/lyra-ui': minor
---

Components no longer bundle the document token layer's text. Load `theme.css`, or `tokens-root.css`
(the layer alone) when a page does not use `theme.css`, with a `<link>` in `<head>` or a bundler CSS
import: the layer then costs components no JavaScript, and its script is never requested. A
code-splitting build of one standalone control is about 3.5 KB gzip smaller on its initial route;
a bundle built without code splitting still inlines the layer module.

Without either stylesheet, components still render correctly: the first registration imports the
layer as a separate module and adopts it as before, and each component holds its first render until
the layer has arrived, so nothing paints without its tokens. Later documents, iframes and
application shadow roots are filled synchronously once it has loaded. The single-script CDN build
emits the layer as its own chunk, fetched only when the page links no Lyra stylesheet.

On such a page the first render therefore finishes one module request after connection rather than
in the next microtask. Code that reads a component's shadow DOM, parts or rendered attributes must
await the component's own `updateComplete` (a test fixture's wrapper element does not wait for its
children); a page that loads the stylesheet first renders exactly as before.
