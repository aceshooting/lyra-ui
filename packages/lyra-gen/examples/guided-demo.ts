/** Deterministic application example: simulated data, authored replies and no model requests. */
import { emitMarkup } from '@aceshooting/lyra-gen/authoring.js';
import { initialCatalog } from '@aceshooting/lyra-gen/catalog.js';
import { createChatStream, type LyraGenChatSnapshot, type LyraGenChatStrings } from '@aceshooting/lyra-gen/chat.js';
import { replayRecordedChunks, type ReplayRecording } from '@aceshooting/lyra-gen/replay.js';
import type { JsonValue, LyraGenNode } from '@aceshooting/lyra-gen/types.js';

export const guidedDemoLocales = ['en', 'fr', 'ar'] as const;
export const guidedDemoScenarios = ['markets', 'weather', 'travel-budget'] as const;
export type GuidedDemoLocale = typeof guidedDemoLocales[number];
export type GuidedDemoScenario = typeof guidedDemoScenarios[number];
export type GuidedDemoFollowUp = 'focus-orchard' | 'dry-cities' | 'add-night';
type GuidedDemoPhase = 'idle' | 'playing' | 'complete' | 'cancelled' | 'error' | 'unsupported';
export interface TravelInputs { readonly nights: number; readonly travelers: number; readonly budget: number }
export interface TravelTotals {
  readonly days: number; readonly lodging: number; readonly meals: number; readonly transit: number;
  readonly activities: number; readonly total: number; readonly remaining: number;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export const marketSamples = freeze([
  { id: 'orchard', name: 'Orchard', values: [101.2, 102.1, 103.4] },
  { id: 'harbor', name: 'Harbor', values: [100.8, 100.1, 101.6] },
  { id: 'meadow', name: 'Meadow', values: [99.7, 100.5, 100.9] },
]);
export const weatherSamples = freeze([
  { id: 'lyon', name: 'Lyon', temperature: 18, precipitation: 20 },
  { id: 'lisbon', name: 'Lisbon', temperature: 23, precipitation: 5 },
  { id: 'oslo', name: 'Oslo', temperature: 12, precipitation: 60 },
]);
const travelRates = freeze({ lodgingPerNight: 95, mealsPerPersonDay: 28, transitPerPersonDay: 8, activitiesPerPerson: 45 });
const defaultTravel: TravelInputs = freeze({ nights: 4, travelers: 2, budget: 1200 });

/** One room, nights + 1 days, and one activities allowance per traveler; EUR budgets accept whole cents. */
export function calculateTravelBudget(inputs: TravelInputs): TravelTotals {
  const budgetCents = Math.round(inputs.budget * 100);
  if (!Number.isSafeInteger(inputs.nights) || inputs.nights < 1 || inputs.nights > 30
    || !Number.isSafeInteger(inputs.travelers) || inputs.travelers < 1 || inputs.travelers > 8
    || !Number.isFinite(inputs.budget) || inputs.budget < 0 || inputs.budget > 100000
    || Math.abs(inputs.budget * 100 - budgetCents) > 1e-7) throw new RangeError('Invalid travel inputs.');
  const days = inputs.nights + 1;
  const lodging = inputs.nights * travelRates.lodgingPerNight;
  const meals = days * inputs.travelers * travelRates.mealsPerPersonDay;
  const transit = days * inputs.travelers * travelRates.transitPerPersonDay;
  const activities = inputs.travelers * travelRates.activitiesPerPerson;
  const total = lodging + meals + transit + activities;
  return freeze({ days, lodging, meals, transit, activities, total, remaining: (budgetCents - total * 100) / 100 });
}

const english = {
  title: 'Explore a guided demo', simulatedData: 'Simulated data', authoredReply: 'Scripted reply · no AI request',
  next: 'Next', back: 'Back', replay: 'Replay', cancel: 'Cancel', failure: 'Try an invalid response', source: 'View source',
  followUp: 'Follow-up', send: 'Send follow-up', scenario: 'Scenario', prompt: 'Your prompt', answer: 'Scripted answer',
  nights: 'Nights', travelers: 'Travelers', budget: 'Budget (EUR)', apply: 'Update budget',
  idle: 'Read the prompt, then choose Next.', playing: 'Playing an authored synthetic recording.', complete: 'The scripted response is ready.',
  cancelled: 'Replay cancelled. Completed content remains available.', error: 'The invalid response was rejected. Completed content remains available.',
  unsupported: 'Choose the suggested follow-up. This demo cannot answer arbitrary questions.', invalidTravel: 'Enter 1–30 whole nights, 1–8 whole travelers and a budget from 0 to 100,000 EUR in whole cents.',
  loading: 'Loading the simulated dashboard…', incomplete: 'The simulated dashboard was interrupted.', invalid: 'This simulated content could not be displayed.', sourceUnavailable: 'Source unavailable',
  markets: 'Markets', weather: 'Weather', travel: 'Travel budget',
  marketsPrompt: 'Compare the three fictional sectors over the sample days.', marketsReply: 'These invented indices demonstrate a table and a line chart. They are not live market observations.',
  marketsQuestion: 'Focus on Orchard.', marketsRefinement: 'The scripted refinement keeps only Orchard, from 101.2 to 103.4 across the three sample days.',
  weatherPrompt: 'Compare the sample weather for Lyon, Lisbon and Oslo.', weatherReply: 'These illustrative city conditions are fixed demo data, not a forecast.',
  weatherQuestion: 'Keep cities with precipitation at most 20%.', weatherRefinement: 'The local filter retains Lyon and Lisbon because their sample precipitation is at most 20%.',
  travelPrompt: 'Plan a Lisbon trip: {nights} nights, {travelers} travelers, budget {budget}.', travelReply: 'Using the displayed sample rates and your inputs: total {total}; budget remaining {remaining}. No prices were fetched.',
  travelQuestion: 'Add one night.', travelRefinement: 'Updated local calculation: {nights} nights, {travelers} travelers. Total {total}; budget remaining {remaining}. Replay keeps these inputs.',
  sector: 'Fictional sector', index: 'Sample index', day1: 'Sample day 1', day2: 'Sample day 2', day3: 'Sample day 3',
  city: 'City', cityLyon: 'Lyon', cityLisbon: 'Lisbon', cityOslo: 'Oslo',
  temperature: 'Temperature (°C)', precipitation: 'Precipitation (%)', category: 'Category', amount: 'Amount (EUR)',
  lodging: 'Lodging', meals: 'Meals', transit: 'Transit', activities: 'Activities', total: 'Total', remaining: 'Budget remaining',
  rates: 'Sample rates: room 95 EUR/night; meals 28 EUR/person/day; transit 8 EUR/person/day; activities 45 EUR/person. Days = nights + 1.',
};
type GuidedDemoLabels = Readonly<Record<keyof typeof english, string>>;
export interface GuidedDemoLocalization {
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly labels: GuidedDemoLabels;
}
const copies: Readonly<Record<GuidedDemoLocale, GuidedDemoLabels>> = freeze({
  en: english,
  fr: {
    title: 'Explorer une démonstration guidée', simulatedData: 'Données simulées', authoredReply: 'Réponse écrite à l’avance · aucun appel IA',
    next: 'Suivant', back: 'Précédent', replay: 'Rejouer', cancel: 'Annuler', failure: 'Essayer une réponse invalide', source: 'Voir la source',
    followUp: 'Question complémentaire', send: 'Envoyer la question', scenario: 'Scénario', prompt: 'Votre demande', answer: 'Réponse écrite à l’avance',
    nights: 'Nuits', travelers: 'Voyageurs', budget: 'Budget (EUR)', apply: 'Actualiser le budget',
    idle: 'Lisez la demande, puis choisissez Suivant.', playing: 'Lecture d’un enregistrement synthétique écrit à l’avance.', complete: 'La réponse préparée est prête.',
    cancelled: 'Lecture annulée. Le contenu terminé reste disponible.', error: 'La réponse invalide a été refusée. Le contenu terminé reste disponible.',
    unsupported: 'Choisissez la question proposée. Cette démonstration ne répond pas aux questions libres.', invalidTravel: 'Saisissez 1 à 30 nuits entières, 1 à 8 voyageurs et un budget de 0 à 100 000 EUR en centimes entiers.',
    loading: 'Chargement du tableau de bord simulé…', incomplete: 'Le tableau de bord simulé a été interrompu.', invalid: 'Ce contenu simulé ne peut pas être affiché.', sourceUnavailable: 'Source indisponible',
    markets: 'Marchés', weather: 'Météo', travel: 'Budget de voyage',
    marketsPrompt: 'Comparez les trois secteurs fictifs sur les journées de l’exemple.', marketsReply: 'Ces indices inventés illustrent un tableau et un graphique. Ce ne sont pas des données de marché en direct.',
    marketsQuestion: 'Afficher uniquement Orchard.', marketsRefinement: 'Cette réponse préparée conserve uniquement Orchard, de 101,2 à 103,4 sur les trois journées de l’exemple.',
    weatherPrompt: 'Comparez les conditions météo de l’exemple pour Lyon, Lisbonne et Oslo.', weatherReply: 'Ces conditions urbaines sont des données fixes de démonstration, pas des prévisions.',
    weatherQuestion: 'Garder les villes avec au plus 20 % de précipitations.', weatherRefinement: 'Le filtre local conserve Lyon et Lisbonne car leurs précipitations dans l’exemple ne dépassent pas 20 %.',
    travelPrompt: 'Préparer un séjour à Lisbonne : {nights} nuits, {travelers} voyageurs, budget {budget}.', travelReply: 'Avec les tarifs de l’exemple et vos valeurs : total {total} ; budget restant {remaining}. Aucun prix n’a été récupéré.',
    travelQuestion: 'Ajouter une nuit.', travelRefinement: 'Calcul local actualisé : {nights} nuits, {travelers} voyageurs. Total {total} ; budget restant {remaining}. Rejouer conserve ces valeurs.',
    sector: 'Secteur fictif', index: 'Indice de l’exemple', day1: 'Journée 1', day2: 'Journée 2', day3: 'Journée 3',
    city: 'Ville', cityLyon: 'Lyon', cityLisbon: 'Lisbonne', cityOslo: 'Oslo',
    temperature: 'Température (°C)', precipitation: 'Précipitations (%)', category: 'Catégorie', amount: 'Montant (EUR)',
    lodging: 'Hébergement', meals: 'Repas', transit: 'Transports', activities: 'Activités', total: 'Total', remaining: 'Budget restant',
    rates: 'Tarifs fictifs : chambre 95 EUR/nuit ; repas 28 EUR/personne/jour ; transports 8 EUR/personne/jour ; activités 45 EUR/personne. Jours = nuits + 1.',
  },
  ar: {
    title: 'استكشف عرضًا توضيحيًا موجّهًا', simulatedData: 'بيانات محاكاة', authoredReply: 'رد مكتوب مسبقًا · دون طلب ذكاء اصطناعي',
    next: 'التالي', back: 'السابق', replay: 'إعادة التشغيل', cancel: 'إلغاء', failure: 'تجربة رد غير صالح', source: 'عرض المصدر',
    followUp: 'سؤال متابعة', send: 'إرسال سؤال المتابعة', scenario: 'السيناريو', prompt: 'طلبك', answer: 'الرد المكتوب مسبقًا',
    nights: 'الليالي', travelers: 'المسافرون', budget: 'الميزانية (EUR)', apply: 'تحديث الميزانية',
    idle: 'اقرأ الطلب ثم اختر التالي.', playing: 'تشغيل تسجيل اصطناعي مكتوب مسبقًا.', complete: 'الرد المكتوب مسبقًا جاهز.',
    cancelled: 'أُلغي التشغيل. يظل المحتوى المكتمل متاحًا.', error: 'رُفض الرد غير الصالح. يظل المحتوى المكتمل متاحًا.',
    unsupported: 'اختر سؤال المتابعة المقترح. لا يجيب هذا العرض عن أسئلة حرة.', invalidTravel: 'أدخل من 1 إلى 30 ليلة كاملة، ومن 1 إلى 8 مسافرين، وميزانية من 0 إلى 100000 يورو بسنتات كاملة.',
    loading: 'جارٍ تحميل لوحة البيانات المحاكاة…', incomplete: 'توقف عرض لوحة البيانات المحاكاة.', invalid: 'تعذر عرض محتوى المحاكاة هذا.', sourceUnavailable: 'المصدر غير متاح',
    markets: 'الأسواق', weather: 'الطقس', travel: 'ميزانية السفر',
    marketsPrompt: 'قارن القطاعات الخيالية الثلاثة خلال أيام العينة.', marketsReply: 'توضح هذه المؤشرات الخيالية جدولًا ورسمًا خطيًا. إنها ليست بيانات سوق مباشرة.',
    marketsQuestion: 'اعرض Orchard فقط.', marketsRefinement: 'يحتفظ هذا الرد المكتوب مسبقًا بقطاع Orchard فقط، من 101.2 إلى 103.4 خلال أيام العينة الثلاثة.',
    weatherPrompt: 'قارن طقس العينة في ليون ولشبونة وأوسلو.', weatherReply: 'هذه الظروف التوضيحية للمدن بيانات ثابتة للعرض، وليست توقعات جوية.',
    weatherQuestion: 'احتفظ بالمدن التي لا يتجاوز احتمال هطولها 20%.', weatherRefinement: 'يحتفظ المرشح المحلي بليون ولشبونة لأن هطول العينة فيهما لا يتجاوز 20%.',
    travelPrompt: 'خطط لرحلة إلى لشبونة: الليالي {nights}، المسافرون {travelers}، الميزانية {budget}.', travelReply: 'بحسب أسعار العينة ومدخلاتك: الإجمالي {total}؛ والمتبقي من الميزانية {remaining}. لم تُجلب أي أسعار.',
    travelQuestion: 'أضف ليلة واحدة.', travelRefinement: 'الحساب المحلي المحدّث: الليالي {nights}، المسافرون {travelers}. الإجمالي {total}؛ والمتبقي {remaining}. تحتفظ إعادة التشغيل بهذه المدخلات.',
    sector: 'قطاع خيالي', index: 'مؤشر العينة', day1: 'يوم العينة 1', day2: 'يوم العينة 2', day3: 'يوم العينة 3',
    city: 'المدينة', cityLyon: 'ليون', cityLisbon: 'لشبونة', cityOslo: 'أوسلو',
    temperature: 'الحرارة (°C)', precipitation: 'الهطول (%)', category: 'الفئة', amount: 'المبلغ (EUR)',
    lodging: 'الإقامة', meals: 'الوجبات', transit: 'التنقل', activities: 'الأنشطة', total: 'الإجمالي', remaining: 'المتبقي من الميزانية',
    rates: 'أسعار العينة: الغرفة 95 يورو/ليلة؛ الوجبات 28 يورو/شخص/يوم؛ التنقل 8 يورو/شخص/يوم؛ الأنشطة 45 يورو/شخص. الأيام = الليالي + 1.',
  },
});
const followUps: Readonly<Record<GuidedDemoScenario, GuidedDemoFollowUp>> = { markets: 'focus-orchard', weather: 'dry-cities', 'travel-budget': 'add-night' };

function language(options: { readonly locale?: GuidedDemoLocale; readonly localization?: GuidedDemoLocalization }): {
  readonly locale: string; readonly direction: 'ltr' | 'rtl'; readonly labels: GuidedDemoLabels;
} {
  if (options.localization === undefined) {
    const locale = options.locale ?? 'en';
    if (!guidedDemoLocales.includes(locale)) throw new TypeError('Unsupported demo locale.');
    return { locale, direction: locale === 'ar' ? 'rtl' : 'ltr', labels: copies[locale] };
  }
  const localization = options.localization;
  if (options.locale !== undefined || localization === null || typeof localization !== 'object'
    || !['ltr', 'rtl'].includes(localization.direction)) throw new TypeError('Invalid demo localization options.');
  let locale: string;
  try {
    const canonical = typeof localization.locale === 'string' ? Intl.getCanonicalLocales(localization.locale) : [];
    if (canonical.length !== 1) throw new TypeError();
    locale = canonical[0]!;
  } catch { throw new TypeError('Invalid demo localization locale.'); }
  const source = localization.labels;
  const keys = Object.keys(english) as (keyof GuidedDemoLabels)[];
  if (source === null || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).length !== keys.length)
    throw new TypeError('Incomplete demo localization copy.');
  const placeholders = (text: string) => [...new Set([...text.matchAll(/\{([^{}]*)\}/gu)].map(match => match[1]!))].sort();
  const labels = { ...source };
  for (const key of keys) {
    const value = labels[key];
    if (!Object.hasOwn(source, key) || typeof value !== 'string' || !value.trim()
      || /(?:^|\r\n|\r|\n) {0,3}(?:`{3,}|~{3,})/u.test(value)) throw new TypeError(`Invalid demo localization copy: ${key}.`);
    const expected = placeholders(english[key]);
    const actual = placeholders(value);
    if (expected.length !== actual.length || expected.some((token, index) => token !== actual[index]))
      throw new TypeError(`Invalid demo localization placeholders: ${key}.`);
  }
  return { locale, direction: localization.direction, labels: freeze(labels) };
}

export interface GuidedDemoSnapshot {
  readonly locale: string; readonly direction: 'ltr' | 'rtl'; readonly scenario: GuidedDemoScenario;
  readonly step: 0 | 1 | 2; readonly phase: GuidedDemoPhase; readonly status: string; readonly labels: GuidedDemoLabels;
  readonly prompt: string; readonly reply: string; readonly followUp: { readonly id: GuidedDemoFollowUp; readonly question: string };
  readonly travel: { readonly inputs: TravelInputs; readonly totals: TravelTotals };
  readonly source: string; readonly recording: ReplayRecording; readonly deliveredChunks: number;
  readonly chat: LyraGenChatSnapshot; readonly chatStrings: LyraGenChatStrings;
}

/** Host-owned locale and chrome; the eventual renderer still receives its own locale catalogs. */
export function createGuidedDemo(options: {
  readonly packageVersion: string;
  readonly onChange?: (snapshot: GuidedDemoSnapshot) => void;
} & ({ readonly locale?: GuidedDemoLocale; readonly localization?: never }
  | { readonly locale?: never; readonly localization: GuidedDemoLocalization })) {
  if (!options.packageVersion.trim() || options.packageVersion.length > 128) throw new TypeError('A package version is required.');
  const { locale, direction, labels } = language(options);
  const chatStrings: LyraGenChatStrings = freeze({ loading: labels.loading, incomplete: labels.incomplete, invalid: labels.invalid, sourceUnavailable: labels.sourceUnavailable });
  let scenario: GuidedDemoScenario = 'markets';
  let step: 0 | 1 | 2 = 0;
  let phase: GuidedDemoPhase = 'idle';
  let travel = defaultTravel;
  let baselineTravel = defaultTravel;
  let generation = 0;
  let active: AbortController | undefined;
  let disposed = false;
  let deliveredChunks = 0;
  let extraSource = '';
  let validationMessage: string | undefined;
  const makeChat = () => createChatStream({ messageId: `demo-${scenario}`, surfaceId: `demo-${scenario}`, catalog: initialCatalog,
    strings: chatStrings, provenance: `${labels.simulatedData} · ${labels.authoredReply}` });
  let chat = makeChat();

  function content() {
    const refined = step === 2;
    const totals = calculateTravelBudget(travel);
    const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
    // Intl adds directional literals in some locales; the restricted source excludes them.
    const currency = (value: number) => money.formatToParts(value).map(part => part.type === 'literal'
      ? part.value.replace(/[\u061c\u200e\u200f]/gu, '') : part.value).join('');
    const numbers = new Intl.NumberFormat(locale);
    const interpolate = (text: string) => text.replaceAll('{total}', currency(totals.total)).replaceAll('{remaining}', currency(totals.remaining))
      .replaceAll('{nights}', numbers.format(travel.nights)).replaceAll('{travelers}', numbers.format(travel.travelers)).replaceAll('{budget}', currency(travel.budget));
    const reply = interpolate(scenario === 'markets' ? refined ? labels.marketsRefinement : labels.marketsReply
      : scenario === 'weather' ? refined ? labels.weatherRefinement : labels.weatherReply
        : refined ? labels.travelRefinement : labels.travelReply);
    const prompt = interpolate(scenario === 'markets' ? labels.marketsPrompt : scenario === 'weather' ? labels.weatherPrompt : labels.travelPrompt);
    const question = scenario === 'markets' ? labels.marketsQuestion : scenario === 'weather' ? labels.weatherQuestion : labels.travelQuestion;
    const title = scenario === 'markets' ? labels.markets : scenario === 'weather' ? labels.weather : labels.travel;
    let columns: { key: string; label: string }[];
    let rows: Record<string, JsonValue>[];
    let chartLabels: string[];
    let datasets: { label: string; data: number[] }[];
    if (scenario === 'markets') {
      const selected = refined ? marketSamples.slice(0, 1) : marketSamples;
      columns = [{ key: 'c0', label: labels.sector }, { key: 'c1', label: labels.index }];
      rows = selected.map(row => ({ c0: row.name, c1: row.values[2]! }));
      chartLabels = [labels.day1, labels.day2, labels.day3];
      datasets = selected.map(row => ({ label: row.name, data: [...row.values] }));
    } else if (scenario === 'weather') {
      const selected = refined ? weatherSamples.filter(row => row.precipitation <= 20) : weatherSamples;
      const city = (id: string) => id === 'lyon' ? labels.cityLyon : id === 'lisbon' ? labels.cityLisbon : labels.cityOslo;
      columns = [{ key: 'c0', label: labels.city }, { key: 'c1', label: labels.temperature }, { key: 'c2', label: labels.precipitation }];
      rows = selected.map(row => ({ c0: city(row.id), c1: row.temperature, c2: row.precipitation }));
      chartLabels = selected.map(row => city(row.id));
      datasets = [{ label: labels.temperature, data: selected.map(row => row.temperature) }];
    } else {
      columns = [{ key: 'c0', label: labels.category }, { key: 'c1', label: labels.amount }];
      rows = (['lodging', 'meals', 'transit', 'activities', 'total', 'remaining'] as const).map(key => ({ c0: labels[key], c1: totals[key] }));
      chartLabels = [labels.lodging, labels.meals, labels.transit, labels.activities];
      datasets = [{ label: labels.amount, data: [totals.lodging, totals.meals, totals.transit, totals.activities] }];
    }
    const root: LyraGenNode = { id: 'dashboard', type: 'stack', children: [
      { id: 'title', type: 'heading', text: title },
      { id: 'records', type: 'table', props: { caption: title, columns, rows } },
      { id: 'comparison', type: 'chart', props: { label: title, type: scenario === 'markets' ? 'line' : 'bar', labels: chartLabels, datasets, withDataTable: true, withLegend: true } },
    ] };
    const markup = (node: LyraGenNode) => {
      const emitted = emitMarkup({ version: '1', surfaceId: `demo-${scenario}`, revision: 0,
        catalog: { id: initialCatalog.id, version: initialCatalog.version }, root: node }, initialCatalog);
      if (!emitted.ok) throw new TypeError('The authored demo must validate against the active catalog.');
      return emitted.value;
    };
    const summary = markup({ id: 'summary', type: 'text', text: scenario === 'travel-budget' ? `${reply} ${labels.rates}` : reply });
    const dashboard = markup(root);
    const split = Math.floor(dashboard.length / 2);
    const pieces = [`${reply}\n\n\`\`\`lyra\n`, summary, '\n```\n\n```lyra\n', dashboard.slice(0, split), dashboard.slice(split), '\n', '```\n'];
    const offsets = [0, 100, 260, 480, 700, 920, 1180];
    const recording: ReplayRecording = freeze({ version: '1', recordingKind: 'authored-synthetic', source: { kind: 'fixture', id: `guided-${scenario}-${refined ? 'refinement' : 'overview'}-v1` },
      model: null, package: { name: '@aceshooting/lyra-gen', version: options.packageVersion }, catalog: { id: initialCatalog.id, version: initialCatalog.version },
      format: 'chat', text: pieces.join(''), chunks: pieces.map((text, index) => ({ atMs: offsets[index]!, text })) });
    return { prompt, reply, question, recording };
  }

  let presentation = content();
  function snapshot(): GuidedDemoSnapshot {
    return freeze({ locale, direction, scenario, step, phase,
      status: validationMessage ?? labels[phase], labels, prompt: presentation.prompt, reply: presentation.reply,
      followUp: { id: followUps[scenario], question: presentation.question }, travel: { inputs: travel, totals: calculateTravelBudget(travel) },
      source: presentation.recording.text + extraSource, recording: presentation.recording, deliveredChunks, chat: chat.snapshot, chatStrings });
  }
  let current = snapshot();
  function publish() { current = snapshot(); options.onChange?.(current); }
  function abort() { generation++; active?.abort(); active = undefined; }
  function clear() {
    abort(); chat.dispose(); chat = makeChat(); deliveredChunks = 0; extraSource = ''; validationMessage = undefined;
    phase = 'idle'; presentation = content(); publish();
  }
  async function play(): Promise<boolean> {
    if (disposed) return false;
    abort(); chat.dispose(); chat = makeChat(); deliveredChunks = 0; extraSource = ''; validationMessage = undefined;
    presentation = content(); phase = 'playing';
    const token = generation;
    const pending = new AbortController(); active = pending;
    publish();
    if (disposed || token !== generation) return false;
    const replayed = await replayRecordedChunks(presentation.recording, (chunk, index) => {
      if (disposed || token !== generation) return;
      chat.push(chunk.text); deliveredChunks = index + 1; publish();
    }, { signal: pending.signal });
    if (disposed || token !== generation) return false;
    active = undefined;
    chat.finish(); phase = replayed.ok && replayed.value.status === 'completed' && chat.snapshot.diagnostics.length === 0 ? 'complete' : 'error';
    publish(); return phase === 'complete';
  }
  async function next(): Promise<boolean> {
    if (disposed || step === 2 || active) return false;
    if (step === 0) step = 1;
    else {
      if (scenario === 'travel-budget') {
        if (travel.nights === 30) { validationMessage = labels.invalidTravel; publish(); return false; }
        baselineTravel = travel; travel = freeze({ ...travel, nights: travel.nights + 1 });
      }
      step = 2;
    }
    return play();
  }
  function unsupported(): false { validationMessage = undefined; phase = 'unsupported'; publish(); return false; }
  async function followUp(choice: GuidedDemoFollowUp): Promise<boolean> {
    if (disposed || active) return false;
    if (choice !== followUps[scenario] || step !== 1) return unsupported();
    return next();
  }
  return {
    get snapshot() { return current; },
    next,
    async back(): Promise<boolean> {
      if (disposed || step === 0) return false;
      if (step === 2) { step = 1; if (scenario === 'travel-budget') travel = baselineTravel; return play(); }
      step = 0; clear(); return true;
    },
    selectScenario(id: GuidedDemoScenario | string): boolean {
      if (disposed || !guidedDemoScenarios.includes(id as GuidedDemoScenario)) return false;
      scenario = id as GuidedDemoScenario; step = 0; travel = defaultTravel; baselineTravel = defaultTravel; clear(); return true;
    },
    replay(): Promise<boolean> { if (disposed) return Promise.resolve(false); if (step === 0) step = 1; return play(); },
    followUp,
    submitFollowUp(question: string): Promise<boolean> {
      if (disposed || active) return Promise.resolve(false);
      return question === presentation.question ? followUp(followUps[scenario]) : Promise.resolve(unsupported());
    },
    async editTravel(patch: Partial<TravelInputs>): Promise<boolean> {
      if (disposed || scenario !== 'travel-budget') return false;
      const edited = { ...travel, ...patch };
      try { calculateTravelBudget(edited); } catch { validationMessage = labels.invalidTravel; publish(); return false; }
      travel = freeze({ nights: edited.nights, travelers: edited.travelers, budget: edited.budget });
      if (step === 0) { presentation = content(); validationMessage = undefined; publish(); return true; }
      return play();
    },
    cancel() {
      if (disposed || !active) return;
      abort(); chat.cancel(); validationMessage = undefined; phase = 'cancelled'; publish();
    },
    fail() {
      if (disposed || phase !== 'complete') return;
      abort(); chat.retry(); extraSource = '\n```lyra\n<unknown-role id="rejected"/>\n```\n';
      chat.push(extraSource); chat.finish(); phase = 'error'; validationMessage = undefined; publish();
    },
    dispose() { if (disposed) return; abort(); disposed = true; chat.dispose(); },
  };
}
