# Public API fallback

Without local references, use the public surfaces instead of guessing:

| Need | Public fallback |
|---|---|
| Search by intent, synonym or typo | `GET https://www.lyra-ui.com/api/v1/components/search?q=<query>` |
| Exact component API | `GET https://www.lyra-ui.com/api/v1/components/<lr-tag>` |
| Shared documentation search | `GET https://www.lyra-ui.com/api/v1/documentation/search?q=<query>` |
| Resolve a `wa-*`/`sl-*` tag | `GET https://www.lyra-ui.com/api/v1/migrations/<tag>` |
| Structured index | `https://www.lyra-ui.com/component-api-index.json` |

MCP clients can connect to `https://www.lyra-ui.com/mcp` (streamable HTTP, no authentication):
`search_components`, `get_component`, `search_documentation`, `resolve_migration`; resources
`lyra://catalog`, `lyra://component/{tag}`, `lyra://guide/{topic}`.
