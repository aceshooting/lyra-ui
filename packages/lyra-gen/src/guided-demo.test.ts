import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedDemo, calculateTravelBudget, guidedDemoLocales, guidedDemoScenarios, marketSamples, weatherSamples } from '../examples/guided-demo.js';
import { createChatStream } from './chat.js';
import { initialCatalog } from './catalog.js';
import { parseReplayRecording } from './replay.js';

const options = { packageVersion: '1.0.0' };

test('travel calculations use declared rates, all edited inputs and bounded finite values', () => {
  assert.deepEqual(calculateTravelBudget({ nights: 4, travelers: 2, budget: 1200 }), {
    days: 5, lodging: 380, meals: 280, transit: 80, activities: 90, total: 830, remaining: 370,
  });
  assert.equal(calculateTravelBudget({ nights: 5, travelers: 2, budget: 1200 }).total, 997);
  assert.equal(calculateTravelBudget({ nights: 4, travelers: 2, budget: 1200.25 }).remaining, 370.25);
  assert.equal(calculateTravelBudget({ nights: 4, travelers: 2, budget: 19.99 }).remaining, -810.01);
  assert.deepEqual(calculateTravelBudget({ nights: 2, travelers: 3, budget: 500 }), {
    days: 3, lodging: 190, meals: 252, transit: 72, activities: 135, total: 649, remaining: -149,
  });
  for (const patch of [{ nights: 0 }, { nights: 31 }, { nights: 1.5 }, { travelers: 0 }, { travelers: 9 }, { budget: -1 }, { budget: Infinity }, { budget: Number.NaN }, { budget: 1200.005 }]) {
    assert.throws(() => calculateTravelBudget({ nights: 4, travelers: 2, budget: 1200, ...patch }), RangeError);
  }
});

test('each localized scenario and refinement has admitted original synthetic chunks and numeric data', async () => {
  assert.deepEqual(marketSamples.map(row => row.values), [[101.2, 102.1, 103.4], [100.8, 100.1, 101.6], [99.7, 100.5, 100.9]]);
  assert.deepEqual(weatherSamples.map(row => [row.temperature, row.precipitation]), [[18, 20], [23, 5], [12, 60]]);
  await Promise.all(guidedDemoLocales.flatMap(locale => guidedDemoScenarios.map(async scenario => {
    const demo = createGuidedDemo({ ...options, locale });
    demo.selectScenario(scenario);
    for (const step of [1, 2]) {
      await demo.next();
      const snapshot = demo.snapshot;
      assert.equal(snapshot.step, step);
      assert.equal(snapshot.phase, 'complete');
      assert.equal(snapshot.direction, locale === 'ar' ? 'rtl' : 'ltr');
      assert.ok(snapshot.labels.simulatedData.length > 0 && snapshot.labels.authoredReply.length > 0);
      assert.equal(parseReplayRecording(snapshot.recording).ok, true);
      assert.equal(snapshot.recording.model, null);
      assert.equal(snapshot.recording.recordingKind, 'authored-synthetic');
      assert.deepEqual(snapshot.recording.chunks.map(chunk => chunk.atMs), [0, 100, 260, 480, 700, 920, 1180]);
      assert.equal(snapshot.recording.chunks.map(chunk => chunk.text).join(''), snapshot.source);
      const chat = createChatStream({ catalog: initialCatalog, messageId: 'oracle', surfaceId: 'oracle', strings: snapshot.chatStrings });
      for (const chunk of snapshot.recording.chunks) chat.push(chunk.text);
      const admitted = chat.finish();
      assert.equal(admitted.diagnostics.length, 0);
      assert.deepEqual(admitted.islands.map(island => island.status), ['ready', 'ready']);
      const root = admitted.islands[1]?.document?.root;
      assert.deepEqual(root?.children?.map(node => node.type), ['heading', 'table', 'chart']);
      assert.deepEqual(root, snapshot.chat.islands[1]?.document?.root);
      const table = root?.children?.[1];
      const chart = root?.children?.[2];
      const rows = table?.props?.['rows'] as readonly { readonly c1: number; readonly c2?: number }[];
      const datasets = chart?.props?.['datasets'] as readonly { readonly data: readonly number[] }[];
      if (scenario === 'markets') {
        assert.deepEqual(rows.map(row => row.c1), step === 1 ? [103.4, 101.6, 100.9] : [103.4]);
        assert.deepEqual(datasets.map(dataset => dataset.data), step === 1 ? marketSamples.map(row => row.values) : [[101.2, 102.1, 103.4]]);
      } else if (scenario === 'weather') {
        assert.deepEqual(rows.map(row => [row.c1, row.c2]), step === 1 ? [[18, 20], [23, 5], [12, 60]] : [[18, 20], [23, 5]]);
      } else {
        assert.deepEqual(rows.map(row => row.c1), step === 1 ? [380, 280, 80, 90, 830, 370] : [475, 336, 96, 90, 997, 203]);
      }
      chat.dispose();
    }
    demo.dispose();
  })));
});

