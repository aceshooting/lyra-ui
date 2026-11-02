---
'@aceshooting/lyra-ui': minor
---

`lr-markdown` and `lr-markdown-core` gain a `without-images` attribute (`withoutImages` property) for untrusted content such as streamed language-model answers. In every `html-mode`, each Markdown image renders as its alt text, as a refused URL does, and the finished HTML is enforced too: raw-HTML `<img>` and `<input type="image">` become their alt text, `<picture>` sources and SVG `<image>`/`<feImage>` are removed, and `<video>` loses its `poster`, so rendering never loads an image element. In `sanitize` mode it also removes authored `<style>` elements. `lr-streaming-text` and `lr-streaming-text-core` forward it. The default is unchanged.
