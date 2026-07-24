#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  dynamicRelativeSpecifiers,
  findTransitiveRegistrationPaths,
  runtimeRelativeSpecifiers,
} from './check-registration-architecture.mjs';

const modules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { helper } from './example-shared.js';\nimport type { Example } from './types.js';\nvoid helper;",
  ],
  [
    '/src/components/example/example-shared.ts',
    "export { registeredHelper as helper } from '../registered/registered.js';",
  ],
  [
    '/src/components/registered/registered.ts',
    "import { defineElement } from '../../../internal/prefix.js';\ndefineElement('registered', class {});",
  ],
  ['/src/components/example/types.ts', "export interface Example { value: string }\n"],
]);

assert.deepEqual(
  runtimeRelativeSpecifiers(`
    import type { Example } from './types.js'
    import { type OtherExample } from './other-types.js';
    import { helper, type HelperOptions } from './example-shared.js';
    import './setup.js';
    import {} from './empty-import.js'
    export type { PublicExample } from './public-types.js'
    export { type OtherPublicExample } from './other-public-types.js';
    export { publicHelper, type PublicHelperOptions } from './public-helper.js';
    export {} from './empty-export.js'
  `),
  [
    './example-shared.js',
    './setup.js',
    './empty-import.js',
    './public-helper.js',
    './empty-export.js',
  ],
  'runtime imports and re-exports are found without relying on semicolons or nonempty clauses',
);

assert.deepEqual(
  dynamicRelativeSpecifiers(`
    const load = () => import('./lazy-registration.js');
    const ignored = () => import(packageName);
  `),
  ['./lazy-registration.js'],
  'literal relative dynamic imports are exposed for the lazy-registration audit',
);

assert.deepEqual(
  runtimeRelativeSpecifiers(`
    const template = \`text with \${value}\`;
    const matcher = /import\\(['"]\\.\\/regex-false-positive\\.js['"]\\)/;
    registry.import('./member-false-positive.js');
    import { helper } from './after-template.js';
    void template;
    void matcher;
    void helper;
  `),
  ['./after-template.js'],
  'template literals, regular expressions, and member calls must not hide or invent eager imports',
);

assert.deepEqual(
  dynamicRelativeSpecifiers(`
    const template = \`text with \${value}\`;
    const matcher = /import\\(['"]\\.\\/regex-false-positive\\.js['"]\\)/;
    registry.import('./member-false-positive.js');
    const load = () => import(\`./after-template.js\`);
    void template;
    void matcher;
  `),
  ['./after-template.js'],
  'only real literal import() expressions are dynamic edges',
);

assert.deepEqual(
  runtimeRelativeSpecifiers(`
    import { type } from './runtime-binding-named-type.js';
    import { type as runtimeType } from './runtime-binding-aliased-type.js';
    export { type } from './runtime-export-named-type.js';
    export { type as runtimeType } from './runtime-export-aliased-type.js';
    void runtimeType;
  `),
  [
    './runtime-binding-named-type.js',
    './runtime-binding-aliased-type.js',
    './runtime-export-named-type.js',
    './runtime-export-aliased-type.js',
  ],
  'a runtime binding literally named type must not be mistaken for an import type modifier',
);

assert.deepEqual(
  dynamicRelativeSpecifiers(`
    type Imported = import('./erased-type-query.js').Imported;
    const compound = () => import('./compound-prefix.js' + suffix);
    if (ready) /import\\(['"]\\.\\/regex-after-condition\\.js['"]\\)/.test(text);
    const real = () => import('./real-lazy.js');
  `),
  ['./real-lazy.js'],
  'only runtime import expressions with one complete literal argument are lazy edges',
);

assert.deepEqual(
  dynamicRelativeSpecifiers(`
    const parenthesized = () => import(('./parenthesized.js'));
    const asserted = () => import('./asserted.js' as string);
    const satisfied = () => import('./satisfied.js' satisfies string);
    const nonNull = () => import('./non-null.js'!);
  `),
  ['./parenthesized.js', './asserted.js', './satisfied.js', './non-null.js'],
  'transparent TypeScript and parenthesized wrappers preserve exact literal lazy edges',
);

assert.deepEqual(
  runtimeRelativeSpecifiers(modules.get('/src/components/example/example.class.ts')),
  ['./example-shared.js'],
  'type-only imports must not create runtime registration edges',
);

assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    modules,
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/example/example-shared.ts',
      '/src/components/registered/registered.ts',
    ],
  ],
  'a class module must be rejected when a value import reaches registration transitively',
);

const pureModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { helper } from './example-shared.js';\nvoid helper;",
  ],
  ['/src/components/example/example-shared.ts', 'export const helper = 1;\n'],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    pureModules,
  ),
  [],
  'a value import chain that never registers a tag remains valid',
);

const lexicalRegistrationModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { helper } from './example-shared.js';\nvoid helper;",
  ],
  [
    '/src/components/example/example-shared.ts',
    `
      const commentText = '/*';
      const codeText = "defineElement('not-a-registration', class {})";
      export const helper = { commentText, codeText };
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    lexicalRegistrationModules,
  ),
  [],
  'comment markers and defineElement text inside strings must not invent or hide registrations',
);

const regexRegistrationModules = new Map([
  [
    '/src/components/example/example.class.ts',
    `
      if (ready) /defineElement('fake-registration', class {})/.test(text);
      export const ready = true;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    regexRegistrationModules,
  ),
  [],
  'defineElement text inside a regex after a control condition must not invent a registration',
);

const aliasedRegistrationModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { helper } from './aliased-registered.js';\nvoid helper;",
  ],
  [
    '/src/components/example/aliased-registered.ts',
    `
      import { defineElement as register } from '../../../internal/prefix.js';
      register(('registered'), class {});
      export const helper = true;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    aliasedRegistrationModules,
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/example/aliased-registered.ts',
    ],
  ],
  'the actual imported defineElement binding is recognized through aliases and transparent wrappers',
);

const shadowedRegistrationModules = new Map([
  [
    '/src/components/example/example.class.ts',
    `
      function defineElement() {}
      defineElement('not-the-library-registrar', class {});
      export const helper = true;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    shadowedRegistrationModules,
  ),
  [],
  'a locally declared function named defineElement is not the library registrar',
);

const namespaceRegistrationModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { helper } from './namespace-registered.js';\nvoid helper;",
  ],
  [
    '/src/components/example/namespace-registered.ts',
    `
      import * as prefix from '../../../internal/prefix.js';
      const register = prefix.defineElement;
      register('registered', class {});
      export const helper = true;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    namespaceRegistrationModules,
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/example/namespace-registered.ts',
    ],
  ],
  'namespace registrar imports and top-level local registrar aliases remain registration edges',
);

const nestedShadowModules = new Map([
  [
    '/src/components/example/example.class.ts',
    `
      import { defineElement } from '../../../internal/prefix.js';
      function probe(defineElement: (name: string, ctor: unknown) => void) {
        defineElement('not-the-imported-registrar', class {});
      }
      void probe;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    nestedShadowModules,
  ),
  [],
  'a nested parameter shadowing an imported registrar is not mistaken for the import binding',
);

for (const [description, source] of [
  [
    'a destructured namespace registrar alias remains a registration edge',
    `
      import * as prefix from '../../../internal/prefix.js';
      const { defineElement: register } = prefix;
      register('registered', class {});
    `,
  ],
  [
    'a computed namespace registrar member remains a registration edge',
    `
      import * as prefix from '../../../internal/prefix.js';
      prefix['defineElement']('registered', class {});
    `,
  ],
  [
    'a block-local registrar alias remains a registration edge',
    `
      import { defineElement } from '../../../internal/prefix.js';
      {
        const register = defineElement;
        register('registered', class {});
      }
    `,
  ],
]) {
  const modulesWithRegistration = new Map([
    ['/src/components/example/example.class.ts', source],
  ]);
  assert.deepEqual(
    findTransitiveRegistrationPaths(
      ['/src/components/example/example.class.ts'],
      modulesWithRegistration,
    ),
    [['/src/components/example/example.class.ts']],
    description,
  );
}

for (const [description, source] of [
  [
    'a for-loop binding shadowing the imported registrar is not a registration edge',
    `
      import { defineElement } from '../../../internal/prefix.js';
      for (const defineElement of registrars) {
        defineElement('not-the-imported-registrar', class {});
      }
    `,
  ],
  [
    'a class static-block binding shadowing the imported registrar is not a registration edge',
    `
      import { defineElement } from '../../../internal/prefix.js';
      class Example {
        static {
          const defineElement = () => {};
          defineElement('not-the-imported-registrar', class {});
        }
      }
    `,
  ],
]) {
  const modulesWithShadow = new Map([
    ['/src/components/example/example.class.ts', source],
  ]);
  assert.deepEqual(
    findTransitiveRegistrationPaths(
      ['/src/components/example/example.class.ts'],
      modulesWithShadow,
    ),
    [],
    description,
  );
}

