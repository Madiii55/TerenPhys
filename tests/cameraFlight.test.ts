import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CameraFlight, smoothRange, type CameraView } from '../src/graphics/cameraFlight.ts';
import { cosmicVisibility, GALAXY_SCALE, GALAXY_SHAPE, HOME_DISTANCE, ORBIT_DURATION, ZOOM_DURATION } from '../src/graphics/cosmicScale.ts';

const home: CameraView = { distance: HOME_DISTANCE, polar: 1.42, azimuth: 0.16, panX: 0.205, panY: 0.015 };
const galaxy: CameraView = { distance: 89 * GALAXY_SCALE, polar: 0.94, azimuth: -1.65, panX: 0, panY: 0 };
const keys = ['distance', 'polar', 'azimuth', 'panX', 'panY'] as const;
const near = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('zoom is monotonic, finite and finishes exactly in both directions', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    let previous = from.distance;
    for (let time = 0; time <= ZOOM_DURATION; time += 0.004) {
      const current = flight.read(time);
      keys.forEach(key => assert.ok(Number.isFinite(current[key])));
      assert.ok((current.distance - previous) * Math.sign(to.distance - from.distance) >= -1e-8);
      previous = current.distance;
    }
    keys.forEach(key => near(flight.read(ZOOM_DURATION)[key], to[key]));
  }
});

test('only the middle of the logarithmic zoom is fast, endpoints are at rest', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  const speed = (time: number) => flight.logDistanceSpeed(time);
  assert.ok(speed(ZOOM_DURATION / 2) > speed(ZOOM_DURATION * 0.1) * 6);
  assert.ok(speed(ZOOM_DURATION / 2) > speed(ZOOM_DURATION * 0.9) * 6);
  near(speed(0), 0);
  near(speed(ZOOM_DURATION), 0);
});

test('interrupting and reversing a flight preserves position and velocity', () => {
  for (const time of [0.12, 0.45, 0.8, 1.3]) {
    const flight = new CameraFlight(home);
    flight.retarget(galaxy, 0, ZOOM_DURATION);
    const epsilon = 0.000001;
    const before = flight.read(time - epsilon);
    const at = flight.read(time);
    flight.retarget(home, time, ZOOM_DURATION);
    const after = flight.read(time + epsilon);
    keys.forEach(key => {
      near(flight.read(time)[key], at[key]);
      const value = (view: CameraView) => key === 'distance' ? Math.log(view.distance) : view[key];
      const velocityBefore = (value(at) - value(before)) / epsilon;
      const velocityAfter = (value(after) - value(at)) / epsilon;
      near(velocityBefore, velocityAfter, 0.003);
    });
    near(flight.read(time + ZOOM_DURATION).distance, home.distance);
  }
});

test('orbital motion takes the shortest route across the angle seam', () => {
  const flight = new CameraFlight({ ...galaxy, azimuth: 3.08 });
  flight.retarget({ ...galaxy, azimuth: -3.08 }, 0, ORBIT_DURATION);
  near(flight.read(ORBIT_DURATION / 2).azimuth, Math.PI);
});

test('reduced motion switches instantly and repeated retargeting remains finite', () => {
  const flight = new CameraFlight(home);
  for (let time = 0; time < 6; time += 0.06) {
    flight.retarget(Math.floor(time / 0.06) % 2 ? home : galaxy, time, ZOOM_DURATION);
    const current = flight.read(time + 0.06);
    keys.forEach(key => assert.ok(Number.isFinite(current[key])));
    assert.ok(current.distance > HOME_DISTANCE * 0.7 && current.distance < galaxy.distance * 3);
  }
  flight.retarget(home, 7, 0);
  keys.forEach(key => near(flight.read(7)[key], home[key]));
});

test('the elongated galaxy stays much larger than the unchanged near-hole scale', () => {
  assert.ok(GALAXY_SHAPE.x / GALAXY_SHAPE.z > 1.35);
  assert.equal(GALAXY_SHAPE.y, 1);
  assert.ok(galaxy.distance / home.distance > 25000);
  assert.ok(13.6 / (120 * GALAXY_SCALE) < 0.0001);
});

test('the cubic middle traverses thousands of times the distance in a short flight', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  const ratio = flight.read(ZOOM_DURATION * 0.75).distance / flight.read(ZOOM_DURATION * 0.25).distance;
  assert.ok(ratio > 7000);
  assert.ok(ZOOM_DURATION <= 1.6);
});