test('scenario and step controls are bounded and unsupported questions retain the accepted answer', async () => {
  const demo = createGuidedDemo(options);
  await demo.back();
  assert.equal(demo.snapshot.step, 0);
  await demo.next();
  const accepted = demo.snapshot.chat;
  assert.equal(await demo.submitFollowUp('Invent a response to an unrelated question'), false);
  assert.equal(demo.snapshot.phase, 'unsupported');
  assert.equal(demo.snapshot.chat, accepted);
  assert.equal(await demo.followUp('dry-cities'), false);
  assert.equal(await demo.submitFollowUp(demo.snapshot.followUp.question), true);
  assert.equal(demo.snapshot.step, 2);
  const source = demo.snapshot.source;
  await demo.next();
  assert.equal(demo.snapshot.source, source);
  await demo.back();
  assert.equal(demo.snapshot.step, 1);
  await demo.back();
  assert.equal(demo.snapshot.step, 0);
  assert.equal(demo.snapshot.chat.parts.length, 0);
  assert.equal(demo.selectScenario('unknown'), false);
  assert.equal(demo.selectScenario('weather'), true);
  assert.equal(demo.snapshot.scenario, 'weather');
  demo.dispose();
});

test('travel refinement, replay and edits compute real values without replay compounding', async () => {
  const demo = createGuidedDemo(options);
  demo.selectScenario('travel-budget');
  await demo.next();
  await demo.next();
  assert.equal(demo.snapshot.travel.inputs.nights, 5);
  assert.equal(demo.snapshot.travel.totals.total, 997);
  const original = demo.snapshot.source;
  await demo.replay();
  assert.equal(demo.snapshot.source, original);
  assert.equal(demo.snapshot.travel.inputs.nights, 5);
  assert.equal(await demo.editTravel({ nights: 2, travelers: 3, budget: 500 }), true);
  assert.equal(demo.snapshot.travel.totals.total, 649);
  assert.equal(demo.snapshot.travel.totals.remaining, -149);
  assert.ok(demo.snapshot.source.includes('649'));
  assert.ok(demo.snapshot.source.includes('-149'));
  assert.ok(demo.snapshot.prompt.includes('2 nights, 3 travelers'));
  const edited = demo.snapshot.source;
  assert.equal(await demo.editTravel({ nights: Number.NaN }), false);
  assert.equal(demo.snapshot.source, edited);
  await demo.replay();
  assert.equal(demo.snapshot.source, edited);
  await demo.back();
  assert.equal(demo.snapshot.travel.inputs.nights, 4);
  assert.equal(demo.snapshot.travel.totals.total, 830);
  demo.selectScenario('travel-budget');
  assert.equal(demo.snapshot.step, 0);
  assert.equal(demo.snapshot.travel.totals.total, 830);
  demo.dispose();
});

test('input ownership and maximum-night refusal preserve accepted values', async () => {
  const demo = createGuidedDemo(options);
  demo.selectScenario('travel-budget');
  const patch = { nights: 30 };
  assert.equal(await demo.editTravel(patch), true);
  patch.nights = 2;
  assert.equal(demo.snapshot.travel.inputs.nights, 30);
  assert.throws(() => { (demo.snapshot.travel.inputs as { nights: number }).nights = 2; }, TypeError);
  await demo.next();
  const source = demo.snapshot.source;
  assert.equal(await demo.next(), false);
  assert.equal(demo.snapshot.step, 1);
  assert.equal(demo.snapshot.travel.inputs.nights, 30);
  assert.equal(demo.snapshot.source, source);
  assert.equal(demo.snapshot.status, demo.snapshot.labels.invalidTravel);
  demo.dispose();
});

test('cancellation preserves closed islands and stale delivery cannot update another scenario', async () => {
  let demo: ReturnType<typeof createGuidedDemo>;
  const updates: string[] = [];
  demo = createGuidedDemo({ ...options, onChange: snapshot => {
    updates.push(`${snapshot.scenario}:${snapshot.phase}`);
    if (snapshot.phase === 'playing' && snapshot.deliveredChunks === 3) demo.cancel();
  } });
  await demo.next();
  assert.equal(demo.snapshot.phase, 'cancelled');
  assert.equal(demo.snapshot.chat.islands[0]?.status, 'ready');
  assert.equal(demo.snapshot.deliveredChunks, 3);
  const pending = demo.replay();
  demo.selectScenario('weather');
  const count = updates.length;
  await pending;
  assert.equal(updates.length, count);
  assert.equal(demo.snapshot.scenario, 'weather');
  assert.equal(demo.snapshot.phase, 'idle');
  assert.equal(demo.snapshot.chat.parts.length, 0);
  const playing = demo.next();
  demo.dispose();
  const disposedCount = updates.length;
  await playing;
  assert.equal(updates.length, disposedCount);
  assert.equal(await demo.next(), false);
});

test('an invalid tail is rejected and replay recovers the same accepted dashboard', async () => {
  const demo = createGuidedDemo(options);
  await demo.next();
  const admitted = demo.snapshot.chat.islands.map(island => island.document);
  demo.fail();
  assert.equal(demo.snapshot.phase, 'error');
  assert.deepEqual(demo.snapshot.chat.islands.slice(0, 2).map(island => island.document), admitted);
  assert.equal(demo.snapshot.chat.islands.at(-1)?.status, 'error');
  assert.ok(demo.snapshot.chat.diagnostics.length > 0);
  await demo.replay();
  assert.equal(demo.snapshot.phase, 'complete');
  assert.deepEqual(demo.snapshot.chat.islands.map(island => island.document), admitted);
  demo.dispose();
});
