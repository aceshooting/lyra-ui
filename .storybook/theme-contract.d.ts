export type StoryThemeName = 'light' | 'dark';

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
