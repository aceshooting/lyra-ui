export type StoryThemeName = 'light' | 'dark';

export interface StoryPresentation {
  theme: StoryThemeName;
  look: 'lyra' | 'shadcn';
  surface: 'solid' | 'glass';
  accent: 'emerald' | null;
  direction: 'ltr' | 'rtl';
}

export const STORY_PRESENTATION_DEFAULTS: Readonly<StoryPresentation>;
export function normalizeStoryPresentation(globals?: Record<string, unknown>): StoryPresentation;

export type StoryColorName =
  | 'surface'
  | 'text'
  | 'quiet'
  | 'border'
  | 'brand'
  | 'brandQuiet'
  | 'onBrand'
  | 'success'
  | 'successQuiet'
  | 'warning'
  | 'warningQuiet'
  | 'danger'
  | 'dangerQuiet'
  | 'noData'
  | 'chart1'
  | 'chart2'
  | 'chart3'
  | 'chart4';

export function normalizeStoryThemeName(themeName: unknown): StoryThemeName;
export function storyToken(property: string): string;
export function storyColor(name: StoryColorName): string;
