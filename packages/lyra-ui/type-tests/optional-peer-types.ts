import type { ChartConfiguration, Plugin } from 'chart.js';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type {
  LyraChart,
  LyraChartConfiguration,
  LyraChartPlugin,
} from '../src/components/charts/chart/chart.class.js';
import type { LyraMarkdown } from '../src/components/conversation/markdown/markdown.class.js';
import type { LyraMap } from '../src/components/media/map/map.class.js';
import type { LyraMapInstance, LyraMapStyleSpecification } from '../src/lyra.js';
import type {
  LyraMarkedParser,
  MarkedExtension,
} from '../src/components/conversation/markdown/markdown-loader.js';
import { DocumentAnchorTarget } from '../src/internal/anchor-target.js';
import { TextViewerTarget } from '../src/internal/text-viewer-target.js';

type IsAny<Value> = 0 extends (1 & Value) ? true : false;
type AssertFalse<Value extends false> = Value;
type AssertTrue<Value extends true> = Value;

type _ChartConfigIsNotAny = AssertFalse<IsAny<NonNullable<LyraChart['config']>>>;
type _ChartPluginIsNotAny = AssertFalse<IsAny<LyraChart['plugins'][number]>>;
type _MarkdownParserIsNotAny = AssertFalse<IsAny<NonNullable<LyraMarkdown['marked']>>>;
type _MarkdownConstructorArgumentIsNotAny = AssertFalse<
  IsAny<ConstructorParameters<typeof LyraMarkdown>[number]>
>;
type _MapStyleIsNotAny = AssertFalse<IsAny<LyraMapStyleSpecification>>;
type _MapInstanceIsNotAny = AssertFalse<IsAny<LyraMapInstance>>;
type _MapGetterIsNotAny = AssertFalse<IsAny<NonNullable<LyraMap['map']>>>;
type _AnchorTargetConstructorArgumentIsNotAny = AssertFalse<
  IsAny<ConstructorParameters<ReturnType<typeof DocumentAnchorTarget>>[number]>
>;
type _TextViewerTargetConstructorArgumentIsNotAny = AssertFalse<
  IsAny<ConstructorParameters<ReturnType<typeof TextViewerTarget>>[number]>
>;
declare const markedParser: LyraMarkedParser;
declare const markedExtension: MarkedExtension;
markedParser.use(markedExtension, markedExtension);
type _ChartJsConfigFitsPeerNeutralSurface = AssertTrue<
  ChartConfiguration extends LyraChartConfiguration ? true : false
>;
type _ChartJsPluginFitsPeerNeutralSurface = AssertTrue<
  Plugin extends LyraChartPlugin ? true : false
>;
type _MapLibreStyleFitsPeerNeutralSurface = AssertTrue<
  StyleSpecification extends LyraMapStyleSpecification ? true : false
>;
type _MapLibreMapFitsPeerNeutralSurface = AssertTrue<
  MapLibreMap extends LyraMapInstance ? true : false
>;
type _MapGetterUsesPeerNeutralSurface = AssertTrue<
  NonNullable<LyraMap['map']> extends LyraMapInstance ? true : false
>;

export type OptionalPeerPublicTypeAssertions =
  | _ChartConfigIsNotAny
  | _ChartPluginIsNotAny
  | _MarkdownParserIsNotAny
  | _MarkdownConstructorArgumentIsNotAny
  | _MapStyleIsNotAny
  | _MapInstanceIsNotAny
  | _MapGetterIsNotAny
  | _AnchorTargetConstructorArgumentIsNotAny
  | _TextViewerTargetConstructorArgumentIsNotAny
  | _ChartJsConfigFitsPeerNeutralSurface
  | _ChartJsPluginFitsPeerNeutralSurface
  | _MapLibreStyleFitsPeerNeutralSurface
  | _MapLibreMapFitsPeerNeutralSurface
  | _MapGetterUsesPeerNeutralSurface;
