---
"@aceshooting/lyra-gen": minor
---

New opt-in `mcp-app` role embeds a sandboxed MCP App through `lr-mcp-app`. The host supplies the reviewed resources (`ui://` identity, inline document or URL, CSP and permissions), the protocol and capability grants, and the allowed tool names; generated content can only choose one of the host-allowlisted resource ids, set a label and pass bounded scalar input. Tool requests from the app initiate a confirmed `mcp-tool-call` action limited to the allowlisted tools, so `lr-gen-view`'s existing action authorization applies and lyra-gen never executes a tool.
