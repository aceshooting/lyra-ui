import type { Map as NativeMap } from 'maplibre-gl';
import { createSceneBridge, type SceneBridge, type SceneBridgeHost,
  type SceneBridgeNativeMap } from '@aceshooting/lyra-map/scene';

declare const nativeMap: NativeMap;
declare const host: SceneBridgeHost;

// Exercise the actual native package declaration, including its custom-layer callbacks.
const port: SceneBridgeNativeMap = nativeMap;
const bridge: SceneBridge = createSceneBridge(nativeMap, host);
bridge.requestFrame();
bridge.setVisible(false);
bridge.invalidateStyle();
bridge.dispose();

// @ts-expect-error Native MapLibre does not implement the optional modular preparation API.
nativeMap.prepareFeatures({});
void port;
