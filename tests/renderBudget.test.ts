import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AdaptiveRenderBudget, CosmicFramePacer, cosmicRenderSize } from '../src/graphics/renderBudget.ts';
import { blackHoleFragment, galaxyFragment } from '../src/graphics/cosmicShaders.ts';
import { ACCRETION_DISK } from '../src/graphics/accretionDisk.ts';

test('render targets stay bounded on desktop, Retina, ultrawide and mobile screens', () => {
  for (const [width, height, dpr] of [[1242, 764, 2], [3840, 2160, 2], [5120, 1440, 2], [390, 844, 3], [1, 1, 1]]) {
    for (const mobile of [true, false]) {
      const size = cosmicRenderSize(width, height, dpr, 1, mobile);
      assert.ok(size.width >= 1 && size.height >= 1);
      assert.ok(size.width * size.height <= (mobile ? 650_000 : 1_150_000));
      assert.ok(width * height * size.outputRatio ** 2 <= 2_400_001);
      assert.ok(Math.abs(size.width / size.height - width / height) < 0.01);
    }
  }
});

test('adaptive resolution changes only the 3D targets, not the display canvas', () => {
  const high = cosmicRenderSize(1920, 1080, 2);
  const low = cosmicRenderSize(1920, 1080, 2, 0.55);
  assert.equal(high.outputRatio, low.outputRatio);
  assert.ok(low.width * low.height < high.width * high.height * 0.31);
});

test('sustained slow frames lower quality, isolated hiccups and flights do not', () => {
  const budget = new AdaptiveRenderBudget();
  for (let i = 0; i < 240; i++) budget.sample(16.67, true);
  assert.equal(budget.quality, 1);
  budget.sample(140, true);
  for (let i = 0; i < 240; i++) budget.sample(16.67, true);
  assert.equal(budget.quality, 1);
  for (let i = 0; i < 600; i++) budget.sample(40, false);
  assert.equal(budget.quality, 1);
  for (let i = 0; i < 180; i++) budget.sample(35, true);
  assert.ok(budget.quality < 1 && budget.quality >= 0.55);
});

test('quality has a floor and recovers slowly without ping-ponging every frame', () => {
  const budget = new AdaptiveRenderBudget();
  for (let i = 0; i < 3000; i++) budget.sample(40, true);
  assert.equal(budget.quality, 0.55);
  for (let i = 0; i < 300; i++) budget.sample(16.67, true);
  assert.equal(budget.quality, 0.55);
  for (let i = 0; i < 6000; i++) budget.sample(16.67, true);
  assert.ok(budget.quality > 0.55 && budget.quality <= 1);
  const current = budget.quality;
  budget.reset();
  for (const invalid of [0, -1, NaN, Infinity, 5000]) budget.sample(invalid, true);
  assert.equal(budget.quality, current);
});

test('frame pacing reaches 60 FPS on 60/120/144 Hz displays including RAF jitter', () => {
  for (const refreshRate of [60, 120, 144]) {
    const pacer = new CosmicFramePacer();
    let frames = 0;
    for (let i = 0; i < refreshRate * 10; i++) {
      const jitter = i % 2 ? -0.2 : 0.2;
      if (pacer.due(i * 1000 / refreshRate + jitter)) frames++;
    }
    assert.ok(frames >= 598 && frames <= 602, `${refreshRate} Hz: ${frames} frames`);
  }
});

test('hidden-tab resume does not burst through missed frames', () => {
  const pacer = new CosmicFramePacer();
  assert.equal(pacer.due(0), true);
  assert.equal(pacer.due(30000), true);
  assert.equal(pacer.due(30001), false);
  pacer.reset();
  assert.equal(pacer.due(30001), true);
});

test('empty-space bounds include the whole thin warped accretion disk', () => {
  const bound = ACCRETION_DISK.outerThickness * 2.5 + 0.071;
  assert.ok(bound > ACCRETION_DISK.outerThickness * 2.5 + 0.045 + 0.025);
  for (const steps of [144, 192]) {
    assert.ok(blackHoleFragment(steps).includes(`if (abs(p.y) > ${bound.toFixed(4)}) return;`));
  }
  const galaxy = galaxyFragment(48);
  assert.ok(galaxy.indexOf('if (vertical < 0.001) continue;') < galaxy.indexOf('texture2D(uDiskPhoto'));
});
