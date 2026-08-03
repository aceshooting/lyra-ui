/**
 * A compact-manifest regression fixture shared by every consumer that needs the effective public
 * surface of a custom element. Keep every inheritable CEM collection represented here: losing one
 * of them can make generated docs or contract gates silently disagree with the published API.
 */
export function createManifestInheritanceFixture() {
  return {
    schemaVersion: '1.0.0',
    modules: [
      {
        path: 'src/components/fixture/base/base.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraFixtureBase',
            customElement: true,
            tagName: 'lr-fixture-base',
            members: [
              { kind: 'field', name: 'locale' },
              { kind: 'field', name: 'secret', privacy: 'private' },
              { kind: 'field', name: 'defaultStrings', privacy: 'protected' },
              {
                kind: 'method',
                name: 'setRangeText',
                parameters: [{ name: 'value', type: { text: 'string' } }],
              },
              {
                kind: 'method',
                name: 'setRangeText',
                parameters: [
                  { name: 'value', type: { text: 'string' } },
                  { name: 'start', type: { text: 'number' } },
                ],
              },
            ],
            attributes: [{ name: 'locale', fieldName: 'locale' }],
            events: [
              { name: 'lr-ready', type: { text: 'CustomEvent<{ ready: boolean }>' } },
            ],
            slots: [{ name: 'label', description: 'The inherited label.' }],
            cssParts: [{ name: 'base', description: 'The inherited base.' }],
            cssProperties: [
              { name: '--lr-fixture-base-color', description: 'The inherited color.' },
            ],
          },
        ],
      },
      {
        path: 'src/components/fixture/child/child.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraFixtureChild',
            customElement: true,
            tagName: 'lr-fixture-child',
            superclass: {
              name: 'LyraFixtureBase',
              module: '/src/components/fixture/base/base.class.js',
            },
            members: [
              {
                kind: 'field',
                name: 'locale',
                inheritedFrom: {
                  name: 'LyraFixtureBase',
                  module: 'src/components/fixture/base/base.class.ts',
                },
              },
              { kind: 'field', name: 'value' },
              {
                kind: 'method',
                name: 'setRangeText',
                parameters: [
                  { name: 'replacement', type: { text: 'string' } },
                  { name: 'start', type: { text: 'number' } },
                ],
              },
            ],
            attributes: [
              {
                name: 'locale',
                inheritedFrom: {
                  name: 'LyraFixtureBase',
                  module: 'src/components/fixture/base/base.class.ts',
                },
              },
              { name: 'value', fieldName: 'value' },
            ],
            events: [{ name: 'lr-change', type: { text: 'CustomEvent<{ value: string }>' } }],
            slots: [{ name: '', description: 'The child content.' }],
            cssParts: [{ name: 'control', description: 'The child control.' }],
            cssProperties: [
              { name: '--lr-fixture-child-color', description: 'The child color.' },
            ],
          },
        ],
      },
      {
        path: 'src/components/fixture/mixed/mixed.class.ts',
        declarations: [
          {
            kind: 'class',
            name: 'LyraFixtureMixed',
            customElement: true,
            tagName: 'lr-fixture-mixed',
            superclass: { name: 'UnmaterializedMixinBase' },
            members: [
              { kind: 'field', name: 'mixedValue', inheritedFrom: { name: 'Mixin' } },
              {
                kind: 'field',
                name: 'mixedSecret',
                privacy: 'protected',
                inheritedFrom: { name: 'Mixin' },
              },
            ],
          },
        ],
      },
    ],
  };
}
