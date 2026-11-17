---
'@aceshooting/lyra-ui': patch
---

Stop a virtual list's pending notification sequence when a range-change or load-more listener disconnects or moves it to a new document. A removed list no longer requests more data from the retired update, and normal demand resumes after reconnect.
