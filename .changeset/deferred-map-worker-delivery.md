---
'@aceshooting/lyra-map': patch
---

Keep an unused modular renderer import free of worker asset warnings. The Vite plugin supplies the actual worker URL only for configured map consumers; constructing a map without worker setup still reports the configuration error.
