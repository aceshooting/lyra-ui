# @aceshooting/lyra-ide

[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ide)](https://www.npmjs.com/package/@aceshooting/lyra-ide)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-ide)](https://www.npmjs.com/package/@aceshooting/lyra-ide)

Editor data for [`@aceshooting/lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui),
generated from the same source as the components: tag, attribute, property, event, slot and CSS
custom-property completion for plain HTML, Vue and Angular templates, and CSS.

| File | Consumer |
| --- | --- |
| `web-types.json` | WebStorm / IntelliJ: found automatically once the package is installed |
| `vscode-html-data.json` | VS Code `html.customData` |
| `vscode-css-data.json` | VS Code `css.customData` |
| `custom-elements.json` | Custom Elements Manifest tooling (Storybook, API docs, analyzers) |

## Install

```bash
pnpm add -D @aceshooting/lyra-ide
```

`@aceshooting/lyra-ui` is a peer; install the same version.

## VS Code

```json
{
  "html.customData": ["./node_modules/@aceshooting/lyra-ide/vscode-html-data.json"],
  "css.customData": ["./node_modules/@aceshooting/lyra-ide/vscode-css-data.json"]
}
```

## Manifest

```ts
import manifest from '@aceshooting/lyra-ide/custom-elements.json' with { type: 'json' };
```

Migrating from `@aceshooting/lyra-ui` 26 or earlier: install this package and point the manifest
import and the `vscode-*-data.json` paths at `@aceshooting/lyra-ide/...` instead of
`@aceshooting/lyra-ui`. `lyra-ui` no longer publishes these files or the `customElements` and
`web-types` fields.

## Versioning

This package is versioned together with `@aceshooting/lyra-ui`; use matching versions.

MIT licensed.
