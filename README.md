# Lyra UI (monorepo)

A pnpm workspace hosting `lyra-ui` and its optional companion packages.

| Package | Description |
|---|---|
| [`packages/lyra-ui`](./packages/lyra-ui) | Free, clean-room Lit web components — a companion to Web Awesome. |
| [`packages/lyra-flags`](./packages/lyra-flags) | Optional waving flag PNGs for `<lyra-flag>`, kept out of `lyra-ui`'s install by default. |

See each package's own README for install/usage. For local development:

```bash
pnpm install
pnpm build        # builds every package
pnpm test         # tests every package
pnpm lint         # typechecks every package
pnpm docs         # Vite playground demoing every component
```

## License

[MIT](./LICENSE) for the code. `packages/lyra-flags` ships third-party flag artwork with
unverified provenance — see [its README](./packages/lyra-flags/README.md#%EF%B8%8F-asset-provenance--license)
before relying on it.
