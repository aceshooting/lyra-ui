---
"@aceshooting/lyra-ui": minor
---

Add an optional More menu to horizontal tab groups. Trailing tabs move into the menu when space runs out, and More shows the selected state when it represents the active tab.

Let video players use the clip's aspect ratio and fit inside a height-bounded stage. `lr-video.play()` and mounted `lr-av-player.play()` and `toggle()` apply a pending source assignment before acting, so a clip can be switched and played in the same task.

These additions increase the minified, gzip-compressed all-components build by 3,466 bytes. The layout family grows by 2,597 bytes for tab measurement and accessible overflow navigation. The media family grows by 673 bytes for player sizing and source synchronization. A granular tab-group import loads the popup positioning code when the menu first opens.

The translated More label brings the unpacked translations package to 9,123,513 bytes. The IDE package with the new attributes and styling parts measures 1,978,341 bytes packed.

