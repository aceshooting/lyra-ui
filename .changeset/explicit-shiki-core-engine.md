---
'@aceshooting/lyra-ui': major
---

Use the JavaScript regex engine by default for fine-grained highlighting. Import the explicit Oniguruma factory and pass it to setShikiCoreEngine in place of the oniguruma string preset when custom grammars require its behavior. Full automatic language highlighting retains its existing engine.