test('model handover takes under 120 ms, deep inside the nucleus, in both directions', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    const samples: number[] = [];
    for (let time = 0; time <= ZOOM_DURATION; time += 0.001) {
      const current = flight.read(time);
      const visibility = cosmicVisibility(current.distance);
      if (visibility.detail > 0.001 && visibility.detail < 0.999) {
        samples.push(time);
        near(visibility.disk, 0);
        near(visibility.cluster, 0);
        assert.ok(Math.abs(flight.logDistanceSpeed(time)) > 10);
      }
    }
    assert.ok(samples.length > 0);
    assert.ok(samples.at(-1)! - samples[0] < 0.12);
  }
  near(cosmicVisibility(home.distance).detail, 1);
  near(cosmicVisibility(galaxy.distance).detail, 0);
  near(cosmicVisibility(galaxy.distance).disk, 1);
  near(cosmicVisibility(galaxy.distance).cluster, 1);
});

test('an interrupted deep zoom brakes smoothly without huge scale overshoots', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    const changedAt = ZOOM_DURATION / 2;
    flight.retarget(from, changedAt, ZOOM_DURATION);
    for (let time = changedAt; time <= changedAt + ZOOM_DURATION; time += 0.001) {
      const current = flight.read(time);
      assert.ok(current.distance > HOME_DISTANCE * 0.7 && current.distance < galaxy.distance * 3);
    }
    const join = changedAt + 0.09;
    near(flight.logDistanceSpeed(join - 0.000001), 0, 0.00001);
    near(flight.logDistanceSpeed(join + 0.000001), 0, 0.00001);
    near(flight.read(changedAt + ZOOM_DURATION).distance, from.distance);
  }
});

test('detail crossfade is bounded and has smooth endpoints', () => {
  near(smoothRange(23, 24, 49), 0);
  near(smoothRange(50, 24, 49), 1);
  let previous = 0;
  for (let d = 24; d <= 49; d += 0.01) {
    const opacity = smoothRange(d, 24, 49);
    assert.ok(opacity >= previous && opacity >= 0 && opacity <= 1);
    previous = opacity;
  }
});

test('cubic zoom has one symmetric velocity peak without a pause in its middle', () => {
  for (const [from, to] of [[home, galaxy], [galaxy, home]]) {
    const flight = new CameraFlight(from);
    flight.retarget(to, 0, ZOOM_DURATION);
    let previous = 0;
    for (let fraction = 0; fraction <= 0.5; fraction += 0.002) {
      const speed = Math.abs(flight.logDistanceSpeed(fraction * ZOOM_DURATION));
      assert.ok(speed >= previous - 1e-9);
      near(speed, Math.abs(flight.logDistanceSpeed((1 - fraction) * ZOOM_DURATION)));
      previous = speed;
    }
    const range = Math.log(to.distance) - Math.log(from.distance);
    near(flight.logDistanceSpeed(ZOOM_DURATION / 2), range * 3 / ZOOM_DURATION);
    near((Math.log(flight.read(ZOOM_DURATION / 4).distance) - Math.log(from.distance)) / range, 0.0625);
    near((Math.log(flight.read(ZOOM_DURATION * 3 / 4).distance) - Math.log(from.distance)) / range, 0.9375);
  }
});

test('content completion is available only after the actual camera flight ends', () => {
  const flight = new CameraFlight(home);
  assert.ok(flight.isSettled(0));
  flight.retarget(galaxy, 0.4, ZOOM_DURATION);
  assert.equal(flight.isSettled(0.4), false);
  assert.equal(flight.isSettled(0.4 + ZOOM_DURATION - 0.000001), false);
  assert.ok(flight.isSettled(0.4 + ZOOM_DURATION));
  flight.retarget(home, 3, 0);
  assert.ok(flight.isSettled(3));
});

test('an interrupted flight cannot reveal content using the old completion time', () => {
  const flight = new CameraFlight(home);
  flight.retarget(galaxy, 0, ZOOM_DURATION);
  flight.retarget(home, 0.9, ZOOM_DURATION);
  assert.equal(flight.isSettled(ZOOM_DURATION), false);
  assert.ok(flight.isSettled(0.9 + ZOOM_DURATION));
});
