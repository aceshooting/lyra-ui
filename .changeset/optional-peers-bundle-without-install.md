---
"@aceshooting/lyra-ui": minor
---

Optional peers no longer have to be installed for an application to bundle. Published peer imports now sit in a `try` block, which esbuild, the Angular `application` builder, Next.js, webpack and Rspack treat as non-fatal when the peer is absent; before this, they failed with "Could not resolve" or "Module not found" for peers the application never uses, including every `@aceshooting/lyra-translations` locale catalog. A missing peer still reaches the same loader at run time, so components keep failing closed with their documented state. Parcel still needs an `alias` entry; see "Bundling without an optional peer" in the AI types and optional peers guide.
