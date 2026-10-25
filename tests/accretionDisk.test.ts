import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCRETION_DISK, ACCRETION_STEPS, accretionMatterPhase, accretionOrbitalRate, accretionTransmission } from '../src/graphics/accretionDisk.ts';
import { blackHoleFragment } from '../src/graphics/cosmicShaders.ts';

const near = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('accretion stays thin and compact while retaining volume and a small tilt', () => {
  near(ACCRETION_DISK.inner, 3 * ACCRETION_DISK.horizon);
  assert.ok(ACCRETION_DISK.outer > ACCRETION_DISK.inner);
  assert.ok(ACCRETION_DISK.innerThickness > 0);
  assert.ok(ACCRETION_DISK.outerThickness > ACCRETION_DISK.innerThickness);
  assert.ok(ACCRETION_DISK.innerThickness / ACCRETION_DISK.inner < 0.06);
  assert.ok(ACCRETION_DISK.outerThickness / ACCRETION_DISK.outer < 0.05);
  assert.ok(ACCRETION_DISK.outer / ACCRETION_DISK.inner < 3.2);
  for (const angle of [ACCRETION_DISK.tiltX, ACCRETION_DISK.tiltZ]) {
    assert.ok(Math.abs(angle) > 0 && Math.abs(angle) <= Math.PI / 18);
  }
});

test('orbital speed is bounded, differential, and independent of material age', () => {
  const innerSpeed = accretionOrbitalRate(ACCRETION_DISK.inner);
  assert.ok(innerSpeed > 0.5 && innerSpeed < 1.5);
  near(accretionOrbitalRate(ACCRETION_DISK.inner * 4), innerSpeed / 8);
  near(accretionOrbitalRate(0), innerSpeed);
  let previous = Infinity;
  for (let radius = ACCRETION_DISK.inner; radius <= ACCRETION_DISK.outer; radius += 0.01) {
    const speed = accretionOrbitalRate(radius);
    assert.ok(Number.isFinite(speed) && speed > 0 && speed <= previous);
    previous = speed;
  }
});

test('large clouds have low density and softened emission in both renderers', () => {
  assert.ok(ACCRETION_DISK.largeClumpDensity > 0 && ACCRETION_DISK.largeClumpDensity < 0.5);
  assert.ok(ACCRETION_DISK.overlappingClumpDensity > 0 && ACCRETION_DISK.overlappingClumpDensity < 0.5);
  for (const steps of Object.values(ACCRETION_STEPS)) {
    const shader = blackHoleFragment(steps);
    assert.ok(shader.includes(`const float LARGE_CLUMP_DENSITY = ${ACCRETION_DISK.largeClumpDensity.toFixed(4)};`));
    assert.ok(shader.includes(`const float OVERLAPPING_CLUMP_DENSITY = ${ACCRETION_DISK.overlappingClumpDensity.toFixed(4)};`));
    assert.match(shader, /LARGE_CLUMP_DENSITY \* \(0\.18 \+ 0\.15 \* large\.y\)/);
    assert.match(shader, /OVERLAPPING_CLUMP_DENSITY \* \(0\.18 \+ 0\.15 \* overlapping\.y\)/);
  }
});

test('renewing clumps preserves value and velocity without a phase-reset pop', () => {
  const field = (time: number) => {
    const phase = accretionMatterPhase(time);
    const older = Math.sin(phase.olderAge * 0.7 + phase.olderSeed * 1.17);
    const younger = Math.sin(phase.youngerAge * 0.7 + phase.youngerSeed * 1.17);
    return older * (1 - phase.mix) + younger * phase.mix;
  };
  const epsilon = 0.000001;
  for (let cycle = 1; cycle < 30; cycle++) {
    const boundary = cycle * ACCRETION_DISK.clumpLifetime;
    near(field(boundary - epsilon), field(boundary + epsilon), 0.000003);
    near((field(boundary) - field(boundary - epsilon)) / epsilon,
      (field(boundary + epsilon) - field(boundary)) / epsilon, 0.00001);
  }
  for (const time of [0, 0.1, 10, 500, 1e6]) {
    const phase = accretionMatterPhase(time);
    assert.ok(phase.mix >= 0 && phase.mix <= 1);
    assert.ok(phase.youngerAge >= 0 && phase.youngerAge <= ACCRETION_DISK.clumpLifetime);
    near(phase.olderAge - phase.youngerAge, ACCRETION_DISK.clumpLifetime);
  }
});

test('opaque foreground matter extinguishes objects and rings behind it', () => {
  near(accretionTransmission(0, 4), 1);
  near(accretionTransmission(3, 0), 1);
  const dense = accretionTransmission(1, 1);
  assert.ok(dense < ACCRETION_DISK.minimumTransmission);
  assert.ok(dense * 4 < 0.002);
  assert.ok(accretionTransmission(0.02, 0.3) > 0.9);
});

test('attenuation composes through depth and is independent of step subdivision', () => {
  near(accretionTransmission(0.4, 1.2), accretionTransmission(0.4, 0.4) ** 3);
  assert.ok(accretionTransmission(0.6, 1) < accretionTransmission(0.3, 1));
  assert.ok(accretionTransmission(0.3, 2) < accretionTransmission(0.3, 1));
  assert.ok(accretionTransmission(1, 2) > 0);
});

test('desktop and mobile shaders integrate 3D clumps without an overlaid circle', () => {
  for (const steps of Object.values(ACCRETION_STEPS)) {
    const shader = blackHoleFragment(steps);
    assert.match(shader, /vec2 particleCloud\(vec3 p/);
    assert.match(shader, /uniform mat3 uDiskFrame/);
    assert.match(shader, /sampleAccretion\(uDiskFrame \* \(\(p \+ next\) \* 0\.5\)/);
    assert.match(shader, /light \+= transmission \* absorption \* source/);
    assert.match(shader, /transmission \*= 1\.0 - absorption/);
    assert.match(shader, /if \(!captured && !opaque && escaped\)/);
    assert.doesNotMatch(shader, /photonRing|diskHit|light = texture2D/);
  }
});
