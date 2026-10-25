# @aceshooting/lyra-ide

[![Coverage](https://img.shields.io/endpoint?url=https://aceshooting.github.io/lyra-ui/badges/coverage-lyra-ide.json)](https://codecov.io/gh/aceshooting/lyra-ui)

[![npm](https://img.shields.io/npm/v/%40aceshooting%2Flyra-ide)](https://www.npmjs.com/package/@aceshooting/lyra-ide)
[![Node.js](https://img.shields.io/node/v/%40aceshooting%2Flyra-ide)](https://www.npmjs.com/package/@aceshooting/lyra-ide)

Generated editor data for [`@aceshooting/lyra-ui`](https://github.com/aceshooting/lyra-ui/tree/main/packages/lyra-ui):
tag, attribute, property, event, slot and CSS custom-property completion for HTML, Vue, Angular and CSS.

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

`@aceshooting/lyra-ui` is a peer. Both packages are versioned together; install matching versions.

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

Upgrading from lyra-ui 26 or earlier: see the [upgrade table](https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/README.md#upgrading).

MIT licensed.
