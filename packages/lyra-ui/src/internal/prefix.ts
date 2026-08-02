import { LYRA_PACKAGE_NAME, LYRA_PACKAGE_VERSION } from './package-metadata.js';

export const LYRA_PREFIX = 'lr';

export const tag = (name: string): string => `${LYRA_PREFIX}-${name}`;

interface RegistrationProvenance {
  ctor: CustomElementConstructor;
  packageName: string;
  version: string;
}

interface RegistryDiagnostics {
  registrations: Map<string, RegistrationProvenance>;
  warned: Map<
    string,
    WeakMap<CustomElementConstructor, WeakSet<CustomElementConstructor>>
  >;
}

interface SharedRegistrationDiagnostics {
  schemaVersion: 1;
  registries: WeakMap<CustomElementRegistry, RegistryDiagnostics>;
}

const DIAGNOSTICS_KEY = Symbol.for('@aceshooting/lyra-ui.registration-diagnostics.v1');
const fallbackSharedDiagnostics: SharedRegistrationDiagnostics = {
  schemaVersion: 1,
  registries: new WeakMap(),
};

function sharedDiagnostics(): SharedRegistrationDiagnostics {
  const scope = globalThis as unknown as Record<PropertyKey, unknown>;
  const existing = scope[DIAGNOSTICS_KEY];
  if (
    existing &&
    typeof existing === 'object' &&
    (existing as Partial<SharedRegistrationDiagnostics>).schemaVersion === 1 &&
    (existing as Partial<SharedRegistrationDiagnostics>).registries instanceof WeakMap
  ) {
    return existing as SharedRegistrationDiagnostics;
  }
  const diagnostics: SharedRegistrationDiagnostics = {
    schemaVersion: 1,
    registries: new WeakMap(),
  };
  try {
    Object.defineProperty(scope, DIAGNOSTICS_KEY, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: diagnostics,
    });
    return diagnostics;
  } catch {
    // A frozen global object is unusual but must not prevent element registration. This fallback
    // retains idempotence within this module instance; cross-copy diagnostics require the shared
    // symbol slot and therefore degrade to an explicit "unknown" existing version.
    return fallbackSharedDiagnostics;
  }
}

function registryDiagnostics(registry: CustomElementRegistry): RegistryDiagnostics {
  const shared = sharedDiagnostics();
  let diagnostics = shared.registries.get(registry);
  if (!diagnostics) {
    diagnostics = { registrations: new Map(), warned: new Map() };
    shared.registries.set(registry, diagnostics);
  }
  return diagnostics;
}

function constructorName(ctor: CustomElementConstructor): string {
  return (ctor as unknown as Function).name || '(anonymous constructor)';
}

function shouldWarn(
  diagnostics: RegistryDiagnostics,
  elementTag: string,
  existing: CustomElementConstructor,
  incoming: CustomElementConstructor,
): boolean {
  let byExisting = diagnostics.warned.get(elementTag);
  if (!byExisting) {
    byExisting = new WeakMap();
    diagnostics.warned.set(elementTag, byExisting);
  }
  let incomingConstructors = byExisting.get(existing);
  if (!incomingConstructors) {
    incomingConstructors = new WeakSet();
    byExisting.set(existing, incomingConstructors);
  }
  if (incomingConstructors.has(incoming)) return false;
  incomingConstructors.add(incoming);
  return true;
}

/**
 * Idempotently registers a Lyra element. A conflicting constructor remains ignored, but the
 * diagnostic identifies both package versions and passes both constructor references to the
 * console so multi-bundle/version collisions can be inspected without parsing function text.
 */
/**
 * Binds a registration to an explicit package-build version. Component entries and the supported
 * `defineElement()` API never accept caller-authored provenance; they always use the generated
 * package version below.
 *
 * @internal
 */
export function defineElementForPackageVersion(
  name: string,
  ctor: CustomElementConstructor,
  packageVersion: string,
): void {
  const t = tag(name);
  const registry = customElements;
  const diagnostics = registryDiagnostics(registry);
  const existing = registry.get(t);
  if (existing) {
    // Identical constructors are already the requested definition. Do not invent provenance when
    // the registry was populated outside this shared helper; a later conflict must report that
    // existing version as unknown rather than attributing it to whichever copy observed it next.
    if (existing === ctor) return;
    if (existing !== ctor) {
      const known = diagnostics.registrations.get(t);
      const existingPackage = known?.ctor === existing ? known.packageName : LYRA_PACKAGE_NAME;
      const existingVersion = known?.ctor === existing ? known.version : 'unknown';
      if (shouldWarn(diagnostics, t, existing, ctor)) {
        console.warn(
          `[lr] duplicate registration for "${t}": existing ${existingPackage}@${existingVersion} ` +
            `${constructorName(existing)}; ignored incoming ${LYRA_PACKAGE_NAME}@${packageVersion} ` +
            `${constructorName(ctor)}. Existing and incoming constructors follow.`,
          existing,
          ctor,
        );
      }
    }
    return;
  }
  registry.define(t, ctor);
  diagnostics.registrations.set(t, {
    ctor,
    packageName: LYRA_PACKAGE_NAME,
    version: packageVersion,
  });
}

export function defineElement(name: string, ctor: CustomElementConstructor): void {
  defineElementForPackageVersion(name, ctor, LYRA_PACKAGE_VERSION);
}