for (const [description, source] of [
  [
    'a nested var binding is hoisted across its containing function and shadows the registrar',
    `
      import { defineElement } from '../../../internal/prefix.js';
      function probe() {
        {
          var defineElement = () => {};
        }
        defineElement('not-the-imported-registrar', class {});
      }
      void probe;
    `,
  ],
  [
    'a switch-case lexical binding shadows the registrar across the switch',
    `
      import { defineElement } from '../../../internal/prefix.js';
      switch (kind) {
        case 'local': {
          const defineElement = () => {};
          defineElement('not-the-imported-registrar', class {});
          break;
        }
      }
    `,
  ],
  [
    'a named class expression shadows the registrar inside its own body',
    `
      import { defineElement } from '../../../internal/prefix.js';
      const Example = class defineElement {
        static {
          defineElement('not-the-imported-registrar', class {});
        }
      };
      void Example;
    `,
  ],
]) {
  const modulesWithShadow = new Map([
    ['/src/components/example/example.class.ts', source],
  ]);
  assert.deepEqual(
    findTransitiveRegistrationPaths(
      ['/src/components/example/example.class.ts'],
      modulesWithShadow,
    ),
    [],
    description,
  );
}

for (const [description, source] of [
  [
    'a switch-local registrar alias is treated as a registration edge',
    `
      import { defineElement } from '../../../internal/prefix.js';
      switch (kind) {
        case 'register':
          const register = defineElement;
          register('registered', class {});
          break;
      }
    `,
  ],
  [
    'an assigned registrar alias is treated as a registration edge',
    `
      import { defineElement } from '../../../internal/prefix.js';
      let register;
      register = defineElement;
      register('registered', class {});
    `,
  ],
  [
    'Function.prototype.call cannot hide a registrar call',
    `
      import { defineElement } from '../../../internal/prefix.js';
      defineElement.call(undefined, 'registered', class {});
    `,
  ],
]) {
  const modulesWithRegistration = new Map([
    ['/src/components/example/example.class.ts', source],
  ]);
  assert.deepEqual(
    findTransitiveRegistrationPaths(
      ['/src/components/example/example.class.ts'],
      modulesWithRegistration,
    ),
    [['/src/components/example/example.class.ts']],
    description,
  );
}

for (const [description, source] of [
  [
    'a sequence-expression registrar call cannot hide registration',
    `
      import { defineElement } from '../../../internal/prefix.js';
      (0, defineElement)('registered', class {});
    `,
  ],
  [
    'passing the registrar to another runtime function is fail-closed',
    `
      import { defineElement } from '../../../internal/prefix.js';
      install(defineElement);
    `,
  ],
  [
    'returning the registrar as a runtime capability is fail-closed',
    `
      import { defineElement } from '../../../internal/prefix.js';
      export function registrar() {
        return defineElement;
      }
    `,
  ],
  [
    'exporting a prefix namespace capability is fail-closed',
    `
      import * as prefix from '../../../internal/prefix.js';
      export { prefix };
    `,
  ],
  [
    'default-exporting a prefix namespace capability is fail-closed',
    `
      import * as prefix from '../../../internal/prefix.js';
      export default prefix;
    `,
  ],
]) {
  const modulesWithRegistrationCapability = new Map([
    ['/src/components/example/example.class.ts', source],
  ]);
  assert.deepEqual(
    findTransitiveRegistrationPaths(
      ['/src/components/example/example.class.ts'],
      modulesWithRegistrationCapability,
    ),
    [['/src/components/example/example.class.ts']],
    description,
  );
}

const reexportedRegistrarModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { register } from './registrar-entry.js';\nregister('registered', class {});",
  ],
  [
    '/src/components/example/registrar-entry.ts',
    "export { defineElement as register } from '../../../internal/prefix.js';",
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    reexportedRegistrarModules,
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/example/registrar-entry.ts',
    ],
  ],
  're-exporting the registrar is a fail-closed registration capability edge',
);

const exportedRegistrarAliasModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "import { register } from './registrar-entry.js';\nregister('registered', class {});",
  ],
  [
    '/src/components/example/registrar-entry.ts',
    `
      import { defineElement } from '../../../internal/prefix.js';
      export const register = defineElement;
    `,
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    exportedRegistrarAliasModules,
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/example/registrar-entry.ts',
    ],
  ],
  'exporting a registrar alias is a fail-closed registration capability edge',
);

const lazyModules = new Map([
  [
    '/src/components/example/example.class.ts',
    "export const load = () => import('../registered/registered.js');",
  ],
  [
    '/src/components/registered/registered.ts',
    "import { defineElement } from '../../../internal/prefix.js';\ndefineElement('registered', class {});",
  ],
]);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    lazyModules,
  ),
  [],
  'lazy registration is not an eager class-import side effect',
);
assert.deepEqual(
  findTransitiveRegistrationPaths(
    ['/src/components/example/example.class.ts'],
    lazyModules,
    { includeDynamic: true },
  ),
  [
    [
      '/src/components/example/example.class.ts',
      '/src/components/registered/registered.ts',
    ],
  ],
  'the separate lazy audit still follows dynamic registration edges',
);

console.log('registration architecture checker self-test passed');
