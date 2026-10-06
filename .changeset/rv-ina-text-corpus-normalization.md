---
"@aceshooting/lyra-ui": patch
---
Text viewers build the searchable text of a document faster for ordinary prose, and no longer rebuild it on every content change while no search query or text-quote highlight is active (it is rebuilt when the next search or highlight needs it).
